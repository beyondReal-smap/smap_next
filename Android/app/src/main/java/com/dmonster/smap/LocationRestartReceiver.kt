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
        LocationService.startIfEligible(context, action)
    }
}
