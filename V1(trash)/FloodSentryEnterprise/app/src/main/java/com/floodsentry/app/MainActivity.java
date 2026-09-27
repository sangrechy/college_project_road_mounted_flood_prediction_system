package com.floodsentry.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {

    // --- VARIABLES ---
    private WebView mWebView;
    private ProgressBar mProgressBar;
    private LinearLayout mConfigPanel, mErrorView;
    private EditText mEtServerIP;
    private SharedPreferences mPrefs;
    private String mCurrentIP = "";
    private final ExecutorService mExecutor = Executors.newSingleThreadExecutor();
    private final Handler mMainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main); // Links to activity_main.xml

        // 1. SETUP UI
        mWebView = findViewById(R.id.webView);
        mProgressBar = findViewById(R.id.progressBar);
        mConfigPanel = findViewById(R.id.configPanel);
        mErrorView = findViewById(R.id.errorView);
        mEtServerIP = findViewById(R.id.etServerIP);
        Button btnConnect = findViewById(R.id.btnSaveConnect);
        Button btnRetry = findViewById(R.id.btnRetry);
        Button btnChangeIP = findViewById(R.id.btnChangeIP);
        FloatingActionButton fabSOS = findViewById(R.id.fabSOS);

        // 2. SETUP STORAGE (Remember IP)
        mPrefs = getSharedPreferences("FloodPrefs", Context.MODE_PRIVATE);
        mCurrentIP = mPrefs.getString("server_ip", "");

        if (!mCurrentIP.isEmpty()) {
            mEtServerIP.setText(mCurrentIP);
            loadDashboard();
        }

        // 3. CONFIGURE WEBVIEW
        setupWebView();

        // 4. BUTTON ACTIONS
        btnConnect.setOnClickListener(v -> {
            String ip = mEtServerIP.getText().toString().trim();
            if (!ip.isEmpty()) {
                mCurrentIP = ip;
                mPrefs.edit().putString("server_ip", ip).apply();
                hideKeyboard();
                loadDashboard();
            }
        });

        btnRetry.setOnClickListener(v -> loadDashboard());

        btnChangeIP.setOnClickListener(v -> {
            mErrorView.setVisibility(View.GONE);
            mWebView.setVisibility(View.GONE);
            mConfigPanel.setVisibility(View.VISIBLE);
        });

        fabSOS.setOnClickListener(v -> {
            new AlertDialog.Builder(this)
                    .setTitle("🚨 TRIGGER SOS?")
                    .setMessage("Send emergency alert to server?")
                    .setPositiveButton("SEND ALERT", (d, w) -> sendNativeSOS())
                    .setNegativeButton("CANCEL", null)
                    .show();
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings s = mWebView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        mWebView.setWebChromeClient(new WebChromeClient() {
            public void onProgressChanged(WebView view, int p) {
                mProgressBar.setVisibility(p < 100 ? View.VISIBLE : View.GONE);
                mProgressBar.setProgress(p);
            }
        });

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                mErrorView.setVisibility(View.GONE);
                mConfigPanel.setVisibility(View.GONE);
            }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    mWebView.setVisibility(View.GONE);
                    mErrorView.setVisibility(View.VISIBLE);
                }
            }
        });
    }

    private void loadDashboard() {
        if (mCurrentIP.isEmpty()) return;
        mConfigPanel.setVisibility(View.GONE);
        mWebView.setVisibility(View.VISIBLE);
        mWebView.loadUrl("http://" + mCurrentIP + ":3000");
    }

    private void sendNativeSOS() {
        if (mCurrentIP.isEmpty()) return;

        // Vibrate Phone
        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(500, -1));
        else v.vibrate(500);

        Toast.makeText(this, "Sending Signal...", Toast.LENGTH_SHORT).show();

        mExecutor.execute(() -> {
            try {
                URL url = new URL("http://" + mCurrentIP + ":3000/api/sos");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);

                JSONObject json = new JSONObject();
                json.put("user", "ANDROID_ADMIN");
                json.put("latitude", 0);
                json.put("longitude", 0);
                json.put("type", "HARDWARE_BTN");

                try(OutputStream os = conn.getOutputStream()) {
                    os.write(json.toString().getBytes());
                }

                int code = conn.getResponseCode();
                mMainHandler.post(() -> {
                    if (code == 200) {
                        Toast.makeText(this, "🚨 SOS SENT!", Toast.LENGTH_LONG).show();
                        mWebView.reload();
                    } else {
                        Toast.makeText(this, "Failed: " + code, Toast.LENGTH_SHORT).show();
                    }
                });
            } catch (Exception e) {
                mMainHandler.post(() -> Toast.makeText(this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        });
    }

    private void hideKeyboard() {
        View view = this.getCurrentFocus();
        if (view != null) {
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            imm.hideSoftInputFromWindow(view.getWindowToken(), 0);
        }
    }
}