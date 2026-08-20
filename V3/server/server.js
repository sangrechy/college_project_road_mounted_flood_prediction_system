const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const dgram = require('dgram');
const os = require('os');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); 

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const HTTP_PORT = 3000;
const UDP_PORT = 4210;

app.use(express.static(__dirname));
app.use(express.json());

// --- 1. CONFIG & STATE ---
const NODE_CONFIG = {
    "NODE_01": { lat: 12.9716, lon: 77.5946 }, 
    "NODE_02": { lat: 12.9750, lon: 77.5920 }, 
    "NODE_03": { lat: 12.9680, lon: 77.5980 }, 
    "NODE_04": { lat: 12.9700, lon: 77.5900 }  
};

let nodes = {}; 
let nodeStatus = {}; 
let activeAlert = null; 
let sosCounter = 0;
let sensorTimers = {}; 

// 👇 NEW: Toggle to mute alarms during your presentation!
let presentationModeMute = false; 

// --- 2. CSV DATABASE SETUP ---
const USER_CSV = 'user_alerts.csv';
const SENSOR_CSV = 'sensor_alerts.csv';

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

function expireStaleAlerts() {
    if (fs.existsSync(USER_CSV)) {
        const content = fs.readFileSync(USER_CSV, 'utf8');
        const lines = content.trim().split('\n');
        const statusMap = {};

        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length >= 7) statusMap[parts[0]] = parts[6].trim();
        }

        for (const [id, status] of Object.entries(statusMap)) {
            if (status === 'ACTIVE') {
                console.log(`⚠️  Previous session alert [${id}] found. Marking as EXPIRED.`);
                logUserAlert(id, "SYSTEM", "SESSION_RESET", 0, 0, "EXPIRED");
            }
        }
    }
}

// --- 3. HELPERS & UDP BEACON ---
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

// --- 4. API ROUTES ---

// 👇 NEW ROUTE: For the frontend toggle switch
app.post('/api/toggle-mute', (req, res) => {
    presentationModeMute = req.body.mute;
    console.log(`🔇 Presentation Mute Mode: ${presentationModeMute ? 'ON' : 'OFF'}`);
    res.json({ success: true, muted: presentationModeMute });
});

// Hardware Data Ingestion (NOW WITH AI INTEGRATION)
app.post('/api/data', async (req, res) => {
    const { id, s1, s2, s3, rain, lat, lon, flowDir: reqFlowDir } = req.body; 
    
    if (!id) return res.status(400).json({ status: "error", msg: "No ID" });

    if (!nodes[id] || nodeStatus[id] === 'offline') {
        console.log(`🟢 [CONNECTED] ${id} came online.`);
        console.log(`   👉 API Link: http://${MY_IP}:${HTTP_PORT}/api/view/${id}`);
        nodeStatus[id] = 'online';
    }

    const val1 = parseFloat(s1);
    const val2 = parseFloat(s2);
    const val3 = parseFloat(s3);
    const rainVal = parseInt(rain);

    let finalFlowDir = 90;
    let aiFlowDir = 0; 

    if (reqFlowDir !== undefined) {
        finalFlowDir = parseFloat(reqFlowDir);
        aiFlowDir = (finalFlowDir === 90) ? 1 : (finalFlowDir === 0 || finalFlowDir === 180) ? 0 : -1;
    } else {
        if (val1 < val3 - 5) {
            finalFlowDir = 180;
            aiFlowDir = 1;
        } else if (val3 < val1 - 5) {
            finalFlowDir = 0;
            aiFlowDir = -1;
        }
    }

    // --- AI BRIDGE START ---
    const currentDepth = Math.max(0, 95.0 - val1); 
    
    const aiInput = {
        water_depth: currentDepth,
        depth_rate: 0.5,           
        flow_direction: aiFlowDir,
        rain_local: rainVal / 1024 
    };

    let aiResponse = null;
    try {
        const pythonResponse = await axios.post('http://localhost:5000/api/predict', aiInput);
        aiResponse = pythonResponse.data;
    } catch (err) {
        // Silent fail for clean console during demo
    }
    // --- AI BRIDGE END ---

    // Local Node Alert Logic (Immediate Danger)
    const isFlood = ((val1 > 45 && val1 < 200) || (val2 > 45 && val2 < 200) || (val3 > 45 && val3 < 200));
    const isHeavyRain = (rainVal < 1500); 

    if (isFlood || isHeavyRain) {
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
                
                logSensorAlert(id, reasons.join('|'), rainVal, duration);
                sensorTimers[id].logged = true;
                
                // 👇 NEW: Only send the loud popups if Presentation Mode is OFF
                if (!presentationModeMute) {
                    io.emit('sos-broadcast', { nodeId: id, type: "FLOOD", message: `Auto Alert: ${reasons.join(', ')}` });
                }
            }
        }
    } else {
        if (sensorTimers[id]) delete sensorTimers[id];
    }

    const mapLat = lat !== undefined ? parseFloat(lat) : (NODE_CONFIG[id] ? NODE_CONFIG[id].lat : 12.9710);
    const mapLon = lon !== undefined ? parseFloat(lon) : (NODE_CONFIG[id] ? NODE_CONFIG[id].lon : 77.5940);

    const finalNodeData = { 
        nodeId: id, 
        lat: mapLat,
        lon: mapLon,
        s1: val1, s2: val2, s3: val3, 
        rain: rainVal, 
        flowDir: finalFlowDir, 
        lastSeen: Date.now(),
        ai: aiResponse 
    };
    
    nodes[id] = finalNodeData;
    io.emit('map-update', finalNodeData); 

    res.json({ server_status: "active", msg: "Packet Received" });
});

