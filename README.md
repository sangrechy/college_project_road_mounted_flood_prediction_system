# 🌊 Road-Mounted IoT Flood Prediction System

An **IoT-based road-mounted flood monitoring and prediction system** that collects water-level and rainfall data using an ESP32, processes sensor data through **machine learning models**, and provides flood predictions and alerts through a web-based system.

The **V3 directory is the final version** of the project. It contains the complete ML/AI training and prediction pipeline, trained models, sensor datasets, Node.js server, web interface, simulator, and alert handling.


---
# 📸 Project Images

<div align="center">

<img width="850" alt="Road-Mounted Flood Prediction System" src="https://github.com/user-attachments/assets/b0831f6b-af58-45ab-a9a2-a808de312da4" />

<br><br>

<img width="800" alt="Flood Prediction System" src="https://github.com/user-attachments/assets/dfb4d662-309f-47ab-8177-0bd579eb3fd6" />

</div>

---

# 🎥 Demo

<div align="center">

https://github.com/user-attachments/assets/c3bafeed-6ec3-4491-87a2-07ae66c4539b

</div>

---

# 📁 Project Directory Structure

```text
V3/
│
├── flood_ml_projecct/
│   ├── data/
│   │   ├── processed_data.csv
│   │   └── sensor_data.csv
│   │
│   ├── depth_forecast_model.pkl
│   ├── flood_model.pkl
│   ├── generate_data.py
│   ├── package.json
│   ├── package-lock.json
│   ├── predict.py
│   ├── preprocessing.py
│   ├── train_depth_model.py
│   └── train_model.py
│
├── server/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── sensor_alerts.csv
│   ├── server.js
│   └── user_alerts.csv
│
├── sensor_alerts.csv
├── user_alerts.csv
├── sim.js
├── package.json
└── package-lock.json
```

---

# 🤖 Machine Learning / AI

The ML/AI implementation is located at:

```text
flood_ml_projecct/
```

### Training Pipeline

```text
Sensor Data
     ↓
generate_data.py
     ↓
sensor_data.csv
     ↓
preprocessing.py
     ↓
processed_data.csv
     ↓
train_model.py
     ↓
flood_model.pkl
```

### Depth Forecasting

```text
Processed Sensor Data
        ↓
train_depth_model.py
        ↓
depth_forecast_model.pkl
```

### Prediction

```text
predict.py
     ↓
Flood Prediction
     +
Depth Forecast
```

The repository includes both the **training code** and the **trained `.pkl` models**, so the existing models can be used directly without retraining.

---

# 🐍 ML Installation

```bash
cd V3/flood_ml_projecct
```

Create a virtual environment:

```bash
python3 -m venv venv
```

Activate it:

```bash
source venv/bin/activate
```

Install the required ML packages:

```bash
pip install numpy pandas scikit-learn joblib
```

---

# 🧪 Generate / Process Data

Generate sensor data:

```bash
python3 generate_data.py
```

The generated data is stored under:

```text
data/
├── sensor_data.csv
└── processed_data.csv
```

---

# 🏋️ Train Flood Model

```bash
python3 train_model.py
```

Output:

```text
flood_model.pkl
```

---

# 📈 Train Depth Forecast Model

```bash
python3 train_depth_model.py
```

Output:

```text
depth_forecast_model.pkl
```

---

# 🔮 Run Prediction

```bash
python3 predict.py
```

The prediction script uses the trained models:

```text
flood_model.pkl
depth_forecast_model.pkl
```

---

# 🌐 Web Server Installation

The final web server is located at:

```text
V3/server/
```

Install the Node.js dependencies:

```bash
cd V3/server
npm install
```

Start the server:

```bash
node server.js
```

The web interface is:

```text
V3/server/index.html
```

Open the URL/port displayed by `server.js`.

---

# 📡 ESP32 Sensor System

The ESP32 collects data from:

* 3 × Ultrasonic water-level sensors
* 1 × Rain sensor

The ESP32 exposes the collected sensor values through a local HTTP API.

### API Endpoint

```text
/data
```

Example response:

```json
{
  "s1": 25.430,
  "s2": 28.210,
  "s3": 31.550,
  "rainAO": 1850,
  "rainDO": 0
}
```

The ESP32 also provides a simple live monitoring page at:

```text
/
```

---

# 🔌 ESP32 Connection Pinout

Based on the ESP32 firmware used by the project:

## 🌊 Ultrasonic Sensor 1

| Sensor | ESP32   |
| ------ | ------- |
| TRIG   | GPIO 5  |
| ECHO   | GPIO 18 |
| VCC    | 5V      |
| GND    | GND     |

---

## 🌊 Ultrasonic Sensor 2

| Sensor | ESP32   |
| ------ | ------- |
| TRIG   | GPIO 19 |
| ECHO   | GPIO 21 |
| VCC    | 5V      |
| GND    | GND     |

---

## 🌊 Ultrasonic Sensor 3

| Sensor | ESP32   |
| ------ | ------- |
| TRIG   | GPIO 25 |
| ECHO   | GPIO 26 |
| VCC    | 5V      |
| GND    | GND     |

