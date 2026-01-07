package com.dmonster.smap.ui.activitylog

import android.content.Context
import android.graphics.*
import android.graphics.Color as AndroidColor
import android.text.TextPaint
import androidx.core.content.res.ResourcesCompat
import com.dmonster.smap.R

/**
 * Utility for drawing high-quality markers for the Activity Log
 */
object ActivityLogMarkerUtils {

    /**
     * Creates a stay marker bitmap with a vivid circle and a black duration capsule.
     */
    fun createStayMarkerBitmap(
        context: Context,
        number: Int,
        durationText: String,
        markerColor: Int,
        markerSizePx: Float
    ): Bitmap {
        val suiteBold = ResourcesCompat.getFont(context, R.font.suite_bold)
        val suiteMedium = ResourcesCompat.getFont(context, R.font.suite_medium)

        // 1. Setup Paints
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        
        val numberPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.WHITE
            textSize = markerSizePx * 0.45f
            typeface = suiteBold ?: Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }

        val durationPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.WHITE
            textSize = 28f // Fixed size for duration label
            typeface = suiteMedium ?: Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
            textAlign = Paint.Align.CENTER
        }

        // 2. Measure Duration Box
        val textWidth = durationPaint.measureText(durationText)
        val boxPaddingH = 16f
        val boxPaddingV = 8f
        val boxWidth = textWidth + (boxPaddingH * 2)
        val boxHeight = durationPaint.textSize + (boxPaddingV * 2)

        // 3. Calculate Canvas Dimensions
        // We want the circle and the box to be side-by-side with a slight overlap/offset
        val margin = 20f
        val canvasWidth = markerSizePx + boxWidth + margin
        val canvasHeight = maxOf(markerSizePx, boxHeight) + margin * 2

        val bitmap = Bitmap.createBitmap(canvasWidth.toInt(), canvasHeight.toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // vertical centering helper
        val midY = canvasHeight / 2

        // 4. Draw Circle (Marker) with Border
        val circleX = markerSizePx / 2 + margin / 2
        val density = context.resources.displayMetrics.density
        val borderWidth = 1.5f * density
        
        // Outer Border (White)
        paint.color = AndroidColor.WHITE
        canvas.drawCircle(circleX, midY, markerSizePx / 2, paint)
        
        // Inner Circle (Colored)
        paint.color = markerColor
        canvas.drawCircle(circleX, midY, (markerSizePx / 2) - borderWidth, paint)

        // 5. Draw Number inside Circle
        val numberMetrics = numberPaint.fontMetrics
        val numberBaseline = midY - (numberMetrics.descent + numberMetrics.ascent) / 2
        canvas.drawText(number.toString(), circleX, numberBaseline, numberPaint)

        // 6. Draw Duration Box (Black Capsule)
        // Position it to the right of the circle, slightly overlapping or touching
        val boxX = circleX + markerSizePx / 2 - 10f // slight overlap
        val boxRect = RectF(
            boxX,
            midY - boxHeight / 2,
            boxX + boxWidth,
            midY + boxHeight / 2
        )
        
        paint.color = AndroidColor.parseColor("#1F2937") // iOS Dark Gray/Black
        canvas.drawRoundRect(boxRect, boxHeight / 2, boxHeight / 2, paint)

        // 7. Draw Duration Text inside Box
        val durationMetrics = durationPaint.fontMetrics
        val durationBaseline = midY - (durationMetrics.descent + durationMetrics.ascent) / 2
        canvas.drawText(durationText, boxRect.centerX(), durationBaseline, durationPaint)

        return bitmap
    }
}
