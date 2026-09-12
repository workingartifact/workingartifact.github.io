package com.exapterendapter.prompter;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    public static final String PREFS = "prompter_prefs";

    private static final int BG = Color.rgb(11, 11, 11);
    private static final int PANEL = Color.rgb(23, 24, 24);
    private static final int TEXT = Color.rgb(238, 236, 230);
    private static final int MUTED = Color.rgb(168, 166, 159);
    private static final int ACCENT = Color.rgb(164, 189, 131);

    private SharedPreferences prefs;
    private EditText script;
    private Spinner promptBackground;
    private Spinner textColor;
    private Spinner countdown;
    private CheckBox grid;
    private TextView permissionStatus;
    private boolean pendingOpenCamera = false;
    private boolean pendingStartOverlay = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        setContentView(buildUi());
        loadSettings();
        requestNotificationPermissionIfNeeded();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshPermissionStatus();
        if (pendingStartOverlay && Settings.canDrawOverlays(this)) {
            pendingStartOverlay = false;
            saveSettings();
            startOverlayService();
            if (pendingOpenCamera) {
                pendingOpenCamera = false;
                new Handler(getMainLooper()).postDelayed(this::openPixelCamera, 350);
            }
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        saveSettings();
    }

    private View buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(18), dp(18), dp(28));
        scroll.addView(root, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView brand = text("EXAPTER ENDAPTER", 25, ACCENT);
        brand.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        root.addView(brand);

        TextView subtitle = text("Native Overlay Prompter — v0.3", 14, MUTED);
        subtitle.setPadding(0, dp(2), 0, dp(16));
        root.addView(subtitle);

        TextView explainer = text(
                "Pixel Camera still owns the camera, microphone, stabilization, bitrate, and processing. The teleprompter is a local floating window above it.",
                14, TEXT);
        explainer.setLineSpacing(0, 1.12f);
        root.addView(card(explainer));

        permissionStatus = text("Overlay permission: checking…", 13, MUTED);
        permissionStatus.setPadding(0, dp(14), 0, dp(8));
        root.addView(permissionStatus);

        Button permission = button("Grant / manage overlay permission", false);
        permission.setOnClickListener(v -> requestOverlayPermission(false));
        root.addView(permission);

        root.addView(sectionTitle("SCRIPT"));
        script = new EditText(this);
        script.setTextColor(TEXT);
        script.setHintTextColor(MUTED);
        script.setHint("Paste your script here...");
        script.setTextSize(16);
        script.setGravity(Gravity.TOP | Gravity.START);
        script.setMinLines(9);
        script.setPadding(dp(12), dp(12), dp(12), dp(12));
        script.setBackgroundColor(PANEL);
        root.addView(script, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(220)));

        root.addView(sectionTitle("OVERLAY DEFAULTS"));
        TextView liveControls = text(
                "Adjust the floating window directly: drag EE to move it, drag the ↘ corner to resize it, drag the green grip to move the reading line, swipe/drag the scrolling text to move backward or forward through the script, and use −/+ and A−/A+ in the floating bar for speed and text size. Tap ● to cycle text colors.",
                13, MUTED);
        liveControls.setLineSpacing(0, 1.15f);
        liveControls.setPadding(0, 0, 0, dp(10));
        root.addView(liveControls);

        root.addView(label("Prompt background"));
        promptBackground = spinner(new String[]{"Clear", "Light shade", "Dark shade"});
        root.addView(promptBackground);

        root.addView(label("Text color"));
        textColor = spinner(new String[]{"White", "Black", "Red", "Yellow", "Green", "Cyan"});
        root.addView(textColor);

        root.addView(label("Countdown before scroll"));
        countdown = spinner(new String[]{"None", "3 seconds", "5 seconds"});
        root.addView(countdown);

        grid = new CheckBox(this);
        grid.setText("Show 3 × 3 grid overlay");
        grid.setTextColor(TEXT);
        grid.setButtonTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        grid.setPadding(0, dp(10), 0, dp(10));
        root.addView(grid);

        root.addView(sectionTitle("LAUNCH"));

        Button startCamera = button("Start overlay + open Pixel Camera", true);
        startCamera.setOnClickListener(v -> startOverlay(true));
        root.addView(startCamera);

        Button overlayOnly = button("Start overlay only", false);
        overlayOnly.setOnClickListener(v -> startOverlay(false));
        root.addView(overlayOnly);

        Button stop = button("Stop overlay", false);
        stop.setOnClickListener(v -> {
            Intent i = new Intent(this, OverlayService.class).setAction(OverlayService.ACTION_STOP);
            startService(i);
        });
        root.addView(stop);

        TextView note = text(
                "The overlay is a separate Android window. Pixel Camera records the camera stream, not the screen, so the teleprompter is not intended to appear in the saved video. This app requests no camera or microphone permission.",
                12, MUTED);
        note.setPadding(0, dp(16), 0, 0);
        note.setLineSpacing(0, 1.12f);
        root.addView(note);

        TextView footer = text("QUAESTIO ET VERITAS  ·  Inquiry and Truth\nJosh Ayala · 2026 · © EXAPTER ENDAPTER LLC", 12, MUTED);
        footer.setPadding(0, dp(28), 0, dp(8));
        root.addView(footer);

        return scroll;
    }

    private void startOverlay(boolean openCamera) {
        saveSettings();
        if (!Settings.canDrawOverlays(this)) {
            pendingStartOverlay = true;
            pendingOpenCamera = openCamera;
            requestOverlayPermission(true);
            return;
        }
        startOverlayService();
        if (openCamera) {
            new Handler(getMainLooper()).postDelayed(this::openPixelCamera, 350);
        }
    }

    private void startOverlayService() {
        Intent i = new Intent(this, OverlayService.class).setAction(OverlayService.ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(i);
        else startService(i);
        Toast.makeText(this, "Teleprompter overlay started", Toast.LENGTH_SHORT).show();
    }

    private void requestOverlayPermission(boolean fromLaunch) {
        if (Settings.canDrawOverlays(this)) {
            refreshPermissionStatus();
            if (fromLaunch) {
                boolean openCamera = pendingOpenCamera;
                pendingStartOverlay = false;
                pendingOpenCamera = false;
                startOverlay(openCamera);
            }
            return;
        }
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName()));
            startActivity(i);
        } catch (Exception e) {
            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION));
        }
    }

    private void openPixelCamera() {
        Intent pixel = new Intent(MediaStore.INTENT_ACTION_VIDEO_CAMERA);
        pixel.setPackage("com.google.android.GoogleCamera");
        pixel.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(pixel);
            return;
        } catch (Exception ignored) { }

        Intent generic = new Intent(MediaStore.INTENT_ACTION_VIDEO_CAMERA);
        generic.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(generic);
        } catch (Exception e) {
            Toast.makeText(this, "No video camera app could be opened.", Toast.LENGTH_LONG).show();
        }
    }

    private void refreshPermissionStatus() {
        boolean granted = Settings.canDrawOverlays(this);
        permissionStatus.setText(granted
                ? "Overlay permission: GRANTED"
                : "Overlay permission: REQUIRED");
        permissionStatus.setTextColor(granted ? ACCENT : Color.rgb(239, 132, 118));
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 2001);
        }
    }

    private void loadSettings() {
        script.setText(prefs.getString("script", ""));
        promptBackground.setSelection(prefs.getInt("background", 1));
        textColor.setSelection(prefs.getInt("textColor", 0));
        countdown.setSelection(prefs.getInt("countdown", 1));
        grid.setChecked(prefs.getBoolean("grid", false));
    }

    private void saveSettings() {
        prefs.edit()
                .putString("script", script.getText().toString())
                .putInt("background", promptBackground.getSelectedItemPosition())
                .putInt("textColor", textColor.getSelectedItemPosition())
                .putInt("countdown", countdown.getSelectedItemPosition())
                .putBoolean("grid", grid.isChecked())
                .apply();
    }

    private Spinner spinner(String[] options) {
        Spinner s = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<String>(this,
                android.R.layout.simple_spinner_dropdown_item, options) {
            @Override
            public View getView(int position, View convertView, ViewGroup parent) {
                TextView v = (TextView) super.getView(position, convertView, parent);
                v.setTextColor(TEXT);
                v.setBackgroundColor(PANEL);
                v.setPadding(dp(12), dp(10), dp(12), dp(10));
                return v;
            }
            @Override
            public View getDropDownView(int position, View convertView, ViewGroup parent) {
                TextView v = (TextView) super.getDropDownView(position, convertView, parent);
                v.setTextColor(TEXT);
                v.setBackgroundColor(PANEL);
                v.setPadding(dp(12), dp(12), dp(12), dp(12));
                return v;
            }
        };
        s.setAdapter(adapter);
        return s;
    }

    private View card(View child) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(12), dp(12), dp(12), dp(12));
        card.setBackgroundColor(PANEL);
        card.addView(child);
        return card;
    }

    private TextView sectionTitle(String value) {
        TextView t = text(value, 12, ACCENT);
        t.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        t.setLetterSpacing(0.08f);
        t.setPadding(0, dp(22), 0, dp(8));
        return t;
    }

    private TextView label(String value) {
        TextView t = text(value, 13, TEXT);
        t.setPadding(0, dp(6), 0, dp(5));
        return t;
    }

    private TextView text(String value, float sp, int color) {
        TextView t = new TextView(this);
        t.setText(value);
        t.setTextSize(sp);
        t.setTextColor(color);
        return t;
    }

    private Button button(String value, boolean primary) {
        Button b = new Button(this);
        b.setText(value);
        b.setTextSize(14);
        b.setAllCaps(false);
        b.setTextColor(primary ? Color.rgb(10, 12, 10) : TEXT);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(primary ? ACCENT : Color.rgb(46, 48, 47)));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, dp(5), 0, dp(5));
        b.setLayoutParams(lp);
        return b;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
