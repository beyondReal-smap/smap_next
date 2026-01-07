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
import com.google.android.gms.location.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*

class LocationService : Service() {
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationRequest: LocationRequest
    private val client = OkHttpClient()

    // 속도 변화 감지 관련 변수들
    private var lastSpeed: Float = -1f
    private var lastLocationTime: Long = 0L
    private var speedChangeThreshold = 0.3f // 속도 변화 임계값 (m/s) - 사람이 걷는 정도
    private var lastLocation: Location? = null
    private var distanceThreshold = 10.0f // 거리 기반 임계값 (미터)

    companion object {
        private const val TAG = "LocationService"
        private const val NOTIFICATION_CHANNEL_ID = "LocationServiceChannel"
        private const val NOTIFICATION_ID = 10000
        private const val GPS_REFRESH_INTERVAL = 10000L // 10초로 단축
        private const val GPS_MIN_REFRESH_INTERVAL = 5000L // 5초로 단축
        private const val GPS_MAX_REFRESH_INTERVAL = 15000L // 15초로 단축
        private const val API_BASE_URL = "https://nextstep.smap.site/api"

        fun isRunning(context: Context): Boolean {
            val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
            return manager.getRunningServices(Integer.MAX_VALUE)
                .any { it.service.className == LocationService::class.java.name }
        }
    }

    private val locationCallback: LocationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            Log.d(TAG, "🔥 [LOCATION] ===== 위치 업데이트 수신 시작 =====")
            Log.d(TAG, "🔥 [LOCATION] onLocationResult 호출됨 - 위치 개수: ${result.locations.size}")
            Log.d(TAG, "🔥 [LOCATION] 서비스 상태 - 속도 임계값: ${speedChangeThreshold}m/s, 거리 임계값: ${distanceThreshold}m")
            
