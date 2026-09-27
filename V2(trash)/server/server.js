const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const dgram = require('dgram');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- 1. MONGODB CONNECTION ---
const MONGO_URI = "mongodb+srv://watchsociety69_db_user:iB3X6JtmEHg7qOlY@cluster0.5ox17b8.mongodb.net/flood_monitoring?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✨ Cloud Database Connected"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Schemas
const NodeData = mongoose.model('NodeData', new mongoose.Schema({
    nodeId: String, lat: Number, lon: Number,
    s1: Number, s2: Number, s3: Number, rain: Number, flowDir: Number,
    timestamp: { type: Date, default: Date.now }
}));

const FloodAlert = mongoose.model('FloodAlert', new mongoose.Schema({
    nodeId: String,
    type: String, // "FLOOD", "HEAVY_RAIN", "SOS"
    message: String,
    timestamp: { type: Date, default: Date.now }
}));

const NODE_CONFIG = {
    "NODE_02": { lat: 12.9716, lon: 77.5946 }, 
    "NODE_03": { lat: 12.9725, lon: 77.5950 }
};

app.use(express.static(__dirname));
app.use(express.json());

// --- 2. SENSOR DATA INGESTION ---
app.post('/api/data', async (req, res) => {
    const { id, s1, s2, s3, rain } = req.body;
    const config = NODE_CONFIG[id] || { lat: 0, lon: 0 };

    let direction = 90;
    if (s1 < s3 - 5) direction = 180;
    else if (s3 < s1 - 5) direction = 0;

    const entry = new NodeData({ nodeId: id, ...config, s1, s2, s3, rain, flowDir: direction });
    await entry.save();
    
    // Auto-Alert Logic
    if (s1 < 50 && s1 > 0) {
        const alert = new FloodAlert({ nodeId: id, type: "FLOOD", message: `Critical Water Level: ${s1}cm` });
        await alert.save();
        io.emit('new-alert', alert);
    }
    
    io.emit('map-update', entry);
    res.json({ server_status: "active" });
});

// --- 3. SOCKET.IO (SOS & Realtime) ---
io.on('connection', (socket) => {
    // LISTEN FOR SOS FROM FRONTEND
    socket.on('sos-trigger', async (data) => {
        console.log("🚨 SOS RECEIVED from User!");
        
        // 1. Save to MongoDB
        const alert = new FloodAlert({
            nodeId: "ADMIN_PANEL",
            type: "SOS",
            message: "GLOBAL SOS TRIGGERED BY USER"
        });
        await alert.save();

        // 2. Broadcast to ALL connected users
        io.emit('sos-broadcast', alert);
    });
});

// --- 4. API ROUTES ---
app.get('/api/alerts', async (req, res) => {
    const alerts = await FloodAlert.find().sort({ timestamp: -1 }).limit(20);
    res.json(alerts);
});

// --- 5. UDP DISCOVERY ---
const UDP_PORT = 4210;
const udpSocket = dgram.createSocket('udp4');
udpSocket.bind(() => {
    udpSocket.setBroadcast(true);
    setInterval(() => {
        const interfaces = os.networkInterfaces();
        const addresses = Object.values(interfaces).flat()
            .filter(iface => iface.family === 'IPv4' && !iface.internal)
            .map(iface => iface.address);
        if (addresses.length > 0) {
            const msg = Buffer.from(`FLOOD_SERVER|${addresses[0]}`);
            udpSocket.send(msg, 0, msg.length, UDP_PORT, '255.255.255.255');
        }
    }, 2000);
});

server.listen(3000, () => console.log("🚀 Server Ready: http://localhost:3000"));