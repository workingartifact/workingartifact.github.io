package com.exapterendapter.prompter;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public class OverlayService extends Service {
    public static final String ACTION_START = "com.exapterendapter.prompter.START";
    public static final String ACTION_STOP = "com.exapterendapter.prompter.STOP";

    private static final String CHANNEL_ID = "prompter_overlay";
    private static final int NOTIFICATION_ID = 2201;
    private static final int ACCENT = Color.rgb(164, 189, 131);
    private static final int INK = Color.rgb(238, 236, 230);

    private WindowManager wm;
    private WindowManager.LayoutParams promptParams;
    private FrameLayout promptRoot;
    private LinearLayout controls;
    private TeleprompterView prompter;
    private GridOverlayView gridView;
    private boolean gridAdded = false;
    private SharedPreferences prefs;
    private Handler handler;
    private int countdownSeconds = 0;
    private TextView speedLabel;
    private TextView textSizeLabel;

    @Override
    public void onCreate() {
        super.onCreate();
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        prefs = getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE);
        handler = new Handler(getMainLooper());
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopOverlay();
            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground(NOTIFICATION_ID, buildNotification());
        if (!Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "Overlay permission is not granted.", Toast.LENGTH_LONG).show();
            stopSelf();
            return START_NOT_STICKY;
        }
        showOverlay();
        return START_STICKY;
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (promptRoot != null) handler.postDelayed(this::applyWindowGeometry, 180);
    }

    private void showOverlay() {
        if (promptRoot != null) {
            applySettingsToPrompter();
            applyWindowGeometry();
            syncGrid();
            return;
        }

        promptRoot = new FrameLayout(this);
        promptRoot.setBackgroundColor(Color.TRANSPARENT);

        LinearLayout shell = new LinearLayout(this);
        shell.setOrientation(LinearLayout.VERTICAL);
        shell.setBackgroundColor(Color.TRANSPARENT);
        promptRoot.addView(shell, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(5), dp(4), dp(5), dp(4));
        toolbar.setBackgroundColor(Color.argb(230, 12, 13, 13));

        TextView dragHandle = chip("EE", ACCENT, true);
        toolbar.addView(dragHandle, new LinearLayout.LayoutParams(dp(42), dp(38)));

        controls = new LinearLayout(this);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        controls.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.addView(controls, new LinearLayout.LayoutParams(0, dp(38), 1f));

        Button play = miniButton("▶", 34);
        Button reset = miniButton("↺", 34);
        Button slower = miniButton("−", 32);
        speedLabel = chip("32", INK, false);
        Button faster = miniButton("+", 32);
        Button textSmaller = miniButton("A−", 40);
        textSizeLabel = chip("34", INK, false);
        Button textLarger = miniButton("A+", 40);
        Button hide = miniButton("Hide", 48);
        Button close = miniButton("×", 34);

        controls.addView(play);
        controls.addView(reset);
        controls.addView(slower);
        controls.addView(speedLabel, new LinearLayout.LayoutParams(dp(38), dp(38)));
        controls.addView(faster);
        controls.addView(textSmaller);
        controls.addView(textSizeLabel, new LinearLayout.LayoutParams(dp(38), dp(38)));
        controls.addView(textLarger);
        controls.addView(hide);
        controls.addView(close);

        Button expand = miniButton("Show", 50);
        expand.setVisibility(View.GONE);
        toolbar.addView(expand);

        prompter = new TeleprompterView(this);
        shell.addView(toolbar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(46)));
        shell.addView(prompter, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        TextView resizeHandle = chip("↘", ACCENT, true);
        resizeHandle.setBackgroundColor(Color.argb(220, 12, 13, 13));
        FrameLayout.LayoutParams resizeLp = new FrameLayout.LayoutParams(dp(42), dp(42), Gravity.BOTTOM | Gravity.END);
        promptRoot.addView(resizeHandle, resizeLp);

        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        promptParams = new WindowManager.LayoutParams(
                dp(700), dp(260), type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        promptParams.gravity = Gravity.TOP | Gravity.START;

        dragHandle.setOnTouchListener(new View.OnTouchListener() {
            float startRawX, startRawY;
            int startX, startY;
            @Override public boolean onTouch(View v, MotionEvent event) {
                if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
                    startRawX = event.getRawX();
                    startRawY = event.getRawY();
                    startX = promptParams.x;
                    startY = promptParams.y;
                    return true;
                }
                if (event.getActionMasked() == MotionEvent.ACTION_MOVE) {
                    promptParams.x = startX + Math.round(event.getRawX() - startRawX);
                    promptParams.y = startY + Math.round(event.getRawY() - startRawY);
                    clampWindowPosition();
                    updateWindow();
                    return true;
                }
                if (event.getActionMasked() == MotionEvent.ACTION_UP || event.getActionMasked() == MotionEvent.ACTION_CANCEL) {
                    saveWindowGeometry();
                    return true;
                }
                return true;
            }
        });

        resizeHandle.setOnTouchListener(new View.OnTouchListener() {
            float startRawX, startRawY;
            int startW, startH;
            @Override public boolean onTouch(View v, MotionEvent event) {
                if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
                    startRawX = event.getRawX();
                    startRawY = event.getRawY();
                    startW = promptParams.width;
                    startH = promptParams.height;
                    return true;
                }
                if (event.getActionMasked() == MotionEvent.ACTION_MOVE) {
                    int screenW = getResources().getDisplayMetrics().widthPixels;
                    int screenH = getResources().getDisplayMetrics().heightPixels;
                    int desiredW = startW + Math.round(event.getRawX() - startRawX);
                    int desiredH = startH + Math.round(event.getRawY() - startRawY);
                    int maxW = Math.max(dp(280), screenW - Math.max(0, promptParams.x));
                    int maxH = Math.max(dp(170), screenH - Math.max(0, promptParams.y));
                    promptParams.width = Math.max(dp(280), Math.min(desiredW, maxW));
                    promptParams.height = Math.max(dp(170), Math.min(desiredH, maxH));
                    updateWindow();
                    return true;
                }
                if (event.getActionMasked() == MotionEvent.ACTION_UP || event.getActionMasked() == MotionEvent.ACTION_CANCEL) {
                    saveWindowGeometry();
                    return true;
                }
                return true;
            }
        });

        play.setOnClickListener(v -> {
            if (prompter.isRunning()) {
                prompter.pause();
                play.setText("▶");
            } else {
                beginScrollWithCountdown(play);
            }
        });
        reset.setOnClickListener(v -> {
            handler.removeCallbacksAndMessages(null);
            prompter.reset();
            play.setText("▶");
        });
        slower.setOnClickListener(v -> setSpeed(prompter.getSpeedRounded() - 2));
        faster.setOnClickListener(v -> setSpeed(prompter.getSpeedRounded() + 2));
        textSmaller.setOnClickListener(v -> setTextSize(prompter.getTextSizeRounded() - 2));
        textLarger.setOnClickListener(v -> setTextSize(prompter.getTextSizeRounded() + 2));
        hide.setOnClickListener(v -> {
            controls.setVisibility(View.GONE);
            expand.setVisibility(View.VISIBLE);
        });
        expand.setOnClickListener(v -> {
            controls.setVisibility(View.VISIBLE);
            expand.setVisibility(View.GONE);
        });
        close.setOnClickListener(v -> {
            stopOverlay();
            stopSelf();
        });

        prompter.setReadingLineListener(percent ->
                prefs.edit().putInt("readingLine", percent).apply());

        applySettingsToPrompter();
        refreshLiveLabels();
        applyWindowGeometry();
        syncGrid();
        wm.addView(promptRoot, promptParams);
    }

    private void setSpeed(int value) {
        int next = Math.max(8, Math.min(90, value));
        prompter.setSpeed(next);
        prefs.edit().putInt("speed", next).apply();
        refreshLiveLabels();
    }

    private void setTextSize(int value) {
        int next = Math.max(18, Math.min(72, value));
        prompter.setTextSizeSp(next);
        prefs.edit().putInt("textSize", next).apply();
        refreshLiveLabels();
    }

    private void refreshLiveLabels() {
        if (prompter == null) return;
        if (speedLabel != null) speedLabel.setText(String.valueOf(prompter.getSpeedRounded()));
        if (textSizeLabel != null) textSizeLabel.setText(String.valueOf(prompter.getTextSizeRounded()));
    }

    private void beginScrollWithCountdown(Button play) {
        if (countdownSeconds <= 0) {
            prompter.setCountdown(null);
            prompter.start();
            play.setText("❚❚");
            return;
        }
        handler.removeCallbacksAndMessages(null);
        final int[] left = {countdownSeconds};
        prompter.setCountdown(left[0]);
        play.setText("…");
        Runnable ticker = new Runnable() {
            @Override public void run() {
                left[0]--;
                if (left[0] <= 0) {
                    prompter.setCountdown(null);
                    prompter.start();
                    play.setText("❚❚");
                } else {
                    prompter.setCountdown(left[0]);
                    handler.postDelayed(this, 1000);
                }
            }
        };
        handler.postDelayed(ticker, 1000);
    }

    private void applySettingsToPrompter() {
        String text = prefs.getString("script", "");
        int size = prefs.getInt("textSize", 34);
        int line = prefs.getInt("readingLine", 55);
        int speed = prefs.getInt("speed", 32);
        int bg = prefs.getInt("background", 1);
        int countdownIndex = prefs.getInt("countdown", 1);
        countdownSeconds = countdownIndex == 1 ? 3 : countdownIndex == 2 ? 5 : 0;
        if (prompter != null) prompter.configure(text, size, line, speed, bg);
        refreshLiveLabels();
    }

    private String geometrySuffix() {
        return getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE ? "_land" : "_port";
    }

    private void applyWindowGeometry() {
        if (promptParams == null) return;
        int screenW = getResources().getDisplayMetrics().widthPixels;
        int screenH = getResources().getDisplayMetrics().heightPixels;
        String s = geometrySuffix();

        int savedW = prefs.getInt("windowW" + s, -1);
        int savedH = prefs.getInt("windowH" + s, -1);
        int savedX = prefs.getInt("windowX" + s, -1);
        int savedY = prefs.getInt("windowY" + s, -1);

        if (savedW > 0 && savedH > 0) {
            promptParams.width = Math.max(dp(280), Math.min(savedW, screenW));
            promptParams.height = Math.max(dp(170), Math.min(savedH, screenH));
            promptParams.x = Math.max(0, Math.min(savedX, Math.max(0, screenW - promptParams.width)));
            promptParams.y = Math.max(0, Math.min(savedY, Math.max(0, screenH - promptParams.height)));
        } else {
            int width = Math.min(screenW, Math.max(dp(320), Math.round(screenW * 0.80f)));
            int height = Math.min(screenH, Math.max(dp(210), Math.round(screenH * 0.34f)));
            promptParams.width = width;
            promptParams.height = height;
            promptParams.x = Math.max(0, (screenW - width) / 2);
            promptParams.y = Math.max(0, Math.round(screenH * 0.12f));
        }
        updateWindow();
    }

    private void clampWindowPosition() {
        int screenW = getResources().getDisplayMetrics().widthPixels;
        int screenH = getResources().getDisplayMetrics().heightPixels;
        promptParams.x = Math.max(0, Math.min(promptParams.x, Math.max(0, screenW - promptParams.width)));
        promptParams.y = Math.max(0, Math.min(promptParams.y, Math.max(0, screenH - promptParams.height)));
    }

    private void saveWindowGeometry() {
        if (promptParams == null) return;
        String s = geometrySuffix();
        prefs.edit()
                .putInt("windowW" + s, promptParams.width)
                .putInt("windowH" + s, promptParams.height)
                .putInt("windowX" + s, promptParams.x)
                .putInt("windowY" + s, promptParams.y)
                .apply();
    }

    private void updateWindow() {
        if (promptRoot != null && promptRoot.getWindowToken() != null) {
            try { wm.updateViewLayout(promptRoot, promptParams); } catch (Exception ignored) { }
        }
    }

    private void syncGrid() {
        boolean wantsGrid = prefs.getBoolean("grid", false);
        if (wantsGrid && !gridAdded) {
            gridView = new GridOverlayView(this);
            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE;
            WindowManager.LayoutParams gp = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT,
                    type,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                            | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                            | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                            | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.TRANSLUCENT);
            gp.gravity = Gravity.TOP | Gravity.START;
            wm.addView(gridView, gp);
            gridAdded = true;
        } else if (!wantsGrid && gridAdded) {
            try { wm.removeView(gridView); } catch (Exception ignored) { }
            gridAdded = false;
            gridView = null;
        }
    }

    private void stopOverlay() {
        handler.removeCallbacksAndMessages(null);
        if (promptRoot != null) {
            saveWindowGeometry();
            try { wm.removeView(promptRoot); } catch (Exception ignored) { }
            promptRoot = null;
            prompter = null;
            promptParams = null;
            speedLabel = null;
            textSizeLabel = null;
        }
        if (gridAdded && gridView != null) {
            try { wm.removeView(gridView); } catch (Exception ignored) { }
            gridAdded = false;
            gridView = null;
        }
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
    }

    @Override
    public void onDestroy() {
        stopOverlay();
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Teleprompter overlay",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Keeps the EXAPTER ENDAPTER teleprompter overlay available while Pixel Camera is open.");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent openPi = PendingIntent.getActivity(
                this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent stop = new Intent(this, OverlayService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(
                this, 1, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        return b.setSmallIcon(android.R.drawable.ic_menu_view)
                .setContentTitle("EXAPTER ENDAPTER Prompter")
                .setContentText("Teleprompter overlay is active")
                .setContentIntent(openPi)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(
                        android.R.drawable.ic_menu_close_clear_cancel,
                        "Stop overlay",
                        stopPi).build())
                .build();
    }

    private Button miniButton(String text, int widthDp) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextSize(10);
        b.setTextColor(INK);
        b.setAllCaps(false);
        b.setPadding(dp(2), 0, dp(2), 0);
        b.setMinWidth(0);
        b.setMinimumWidth(0);
        b.setMinHeight(0);
        b.setMinimumHeight(0);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(42, 44, 43)));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(widthDp), dp(36));
        lp.setMargins(dp(1), 0, dp(1), 0);
        b.setLayoutParams(lp);
        return b;
    }

    private TextView chip(String text, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(text);
        t.setTextColor(color);
        t.setTextSize(11);
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        t.setPadding(dp(3), 0, dp(3), 0);
        return t;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
