package com.exapterendapter.prompter;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.SystemClock;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;

public class TeleprompterView extends View {
    public interface ReadingLineListener { void onChanged(int percent); }

    private static final int[] TEXT_COLORS = new int[]{
            Color.WHITE,
            Color.BLACK,
            Color.rgb(239, 83, 80),
            Color.rgb(255, 235, 59),
            Color.rgb(164, 189, 131),
            Color.rgb(77, 208, 225)
    };

    private static final String[] TEXT_COLOR_NAMES = new String[]{
            "White", "Black", "Red", "Yellow", "Green", "Cyan"
    };

    private final TextPaint textPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
    private final Paint guidePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint shadePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint countdownPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint guideGripPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private StaticLayout layout;
    private String script = "";
    private float textSizeSp = 34f;
    private float readingLinePercent = 55f;
    private float speedDpPerSecond = 32f;
    private float scrollOffset = 0f;
    private float maxScrollOffset = 0f;
    private boolean running = false;
    private boolean draggingGuide = false;
    private boolean draggingText = false;
    private boolean resumeAfterManualDrag = false;
    private float touchStartY = 0f;
    private float touchStartOffset = 0f;
    private long lastFrameMs = 0L;
    private int shadeMode = 1;
    private int textColorIndex = 0;
    private Integer countdownValue = null;
    private ReadingLineListener readingLineListener;

    public TeleprompterView(Context context) { super(context); init(); }
    public TeleprompterView(Context context, AttributeSet attrs) { super(context, attrs); init(); }

    private void init() {
        setWillNotDraw(false);
        applyTextColor();
        textPaint.setTextAlign(Paint.Align.LEFT);
        guidePaint.setColor(Color.rgb(164, 189, 131));
        guidePaint.setStrokeWidth(dp(2));
        guideGripPaint.setColor(Color.rgb(164, 189, 131));
        shadePaint.setColor(Color.argb(42, 0, 0, 0));
        countdownPaint.setColor(Color.WHITE);
        countdownPaint.setTextAlign(Paint.Align.CENTER);
        countdownPaint.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        countdownPaint.setShadowLayer(dp(4), 0, dp(2), Color.BLACK);
    }

    public void configure(String text, int textSize, int readingLine, int speed, int backgroundMode, int colorIndex) {
        script = (text == null || text.trim().isEmpty())
                ? "Paste a script in EXAPTER ENDAPTER Prompter, then relaunch the overlay."
                : text;
        textSizeSp = textSize;
        readingLinePercent = readingLine;
        speedDpPerSecond = speed;
        shadeMode = backgroundMode;
        setTextColorIndex(colorIndex);
        scrollOffset = 0f;
        running = false;
        rebuildLayout();
        invalidate();
    }

    public void setSpeed(int speed) { speedDpPerSecond = Math.max(1, speed); }
    public int getSpeedRounded() { return Math.round(speedDpPerSecond); }

    public void setTextSizeSp(int textSize) {
        textSizeSp = Math.max(18, Math.min(72, textSize));
        rebuildLayout();
        invalidate();
    }
    public int getTextSizeRounded() { return Math.round(textSizeSp); }

    public void setTextColorIndex(int index) {
        textColorIndex = Math.max(0, Math.min(TEXT_COLORS.length - 1, index));
        applyTextColor();
        invalidate();
    }

    public int getTextColorIndex() { return textColorIndex; }
    public int getTextColor() { return TEXT_COLORS[textColorIndex]; }
    public int getTextColorCount() { return TEXT_COLORS.length; }
    public String getTextColorName() { return TEXT_COLOR_NAMES[textColorIndex]; }

    private void applyTextColor() {
        int color = TEXT_COLORS[Math.max(0, Math.min(TEXT_COLORS.length - 1, textColorIndex))];
        textPaint.setColor(color);
        if (color == Color.BLACK) {
            textPaint.setShadowLayer(dp(2.4f), 0, dp(1), Color.WHITE);
        } else {
            textPaint.setShadowLayer(dp(2.4f), 0, dp(1), Color.BLACK);
        }
    }

    public void setReadingLine(int percent) {
        readingLinePercent = Math.max(15, Math.min(85, percent));
        invalidate();
    }
    public int getReadingLineRounded() { return Math.round(readingLinePercent); }
    public void setReadingLineListener(ReadingLineListener listener) { readingLineListener = listener; }

    public void start() {
        if (layout == null) rebuildLayout();
        running = true;
        lastFrameMs = SystemClock.uptimeMillis();
        postOnAnimation(frameRunnable);
    }

    public void pause() { running = false; invalidate(); }
    public boolean isRunning() { return running; }

    public void reset() {
        running = false;
        scrollOffset = 0f;
        countdownValue = null;
        invalidate();
    }

