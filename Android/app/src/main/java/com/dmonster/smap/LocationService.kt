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
    // STATIONARY 진입 시점의 기준 위치. 이 지점에서 STATIONARY_ESCAPE_METERS 이상 벗어나면
    // speed 측정과 무관하게 WALKING으로 승급한다. FLP가 speed=0만 내려보내 stuck되는 케이스 방지.
    @Volatile private var stationaryReferenceLocation: Location? = null
    // requestLocationUpdates 성공 여부. AlarmManager로 서비스가 부활했을 때
    // 위치 구독이 유실된 상태인지 판별하는 데 쓴다.
    @Volatile private var isTracking = false
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
        private const val KEY_CURRENT_MODE = "current_mode"
        private const val RESTART_DELAY_MS = 5_000L

        private const val STATIONARY_DWELL_MS = 5 * 60 * 1000L  // 5 min before entering stationary
        private const val HEARTBEAT_INTERVAL_MS = 900_000L       // 15 min
        private const val BATCH_INTERVAL_MS = 60_000L            // 1 min
        // STATIONARY에서 reference 위치로부터 이 거리 이상 벗어나면 speed와 무관하게
        // WALKING으로 승급. FLP가 speed를 0으로만 돌려줘 모드 전환이 영원히 안 되는
        // stuck 상태를 방지하기 위한 안전장치.
        private const val STATIONARY_ESCAPE_METERS = 50f
        // 폴백 speed 계산 시 너무 오래된 lastLocation과의 gap은 신뢰할 수 없어 무시.
        private const val SPEED_FALLBACK_MAX_GAP_MS = 10 * 60 * 1000L  // 10 min

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
        // 프로세스 부활 시 마지막 모드를 복원해야 올바른 LocationRequest/알림 텍스트로 시작한다.
        restoreCurrentMode()
        locationRequest = createLocationRequest(currentMode)
        restorePendingLocations()
        restoreLastLocation()
        // 부활 직후 STATIONARY 모드라면 복원된 lastLocation을 escape 기준점으로 즉시 세팅.
        // 이게 없으면 최초 switchToMode 호출 전까지 이동거리 기반 escape가 동작하지 않는다.
        if (currentMode == PowerMode.STATIONARY) {
            stationaryReferenceLocation = lastLocation
        }
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
            // OS가 서비스 프로세스를 Doze/메모리 압박으로 종료했다 부활한 경우
            // locationCallback 구독이 유실된 상태다. 위치 권한이 있으면 재구독해
            // 실제 움직임을 다시 감지하도록 한다. (alarm이 막아주려던 바로 그 상황)
            if (!isTracking && hasLocationPermissionGranted()) {
                startLocationTracking()
                startTimerForMode(currentMode)
            }
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
        stopLocationTracking()
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
        stopLocationTracking()
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
                // BALANCED_POWER는 네트워크 fix 위주라 Location.speed가 항상 0으로 내려와
                // detectModeFromLocation이 WALKING으로 승급 못하고 STATIONARY에 갇힌다.
                // 2분/5분 하한이 배터리를 이미 보호하므로 priority는 HIGH_ACCURACY 유지.
                Priority.PRIORITY_HIGH_ACCURACY, 120_000L  // 2 min (desired)
            )
                // 정지 상태에서는 displacement 필터가 크면 콜백이 아예 오지 않아
                // lastLocation/heartbeat가 stale해진다. 대신 시간 기반 하한을 걸어
                // 센서 노이즈로 인한 과도한 콜백을 방지한다(최소 5분 간격).
                .setMinUpdateDistanceMeters(20f)
                .setMinUpdateIntervalMillis(300_000L) // 5 min lower bound
                .setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
                .build()

            PowerMode.WALKING -> LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, 10_000L  // 10 sec
            ).setMinUpdateDistanceMeters(10f)
                .setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
                // interval과 displacement는 AND 평가이므로, 둘 다 좁게 두어야 iOS의
                // distanceFilter 30m 단독 필터와 비슷한 콜백 빈도를 얻는다.
                // waitForAccurateLocation(true)는 첫 fix가 정확해질 때까지 대기해
                // 도심 협곡/실내에서 콜백 자체가 수십 초~수 분 정지되므로 false로 둔다.
                // 정확도 필터는 클라 isValidCoordinate + 서버 max_accuracy<50 에서 처리.
                .setWaitForAccurateLocation(false)
                .build()

            PowerMode.AUTOMOTIVE -> LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, 5_000L  // 5 sec
            ).setMinUpdateDistanceMeters(50f)
                .setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
                .setWaitForAccurateLocation(false)
                .build()
        }
    }

    // ── Tracking ───────────────────────────────────────────────────────────

    private fun startLocationTracking() {
        if (!hasLocationPermissionGranted()) return

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
            isTracking = true
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission revoked during request", e)
            isTracking = false
            stopSelf()
        }
    }

    private fun hasLocationPermissionGranted(): Boolean {
        return ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    private fun stopLocationTracking() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        isTracking = false
    }

    // ── Mode detection (speed-based) ───────────────────────────────────────

    private fun detectModeFromLocation(location: Location) {
        // STATIONARY stuck 탈출: speed=0만 들어와도 실제로 충분히 이동했으면 즉시 승급.
        if (currentMode == PowerMode.STATIONARY) {
            val ref = stationaryReferenceLocation
            if (ref != null && location.distanceTo(ref) > STATIONARY_ESCAPE_METERS) {
                stationaryStartTime = 0L
                switchToMode(PowerMode.WALKING)
                return
            }
        }

        // FLP가 speed를 안 주는 경우가 흔해 computeSpeed 폴백을 사용한다.
        val speedMs = computeSpeed(location).toFloat()
        val speed = if (speedMs < 0f) 0f else speedMs  // m/s

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
        persistCurrentMode()

        // STATIONARY 진입 시 reference 위치를 저장해 이후 이동거리 기반 escape 판정의 기준점으로 삼는다.
        stationaryReferenceLocation = if (newMode == PowerMode.STATIONARY) lastLocation else null

        // Flush pending before reconfiguring
        flushPendingLocations()

        // Stop old alarms
        cancelAlarms()

        // Reconfigure location request
        stopLocationTracking()
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
     * Heartbeat: STATIONARY에서 움직임이 없을 때도 "여기에 있다"를 주기적으로 서버에 알린다.
     *
     * 중복 전송 방지: 방금 flush한 pending이 있었다면 그 배치에 최근 위치가 포함돼 있으므로
     * 추가 송신을 생략한다. pending이 비어있던 경우에만 heartbeat 1건을 보낸다.
     * 또한 heartbeat은 "지금 시각"을 의미해야 하므로 mlt_timestamp를 현재로 덮어쓴다
     * (과거 GPS time 반복 전송으로 활동로그가 멈춰 보이는 문제 방지).
     */
    private fun sendHeartbeat() {
        val hadPending: Boolean
        synchronized(pendingLocations) { hadPending = pendingLocations.isNotEmpty() }

        flushPendingLocations()
        if (hadPending) return

        val loc = lastLocation ?: return
        val request = buildLocationLogRequest(loc, useNow = true) ?: return
        serviceScope.launch { sendLocationToServer(request) }
    }

    // ── Build request model ────────────────────────────────────────────────

    private fun buildLocationLogRequest(
        location: Location,
        useNow: Boolean = false
    ): CreateLocationLogRequest? {
        val prefs = getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
        val mtIdxInt = prefs.getInt("mt_idx", -1)
        if (mtIdxInt == -1) return null

        val dateFormatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        // heartbeat처럼 "지금도 여기에 있다"를 표현해야 하는 호출은 현재 시각으로 덮어쓴다.
        // 그렇지 않으면 STATIONARY에서 변화가 없는 동안 GPS time이 과거 시각 그대로 반복 전송된다.
        val locationTime = when {
            useNow -> Date()
            location.time > 0 -> Date(location.time)
            else -> Date()
        }

        return CreateLocationLogRequest(
            mtIdx = mtIdxInt.toString(),
            mltLat = location.latitude,
            mltLong = location.longitude,
            mltAccuracy = location.accuracy.toDouble(),
            mltSpeed = computeSpeed(location),
            mltAltitude = if (location.hasAltitude()) location.altitude else 0.0,
            mltTimestamp = dateFormatter.format(locationTime),
            mltBattery = getBatteryLevel()
        )
    }

    /**
     * FLP가 제공하는 Location.speed는 provider priority에 따라 항상 0으로 내려올 수 있다.
     * (BALANCED_POWER 모드 / 네트워크 fix 등) 이때 lastLocation과의 거리·시간으로 폴백 계산한다.
     * 활동로그 서버 필터(min_speed>=1.0)를 통과시켜 지도에 이동 경로를 표시하기 위함.
     */
    private fun computeSpeed(location: Location): Double {
        if (location.hasSpeed() && location.speed > 0f) return location.speed.toDouble()
        val prev = lastLocation ?: return 0.0
        val dtMs = location.time - prev.time
        if (dtMs <= 0L || dtMs > SPEED_FALLBACK_MAX_GAP_MS) return 0.0
        val distance = location.distanceTo(prev).toDouble()
        // accuracy 5~30m 구간에서 초당 0.3~1m 이동(걷기 시작/정지, 느린 이동)이
        // 1.0m 하한에 걸려 speed=0으로 떨어지면, 서버 min_speed>=1.0 필터에
        // 다시 걸려 지도 경로에서 삭제된다. 하한을 0.3m로 낮춰 걷기 샘플까지
        // 살리되, 거리/시간 비율은 그대로 반환한다(미세 노이즈는 여전히 배제).
        if (distance < 0.3) return 0.0
        return distance / (dtMs / 1000.0)
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

    private fun persistCurrentMode() {
        getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_CURRENT_MODE, currentMode.name)
            .apply()
    }

    private fun restoreCurrentMode() {
        val prefs = getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
        val name = prefs.getString(KEY_CURRENT_MODE, null) ?: return
        currentMode = runCatching { PowerMode.valueOf(name) }.getOrDefault(PowerMode.WALKING)
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
