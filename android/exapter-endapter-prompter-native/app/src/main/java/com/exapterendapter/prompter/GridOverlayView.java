package com.exapterendapter.prompter;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.view.View;

public class GridOverlayView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

    public GridOverlayView(Context context) {
        super(context);
        paint.setColor(Color.argb(105, 255, 255, 255));
        paint.setStrokeWidth(getResources().getDisplayMetrics().density);
        setBackgroundColor(Color.TRANSPARENT);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float w = getWidth();
        float h = getHeight();
        canvas.drawLine(w / 3f, 0, w / 3f, h, paint);
        canvas.drawLine(w * 2f / 3f, 0, w * 2f / 3f, h, paint);
        canvas.drawLine(0, h / 3f, w, h / 3f, paint);
        canvas.drawLine(0, h * 2f / 3f, w, h * 2f / 3f, paint);
    }
}
