from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import requests

# =====================================================
# INITIALIZE FLASK APP
# =====================================================
app = Flask(__name__)
CORS(app) # Allows your JS/Node server to talk to this Python server

# =====================================================
# LOAD TRAINED MODELS
# =====================================================
try:
    depth_model = joblib.load("depth_forecast_model.pkl")
    print("✅ Flood prediction model (future depth) loaded\n")
except Exception as e:
    print(f"❌ Error loading model: {e}")

# =====================================================
# WEATHER API CONFIG
# =====================================================
API_KEY = "b1fdff3195f3c4274ac3bf3944a8aed7"
LAT = 12.9716
LON = 77.5946

def get_weather_forecast():
    """Returns rainfall forecast for next 3 hours (mm)"""
    url = (
        f"https://api.openweathermap.org/data/2.5/forecast"
        f"?lat={LAT}&lon={LON}&appid={API_KEY}&units=metric"
    )
    try:
        data = requests.get(url, timeout=5).json()
        forecast = data["list"][0]
        return forecast.get("rain", {}).get("3h", 0.0)
    except:
        return 0.0

def calculate_effective_rain(rain_local, rain_mm):
    rain_forecast_rate = rain_mm / 3.0  # mm/hr
    rain_effective = 0.6 * rain_local + 0.4 * rain_forecast_rate
    return min(rain_effective, 1.0)

def compute_accumulation_index(future_depth, rain_6h, flow_direction):
    flow_factor = 2 if flow_direction == 1 else 0
    return future_depth + 0.6 * rain_6h + flow_factor

def classify_accumulation(accumulation):
    if accumulation < 5: return "NO ACCUMULATION", "GREEN"
    elif accumulation < 10: return "MINOR POOLING", "YELLOW"
    elif accumulation < 20: return "WATER ACCUMULATED", "ORANGE"
    elif accumulation < 30: return "FLOODED AREA", "RED"
    else: return "SEVERE FLOODING", "DARK RED"

# =====================================================
# FLASK API ENDPOINT
# =====================================================
@app.route('/api/predict', methods=['POST'])
def predict_flood():
    """
    Receives live sensor data via POST request, returns AI predictions.
    """
    try:
        # 1. Get raw data from the JS/Node.js request
        req_data = request.json
        water_depth = float(req_data.get('water_depth', 0.0))
        depth_rate = float(req_data.get('depth_rate', 0.0))
        flow_direction = int(req_data.get('flow_direction', 0))
        rain_local = float(req_data.get('rain_local', 0.0))

        # 2. Get Weather Forecast
        rain_mm_3h = get_weather_forecast()
        rain_effective = calculate_effective_rain(rain_local, rain_mm_3h)

        # 3. Format for the AI Model
        X_live = pd.DataFrame([{
            "water_depth": water_depth,
            "depth_rate": depth_rate,
            "flow_direction": flow_direction,
            "rain_local": rain_effective
        }])

        # 4. Run AI Predictions
        future_depth = depth_model.predict(X_live)[0]
        rain_6h = rain_mm_3h * 2
        accumulation_index = compute_accumulation_index(future_depth, rain_6h, flow_direction)
        severity, color = classify_accumulation(accumulation_index)

        # 5. Send clean JSON back to JavaScript
        return jsonify({
            "status": "success",
            "predictions": {
                "future_depth_cm": round(future_depth, 2),
                "forecast_rain_6h_mm": round(rain_6h, 2),
                "accumulation_index": round(accumulation_index, 2)
            },
            "alert": {
                "severity": severity,
                "color_code": color,
                "is_flood_expected": bool(accumulation_index >= 20)
            }
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

# =====================================================
# START SERVER
# =====================================================
if __name__ == '__main__':
    print("🚀 Python AI Prediction Server starting on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)