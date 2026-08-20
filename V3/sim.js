const axios = require('axios');

const nodes = [];
const GRID_SIZE = 20;

// 1. Generate 20x20 Grid
for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
        let lat = 12.9716 + (r * 0.0015);
        let lon = 77.5946 + (c * 0.0015);

        // Find where the river SHOULD be on this specific row (The S-Curve)
        // Offset it slightly (+ 0.015) so it sits in the middle of our grid
        let targetRiverLon = 77.5946 + (Math.sin(r * 0.5) * 0.003) + 0.015;
        
        // If a node is very close to the target curve, it's a "River" node
        let isRiver = Math.abs(lon - targetRiverLon) < 0.002;

        nodes.push({
            id: `NODE_${r}_${c}`,
            lat: lat,
            lon: lon,
            targetRiverLon: targetRiverLon, // Save this to calculate convergence/divergence later
            isRiver: isRiver,
            s1: 95 // Start dry
        });
    }
}

// 2. Calculate initial pointing directions (Convergence)
for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];
    
    if (node.isRiver) {
        // River nodes flow naturally along the S-curve
        let dy = -0.0015; // Flowing south
        let dx = (Math.sin((node.lat - 12.9716)/0.0015 * 0.5) * 0.003); 
        node.baseFlowDir = Math.atan2(-dy, dx) * (180 / Math.PI);
    } else {
        // Land nodes CONVERGE (point toward) the river
        let dy = 0;
        let dx = node.targetRiverLon - node.lon; 
        // Invert dy (-dy) to map map-north to screen-up correctly
        node.baseFlowDir = Math.atan2(-dy, dx) * (180 / Math.PI);
    }
    
    node.flowDir = node.baseFlowDir;
}

let tick = 0;

async function runDemo() {
    tick++;
    console.log(`🌊 Grid Flow Tick ${tick} (Total Nodes: ${nodes.length})...`);
    
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        
        // 3. Dynamic Color / Depth Logic
        if (node.isRiver) {
            // River fills up fast
            node.s1 = Math.max(20, 95 - (tick * 2)); 
        } else {
            // Land stays dry until tick 10, then it floods
            if (tick > 10) {
                node.s1 = Math.max(40, 95 - ((tick - 10) * 1.5)); 
            } else {
                node.s1 = 95; 
            }
        }

        // 4. THE DIRECTION CHANGE (After tick 10)
        if (tick > 10) {
            if (node.isRiver) {
                // River becomes turbulent/chaotic (random jitter)
                node.flowDir = node.baseFlowDir + (Math.random() * 40 - 20); 
            } else {
                // Flash Flood: Land water now DIVERGES (points away from the river)
                let dy = 0;
                let dx = node.lon - node.targetRiverLon; 
                node.flowDir = Math.atan2(-dy, dx) * (180 / Math.PI);
            }
        }

        const payload = {
            id: node.id,
            lat: node.lat,
            lon: node.lon,
            s1: node.s1.toFixed(2),
            s2: (node.s1 + 1).toFixed(2),
            s3: (node.s1 + 2).toFixed(2),
            rain: node.isRiver ? 900 : 100, 
            flowDir: node.flowDir 
        };

        // Fire off the 400 requests
        try {
            await axios.post('http://localhost:3000/api/data', payload);
        } catch (e) {}
    }
}

// Increased interval slightly to 4000ms to give your local server breathing room for 400 requests
setInterval(runDemo, 4000);