app.get('/api/alerts', (req, res) => {
    const history = [];
    if (fs.existsSync(SENSOR_CSV)) {
        const lines = fs.readFileSync(SENSOR_CSV, 'utf8').trim().split('\n');
        for (let i = 1; i < lines.length; i++) {
            const [id, time, nodeId, sensors] = lines[i].split(',');
            if (id) history.push({ type: "SENSOR", message: `${nodeId} - ${sensors}`, timestamp: time });
        }
    }
    if (fs.existsSync(USER_CSV)) {
        const lines = fs.readFileSync(USER_CSV, 'utf8').trim().split('\n');
        for (let i = 1; i < lines.length; i++) {
            const [id, time, user, type, lat, lon, status] = lines[i].split(',');
            if(status === 'ACTIVE') history.push({ type: type, message: `User Alert (${user})`, timestamp: time });
        }
    }
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(history.slice(0, 20));
});

app.get('/api/all', (req, res) => {
    let response = { ...nodes };
    if (activeAlert) response["SERVER_ALERT"] = activeAlert;
    res.json(response);
});

app.get('/api/view/:id', (req, res) => {
    const id = req.params.id;
    if (nodes[id]) res.json(nodes[id]);
    else res.status(404).json({ error: "Node not found or offline" });
});

// --- 5. SOCKET.IO EVENTS ---
io.on('connection', (socket) => {
    socket.on('sos-trigger', (data) => {
        const alertId = "ALERT_" + Date.now();
        sosCounter++;
        
        console.log(`🚨 MANUAL EMERGENCY TRIGGERED: ${data.msg || "UI User"}`);
        logUserAlert(alertId, "UI_USER", "MANUAL_SOS", 0, 0, "ACTIVE");
        
        // Manual triggers still broadcast to show it works
        io.emit('sos-broadcast', { type: "SOS", message: data.msg || "Manual SOS Triggered" });
    });
});

// --- 6. WATCHDOG ---
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

// --- 7. STARTUP ---
server.listen(HTTP_PORT, () => {
    expireStaleAlerts();
    console.log(`==================================================`);
    console.log(`⚡ FLOOD SERVER PROFESSIONAL | AI INTEGRATED`); 
    console.log(`==================================================`);
    console.log(`🏠 Dashboard UI: http://${MY_IP}:${HTTP_PORT}`); 
    console.log(`==================================================`);
    startUDPBeacon();
});