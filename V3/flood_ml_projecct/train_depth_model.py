import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib

# Load processed data
df = pd.read_csv("data/processed_data.csv")

# --------------------------------
# Create future depth label
# Assume 1 row = 1 hour
# --------------------------------
df["future_depth_6h"] = df["water_depth"].shift(-6)
df.dropna(inplace=True)

# --------------------------------
# Features
# --------------------------------
X = df[[
    "water_depth",
    "depth_rate",
    "flow_direction",
    "rain_local"
]]

# Target
y = df["future_depth_6h"]

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, random_state=42
)

# Train model
depth_model = RandomForestRegressor(
    n_estimators=200,
    random_state=42
)

depth_model.fit(X_train, y_train)

# Save model
joblib.dump(depth_model, "depth_forecast_model.pkl")

print("✅ depth_forecast_model.pkl created successfully")