    public void setCountdown(Integer value) { countdownValue = value; invalidate(); }

    private final Runnable frameRunnable = new Runnable() {
        @Override public void run() {
            if (!running) return;
            long now = SystemClock.uptimeMillis();
            float dt = Math.min(0.08f, (now - lastFrameMs) / 1000f);
            lastFrameMs = now;
            float density = getResources().getDisplayMetrics().density;
            scrollOffset += speedDpPerSecond * density * dt;
            if (scrollOffset >= maxScrollOffset) {
                scrollOffset = maxScrollOffset;
                running = false;
            }
            invalidate();
            if (running) postOnAnimation(this);
        }
    };

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        rebuildLayout();
    }

    private void rebuildLayout() {
        int width = getWidth() - dp(28);
        if (width <= dp(40)) return;
        textPaint.setTextSize(sp(textSizeSp));
        layout = StaticLayout.Builder.obtain(script, 0, script.length(), textPaint, width)
                .setAlignment(Layout.Alignment.ALIGN_CENTER)
                .setIncludePad(true)
                .setLineSpacing(dp(4), 1.08f)
                .build();

        if (layout.getLineCount() > 0) {
            float firstCenter = (layout.getLineTop(0) + layout.getLineBottom(0)) / 2f;
            int last = layout.getLineCount() - 1;
            float lastCenter = (layout.getLineTop(last) + layout.getLineBottom(last)) / 2f;
            maxScrollOffset = Math.max(0f, lastCenter - firstCenter);
            scrollOffset = Math.min(scrollOffset, maxScrollOffset);
        }
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        float guideY = getHeight() * (readingLinePercent / 100f);
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                draggingGuide = event.getX() >= getWidth() - dp(70)
                        && Math.abs(event.getY() - guideY) <= dp(32);
                draggingText = !draggingGuide;
                if (draggingText) {
                    touchStartY = event.getY();
                    touchStartOffset = scrollOffset;
                    resumeAfterManualDrag = running;
                    running = false;
                }
                getParent().requestDisallowInterceptTouchEvent(true);
                return true;

            case MotionEvent.ACTION_MOVE:
                if (draggingGuide) {
                    setReadingLine(Math.round(100f * event.getY() / Math.max(1, getHeight())));
                    if (readingLineListener != null) readingLineListener.onChanged(getReadingLineRounded());
                    return true;
                }
                if (draggingText) {
                    float delta = touchStartY - event.getY();
                    scrollOffset = Math.max(0f, Math.min(maxScrollOffset, touchStartOffset + delta));
                    invalidate();
                    return true;
                }
                return true;

            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                if (draggingGuide) {
                    draggingGuide = false;
                    if (readingLineListener != null) readingLineListener.onChanged(getReadingLineRounded());
                }
                if (draggingText) {
                    draggingText = false;
                    boolean resume = resumeAfterManualDrag;
                    resumeAfterManualDrag = false;
                    if (resume && event.getActionMasked() == MotionEvent.ACTION_UP) start();
                    else invalidate();
                }
                getParent().requestDisallowInterceptTouchEvent(false);
                return true;
        }
        return true;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);

        if (shadeMode == 1) shadePaint.setColor(Color.argb(42, 0, 0, 0));
        else if (shadeMode == 2) shadePaint.setColor(Color.argb(98, 0, 0, 0));
        else shadePaint.setColor(Color.TRANSPARENT);
        canvas.drawRect(0, 0, getWidth(), getHeight(), shadePaint);

        float guideY = getHeight() * (readingLinePercent / 100f);
        canvas.drawLine(dp(10), guideY, getWidth() - dp(10), guideY, guidePaint);
        canvas.drawCircle(getWidth() - dp(18), guideY, dp(6), guideGripPaint);

        if (layout != null && layout.getLineCount() > 0) {
            float firstCenter = (layout.getLineTop(0) + layout.getLineBottom(0)) / 2f;
            float startY = guideY - firstCenter - scrollOffset;
            canvas.save();
            canvas.clipRect(dp(8), 0, getWidth() - dp(8), getHeight());
            canvas.translate(dp(14), startY);
            layout.draw(canvas);
            canvas.restore();
        }

        if (countdownValue != null) {
            countdownPaint.setTextSize(sp(68));
            Paint.FontMetrics fm = countdownPaint.getFontMetrics();
            float baseline = getHeight() / 2f - (fm.ascent + fm.descent) / 2f;
            canvas.drawText(String.valueOf(countdownValue), getWidth() / 2f, baseline, countdownPaint);
        }
    }

    private int dp(float value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private float sp(float value) { return value * getResources().getDisplayMetrics().scaledDensity; }
}
