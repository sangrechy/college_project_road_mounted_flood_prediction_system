const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const socketIo = require('socket.io');
const dgram = require('dgram');
const os = require('os');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const HTTP_PORT = 3000;
const UDP_PORT = 4210;

app.use(express.static(__dirname));
app.use(bodyParser.json());

// --- 1. DATABASE SETUP ---
const USER_CSV = 'user_alerts.csv';
const SENSOR_CSV = 'sensor_alerts.csv';

// Ensure CSV files exist
function initCSV(file, headers) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, headers + '\n');
    }
}
initCSV(USER_CSV, 'Alert_ID,Timestamp,User,Type,Lat,Lon,Status');
initCSV(SENSOR_CSV, 'Log_ID,Timestamp,Node_ID,Critical_Sensors,Rain_Val,Duration_ms');

function logUserAlert(id, user, type, lat, lon, status) {
    const row = `${id},${new Date().toISOString()},${user},${type},${lat},${lon},${status}\n`;
    fs.appendFileSync(USER_CSV, row);
}

function logSensorAlert(nodeId, sensors, rain, duration) {
    const id = "LOG_" + Date.now();
    const row = `${id},${new Date().toISOString()},${nodeId},"${sensors}",${rain},${duration}\n`;
    fs.appendFileSync(SENSOR_CSV, row);
}

// --- NEW: CLEANUP PREVIOUS SESSIONS ---
function expireStaleAlerts() {
    if (fs.existsSync(USER_CSV)) {
        const content = fs.readFileSync(USER_CSV, 'utf8');
        const lines = content.trim().split('\n');
        const statusMap = {};

        // 1. Map the latest status for every ID
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length >= 7) {
                statusMap[parts[0]] = parts[6].trim();
            }
        }

        // 2. If any ID is still 'ACTIVE', force it to 'EXPIRED'
        for (const [id, status] of Object.entries(statusMap)) {
            if (status === 'ACTIVE') {
                console.log(`⚠️  Previous session alert [${id}] found. Marking as EXPIRED.`);
                logUserAlert(id, "SYSTEM", "SESSION_RESET", 0, 0, "EXPIRED");
            }
        }
    }
}

// --- STATE TRACKING ---
let nodes = {}; 
let nodeStatus = {}; 
let activeAlert = null; 
let sosCounter = 0;
let sensorTimers = {}; 

// --- HELPERS ---
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return '0.0.0.0';
}
const MY_IP = getLocalIP();

function getTimeStr() {
    return new Date().toLocaleTimeString('en-US', { hour12: true }).toLowerCase();
}

// --- UDP DISCOVERY ---
function startUDPBeacon() {
    const socket = dgram.createSocket('udp4');
    socket.bind(() => {
        socket.setBroadcast(true);
        setInterval(() => {
            const message = Buffer.from(`FLOOD_SERVER|${MY_IP}`);
            socket.send(message, 0, message.length, UDP_PORT, '255.255.255.255', (err) => {});
        }, 1500); 
    });
}

// --- API: RECEIVE DATA ---
app.post('/api/data', (req, res) => {
    const { id, s1, s2, s3, rain } = req.body;
    if (!id) return res.status(400).json({ status: "error", msg: "No ID" });

    // 1. Connection Log
    if (!nodes[id] || nodeStatus[id] === 'offline') {
        console.log(`🟢 [CONNECTED] ${id} came online.`);
        console.log(`   👉 API Link: http://${MY_IP}:${HTTP_PORT}/api/view/${id}`);
        nodeStatus[id] = 'online';
    }

    // 2. Parse Values
    const val1 = parseFloat(s1);
    const val2 = parseFloat(s2);
    const val3 = parseFloat(s3);
    const rainVal = parseInt(rain);

    // 3. Check Thresholds 
    // ** LOGIC UPDATE: Only trigger flood if value is > 45 AND < 200 (Ignore Recalibrate Errors) **
    const isFlood = (
        (val1 > 45 && val1 < 200) || 
        (val2 > 45 && val2 < 200) || 
        (val3 > 45 && val3 < 200)
    );
    const isHeavyRain = (rainVal < 1500); // Low value = Wet

    if (isFlood || isHeavyRain) {
        // Condition is Critical
        if (!sensorTimers[id]) {
            sensorTimers[id] = { startTime: Date.now(), logged: false };
        } else {
            const duration = Date.now() - sensorTimers[id].startTime;

            if (duration > 3000 && !sensorTimers[id].logged) {
                let reasons = [];
                if (val1 > 45 && val1 < 200) reasons.push(`S1:${val1}`);
                if (val2 > 45 && val2 < 200) reasons.push(`S2:${val2}`);
                if (val3 > 45 && val3 < 200) reasons.push(`S3:${val3}`);
                if (isHeavyRain) reasons.push(`RAIN:${rainVal}`);
                
                console.log(`⚠️  [SENSOR ALERT] ${id} Critical for 3s! Writing to CSV...`);
                console.log(`    Cause: ${reasons.join(', ')}`);
                
                logSensorAlert(id, reasons.join('|'), rainVal, duration);
                sensorTimers[id].logged = true; 
            }
        }
    } else {
        // Condition is Normal - Reset Timer
        if (sensorTimers[id]) {
            delete sensorTimers[id];
        }
    }

    // 4. Update Node State
    nodes[id] = { id, s1: val1, s2: val2, s3: val3, rain: rainVal, lastSeen: Date.now() };
    
    // Send to Frontend immediately
    io.emit('node-update', nodes[id]);

    res.json({ server_status: "active", msg: "Packet Received" });
});

