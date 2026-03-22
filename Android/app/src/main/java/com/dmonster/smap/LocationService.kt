package com.dmonster.smap

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.CreateLocationLogRequest
import com.google.android.gms.location.*
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.*
import java.text.SimpleDateFormat
import java.util.*

/**
 * Adaptive 3-mode foreground location service for battery-efficient tracking.
 *
 * Modes:
 *  - STATIONARY : low-power, 5 min interval, 500 m displacement, 15 min heartbeat
 *  - WALKING    : high-accuracy, 30 s interval, 30 m displacement, 1 min batch
 *  - AUTOMOTIVE : high-accuracy, 15 s interval, 100 m displacement, 1 min batch
 *
 * Mode is detected from GPS speed with a 5-minute dwell timer before entering
 * STATIONARY, and instant upgrade to WALKING/AUTOMOTIVE when movement resumes.
 */
class LocationService : Service() {

    // ── Hilt entry point (Service cannot use @Inject) ──────────────────────

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface LocationServiceEntryPoint {
        fun smapApi(): SmapApi
    }

    private val smapApi: SmapApi by lazy {
        EntryPointAccessors.fromApplication(
            applicationContext, LocationServiceEntryPoint::class.java
        ).smapApi()
    }

    // ── Power modes ────────────────────────────────────────────────────────

    enum class PowerMode { STATIONARY, WALKING, AUTOMOTIVE }

    private var currentMode = PowerMode.WALKING

    // ── Location client ────────────────────────────────────────────────────

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationRequest: LocationRequest

    // ── Activity / mode detection ──────────────────────────────────────────

    private var stationaryStartTime: Long = 0L
    private var lastLocation: Location? = null

    // ── Location batching ──────────────────────────────────────────────────

    private val pendingLocations = mutableListOf<CreateLocationLogRequest>()
    private val maxQueueSize = 100
    private var batchTimer: Timer? = null
    private var heartbeatTimer: Timer? = null

    // ── Coroutine scope ────────────────────────────────────────────────────

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // ── Constants ──────────────────────────────────────────────────────────

    companion object {
        private const val TAG = "LocationService"
        private const val NOTIFICATION_CHANNEL_ID = "LocationServiceChannel"
        private const val NOTIFICATION_ID = 10000

        private const val STATIONARY_DWELL_MS = 5 * 60 * 1000L  // 5 min before entering stationary
        private const val HEARTBEAT_INTERVAL_MS = 900_000L       // 15 min
        private const val BATCH_INTERVAL_MS = 60_000L            // 1 min

        fun isRunning(context: Context): Boolean {
            val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
            return manager.getRunningServices(Integer.MAX_VALUE)
                .any { it.service.className == LocationService::class.java.name }
        }
    }

    // ── Location callback ──────────────────────────────────────────────────

