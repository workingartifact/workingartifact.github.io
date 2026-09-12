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
    private LinearLayout promptRoot;
    private LinearLayout controls;
    private TeleprompterView prompter;
    private GridOverlayView gridView;
    private boolean gridAdded = false;
    private SharedPreferences prefs;
    private Handler handler;
    private int countdownSeconds = 0;

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
        if (promptRoot != null) {
            handler.postDelayed(this::applyWindowGeometry, 180);
        }
    }

    private void showOverlay() {
        if (promptRoot != null) {
            applySettingsToPrompter();
            applyWindowGeometry();
            syncGrid();
            return;
        }

        promptRoot = new LinearLayout(this);
        promptRoot.setOrientation(LinearLayout.VERTICAL);
        promptRoot.setBackgroundColor(Color.TRANSPARENT);

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(6), dp(4), dp(6), dp(4));
        toolbar.setBackgroundColor(Color.argb(230, 12, 13, 13));

        TextView dragHandle = new TextView(this);
        dragHandle.setText("EE");
        dragHandle.setTextColor(ACCENT);
        dragHandle.setTextSize(13);
        dragHandle.setGravity(Gravity.CENTER);
        dragHandle.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        dragHandle.setPadding(dp(10), dp(7), dp(10), dp(7));
        toolbar.addView(dragHandle, new LinearLayout.LayoutParams(dp(48), ViewGroup.LayoutParams.WRAP_CONTENT));

        controls = new LinearLayout(this);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        controls.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.addView(controls, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        Button play = miniButton("▶");
        Button reset = miniButton("↺");
        Button slower = miniButton("−");
        Button faster = miniButton("+");
        TextView speedLabel = new TextView(this);
        speedLabel.setTextColor(INK);
        speedLabel.setTextSize(11);
        speedLabel.setGravity(Gravity.CENTER);
        speedLabel.setPadding(dp(5), 0, dp(5), 0);
        Button hide = miniButton("Hide");
        Button close = miniButton("×");

        controls.addView(play);
        controls.addView(reset);
        controls.addView(slower);
        controls.addView(speedLabel, new LinearLayout.LayoutParams(dp(58), dp(38)));
        controls.addView(faster);
        controls.addView(hide);
        controls.addView(close);

        Button expand = miniButton("Show");
        expand.setVisibility(View.GONE);
        toolbar.addView(expand);

        prompter = new TeleprompterView(this);
        promptRoot.addView(toolbar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(46)));
        promptRoot.addView(prompter, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

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
                if (event.getAction() == MotionEvent.ACTION_DOWN) {
                    startRawX = event.getRawX();
                    startRawY = event.getRawY();
                    startX = promptParams.x;
                    startY = promptParams.y;
                    return true;
                }
                if (event.getAction() == MotionEvent.ACTION_MOVE) {
                    promptParams.x = startX + Math.round(event.getRawX() - startRawX);
                    promptParams.y = startY + Math.round(event.getRawY() - startRawY);
                    try { wm.updateViewLayout(promptRoot, promptParams); } catch (Exception ignored) { }
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
        slower.setOnClickListener(v -> {
            int next = Math.max(8, prompter.getSpeedRounded() - 2);
            prompter.setSpeed(next);
            speedLabel.setText(next + "");
        });
        faster.setOnClickListener(v -> {
            int next = Math.min(90, prompter.getSpeedRounded() + 2);
            prompter.setSpeed(next);
            speedLabel.setText(next + "");
        });
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

        applySettingsToPrompter();
        speedLabel.setText(String.valueOf(prefs.getInt("speed", 32)));
        applyWindowGeometry();
        syncGrid();
        wm.addView(promptRoot, promptParams);
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
        int line = prefs.getInt("readingLine", 50);
        int speed = prefs.getInt("speed", 32);
        int bg = prefs.getInt("background", 1);
        int countdownIndex = prefs.getInt("countdown", 1);
        countdownSeconds = countdownIndex == 1 ? 3 : countdownIndex == 2 ? 5 : 0;
        if (prompter != null) prompter.configure(text, size, line, speed, bg);
    }

    private void applyWindowGeometry() {
        if (promptParams == null) return;
        int screenW = getResources().getDisplayMetrics().widthPixels;
        int screenH = getResources().getDisplayMetrics().heightPixels;
        int widthPct = prefs.getInt("promptWidth", 76);
        int posPct = prefs.getInt("promptPosition", 18);

        int width = Math.max(dp(280), Math.round(screenW * widthPct / 100f));
        width = Math.min(width, screenW);
        int bodyHeight = Math.max(dp(160), Math.min(dp(360), Math.round(screenH * 0.42f)));
        int totalHeight = bodyHeight + dp(46);
        int bottomGap = Math.round(screenH * posPct / 100f);
        int y = screenH - totalHeight - bottomGap;
        y = Math.max(0, Math.min(y, Math.max(0, screenH - totalHeight)));
        int x = Math.max(0, (screenW - width) / 2);

        promptParams.width = width;
        promptParams.height = totalHeight;
        promptParams.x = x;
        promptParams.y = y;

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
            try { wm.removeView(promptRoot); } catch (Exception ignored) { }
            promptRoot = null;
            prompter = null;
            promptParams = null;
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

    private Button miniButton(String text) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextSize(11);
        b.setTextColor(INK);
        b.setAllCaps(false);
        b.setPadding(dp(4), 0, dp(4), 0);
        b.setMinWidth(0);
        b.setMinimumWidth(0);
        b.setMinHeight(0);
        b.setMinimumHeight(0);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(42, 44, 43)));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(text.length() > 2 ? 56 : 42), dp(38));
        lp.setMargins(dp(2), 0, dp(2), 0);
        b.setLayoutParams(lp);
        return b;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
