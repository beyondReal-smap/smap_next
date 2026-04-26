package com.dmonster.smap

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class LocationRestartReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "LocationRestartReceiver"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: "manual_restart"
        Log.d(TAG, "Received restart trigger: $action")
        // BroadcastReceiver는 background 컨텍스트에서 호출되므로 BG location 권한이 있어야
        // FGS를 새로 시작할 수 있다(Android 12+/14+ background-start restriction). 권한이 없으면
        // 사용자 다음 진입 시 MainActivity 경로에서 다시 시작된다.
        LocationService.startIfEligible(context, action, requireBackgroundPermission = true)
    }
}