    private val locationCallback: LocationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.locations.lastOrNull()?.let { location ->
                if (!isValidCoordinate(location)) return

                // Detect power mode from speed
                detectModeFromLocation(location)

                // Build request and enqueue
                val request = buildLocationLogRequest(location) ?: return
                enqueueLocation(request)
                lastLocation = location
            }
        }
    }

    // ── Service lifecycle ──────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        locationRequest = createLocationRequest(PowerMode.WALKING)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "LocationService starting")

        // Android 14+ foreground service location permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.FOREGROUND_SERVICE_LOCATION)
                != PackageManager.PERMISSION_GRANTED
            ) {
                Log.e(TAG, "FOREGROUND_SERVICE_LOCATION permission missing")
                stopSelf()
                return START_NOT_STICKY
            }
        }

        // Location permission
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.e(TAG, "Location permission missing")
            stopSelf()
            return START_NOT_STICKY
        }

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification(currentMode))
        startLocationTracking()
        startTimerForMode(currentMode)

        Log.d(TAG, "LocationService started in ${currentMode.name} mode")
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        batchTimer?.cancel()
        heartbeatTimer?.cancel()
        flushPendingLocations()
        serviceScope.cancel()
        Log.d(TAG, "LocationService destroyed")
    }

    // ── Location request per mode ──────────────────────────────────────────

    private fun createLocationRequest(mode: PowerMode): LocationRequest {
        return when (mode) {
            PowerMode.STATIONARY -> LocationRequest.Builder(
                Priority.PRIORITY_LOW_POWER, 300_000L  // 5 min
            ).setMinUpdateDistanceMeters(500f)
                .setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
                .build()

            PowerMode.WALKING -> LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, 30_000L  // 30 sec
            ).setMinUpdateDistanceMeters(30f)
                .setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
                .setWaitForAccurateLocation(true)
                .build()

            PowerMode.AUTOMOTIVE -> LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, 15_000L  // 15 sec
            ).setMinUpdateDistanceMeters(100f)
                .setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
                .setWaitForAccurateLocation(true)
                .build()
        }
    }

    // ── Tracking ───────────────────────────────────────────────────────────

    private fun startLocationTracking() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) return

        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.myLooper()
        )
    }

    // ── Mode detection (speed-based) ───────────────────────────────────────

    private fun detectModeFromLocation(location: Location) {
        val speed = if (location.speed < 0f) 0f else location.speed  // m/s

        val detectedMode = when {
            speed < 0.5f  -> PowerMode.STATIONARY  // < 1.8 km/h
            speed < 8.0f  -> PowerMode.WALKING     // < 28.8 km/h (walk / run / cycle)
            else          -> PowerMode.AUTOMOTIVE   // > 28.8 km/h
        }

        if (detectedMode == PowerMode.STATIONARY) {
            // Only enter stationary after dwelling for STATIONARY_DWELL_MS
            if (stationaryStartTime == 0L) {
                stationaryStartTime = System.currentTimeMillis()
            } else if (System.currentTimeMillis() - stationaryStartTime > STATIONARY_DWELL_MS) {
                switchToMode(PowerMode.STATIONARY)
            }
        } else {
            // Moving: reset dwell timer & switch immediately
            stationaryStartTime = 0L
            switchToMode(detectedMode)
        }
    }

    // ── Mode switching ─────────────────────────────────────────────────────

    private fun switchToMode(newMode: PowerMode) {
        if (newMode == currentMode) return
        Log.d(TAG, "Mode: ${currentMode.name} -> ${newMode.name}")
        currentMode = newMode

        // Flush pending before reconfiguring
        flushPendingLocations()

        // Stop old timers
        batchTimer?.cancel()
        heartbeatTimer?.cancel()

        // Reconfigure location request
        fusedLocationClient.removeLocationUpdates(locationCallback)
        locationRequest = createLocationRequest(newMode)
        startLocationTracking()

        // Start appropriate timer
        startTimerForMode(newMode)

        // Update notification
        updateNotification(newMode)
    }

    private fun startTimerForMode(mode: PowerMode) {
        when (mode) {
            PowerMode.STATIONARY -> startHeartbeatTimer()
            PowerMode.WALKING,
            PowerMode.AUTOMOTIVE -> startBatchTimer()
        }
    }

    // ── Batching ───────────────────────────────────────────────────────────

    private fun enqueueLocation(data: CreateLocationLogRequest) {
        synchronized(pendingLocations) {
            pendingLocations.add(data)
            if (pendingLocations.size > maxQueueSize) {
                pendingLocations.removeAt(0)  // evict oldest
            }
        }
    }

    private fun startBatchTimer() {
        batchTimer?.cancel()
        batchTimer = Timer().apply {
            scheduleAtFixedRate(object : TimerTask() {
                override fun run() { flushPendingLocations() }
            }, BATCH_INTERVAL_MS, BATCH_INTERVAL_MS)
        }
    }

    private fun startHeartbeatTimer() {
        heartbeatTimer?.cancel()
        heartbeatTimer = Timer().apply {
            scheduleAtFixedRate(object : TimerTask() {
                override fun run() { sendHeartbeat() }
            }, HEARTBEAT_INTERVAL_MS, HEARTBEAT_INTERVAL_MS)
        }
    }

    private fun flushPendingLocations() {
        val toSend: List<CreateLocationLogRequest>
        synchronized(pendingLocations) {
            if (pendingLocations.isEmpty()) return
            toSend = pendingLocations.toList()
            pendingLocations.clear()
        }
        toSend.forEach { request ->
            serviceScope.launch { sendLocationToServer(request) }
        }
    }

    /**
     * Heartbeat: re-send the last known location so the server knows the device
     * is still alive during long stationary periods.
     */
    private fun sendHeartbeat() {
        val loc = lastLocation ?: return
        val request = buildLocationLogRequest(loc) ?: return
        serviceScope.launch { sendLocationToServer(request) }
    }

    // ── Build request model ────────────────────────────────────────────────

    private fun buildLocationLogRequest(location: Location): CreateLocationLogRequest? {
        val prefs = getSharedPreferences("smap_auth_prefs", Context.MODE_PRIVATE)
        val mtIdxInt = prefs.getInt("mt_idx", -1)
        if (mtIdxInt == -1) return null

        val dateFormatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())

        return CreateLocationLogRequest(
            mtIdx = mtIdxInt.toString(),
            mltLat = location.latitude,
            mltLong = location.longitude,
            mltAccuracy = location.accuracy.toDouble(),
            mltSpeed = location.speed.toDouble(),
            mltAltitude = if (location.hasAltitude()) location.altitude else 0.0,
            mltTimestamp = dateFormatter.format(Date()),
            mltBattery = getBatteryLevel()
        )
    }

    // ── Server communication (Retrofit) ────────────────────────────────────

    private suspend fun sendLocationToServer(request: CreateLocationLogRequest) {
        try {
            smapApi.createLocationLog(request)
        } catch (e: Exception) {
            Log.w(TAG, "Location upload failed: ${e.message}")
        }
    }

    // ── Coordinate validation ──────────────────────────────────────────────

    private fun isValidCoordinate(location: Location): Boolean {
        val lat = location.latitude
        val lng = location.longitude

        if (lat == 0.0 && lng == 0.0) return false
        if (lat < -90.0 || lat > 90.0) return false
        if (lng < -180.0 || lng > 180.0) return false
        if (lat.isNaN() || lat.isInfinite()) return false
        if (lng.isNaN() || lng.isInfinite()) return false
        if (location.accuracy > 1000) return false

        // Mock location check
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (location.isMock) return false
        } else {
            @Suppress("DEPRECATION")
            if (location.isFromMockProvider) return false
        }

        return true
    }

    // ── Battery level ──────────────────────────────────────────────────────

    private fun getBatteryLevel(): String {
        val intent = registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1) ?: -1
        return if (level != -1 && scale != -1) ((level * 100) / scale.toFloat()).toInt().toString() else "0"
    }

    // ── Notification ───────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "SMAP 위치 추적 (활동 로그)",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "'활동 로그' 및 '그룹 멤버와 실시간 위치 공유' 기능을 위해 백그라운드에서 위치를 수집합니다."
                setShowBadge(false)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun createNotification(mode: PowerMode) =
        NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("SMAP 위치 공유 중")
            .setContentText(notificationText(mode))
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

    private fun updateNotification(mode: PowerMode) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, createNotification(mode))
    }

    private fun notificationText(mode: PowerMode): String = when (mode) {
        PowerMode.STATIONARY -> "정지 중 (저전력 모드)"
        PowerMode.WALKING    -> "이동 중 (도보)"
        PowerMode.AUTOMOTIVE -> "이동 중 (차량)"
    }
}
