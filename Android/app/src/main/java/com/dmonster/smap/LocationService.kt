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
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.CreateLocationLogRequest
import com.google.android.gms.location.*
import androidx.core.content.ContextCompat
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.withLock
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

    // GPS 콜백을 메인 스레드에서 받으면 enqueueLocation/persistPendingLocations(SharedPrefs write,
    // Json encode)가 메인을 블로킹해 콜백 누적/UI 버벅임이 발생한다. 별도 HandlerThread에서 받아
    // detectModeFromLocation까지 background에서 처리한다.
    private var locationThread: HandlerThread? = null
    private val locationLooper: Looper
        get() {
            val existing = locationThread
            if (existing != null && existing.isAlive) return existing.looper
            val thread = HandlerThread("LocationServiceCallback").apply { start() }
            locationThread = thread
            return thread.looper
        }

    // ── Activity / mode detection ──────────────────────────────────────────

    private var stationaryStartTime: Long = 0L
    @Volatile private var lastLocation: Location? = null
    // STATIONARY 진입 시점의 기준 위치. 이 지점에서 STATIONARY_ESCAPE_METERS 이상 벗어나면
    // speed 측정과 무관하게 WALKING으로 승급한다. FLP가 speed=0만 내려보내 stuck되는 케이스 방지.
    @Volatile private var stationaryReferenceLocation: Location? = null
    // requestLocationUpdates 성공 여부. AlarmManager로 서비스가 부활했을 때
    // 위치 구독이 유실된 상태인지 판별하는 데 쓴다.
    @Volatile private var isTracking = false
    // 401 카운터는 SharedPreferences에 영속화한다. 그렇지 않으면 OS가 서비스를 강제 종료하고
    // AlarmManager로 부활할 때마다 0으로 리셋되어 maxAuthFailures(3) 한도가 무력화된다.
    private var consecutiveAuthFailures = 0
    private val maxAuthFailures = 3
    // 429 Retry-After 응답 시 다음 flush까지 보류할 시각(epoch ms). 이 시각 전에 flush가
    // 호출되면 즉시 return 하여 rate-limit 폭주를 방지한다.
    @Volatile private var rateLimitedUntilMs: Long = 0L

    // ── Location batching ──────────────────────────────────────────────────

    private val maxQueueSize = 100
    // 같은 위치 중복 적재 방지 + 시간순 보존 (PendingLocationQueue.kt)
    private val pendingQueue = PendingLocationQueue(maxQueueSize)
    // 동시에 여러 flush(배치 타이머·네트워크 복구·모드 전환·heartbeat)가 겹쳐도 전송은 한 번에 하나씩만 진행한다.
    private val flushMutex = kotlinx.coroutines.sync.Mutex()
    private var batchJob: Job? = null
    private var heartbeatPendingIntent: PendingIntent? = null

    // ── Connectivity callback ──────────────────────────────────────────────
    // 오프라인 구간에 쌓인 pendingLocations를 네트워크 복구 시 즉시 비우기 위한 훅.
    // 배치 타이머/heartbeat를 기다리지 않고 재전송을 트리거한다.
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    // ── Activity Recognition Transition ────────────────────────────────────
    // GPS 콜백과 독립적으로 motion 변화를 감지해 모드 전환을 트리거한다(iOS MotionManager 대응).
    // PendingIntent → ActivityTransitionReceiver → LocationService의 ACTION_MODE_TRANSITION으로
    // 신호가 돌아온다.
    private var activityTransitionPendingIntent: PendingIntent? = null

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
        private const val KEY_AUTH_FAIL_COUNT = "consecutive_auth_failures"
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
        // heartbeat 송신 시 lastLocation 신선도 상한. 이보다 오래된 좌표는 보내지 않는다.
        // STATIONARY heartbeat이 15분 간격이고 새 콜백이 60초 STATIONARY interval로 들어오므로,
        // 30분 이상 콜백이 없으면 사실상 GPS가 잡히지 않는 환경(터널/지하/실내 깊숙)이라 보고
        // 옛 좌표를 "지금 시각"으로 반복 전송해 활동로그를 오염시키지 않도록 보수화.
        private const val HEARTBEAT_LAST_LOC_MAX_AGE_MS = 30 * 60 * 1000L  // 30 min

        private const val ACTION_HEARTBEAT = "com.dmonster.smap.ACTION_HEARTBEAT"
        private const val REQUEST_CODE_HEARTBEAT = 2002
        private const val REQUEST_CODE_ACTIVITY_TRANSITION = 2003

        fun isRunning(context: Context): Boolean {
            val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
            return manager.getRunningServices(Integer.MAX_VALUE)
                .any { it.service.className == LocationService::class.java.name }
        }

        // Foreground 진입 경로(Activity onResume 등)에서 서비스를 띄우기 위한 최소 권한.
        // ACCESS_BACKGROUND_LOCATION은 여기서 검사하지 않는다 — Android 공식 문서 기준 location FGS의
        // 기본 prerequisite는 fine/coarse이며, BG 권한은 "background에서 FGS를 새로 시작할 때"만 필요.
        // 사용자가 "사용 중에만 허용"을 선택했을 때 foreground 추적까지 막던 회귀를 제거한다.
        // (iOS LocationManager.startTracking()이 whenInUse 만으로도 walking/automotive 진입하는 동작과 정렬)
        fun hasRequiredPermissions(context: Context): Boolean {
            val fine = ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val coarse = ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val locationGranted = fine || coarse
            val foregroundServiceGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                ActivityCompat.checkSelfPermission(context, Manifest.permission.FOREGROUND_SERVICE_LOCATION) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
            return locationGranted && foregroundServiceGranted
        }

        // Background broadcast(BOOT_COMPLETED / MY_PACKAGE_REPLACED / scheduleRestart alarm)에서
        // FGS를 새로 시작하려 할 때만 추가로 검사한다. Android 11+ 사용자가 "항상 허용"을 안 줬다면
        // 자동 재시작은 못 하지만, foreground 진입은 hasRequiredPermissions만으로 통과하도록 한다.
        fun hasBackgroundLocationPermission(context: Context): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
        }

        fun isUserLoggedIn(context: Context): Boolean {
            val prefs = context.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
            val token = prefs.getString("auth_token", null)
            val mtIdx = prefs.getInt("mt_idx", -1)
            return !token.isNullOrBlank() && mtIdx > 0
        }

        // requireBackgroundPermission: background broadcast(부팅/패키지 교체/AlarmManager 재시작) 경로에서
        // FGS를 새로 시작할 때만 true. Activity onResume 등 foreground 경로는 false(기본값)로 두어
        // "사용 중에만 허용" 사용자도 추적이 시작되게 한다.
        fun startIfEligible(context: Context, reason: String, requireBackgroundPermission: Boolean = false) {
            if (!isUserLoggedIn(context)) {
                Log.d(TAG, "Skip start ($reason): user not logged in")
                return
            }
            if (!hasRequiredPermissions(context)) {
                Log.d(TAG, "Skip start ($reason): required location permissions missing")
                return
            }
            if (requireBackgroundPermission && !hasBackgroundLocationPermission(context)) {
                // Android 12+/14+에서 background 시작은 ACCESS_BACKGROUND_LOCATION이 없으면
                // ForegroundServiceStartNotAllowedException 또는 location 차단이 발생할 수 있다.
                // 다음 사용자 진입(MainActivity onResume) 시점에 다시 시작된다.
                Log.d(TAG, "Skip start ($reason): background location permission missing")
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
            // 콜백은 LocationServiceCallback HandlerThread에서 도착한다(requestLocationUpdates의
            // Looper로 전달). 메인 스레드 블로킹 없이 SharedPreferences write/json encode가 안전하게
            // 수행되므로 추가 dispatch 없이 바로 처리한다.
            var latestValid: Location? = null
            for (location in result.locations) {
                if (!isValidCoordinate(location)) continue
                // 같은 fix가 다시 전달되면(콜백 재등록·모드 전환 직후 등) 같은 위치를 두 번 올리지 않는다.
                if (isSameFix(lastLocation, location)) continue

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
        // 프로세스 부활 시 마지막 모드/인증 실패 카운터를 복원해야 올바른 LocationRequest/알림 텍스트로 시작하고
        // maxAuthFailures(3)에 도달했던 세션이 재시작 한 번으로 카운터가 0으로 리셋되며 무한 재시도되는 회귀를 막는다.
        restoreCurrentMode()
        restoreAuthFailureCount()
        locationRequest = createLocationRequest(currentMode)
        restorePendingLocations()
        restoreLastLocation()
        // 부활 직후 STATIONARY 모드라면 복원된 lastLocation을 escape 기준점으로 즉시 세팅.
        // 이게 없으면 최초 switchToMode 호출 전까지 이동거리 기반 escape가 동작하지 않는다.
        if (currentMode == PowerMode.STATIONARY) {
            stationaryReferenceLocation = lastLocation
        }
        registerNetworkCallback()
        registerActivityTransitions()
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

        // ActivityTransitionReceiver가 보낸 motion 기반 모드 전환 신호.
        // GPS 콜백 없이도 STATIONARY ↔ WALKING/AUTOMOTIVE 사이를 깨운다(iOS MotionManager 대응).
        if (intent?.action == ActivityTransitionReceiver.ACTION_MODE_TRANSITION) {
            val target = intent.getStringExtra(ActivityTransitionReceiver.EXTRA_TARGET_MODE)
            val newMode = runCatching { PowerMode.valueOf(target ?: "") }.getOrNull()
            if (newMode != null && newMode != currentMode) {
                Log.d(TAG, "Mode transition from ActivityRecognition: ${currentMode.name} -> ${newMode.name}")
                // STATIONARY 진입은 dwell timer 없이 즉시 적용한다 — Transition API 자체가
                // STILL을 일정 시간 관찰해야 ENTER 신호를 내보내므로 추가 dwell이 불필요.
                stationaryStartTime = 0L
                switchToMode(newMode)
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

        // 첫 onCreate에서는 ACTIVITY_RECOGNITION 권한이 없어 register가 skip됐을 수 있다.
        // 사용자가 권한을 부여한 뒤 MainActivity onResume → startLocationService → 여기 도달하면
        // 다시 등록을 시도한다(이미 등록돼 있으면 no-op).
        if (activityTransitionPendingIntent == null) {
            registerActivityTransitions()
        }

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
        unregisterActivityTransitions()
        serviceScope.cancel()
        // GPS 콜백용 HandlerThread 정리. quitSafely()는 큐의 메시지를 처리한 뒤 종료.
        locationThread?.quitSafely()
        locationThread = null
        Log.d(TAG, "LocationService destroyed")
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        scheduleRestart("task_removed")
    }

    // ── Location request per mode ──────────────────────────────────────────

    private fun createLocationRequest(mode: PowerMode): LocationRequest {
        // FINE 권한이 있을 때만 GRANULARITY_FINE을 명시적으로 요구한다.
        // PERMISSION_LEVEL은 coarse-only 사용자에게 obfuscated/throttled 좌표를 내려줘
        // Location.speed가 0/null로 들어오는 비율(실측 70%)을 키운다(FLP 공식 문서).
        // coarse만 가진 사용자는 fallback으로 PERMISSION_LEVEL 사용 — 권한이 없는 채로
        // GRANULARITY_FINE을 요구하면 SecurityException이 발생할 수 있다.
        val granularity = if (
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
        ) {
            Granularity.GRANULARITY_FINE
        } else {
            Granularity.GRANULARITY_PERMISSION_LEVEL
        }

        return when (mode) {
            PowerMode.STATIONARY -> LocationRequest.Builder(
                // BALANCED_POWER는 네트워크 fix 위주라 Location.speed가 항상 0으로 내려와
                // detectModeFromLocation이 WALKING으로 승급 못하고 STATIONARY에 갇힌다.
                // priority는 HIGH_ACCURACY 유지하되 interval/min은 시간 기반으로 보호한다.
                Priority.PRIORITY_HIGH_ACCURACY, 60_000L  // 1 min (desired)
            )
                // 정지 상태에서도 blind window를 짧게 두어 ActivityRecognition transition
                // 신호 없이도 GPS 콜백 기반 escape 판정이 빠르게 일어나도록 한다.
                // 5분 하한 → 1분 단축. 배터리는 ActivityRecognition Transition + STILL
                // 상태에서 FLP 자체가 콜백을 드물게 내려주는 특성으로 보호된다.
                .setMinUpdateDistanceMeters(20f)
                .setMinUpdateIntervalMillis(60_000L) // 1 min lower bound
                .setGranularity(granularity)
                .build()

            PowerMode.WALKING -> LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, 10_000L  // 10 sec
            ).setMinUpdateDistanceMeters(10f)
                .setGranularity(granularity)
                // 둘 다 좁게 두어야 iOS의 distanceFilter 30m 단독 필터와 비슷한 콜백 빈도.
                // waitForAccurateLocation(true)는 첫 fix가 정확해질 때까지 대기해
                // 도심 협곡/실내에서 콜백 자체가 수십 초~수 분 정지되므로 false로 둔다.
                // 정확도 필터는 클라 isValidCoordinate + 서버 max_accuracy<50 에서 처리.
                .setWaitForAccurateLocation(false)
                .build()

            PowerMode.AUTOMOTIVE -> LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, 5_000L  // 5 sec
            ).setMinUpdateDistanceMeters(50f)
                .setGranularity(granularity)
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
                locationLooper
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
        // 이미 같은 위치가 대기 중이면 쌓지 않는다(중복 업로드 방지). 용량 초과 시 오래된 것부터 버리는 정책은 큐가 처리.
        if (pendingQueue.add(data)) persistPendingLocations()
    }

    private fun isSameFix(prev: Location?, next: Location): Boolean =
        prev != null && prev.time == next.time &&
            prev.latitude == next.latitude && prev.longitude == next.longitude

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

    // ── Auth failure persistence ───────────────────────────────────────────

    private fun restoreAuthFailureCount() {
        val prefs = getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
        consecutiveAuthFailures = prefs.getInt(KEY_AUTH_FAIL_COUNT, 0)
        if (consecutiveAuthFailures > 0) {
            Log.d(TAG, "Restored auth failure count: $consecutiveAuthFailures")
        }
    }

    private fun persistAuthFailureCount() {
        getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putInt(KEY_AUTH_FAIL_COUNT, consecutiveAuthFailures)
            .apply()
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

    // ── Activity Recognition Transition ────────────────────────────────────

    private fun registerActivityTransitions() {
        if (activityTransitionPendingIntent != null) return

        // Android 10+(API 29+)부터 ACTIVITY_RECOGNITION은 dangerous permission이므로 런타임 부여 필요.
        // 권한이 없으면 등록 자체가 실패한다 — 사용자가 추후 권한을 주면 다음 서비스 재시작에서 등록된다.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION)
                != PackageManager.PERMISSION_GRANTED
            ) {
                Log.d(TAG, "ACTIVITY_RECOGNITION permission missing — skipping transition updates")
                return
            }
        }

        val transitions = listOf(
            DetectedActivity.STILL,
            DetectedActivity.WALKING,
            DetectedActivity.RUNNING,
            DetectedActivity.IN_VEHICLE,
            DetectedActivity.ON_BICYCLE
        ).flatMap { activity ->
            // ENTER만 구독하고 EXIT는 무시한다 — 모드 전환은 새 활동 진입 시점에만 의미가 있고,
            // EXIT는 항상 짝지어 다른 ENTER와 함께 도착하므로 중복이 된다.
            listOf(
                ActivityTransition.Builder()
                    .setActivityType(activity)
                    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                    .build()
            )
        }

        val request = ActivityTransitionRequest(transitions)

        val intent = Intent(this, ActivityTransitionReceiver::class.java)
        // FLAG_MUTABLE: ActivityTransitionResult가 PendingIntent에 transition extras를 채워 넣을 수 있도록
        // mutable이어야 한다(Android 12+ 기본은 immutable이라 명시 필요).
        val pi = PendingIntent.getBroadcast(
            this, REQUEST_CODE_ACTIVITY_TRANSITION, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )

        runCatching {
            ActivityRecognition.getClient(this)
                .requestActivityTransitionUpdates(request, pi)
                .addOnSuccessListener {
                    Log.d(TAG, "Activity transition updates registered")
                }
                .addOnFailureListener { e ->
                    Log.w(TAG, "Activity transition register failed: ${e.message}")
                }
            activityTransitionPendingIntent = pi
        }.onFailure {
            Log.w(TAG, "Failed to request activity transition updates", it)
            pi.cancel()
        }
    }

    private fun unregisterActivityTransitions() {
        val pi = activityTransitionPendingIntent ?: return
        runCatching {
            ActivityRecognition.getClient(this).removeActivityTransitionUpdates(pi)
        }.onFailure {
            Log.w(TAG, "Failed to remove activity transition updates", it)
        }
        pi.cancel()
        activityTransitionPendingIntent = null
    }

    private fun flushPendingLocations() {
        // 429 Retry-After 응답 직후에는 보류 시각이 지날 때까지 큐를 비우지 않는다.
        // pendingLocations는 그대로 둬 다음 batch/network-recovery 시점에 다시 시도되도록 한다.
        val now = System.currentTimeMillis()
        if (now < rateLimitedUntilMs) {
            Log.d(TAG, "Flush deferred ${rateLimitedUntilMs - now}ms (rate-limited)")
            return
        }
        if (pendingQueue.size == 0) return
        // 이전에는 큐의 N건을 항목마다 코루틴으로 한꺼번에 쏴서 같은 시각에 N건이 동시에 나갔다.
        // 이제는 하나의 전송 작업이 시간순으로 한 건씩 보내고, 일시 실패 시 나머지를 큐에 되돌리고 멈춘다.
        serviceScope.launch {
            flushMutex.withLock {
                // 락을 기다리는 동안 429 보류가 걸렸을 수 있다.
                if (System.currentTimeMillis() < rateLimitedUntilMs) return@withLock
                val toSend = pendingQueue.drain()
                if (toSend.isEmpty()) return@withLock
                persistPendingLocations()
                val leftover = uploadInOrder(toSend) { sendLocationToServer(it) }
                if (leftover.isNotEmpty()) {
                    pendingQueue.addFirst(leftover)
                    persistPendingLocations()
                }
            }
        }
    }

    /**
     * Heartbeat: STATIONARY에서 움직임이 없을 때도 "여기에 있다"를 주기적으로 서버에 알린다.
     *
     * 중복 전송 방지: 방금 flush한 pending이 있었다면 그 배치에 최근 위치가 포함돼 있으므로
     * 추가 송신을 생략한다. pending이 비어있던 경우에만 heartbeat 1건을 보낸다.
     * 또한 heartbeat은 "지금 시각"을 의미해야 하므로 mlt_timestamp를 현재로 덮어쓴다
     * (과거 GPS time 반복 전송으로 활동로그가 멈춰 보이는 문제 방지).
     *
     * 신선도 검증: lastLocation이 HEARTBEAT_LAST_LOC_MAX_AGE_MS 이상 오래된 경우 송신을 생략한다.
     * 사용자가 이동 후 OS에 의해 서비스가 재기동되어 옛 좌표만 가진 채 STATIONARY로 깨어났을 때,
     * 잘못된 위치를 "지금 시각"으로 반복 전송해 활동로그를 오염시키는 문제 방지.
     */
    private fun sendHeartbeat() {
        val hadPending = pendingQueue.size > 0

        flushPendingLocations()
        if (hadPending) return

        val loc = lastLocation ?: return
        val ageMs = System.currentTimeMillis() - loc.time
        if (ageMs > HEARTBEAT_LAST_LOC_MAX_AGE_MS) {
            Log.d(TAG, "Heartbeat skipped: lastLocation stale (${ageMs / 1000}s old)")
            return
        }
        val request = buildLocationLogRequest(loc, useNow = true) ?: return
        serviceScope.launch {
            flushMutex.withLock {
                if (sendLocationToServer(request) == UploadOutcome.RETRY_LATER) enqueueLocation(request)
            }
        }
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

    private suspend fun sendLocationToServer(request: CreateLocationLogRequest): UploadOutcome {
        try {
            val response = smapApi.createLocationLog(request)
            if (response.isSuccessful) {
                if (consecutiveAuthFailures != 0) {
                    consecutiveAuthFailures = 0
                    persistAuthFailureCount()
                }
                Log.d(TAG, "Location sent: (${request.mltLat}, ${request.mltLong}) mode=${currentMode.name}")
                return UploadOutcome.DELIVERED
            } else {
                Log.w(TAG, "Location upload failed: HTTP ${response.code()}")
                when (response.code()) {
                    401 -> {
                        consecutiveAuthFailures++
                        // 카운터를 디스크에 저장해 OS 재시작/AlarmManager 부활 후에도 누적 유지.
                        persistAuthFailureCount()
                        if (consecutiveAuthFailures >= maxAuthFailures) {
                            // 토큰 폐기 책임은 인증 flow(AuthService.logout / 로그인 재진입)에 위임한다.
                            // 여기서는 재시도 루프를 멈추고 서비스만 중단 → 사용자 재진입 시점에
                            // 스플래시/메인이 /members/me 등으로 세션 유효성을 재확인한다.
                            Log.w(TAG, "Auth failed $maxAuthFailures times — stopping service (token kept)")
                            stopSelf()
                            // 서비스가 멈추는 중이므로 이 항목부터 나머지를 큐에 되돌려(디스크 저장) 더 보내지 않는다.
                            return UploadOutcome.RETRY_LATER
                        } else {
                            Log.w(TAG, "Auth failed ($consecutiveAuthFailures/$maxAuthFailures) — will retry")
                            return UploadOutcome.RETRY_LATER
                        }
                    }
                    403 -> {
                        // 403 may be rate-limit or authorization issue, not necessarily auth failure
                        Log.w(TAG, "403 Forbidden — dropping location, not clearing token")
                        return UploadOutcome.DROPPED
                    }
                    429 -> {
                        // Rate-limit. Retry-After 헤더(seconds 또는 HTTP-date)를 우선하고,
                        // 없으면 보수적으로 60초 보류. flushPendingLocations가 이 시각을 보고 보류한다.
                        val retryAfterMs = parseRetryAfterMs(response.headers().get("Retry-After"))
                            ?: 60_000L
                        rateLimitedUntilMs = System.currentTimeMillis() + retryAfterMs
                        Log.w(TAG, "429 Too Many Requests — backing off for ${retryAfterMs}ms")
                        return UploadOutcome.RETRY_LATER
                    }
                    in 500..599 -> {
                        // 서버 오류: 호출자가 이 항목부터 큐에 되돌려 재시도한다
                        return UploadOutcome.RETRY_LATER
                    }
                }
                // 그 밖의 4xx는 기존과 같이 재시도하지 않고 버린다
                return UploadOutcome.DROPPED
            }
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.w(TAG, "Location upload error: ${e.message}")
            // 네트워크 오류: 호출자가 큐에 되돌려 재시도한다
            return UploadOutcome.RETRY_LATER
        }
    }

    /**
     * Retrofit Headers의 Retry-After 값을 ms로 파싱한다.
     * - 정수: seconds 단위(가장 일반적)
     * - HTTP-date: epoch와의 차이를 ms로 환산
     * 둘 다 실패하면 null. 음수는 0으로 클램프.
     */
    private fun parseRetryAfterMs(value: String?): Long? {
        if (value.isNullOrBlank()) return null
        val asSeconds = value.toLongOrNull()
        if (asSeconds != null) return (asSeconds.coerceAtLeast(0L)) * 1000L
        return runCatching {
            val format = java.text.SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.US)
            format.timeZone = java.util.TimeZone.getTimeZone("GMT")
            val date = format.parse(value) ?: return@runCatching null
            (date.time - System.currentTimeMillis()).coerceAtLeast(0L)
        }.getOrNull()
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
                "도착했어 위치 추적 (활동 로그)",
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
            .setContentTitle("도착했어 위치 공유 중")
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
        val queueSnapshot = pendingQueue.snapshot()
        prefs.edit().putString(KEY_PENDING_QUEUE, json.encodeToString(queueSnapshot)).apply()
    }

    private fun restorePendingLocations() {
        val prefs = getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_PENDING_QUEUE, null) ?: return
        runCatching {
            json.decodeFromString<List<CreateLocationLogRequest>>(raw)
        }.onSuccess { restored ->
            pendingQueue.restore(restored.takeLast(maxQueueSize))
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
            // 서비스 프로세스가 재기동될 때 마지막 좌표를 메모리에 복원해 STATIONARY 모드의
            // ESCAPE 거리 비교 기준점, computeSpeed 폴백의 prev 위치로만 사용한다.
            // - time을 현재로 덮어쓰지 않는다: heartbeat의 신선도 검증(HEARTBEAT_LAST_LOC_MAX_AGE_MS)이
            //   "옛 좌표가 지금 시각으로 반복 전송"되는 회귀를 막아주려면 원래 GPS time이 필요.
            //   dt가 0이거나 음수가 되어 computeSpeed가 폴백을 안 쓰는 경우는 새 콜백 한 번에 즉시 회복.
            // - enqueueLocation을 즉시 부르지 않는다: 옛 좌표가 첫 송신으로 활동로그에 찍히는 회귀를 차단.
            //   heartbeat은 1시간 이내일 때만 송신하도록 별도 가드.
            val cachedTime = if (restored.mltTimestamp.isNotBlank()) {
                runCatching {
                    SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
                        .parse(restored.mltTimestamp)?.time ?: System.currentTimeMillis()
                }.getOrDefault(System.currentTimeMillis())
            } else {
                System.currentTimeMillis()
            }
            lastLocation = Location("cached").apply {
                latitude = restored.mltLat
                longitude = restored.mltLong
                accuracy = restored.mltAccuracy.toFloat()
                altitude = restored.mltAltitude
                time = cachedTime
            }
        }.onFailure {
            Log.w(TAG, "Failed to restore last location", it)
        }
        prefs.edit().remove(KEY_LAST_LOCATION).apply()
    }

    private fun scheduleRestart(reason: String) {
        // alarm은 background broadcast(LocationRestartReceiver)를 트리거하므로,
        // 그 시점에 BG 권한이 없으면 어차피 receiver 단계에서 막힌다.
        // 불필요한 alarm 예약을 줄이기 위해 사전에 BG 권한도 함께 검사한다.
        if (!isUserLoggedIn(this) || !hasRequiredPermissions(this) || !hasBackgroundLocationPermission(this)) return
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
