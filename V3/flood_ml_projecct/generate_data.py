import pandas as pd
import random
from datetime import datetime, timedelta

rows = []
time = datetime.now()

U1_DRY = 95

for i in range(100):
    rain = random.randint(0, 1023)

    if rain < 300:
        depth = random.uniform(0, 1)
        flood = 0
    elif rain < 600:
        depth = random.uniform(1, 3)
        flood = 0
    else:
        depth = random.uniform(3, 8)
        flood = 1

    u1 = U1_DRY - depth
    u2 = u1 - random.uniform(0, 2)
    u3 = u1 - random.uniform(0, 1)

    rows.append([
        time.strftime("%Y-%m-%d %H:%M"),
        round(u1, 2),
        round(u2, 2),
        round(u3, 2),
        rain,
        flood
    ])

    time += timedelta(minutes=5)

df = pd.DataFrame(rows, columns=[
    "timestamp","u1_distance","u2_distance","u3_distance","rain_raw","flood"
])

df.to_csv("data/sensor_data.csv", index=False)
print("Dataset generated!")
