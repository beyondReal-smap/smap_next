package com.dmonster.smap

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
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
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

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
    @Volatile private var lastLocation: Location? = null
    private var consecutiveAuthFailures = 0
    private val maxAuthFailures = 3

    // ── Location batching ──────────────────────────────────────────────────

    private val pendingLocations = mutableListOf<CreateLocationLogRequest>()
    private val maxQueueSize = 100
    private var batchJob: Job? = null
    private var heartbeatPendingIntent: PendingIntent? = null

    // ── Connectivity callback ──────────────────────────────────────────────
    // 오프라인 구간에 쌓인 pendingLocations를 네트워크 복구 시 즉시 비우기 위한 훅.
    // 배치 타이머/heartbeat를 기다리지 않고 재전송을 트리거한다.
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    // ── Coroutine scope ────────────────────────────────────────────────────

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    // ── Constants ──────────────────────────────────────────────────────────

    companion object {
        private const val TAG = "LocationService"
        private const val NOTIFICATION_CHANNEL_ID = "LocationServiceChannel"
        private const val NOTIFICATION_ID = 10000
        private const val AUTH_PREFS = "smap_auth_prefs"
        private const val QUEUE_PREFS = "smap_location_service"
        private const val KEY_PENDING_QUEUE = "pending_queue"
        private const val KEY_LAST_LOCATION = "last_location"
        private const val RESTART_DELAY_MS = 5_000L

        private const val STATIONARY_DWELL_MS = 5 * 60 * 1000L  // 5 min before entering stationary
        private const val HEARTBEAT_INTERVAL_MS = 900_000L       // 15 min
        private const val BATCH_INTERVAL_MS = 60_000L            // 1 min

        private const val ACTION_HEARTBEAT = "com.dmonster.smap.ACTION_HEARTBEAT"
        private const val REQUEST_CODE_HEARTBEAT = 2002

        fun isRunning(context: Context): Boolean {
            val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
            return manager.getRunningServices(Integer.MAX_VALUE)
                .any { it.service.className == LocationService::class.java.name }
        }

        fun hasRequiredPermissions(context: Context): Boolean {
            val fine = ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val coarse = ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val locationGranted = fine || coarse
            val backgroundGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
            val foregroundServiceGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                ActivityCompat.checkSelfPermission(context, Manifest.permission.FOREGROUND_SERVICE_LOCATION) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
            return locationGranted && backgroundGranted && foregroundServiceGranted
        }

        fun isUserLoggedIn(context: Context): Boolean {
            val prefs = context.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
            val token = prefs.getString("auth_token", null)
            val mtIdx = prefs.getInt("mt_idx", -1)
            return !token.isNullOrBlank() && mtIdx > 0
        }

        fun startIfEligible(context: Context, reason: String) {
            if (!isUserLoggedIn(context)) {
                Log.d(TAG, "Skip start ($reason): user not logged in")
                return
            }
            if (!hasRequiredPermissions(context)) {
                Log.d(TAG, "Skip start ($reason): required location permissions missing")
                return
            }

            val intent = Intent(context, LocationService::class.java).putExtra("restart_reason", reason)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
                Log.d(TAG, "LocationService start requested ($reason)")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start LocationService ($reason)", e)
            }
        }
    }

    // ── Location callback ──────────────────────────────────────────────────

    private val locationCallback: LocationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            var latestValid: Location? = null
            for (location in result.locations) {
                if (!isValidCoordinate(location)) continue

                // Build request and enqueue all valid locations
                val request = buildLocationLogRequest(location) ?: continue
                enqueueLocation(request)
                lastLocation = location
                latestValid = location
            }
            // Mode detection on latest location only to avoid thrashing
            latestValid?.let { detectModeFromLocation(it) }
        }
    }

    // ── Service lifecycle ──────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        locationRequest = createLocationRequest(PowerMode.WALKING)
        restorePendingLocations()
        restoreLastLocation()
        registerNetworkCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Ensure foreground state first (required within 5s of onCreate on API 31+)
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification(currentMode))

        // Handle AlarmManager-triggered heartbeat action
        if (intent?.action == ACTION_HEARTBEAT) {
            sendHeartbeat()
            scheduleHeartbeatAlarm()   // schedule next
            return START_STICKY
        }

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

        cancelAlarms()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        startLocationTracking()
        startTimerForMode(currentMode)

        Log.d(TAG, "LocationService started in ${currentMode.name} mode")
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        persistPendingLocations()
        persistLastLocation()
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        cancelAlarms()
        unregisterNetworkCallback()
        serviceScope.cancel()
        Log.d(TAG, "LocationService destroyed")
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        scheduleRestart("task_removed")
    }

    // ── Location request per mode ──────────────────────────────────────────

    private fun createLocationRequest(mode: PowerMode): LocationRequest {
        return when (mode) {
            PowerMode.STATIONARY -> LocationRequest.Builder(
                Priority.PRIORITY_BALANCED_POWER_ACCURACY, 120_000L  // 2 min (desired)
            )
                // 정지 상태에서는 displacement 필터가 크면 콜백이 아예 오지 않아
                // lastLocation/heartbeat가 stale해진다. 대신 시간 기반 하한을 걸어
                // 센서 노이즈로 인한 과도한 콜백을 방지한다(최소 5분 간격).
                .setMinUpdateDistanceMeters(20f)
                .setMinUpdateIntervalMillis(300_000L) // 5 min lower bound
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

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission revoked during request", e)
            stopSelf()
        }
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

        // Stop old alarms
        cancelAlarms()

        // Reconfigure location request
        fusedLocationClient.removeLocationUpdates(locationCallback)
        locationRequest = createLocationRequest(newMode)
        startLocationTracking()

        // Start appropriate alarm
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
        persistPendingLocations()
    }

    private fun startBatchTimer() {
        batchJob?.cancel()
        batchJob = serviceScope.launch {
            while (isActive) {
                delay(BATCH_INTERVAL_MS)
                flushPendingLocations()
            }
        }
    }

    private fun startHeartbeatTimer() {
        cancelHeartbeatAlarm()
        scheduleHeartbeatAlarm()
    }

    private fun scheduleHeartbeatAlarm() {
        val intent = Intent(this, LocationService::class.java).setAction(ACTION_HEARTBEAT)
        heartbeatPendingIntent = PendingIntent.getService(
            this, REQUEST_CODE_HEARTBEAT, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            System.currentTimeMillis() + HEARTBEAT_INTERVAL_MS,
            heartbeatPendingIntent!!
        )
    }

    private fun cancelHeartbeatAlarm() {
        heartbeatPendingIntent?.let {
            (getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(it)
            it.cancel()
        }
        heartbeatPendingIntent = null
    }

    private fun cancelAlarms() {
        batchJob?.cancel()
        batchJob = null
        cancelHeartbeatAlarm()
    }

    // ── Connectivity callback ──────────────────────────────────────────────

    private fun registerNetworkCallback() {
        if (networkCallback != null) return
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return

        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            .build()

        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                Log.d(TAG, "Network available — flushing pending locations")
                // 오프라인 구간에 쌓인 큐를 바로 비운다. 타이머 대기 없이 재전송.
                serviceScope.launch { flushPendingLocations() }
            }
        }

        runCatching {
            cm.registerNetworkCallback(request, callback)
            networkCallback = callback
        }.onFailure {
            Log.w(TAG, "Failed to register network callback", it)
        }
    }

    private fun unregisterNetworkCallback() {
        val callback = networkCallback ?: return
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        runCatching { cm?.unregisterNetworkCallback(callback) }
        networkCallback = null
    }

    private fun flushPendingLocations() {
        val toSend: List<CreateLocationLogRequest>
        synchronized(pendingLocations) {
            if (pendingLocations.isEmpty()) return
            toSend = pendingLocations.toList()
            pendingLocations.clear()
        }
        persistPendingLocations()
        toSend.forEach { request ->
            serviceScope.launch { sendLocationToServer(request) }
        }
    }

    /**
     * Heartbeat: iOS와 동일하게 lastLocation을 주기적으로 강제 송신한다.
     * pending flush와 별개로 진행 — flush가 네트워크 오류로 재큐잉될 수 있고,
     * 그 상태에서 `hadPending` 분기로 송신을 스킵하면 서버는 오랫동안 무소식이 된다.
     */
    private fun sendHeartbeat() {
        // 1) 누적된 위치 flush 시도
        flushPendingLocations()

        // 2) lastLocation이 있으면 heartbeat으로 한 건 강제 송신
        val loc = lastLocation ?: return
        val request = buildLocationLogRequest(loc) ?: return
        serviceScope.launch { sendLocationToServer(request) }
    }

    // ── Build request model ────────────────────────────────────────────────

    private fun buildLocationLogRequest(location: Location): CreateLocationLogRequest? {
        val prefs = getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
        val mtIdxInt = prefs.getInt("mt_idx", -1)
        if (mtIdxInt == -1) return null

        val dateFormatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        // Use the GPS-measured time, not the current wall-clock time
        val locationTime = if (location.time > 0) Date(location.time) else Date()

        return CreateLocationLogRequest(
            mtIdx = mtIdxInt.toString(),
            mltLat = location.latitude,
            mltLong = location.longitude,
            mltAccuracy = location.accuracy.toDouble(),
            mltSpeed = location.speed.toDouble(),
            mltAltitude = if (location.hasAltitude()) location.altitude else 0.0,
            mltTimestamp = dateFormatter.format(locationTime),
            mltBattery = getBatteryLevel()
        )
    }

    // ── Server communication (Retrofit) ────────────────────────────────────

    private suspend fun sendLocationToServer(request: CreateLocationLogRequest) {
        try {
            val response = smapApi.createLocationLog(request)
            if (response.isSuccessful) {
                consecutiveAuthFailures = 0
                Log.d(TAG, "Location sent: (${request.mltLat}, ${request.mltLong}) mode=${currentMode.name}")
            } else {
                Log.w(TAG, "Location upload failed: HTTP ${response.code()}")
                when (response.code()) {
                    401 -> {
                        consecutiveAuthFailures++
                        if (consecutiveAuthFailures >= maxAuthFailures) {
                            // 토큰 폐기 책임은 인증 flow(AuthService.logout / 로그인 재진입)에 위임한다.
                            // 여기서는 재시도 루프를 멈추고 서비스만 중단 → 사용자 재진입 시점에
                            // 스플래시/메인이 /members/me 등으로 세션 유효성을 재확인한다.
                            Log.w(TAG, "Auth failed $maxAuthFailures times — stopping service (token kept)")
                            stopSelf()
                        } else {
                            Log.w(TAG, "Auth failed ($consecutiveAuthFailures/$maxAuthFailures) — will retry")
                            enqueueLocation(request)
                        }
                    }
                    403 -> {
                        // 403 may be rate-limit or authorization issue, not necessarily auth failure
                        Log.w(TAG, "403 Forbidden — dropping location, not clearing token")
                    }
                    in 500..599 -> {
                        // Re-enqueue on server error for retry
                        enqueueLocation(request)
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Location upload error: ${e.message}")
            // Re-enqueue on network error for retry
            enqueueLocation(request)
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

        // Mock location check (skip in debug builds for emulator testing)
        if (!BuildConfig.DEBUG) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (location.isMock) return false
            } else {
                @Suppress("DEPRECATION")
                if (location.isFromMockProvider) return false
            }
        }

        return true
    }

    // ── Battery level ──────────────────────────────────────────────────────

    private fun getBatteryLevel(): String {
        return try {
            val intent = registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            val level = intent?.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = intent?.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1) ?: -1
            if (level != -1 && scale != -1) ((level * 100) / scale.toFloat()).toInt().toString() else "0"
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get battery level", e)
            "0"
        }
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

    private fun persistPendingLocations() {
        val prefs = getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
        val queueSnapshot = synchronized(pendingLocations) { pendingLocations.toList() }
        prefs.edit().putString(KEY_PENDING_QUEUE, json.encodeToString(queueSnapshot)).apply()
    }

    private fun restorePendingLocations() {
        val prefs = getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_PENDING_QUEUE, null) ?: return
        runCatching {
            json.decodeFromString<List<CreateLocationLogRequest>>(raw)
        }.onSuccess { restored ->
            synchronized(pendingLocations) {
                pendingLocations.clear()
                pendingLocations.addAll(restored.takeLast(maxQueueSize))
            }
        }.onFailure {
            Log.w(TAG, "Failed to restore pending queue", it)
        }
    }

    private fun persistLastLocation() {
        val location = lastLocation ?: return
        val request = buildLocationLogRequest(location) ?: return
        getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_LOCATION, json.encodeToString(request))
            .apply()
    }

    private fun restoreLastLocation() {
        val prefs = getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_LAST_LOCATION, null) ?: return
        runCatching {
            json.decodeFromString<CreateLocationLogRequest>(raw)
        }.onSuccess { restored ->
            // 서비스 프로세스가 재기동될 때 Location 필드도 함께 복원해야
            // STATIONARY 모드에서 콜백이 늦게 오는 동안에도 heartbeat가 즉시 송신할 수 있다.
            lastLocation = Location("cached").apply {
                latitude = restored.mltLat
                longitude = restored.mltLong
                accuracy = restored.mltAccuracy.toFloat()
                altitude = restored.mltAltitude
                time = System.currentTimeMillis()
            }
            enqueueLocation(restored)
        }.onFailure {
            Log.w(TAG, "Failed to restore last location", it)
        }
        prefs.edit().remove(KEY_LAST_LOCATION).apply()
    }

    private fun scheduleRestart(reason: String) {
        if (!isUserLoggedIn(this) || !hasRequiredPermissions(this)) return
        val intent = Intent(this, LocationRestartReceiver::class.java).putExtra("restart_reason", reason)
        val pendingIntent = PendingIntent.getBroadcast(
            this,
            1001,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            System.currentTimeMillis() + RESTART_DELAY_MS,
            pendingIntent
        )
    }
}
