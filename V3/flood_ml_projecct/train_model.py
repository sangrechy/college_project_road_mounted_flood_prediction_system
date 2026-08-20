from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import pandas as pd
import joblib

df = pd.read_csv("data/processed_data.csv")

X = df[
    ["water_depth","depth_rate","flow_direction","rain_local"]
]

y = df["future_depth_6h"]

X_train, X_test, y_train, y_test = train_test_split(X, y)

model = RandomForestRegressor(n_estimators=200)
model.fit(X_train, y_train)

joblib.dump(model, "depth_forecast_model.pkl")

print("✅ Water depth forecasting model trained")