            result.locations.lastOrNull()?.let { location ->
                Log.d(TAG, "📍 [LOCATION] 새로운 위치 데이터 수신:")
                Log.d(TAG, "   위도: ${location.latitude}")
                Log.d(TAG, "   경도: ${location.longitude}")
                Log.d(TAG, "   속도: ${location.speed} m/s")
                Log.d(TAG, "   정확도: ${location.accuracy} m")
                Log.d(TAG, "   시간: ${SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date(location.time))}")
                
                // 속도 변화 감지 및 위치 정보 전송
                val shouldSend = shouldSendLocationBasedOnSpeed(location)
                Log.d(TAG, "🤔 [LOCATION] 전송 여부 결정: $shouldSend")
                
                if (shouldSend) {
                    val mltGpsData = MltGpsData(
                        location.latitude.toString(),
                        location.longitude.toString(),
                        location.speed.toString(),
                        location.accuracy.toString(),
                        SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date(location.time))
                    )

                    Log.d(TAG, "✅ [LOCATION] 위치 정보 서버 전송 시작")
                    sendLocationToServer(mltGpsData)
                } else {
                    Log.d(TAG, "⏭️ [LOCATION] 위치 정보 전송 건너뜀")
                }
            }
        }

        override fun onLocationAvailability(locationAvailability: LocationAvailability) {
            super.onLocationAvailability(locationAvailability)
            Log.d(TAG, "onLocationAvailability: ${locationAvailability.isLocationAvailable}")
        }
    }

    private fun createLocationRequest(): LocationRequest =
        LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            GPS_REFRESH_INTERVAL
        ).apply {
            setMinUpdateIntervalMillis(GPS_MIN_REFRESH_INTERVAL)
            setMaxUpdateDelayMillis(GPS_MAX_REFRESH_INTERVAL)
            setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
            setWaitForAccurateLocation(true)
        }.build()

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "LocationService onCreate")
        
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        locationRequest = createLocationRequest()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "🚀 [LOCATION] ===== LocationService 시작 =====")
        Log.d(TAG, "🚀 [LOCATION] LocationService onStartCommand")
        Log.d(TAG, "🚀 [LOCATION] Intent: ${intent?.action ?: "null"}")
        Log.d(TAG, "🚀 [LOCATION] Flags: $flags, StartId: $startId")
        
        // Android 15+ 권한 체크
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val fgServicePermission = ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.FOREGROUND_SERVICE_LOCATION
            )
            Log.d(TAG, "🔐 [LOCATION] FOREGROUND_SERVICE_LOCATION 권한: ${fgServicePermission == PackageManager.PERMISSION_GRANTED}")

            if (fgServicePermission != PackageManager.PERMISSION_GRANTED) {
                Log.e(TAG, "❌ [LOCATION] FOREGROUND_SERVICE_LOCATION 권한이 없습니다")
                stopSelf()
                return START_NOT_STICKY
            }
        }
        
        // 위치 권한 체크
        val fineLocationPermission = ActivityCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        )
        val coarseLocationPermission = ActivityCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        Log.d(TAG, "🔐 [LOCATION] ACCESS_FINE_LOCATION 권한: ${fineLocationPermission == PackageManager.PERMISSION_GRANTED}")
        Log.d(TAG, "🔐 [LOCATION] ACCESS_COARSE_LOCATION 권한: ${coarseLocationPermission == PackageManager.PERMISSION_GRANTED}")

        if (fineLocationPermission != PackageManager.PERMISSION_GRANTED &&
            coarseLocationPermission != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "❌ [LOCATION] 위치 권한이 없습니다")
            stopSelf()
            return START_NOT_STICKY
        }
        
        // 서비스 시작 즉시 포그라운드 전환
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        
        startLocationTracking()

        Log.d(TAG, "✅ [LOCATION] LocationService 시작 완료 - 포그라운드 서비스 실행 중")
        return START_STICKY
    }

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
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification() = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
        .setContentTitle("SMAP 위치 공유 중")
        .setContentText("활동 로그 기록 및 멤버와의 실시간 위치 공유를 위해 위치를 수집하고 있습니다.")
        .setSmallIcon(R.mipmap.ic_launcher)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setOngoing(true)
        .build()

    private fun startLocationTracking() {
        Log.d(TAG, "📡 [LOCATION] ===== 위치 추적 시작 =====")

        if (ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED && ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            Log.e(TAG, "Location permission not granted")
            return
        }

        // 마지막 위치 요청
        fusedLocationClient.lastLocation
            .addOnSuccessListener { location ->
                location?.let {
                    Log.d(TAG, "Last location: ${it.latitude}, ${it.longitude}")
                }
            }

        // 위치 정보 업데이트 시작
        Log.d(TAG, "📡 [LOCATION] 위치 업데이트 요청 설정:")
        Log.d(TAG, "   인터벌: ${locationRequest.interval}ms")
        Log.d(TAG, "   최소 인터벌: ${locationRequest.minUpdateIntervalMillis}ms")
        Log.d(TAG, "   최대 대기시간: ${locationRequest.maxUpdateDelayMillis}ms")
        Log.d(TAG, "   우선순위: ${locationRequest.priority}")

        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.myLooper()
        )

        Log.d(TAG, "✅ [LOCATION] 위치 추적 시작됨 - GPS 업데이트 요청 완료")
    }

    private fun stopLocationTracking() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        Log.d(TAG, "Location tracking stopped")
    }

    /**
     * 속도 변화 및 거리 기반으로 위치 정보 전송 여부를 결정
     * 사람이 걷는 정도의 속도 변화를 감지하고 거리 기반 대안 로직 추가
     */
    private fun shouldSendLocationBasedOnSpeed(location: Location): Boolean {
        val currentSpeed = location.speed
        val currentTime = System.currentTimeMillis()

        // 음수 속도는 0으로 처리 (iOS와 동일)
        val validSpeed = if (currentSpeed < 0) 0f else currentSpeed

        Log.d(TAG, "🔍 [SPEED] 속도 분석 시작:")
        Log.d(TAG, "   현재 속도: ${validSpeed}m/s (${validSpeed * 3.6}km/h)")
        Log.d(TAG, "   이전 속도: ${lastSpeed}m/s (${lastSpeed * 3.6}km/h)")
        Log.d(TAG, "   임계값: ${speedChangeThreshold}m/s (${speedChangeThreshold * 3.6}km/h)")

        // 첫 번째 위치 업데이트인 경우
        if (lastSpeed == -1f) {
            lastSpeed = validSpeed
            lastLocationTime = currentTime
            lastLocation = location
            Log.d(TAG, "✅ [SPEED] 첫 번째 위치 업데이트 - 서버 전송")
            return true
        }

        // 1. 속도 변화 기반 감지
        val speedDifference = Math.abs(validSpeed - lastSpeed)
        Log.d(TAG, "📊 [SPEED] 속도 차이: ${speedDifference}m/s (${speedDifference * 3.6}km/h)")

        if (speedDifference >= speedChangeThreshold) {
            Log.d(TAG, "✅ [SPEED] 속도 변화 감지 - 서버 전송")
            updateLocationData(location, validSpeed, currentTime)
            return true
        }

        // 2. 거리 기반 대안 로직 (속도 변화가 없어도)
        lastLocation?.let { prevLocation ->
            val distance = location.distanceTo(prevLocation)
            Log.d(TAG, "📏 [DISTANCE] 거리 계산: ${distance}m (임계값: ${distanceThreshold}m)")
            
            if (distance >= distanceThreshold) {
                Log.d(TAG, "✅ [DISTANCE] 거리 기반 감지 - 서버 전송")
                updateLocationData(location, validSpeed, currentTime)
                return true
            }
        }

        // 3. 주기적 전송 (3분마다)
        val timeSinceLastSend = currentTime - lastLocationTime
        val threeMinutesInMillis = 3 * 60 * 1000L
        Log.d(TAG, "⏰ [TIME] 마지막 전송 후 경과 시간: ${timeSinceLastSend / 1000}초")

        if (timeSinceLastSend >= threeMinutesInMillis) {
            Log.d(TAG, "✅ [TIME] 주기적 전송 (3분 경과) - 서버 전송")
            updateLocationData(location, validSpeed, currentTime)
            return true
        }

        // 4. 정지 상태에서 움직임 감지 (속도 0에서 0.5m/s 이상으로 변화)
        if (lastSpeed < 0.1f && validSpeed >= 0.5f) {
            Log.d(TAG, "✅ [MOVEMENT] 정지에서 움직임 감지 - 서버 전송")
            updateLocationData(location, validSpeed, currentTime)
            return true
        }

        Log.d(TAG, "⏭️ [SKIP] 모든 조건 미충족 - 전송 건너뜀")
        return false
    }

    /**
     * 위치 데이터 업데이트 헬퍼 함수
     */
    private fun updateLocationData(location: Location, speed: Float, time: Long) {
        lastSpeed = speed
        lastLocationTime = time
        lastLocation = location
        Log.d(TAG, "🔄 [UPDATE] 위치 데이터 업데이트 완료")
    }

    private fun sendLocationToServer(mltGpsData: MltGpsData) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                Log.d(TAG, "🚀 [SERVER] 위치 데이터 서버 전송 시작")
                Log.d(TAG, "📊 [SERVER] 전송할 데이터:")
                Log.d(TAG, "   위도: ${mltGpsData.mlt_lat}")
                Log.d(TAG, "   경도: ${mltGpsData.mlt_long}")
                Log.d(TAG, "   속도: ${mltGpsData.mlt_speed} m/s")
                Log.d(TAG, "   정확도: ${mltGpsData.mlt_accuracy} m")
                Log.d(TAG, "   시간: ${mltGpsData.mlt_gps_time}")
                
                // 🔍 mt_idx 값 확인 및 로깅
                val prefs = getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
                val mt_idx_int = prefs.getInt("mt_idx", -1)
                val mt_idx = if (mt_idx_int != -1) mt_idx_int.toString() else ""

                Log.d(TAG, "🔍 [SERVER] SharedPreferences 모든 값 확인:")
                prefs.all.forEach { (key, value) ->
                    Log.d(TAG, "  $key = $value")
                }

                Log.d(TAG, "🔍 [SERVER] mt_idx 값: '$mt_idx' (int: $mt_idx_int)")

                if (mt_idx.isNotEmpty() && mt_idx != "null") {
                    // iOS와 동일한 데이터 포맷 사용
                    val dateFormatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
                    val currentTimeString = dateFormatter.format(Date())

                    val data = java.util.HashMap<String, Any>()
                    data["act"] = "create_location_log"  // 백엔드에서 요구하는 액션 파라미터
                    data["mt_idx"] = mt_idx
                    data["mlt_lat"] = mltGpsData.mlt_lat.toDoubleOrNull() ?: 0.0
                    data["mlt_long"] = mltGpsData.mlt_long.toDoubleOrNull() ?: 0.0
                    data["mlt_accuracy"] = mltGpsData.mlt_accuracy.toDoubleOrNull() ?: 0.0
                    data["mlt_speed"] = mltGpsData.mlt_speed.toDoubleOrNull() ?: 0.0
                    data["mlt_altitude"] = 0.0 // 안드로이드에서는 고도 정보가 제한적
                    data["mlt_timestamp"] = currentTimeString
                    data["mlt_battery"] = getBatteryLevel()
                    data["mlt_fine_location"] = "N"
                    data["mlt_location_chk"] = "N"
                    data["mt_health_work"] = "0" // 안드로이드에서는 걸음 수 정보를 별도 처리

                    Log.d(TAG, "서버로 전송할 위치 데이터:")
                    Log.d(TAG, "  mt_idx: $mt_idx")
                    Log.d(TAG, "  위도: ${data["mlt_lat"]}")
                    Log.d(TAG, "  경도: ${data["mlt_long"]}")
                    Log.d(TAG, "  정확도: ${data["mlt_accuracy"]}")
                    Log.d(TAG, "  속도: ${data["mlt_speed"]}")
                    Log.d(TAG, "  배터리: ${data["mlt_battery"]}%")

                    val requestBody = JSONObject(data as Map<*, *>?).toString()
                        .toRequestBody("application/json".toMediaType())

                    // 올바른 API 엔드포인트 사용
                    val apiUrl = "https://api3.smap.site/api/v1/logs/member-location-logs"
                    Log.d(TAG, "📡 [API] 요청 URL: $apiUrl")
                    Log.d(TAG, "📡 [API] 요청 데이터: ${JSONObject(data as Map<*, *>?).toString()}")

                    val request = Request.Builder()
                        .url(apiUrl)
                        .post(requestBody)
                        .build()

                    // 타임아웃 설정
                    val timeoutClient = client.newBuilder()
                        .connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                        .readTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                        .writeTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                        .build()

                    timeoutClient.newCall(request).execute().use { response ->
                        Log.d(TAG, "📡 [API] 서버 응답 수신:")
                        Log.d(TAG, "   응답 코드: ${response.code}")
                        Log.d(TAG, "   응답 메시지: ${response.message}")
                        Log.d(TAG, "   응답 시간: ${System.currentTimeMillis()}")

                        if (response.isSuccessful) {
                            Log.d(TAG, "✅ [SUCCESS] 위치 데이터 전송 성공!")
                            val responseBody = response.body?.string()
                            Log.d(TAG, "📄 [SUCCESS] 서버 응답 본문: ${responseBody ?: "응답 없음"}")
                            Log.d(TAG, "🎉 [SUCCESS] 위치 전송 완료 - 다음 업데이트 대기")
                        } else {
                            Log.e(TAG, "❌ [ERROR] 위치 데이터 전송 실패!")
                            Log.e(TAG, "   실패 코드: ${response.code}")
                            val errorBody = response.body?.string()
                            Log.e(TAG, "   에러 응답: ${errorBody ?: "에러 세부 정보 없음"}")
                            Log.e(TAG, "   요청 헤더: ${request.headers}")
                            Log.e(TAG, "   응답 헤더: ${response.headers}")
                        }
                    }
                } else {
                    Log.w(TAG, "⚠️ [SKIP] mt_idx가 유효하지 않아 위치 데이터 전송 건너뜀")
                    Log.w(TAG, "   mt_idx 값: '$mt_idx'")
                    Log.w(TAG, "   mt_idx_int 값: $mt_idx_int")
                    Log.w(TAG, "   사용자 로그인이 필요할 수 있습니다")
                }
            } catch (e: Exception) {
                Log.e(TAG, "💥 [EXCEPTION] 위치 데이터 전송 중 오류 발생!")
                Log.e(TAG, "   오류 메시지: ${e.message}")
                Log.e(TAG, "   오류 타입: ${e.javaClass.simpleName}")
                Log.e(TAG, "   스택 트레이스:")
                e.printStackTrace()
                Log.e(TAG, "🔄 [EXCEPTION] 다음 위치 업데이트에서 재시도 예정")
            }
        }
    }

    private fun getBatteryLevel(): String {
        val batteryIntent = registerReceiver(null, android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED))
        val level = batteryIntent?.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryIntent?.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1) ?: -1
        
        return if (level != -1 && scale != -1) {
            ((level * 100) / scale.toFloat()).toInt().toString()
        } else {
            "0"
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        stopLocationTracking()
        Log.d(TAG, "LocationService onDestroy")
    }

    data class MltGpsData(
        val mlt_lat: String,
        val mlt_long: String,
        val mlt_speed: String,
        val mlt_accuracy: String,
        val mlt_gps_time: String
    )
} 