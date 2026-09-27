#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFiUdp.h>

// --- CONFIG ---
const char* ssid = "Sangrechy";
const char* password = "NEVER123";
const char* nodeID = "NODE_02"; 

// --- PINS ---
#define STATUS_LED 2 
#define TRIG1 5
#define ECHO1 18
#define TRIG2 19
#define ECHO2 21
#define TRIG3 25
#define ECHO3 26
#define RAIN_AO 34

// --- VARS ---
WiFiUDP udp;
unsigned int udpPort = 4210;
char packetBuffer[255];
String serverIP = "";
bool serverFound = false;

// --- SENSORS ---
float getDist(int t, int e) {
  digitalWrite(t, LOW); delayMicroseconds(2);
  digitalWrite(t, HIGH); delayMicroseconds(10);
  digitalWrite(t, LOW);
  long d = pulseIn(e, HIGH, 25000);
  return (d==0) ? -1 : d * 0.034 / 2;
}

int getRain() {
  long sum = 0;
  for(int i=0; i<5; i++) { sum += analogRead(RAIN_AO); delay(2); }
  return sum/5;
}

void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED, OUTPUT);
  pinMode(TRIG1, OUTPUT); pinMode(ECHO1, INPUT);
  pinMode(TRIG2, OUTPUT); pinMode(ECHO2, INPUT);
  pinMode(TRIG3, OUTPUT); pinMode(ECHO3, INPUT);

  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(STATUS_LED, !digitalRead(STATUS_LED)); delay(100);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Connected!");
  digitalWrite(STATUS_LED, LOW);

  udp.begin(udpPort);
  Serial.println("🎧 Waiting for Server Beacon...");
}

void loop() {
  // 1. DISCOVERY MODE
  if (!serverFound) {
    int packetSize = udp.parsePacket();
    if (packetSize) {
      int len = udp.read(packetBuffer, 255);
      if (len > 0) packetBuffer[len] = 0;
      String msg = String(packetBuffer);
      
      if (msg.startsWith("FLOOD_SERVER|")) {
        serverIP = msg.substring(13);
        serverFound = true;
        Serial.println("🎉 Server Found at: " + serverIP);
        // Fast 5 blinks = Found
        for(int i=0; i<5; i++) { digitalWrite(STATUS_LED, HIGH); delay(50); digitalWrite(STATUS_LED, LOW); delay(50); }
      }
    }
    delay(100);
    return;
  }

  // 2. DATA MODE (HANDSHAKE)
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    // 3 second timeout for fast failure detection
    http.setTimeout(3000); 
    
    String url = "http://" + serverIP + ":3000/api/data";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> txDoc;
    txDoc["id"] = nodeID;
    txDoc["s1"] = getDist(TRIG1, ECHO1);
    txDoc["s2"] = getDist(TRIG2, ECHO2);
    txDoc["s3"] = getDist(TRIG3, ECHO3);
    txDoc["rain"] = getRain();
    String json; serializeJson(txDoc, json);

    int httpCode = http.POST(json);

    if (httpCode == 200) {
      // READ RESPONSE FROM SERVER
      String payload = http.getString();
      StaticJsonDocument<200> rxDoc;
      deserializeJson(rxDoc, payload);

      // Verify Server Handshake
      const char* srvStatus = rxDoc["server_status"];
      if (strcmp(srvStatus, "active") == 0) {
         Serial.println("✅ Data Sent -> Server Acknowledged");
         // Slow Blink = Healthy Heartbeat
         digitalWrite(STATUS_LED, HIGH); delay(200); digitalWrite(STATUS_LED, LOW);
      }
    } else {
      Serial.print("❌ Connection Error: "); Serial.println(httpCode);
      // If error persists, force re-discovery
      if (httpCode == -1 || httpCode == -11) {
         // Optionally reset serverIP here if you want it to search again
         // serverIP = ""; serverFound = false;
      }
    }
    http.end();
  }
  
  // Wait 1 second before next update (Fast Refresh)
  delay(1000); 
}