// --- API: SOS BUTTON ---
app.post('/api/sos', (req, res) => {
    const { user, latitude, longitude, type } = req.body;
    
    const alertId = "ALERT_" + Date.now();
    sosCounter++; 

    console.log("========================================");
    console.log(`------------------${getTimeStr()}------------------`);
    console.log("🚨 EMERGENCY ALERT RECEIVED 🚨");
    console.log(`NUMBER:${sosCounter}`);
    console.log(`🔴 ALERT ${alertId}`);
    console.log(`User: ${user}`);
    console.log(`Location: ${latitude}, ${longitude}`);
    console.log(`Type: ${type}`);
    console.log("========================================");

    logUserAlert(alertId, user, type, latitude, longitude, "ACTIVE");
    activeAlert = { id: alertId, user, lat: latitude, lon: longitude, type, time: Date.now() };

    io.emit('sos-active', activeAlert);
    res.json({ status: "SOS_RECEIVED", alertId: alertId });
});

// --- API: CLEAR SOS ---
app.post('/api/sos/clear', (req, res) => {
    if (activeAlert) {
        console.log(`🟢 ALERT ${activeAlert.id} RESOLVED`);
        logUserAlert(activeAlert.id, "ADMIN", "RESOLVE_ACTION", 0, 0, "RESOLVED");
        activeAlert = null;
        io.emit('sos-cleared');
    }
    res.json({ status: "CLEARED" });
});

// --- API: HISTORY ---
app.get('/api/history', (req, res) => {
    const fileContent = fs.readFileSync(USER_CSV, 'utf8');
    const lines = fileContent.trim().split('\n');
    const history = [];
    const resolutionMap = {}; 

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts[6]) {
            const status = parts[6].trim();
            if (status === 'RESOLVED' || status === 'EXPIRED') {
                resolutionMap[parts[0]] = status;
            }
        }
    }

    for (let i = 1; i < lines.length; i++) {
        const [id, time, user, type, lat, lon, status] = lines[i].split(',');
        if (status && status.trim() === 'ACTIVE') {
            const finalStatus = resolutionMap[id] ? resolutionMap[id] : 'ACTIVE';
            history.push({
                id, time, user, type, lat, lon,
                status: finalStatus
            });
        }
    }
    res.json(history.reverse());
});

app.get('/api/all', (req, res) => {
    let response = { ...nodes };
    if (activeAlert) response["SERVER_ALERT"] = activeAlert;
    res.json(response);
});

// --- WATCHDOG ---
setInterval(() => {
    const now = Date.now();
    for (const id in nodes) {
        if (now - nodes[id].lastSeen > 3000) { 
            if (nodeStatus[id] !== 'offline') {
                console.log(`🔴 [DISCONNECTED] ${id} went offline!`);
                nodeStatus[id] = 'offline';
                io.emit('node-offline', id);
            }
        }
    }
}, 500);

// --- STARTUP ---
server.listen(HTTP_PORT, () => {
    expireStaleAlerts();
    const userPath = path.resolve(USER_CSV);
    const sensorPath = path.resolve(SENSOR_CSV);

    console.log(`==================================================`);
    console.log(`⚡ FLOOD SERVER PROFESSIONAL | v2.2 (Refined Logic)`);
    console.log(`==================================================`);
    console.log(`🏠 Dashboard:   http://${MY_IP}:${HTTP_PORT}`);
    console.log(`🔗 Global API:  http://${MY_IP}:${HTTP_PORT}/api/all`);
    console.log(`📡 UDP Beacon:  Active on Port ${UDP_PORT}`);
    console.log(`💾 Logging to:`); 
    console.log(`   1. ${USER_CSV}`);
    console.log(`   2. ${SENSOR_CSV} (Pending > 3s)`);
    console.log(`   Path: ${userPath}`);
    console.log(`==================================================`);
    startUDPBeacon();
});

io.on('connection', (socket) => {
    const fullState = { ...nodes };
    if (activeAlert) fullState["SERVER_ALERT"] = activeAlert;
    socket.emit('init', fullState);
});