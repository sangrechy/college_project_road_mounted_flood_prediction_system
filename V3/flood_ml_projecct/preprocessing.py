import pandas as pd

# Load data
df = pd.read_csv("data/sensor_data.csv")

# Dry road calibration (measured once)
U1_DRY = 95.0

# Water depth
df["water_depth"] = U1_DRY - df["u1_distance"]
df["water_depth"] = df["water_depth"].clip(lower=0)

# Depth rate (change per reading)
df["depth_rate"] = df["water_depth"].diff().fillna(0)

# Flow direction
df["flow_direction"] = (
    (df["u2_distance"].diff() - df["u3_distance"].diff())
    .apply(lambda x: 1 if x > 0.5 else (-1 if x < -0.5 else 0))
)

# Rain normalization
df["rain_local"] = df["rain_raw"] / 1023.0

print(df.head())


# Save processed data for ML
df.to_csv("data/processed_data.csv", index=False)

print("Preprocessing complete. Saved processed_data.csv")

# shift water depth by time steps (example: 6 hours = 6 rows if 1 hr interval)
df["future_depth_6h"] = df["water_depth"].shift(-6)
df.dropna(inplace=True)