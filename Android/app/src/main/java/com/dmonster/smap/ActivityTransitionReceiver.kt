package com.dmonster.smap

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity

/**
 * ActivityRecognition Transition API 콜백 수신기.
 *
 * 이전 동작은 LocationService가 GPS 콜백 안에서만 speed 기반으로 모드를 판단했다 →
 * STATIONARY 진입 후 다음 GPS 콜백(분 단위)까지 WALKING/AUTOMOTIVE로 못 깨어나는 stuck 발생.
 *
 * 본 receiver는 GPS와 독립적으로 motion 변화를 감지하여 LocationService에 모드 전환 신호를 전달한다.
 * iOS의 CMMotionActivityManager + MotionManager 흐름과 1:1 대응.
 */
class ActivityTransitionReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "ActivityTransition"
        const val ACTION_MODE_TRANSITION = "com.dmonster.smap.ACTION_MODE_TRANSITION"
        const val EXTRA_TARGET_MODE = "target_mode"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        intent ?: return
        if (!ActivityTransitionResult.hasResult(intent)) return

        val result = ActivityTransitionResult.extractResult(intent) ?: return

        // 가장 최근 ENTER transition만 처리. EXIT은 별도 ENTER로 항상 짝지어 들어오므로 무시.
        val latestEnter = result.transitionEvents.lastOrNull {
            it.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER
        } ?: return

        val targetMode = when (latestEnter.activityType) {
            DetectedActivity.IN_VEHICLE -> "AUTOMOTIVE"
            DetectedActivity.WALKING,
            DetectedActivity.RUNNING,
            DetectedActivity.ON_BICYCLE -> "WALKING"
            DetectedActivity.STILL -> "STATIONARY"
            // UNKNOWN/TILTING 등은 모드 전환 신호로 사용하지 않는다 — false positive 방지.
            else -> {
                Log.d(TAG, "Ignored activity type: ${latestEnter.activityType}")
                return
            }
        }

        Log.d(TAG, "Activity transition ENTER: type=${latestEnter.activityType} -> $targetMode")

        // LocationService가 실행 중이지 않으면 startService가 onStartCommand에서 startForeground를
        // 호출해 띄우므로 ANR 위험은 없다(현재 구현 기준). 단 BG에서 새로 띄울 때는 권한이 필요하다.
        val serviceIntent = Intent(context, LocationService::class.java)
            .setAction(ACTION_MODE_TRANSITION)
            .putExtra(EXTRA_TARGET_MODE, targetMode)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        } catch (e: Exception) {
            // Android 12+/14+의 background-start 제한, 또는 BG 권한 없는 사용자가 백그라운드에서
            // transition을 받았을 때 발생할 수 있다. 이 경우 mode 전환은 다음 GPS 콜백 기반 fallback에 위임.
            Log.w(TAG, "Failed to deliver mode transition", e)
        }
    }
}