---

## 🌧️ Rain Sensor

| Rain Sensor | ESP32                |
| ----------- | -------------------- |
| AO          | GPIO 34              |
| DO          | GPIO 27              |
| VCC         | 3.3V / module supply |
| GND         | GND                  |

> **Important:** The ESP32 GPIO pins are **3.3 V logic**. If an ultrasonic sensor's ECHO output can reach 5 V, use an appropriate voltage divider/level shifter before connecting it to the ESP32 GPIO.

---

# 📌 ESP32 Pin Summary

```text
ESP32
│
├── GPIO 5  ───── TRIG1
├── GPIO 18 ───── ECHO1
│
├── GPIO 19 ───── TRIG2
├── GPIO 21 ───── ECHO2
│
├── GPIO 25 ───── TRIG3
├── GPIO 26 ───── ECHO3
│
├── GPIO 34 ───── Rain Sensor AO
└── GPIO 27 ───── Rain Sensor DO
```

---

# 📶 ESP32 Wi-Fi Configuration

The firmware connects to the configured Wi-Fi network:

```cpp
const char* ssid = "OnePlus Nord CE 3 Lite 5G";
const char* password = "NEVER123";
```

Change these values to match the Wi-Fi network being used.

```cpp
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";
```

---

# 🌐 ESP32 Web Interface

After connecting to Wi-Fi, the ESP32 starts a web server on:

```text
Port 80
```

It also enables mDNS using:

```text
flood.local
```

The serial monitor displays:

```text
ESP32 READY
Open: http://flood.local
```

Open:

```text
http://flood.local
```

from a device connected to the same network.

---

# 📊 Live Sensor Monitoring

The ESP32 dashboard displays:

```text
Sensor 1 — Water Level
Sensor 2
Sensor 3
Rain Sensor
```

The browser requests new sensor values every:

```text
1 second
```

using:

```text
GET /data
```

---

# 🧪 Simulator

The final V3 version also contains:

```text
sim.js
```

Run it from:

```bash
cd V3
node sim.js
```

The simulator can be used for testing the software side without continuously requiring the physical sensor setup.

---

# 🚨 Alert Data

Sensor alerts are stored in:

```text
sensor_alerts.csv
```

Server-side sensor alerts:

```text
server/sensor_alerts.csv
```

User alerts:

```text
user_alerts.csv
```

Server-side user alerts:

```text
server/user_alerts.csv
```

---

# 🔄 Complete System Architecture

```text
              ┌─────────────────────┐
              │      ESP32          │
              │                     │
              │  Ultrasonic × 3     │
              │  Rain Sensor        │
              └──────────┬──────────┘
                         │
                         │ Wi-Fi
                         ▼
              ┌─────────────────────┐
              │   Sensor Data/API   │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   ML Preprocessing  │
              └──────────┬──────────┘
                         │
                         ▼
                 ┌───────────────┐
                 │   ML Models   │
                 │               │
                 │ Flood Model   │
                 │ Depth Model   │
                 └───────┬───────┘
                         │
                         ▼
              ┌─────────────────────┐
              │ Flood Prediction &  │
              │ Depth Forecast      │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │    Node.js Server   │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Web Dashboard     │
              │   + Alerts          │
              └─────────────────────┘
```

---

# 🛠️ Complete Installation

### 1. Clone

```bash
git clone https://github.com/sangrechy/collage_project_sem4_ccp_road_mounted_flood_prediction_system.git
cd collage_project_sem4_ccp_road_mounted_flood_prediction_system/V3
```

### 2. ML Environment

```bash
cd flood_ml_projecct
python3 -m venv venv
source venv/bin/activate
pip install numpy pandas scikit-learn joblib
```

### 3. Train Models — Optional

Existing models are already included.

To retrain:

```bash
python3 train_model.py
python3 train_depth_model.py
```

### 4. Run Prediction

```bash
python3 predict.py
```

### 5. Start Web Server

In another terminal:

```bash
cd V3/server
npm install
node server.js
```

### 6. ESP32

Upload the ESP32 firmware, configure:

```cpp
ssid
password
```

Connect the sensors according to the pinout above and open:

```text
http://flood.local
```

---

# ⚠️ Troubleshooting

### Python dependency error

```bash
cd V3/flood_ml_projecct
source venv/bin/activate
pip install numpy pandas scikit-learn joblib
```

### Node.js dependency error

```bash
cd V3/server
rm -rf node_modules
npm install
```

### ML model missing

Check:

```text
V3/flood_ml_projecct/flood_model.pkl
V3/flood_ml_projecct/depth_forecast_model.pkl
```

### ESP32 not connecting

Check:

```text
Wi-Fi SSID
Wi-Fi password
ESP32 power
Serial Monitor
```

Serial Monitor:

```text
115200 baud
```

### `flood.local` not opening

Use the ESP32's IP address printed by the Wi-Fi connection instead:

```text
http://<ESP32_IP>/
```

Make sure the computer/phone and ESP32 are connected to the same Wi-Fi network.
