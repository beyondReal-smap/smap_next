package com.dmonster.smap

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log
import com.naver.maps.map.NaverMapSdk
import com.kakao.sdk.common.KakaoSdk
import com.kakao.sdk.common.util.Utility
import java.net.InetAddress
import java.util.concurrent.Executors

/**
 * 🔥 SMAP 앱 Application 클래스
 * 에뮬레이터 환경에서의 네트워크 최적화 및 초기 설정
 */
class SmapApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        
        Log.d("SmapApplication", "🚀 SMAP 앱 초기화 시작")
        Log.d("SmapApplication", "📦 App Package Name: ${this.packageName}")
        
        // 🔥 에뮬레이터 환경 감지 및 최적화
        if (isEmulator()) {
            Log.w("SmapApplication", "⚠️ 에뮬레이터 환경 감지됨")
            optimizeForEmulator()
        } else {
            Log.d("SmapApplication", "📱 실제 기기 환경")
            optimizeForRealDevice()
        }
        
        Log.d("SmapApplication", "✅ SMAP 앱 초기화 완료")
        
        // Naver Map SDK 초기화
        initNaverMapSdk()
        
        // Kakao SDK 초기화
        KakaoSdk.init(this, "56b34b5e5e538073805559cabc81e1d8")
        
        // 🔥 KeyHash 로그 출력 (카카오 콘솔 등록용)
        val keyHash = Utility.getKeyHash(this)
        Log.i("SmapApplication", "🔑 [KAKAO_KEY_HASH] $keyHash")

        // FCM 알림 채널 초기화
        createNotificationChannel()
    }
    
    /**
     * Naver Map SDK 초기화
     */
    private fun initNaverMapSdk() {
        try {
            Log.d("SmapApplication", "🗺️ Naver Map SDK 초기화 시작")
            
            // NCP Key Client로 초기화 (Manifest의 NCP_KEY_ID도 사용됨)
            NaverMapSdk.getInstance(this).client = NaverMapSdk.NcpKeyClient("4e12mmctfk")
            
            // 인증 실패 리스너 등록
            NaverMapSdk.getInstance(this).onAuthFailedListener = NaverMapSdk.OnAuthFailedListener { ex ->
                Log.e("SmapApplication", "❌ Naver Map 인증 실패: ${ex.errorCode}")
                Log.e("SmapApplication", "❌ 오류 메시지: ${ex.message}")
                when (ex) {
                    is NaverMapSdk.ClientUnspecifiedException -> {
                        Log.e("SmapApplication", "⚠️ 클라이언트 ID가 지정되지 않았습니다")
                    }
                    is NaverMapSdk.UnauthorizedClientException -> {
                        Log.e("SmapApplication", "⚠️ 클라이언트 ID가 유효하지 않습니다 (패키지명/SHA-1 확인 필요)")
                    }
                    is NaverMapSdk.QuotaExceededException -> {
                        Log.e("SmapApplication", "⚠️ 사용량 초과")
                    }
                }
            }
            
            Log.d("SmapApplication", "✅ Naver Map SDK 초기화 완료")
        } catch (e: Exception) {
            Log.e("SmapApplication", "❌ Naver Map SDK 초기화 실패: ${e.message}")
        }
    }
    
    /**
     * 에뮬레이터 환경 감지
     */
    private fun isEmulator(): Boolean {
        return (Build.FINGERPRINT.startsWith("generic")
                || Build.FINGERPRINT.startsWith("unknown")
                || Build.MODEL.contains("google_sdk")
                || Build.MODEL.contains("Emulator")
                || Build.MODEL.contains("Android SDK built for x86")
                || Build.MANUFACTURER.contains("Genymotion")
                || (Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic"))
                || "google_sdk" == Build.PRODUCT)
    }
    
    /**
     * 에뮬레이터 환경 최적화
     */
    private fun optimizeForEmulator() {
        Log.d("SmapApplication", "🔧 에뮬레이터 환경 최적화 시작")
        
        try {
            // 🔥 DNS 예열 (에뮬레이터에서 DNS 해석 속도 개선)
            preWarmDNS()
            
            // 🔥 네트워크 연결 상태 로깅
            logNetworkStatus()
            
            // 🔥 에뮬레이터별 특별 설정
            configureEmulatorSpecific()
            
        } catch (e: Exception) {
            Log.w("SmapApplication", "에뮬레이터 최적화 중 오류: ${e.message}")
        }
    }
    
    /**
     * 실제 기기 환경 최적화
     */
    private fun optimizeForRealDevice() {
        Log.d("SmapApplication", "📱 실제 기기 환경 최적화")
        
        try {
            // 실제 기기용 최적화 로직
            preWarmDNS()
            
        } catch (e: Exception) {
            Log.w("SmapApplication", "실기기 최적화 중 오류: ${e.message}")
        }
    }
    
    /**
     * DNS 예열 (백그라운드에서 주요 도메인 해석)
     */
    private fun preWarmDNS() {
        Log.d("SmapApplication", "🌐 DNS 예열 시작")
        
        val executor = Executors.newSingleThreadExecutor()
        executor.execute {
            val domains = listOf(
                "nextstep.smap.site",
                "smap-next.vercel.app", 
                "vercel.app",
                "google.com",
                "googleapis.com"
            )
            
            // 🔥 에뮬레이터에서 DNS 해석 문제 시 IP 주소 매핑 테이블
            val ipMappings = mapOf(
                "nextstep.smap.site" to "216.198.79.65",
                "smap-next.vercel.app" to "64.29.17.65"
            )
            
            domains.forEach { domain ->
                try {
                    val startTime = System.currentTimeMillis()
                    val address = InetAddress.getByName(domain)
                    val elapsed = System.currentTimeMillis() - startTime
                    Log.d("SmapApplication", "✅ DNS 해석 성공: $domain -> ${address.hostAddress} (${elapsed}ms)")
                    
                    // 🔥 에뮬레이터에서 DNS 응답 시간이 너무 느리면 경고
                    if (isEmulator() && elapsed > 5000) {
                        Log.w("SmapApplication", "⚠️ 에뮬레이터 DNS 응답 매우 느림: $domain (${elapsed}ms)")
                        Log.w("SmapApplication", "💡 IP 주소 직접 사용 권장: ${ipMappings[domain] ?: "IP 매핑 없음"}")
                    }
                    
                } catch (e: Exception) {
                    Log.w("SmapApplication", "⚠️ DNS 해석 실패: $domain - ${e.message}")
                    
                    // 🔥 에뮬레이터에서 DNS 실패 시 IP 매핑 정보 제공
                    if (isEmulator()) {
                        val fallbackIP = ipMappings[domain]
                        if (fallbackIP != null) {
                            Log.i("SmapApplication", "💡 DNS 실패 시 대체 IP: $domain -> $fallbackIP")
                            
                            // IP 주소로 직접 연결 테스트
                            try {
                                val ipAddress = InetAddress.getByName(fallbackIP)
                                Log.d("SmapApplication", "✅ 대체 IP 연결 확인: $fallbackIP -> ${ipAddress.hostAddress}")
                            } catch (ipError: Exception) {
                                Log.e("SmapApplication", "❌ 대체 IP도 연결 실패: $fallbackIP - ${ipError.message}")
                            }
                        }
                    }
                }
            }
            
            // 🔥 에뮬레이터 DNS 최적화 권장사항
            if (isEmulator()) {
                Log.i("SmapApplication", "🔧 에뮬레이터 DNS 최적화 권장사항:")
                Log.i("SmapApplication", "  1. 에뮬레이터 DNS 서버: 8.8.8.8, 8.8.4.4")
                Log.i("SmapApplication", "  2. 호스트 파일 설정으로 도메인 우회")
                Log.i("SmapApplication", "  3. IP 주소 직접 사용으로 DNS 우회")
            }
        }
        executor.shutdown()
    }
    
    /**
     * 네트워크 연결 상태 로깅
     */
    private fun logNetworkStatus() {
        try {
            val connectivityManager = getSystemService(CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val network = connectivityManager.activeNetwork
                val capabilities = connectivityManager.getNetworkCapabilities(network)
                
                when {
                    capabilities?.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI) == true -> {
                        Log.d("SmapApplication", "📶 WiFi 연결 감지")
                    }
                    capabilities?.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR) == true -> {
                        Log.d("SmapApplication", "📱 모바일 데이터 연결 감지")
                    }
                    capabilities?.hasTransport(android.net.NetworkCapabilities.TRANSPORT_ETHERNET) == true -> {
                        Log.d("SmapApplication", "🔌 이더넷 연결 감지 (에뮬레이터)")
                    }
                    else -> {
                        Log.w("SmapApplication", "❓ 알 수 없는 네트워크 타입")
                    }
                }
                
                Log.d("SmapApplication", "🌐 인터넷 연결: ${capabilities?.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)}")
                Log.d("SmapApplication", "✅ 검증된 연결: ${capabilities?.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED)}")
            }
            
        } catch (e: Exception) {
            Log.w("SmapApplication", "네트워크 상태 확인 실패: ${e.message}")
        }
    }
    
    /**
     * 에뮬레이터별 특별 설정
     */
    private fun configureEmulatorSpecific() {
        when {
            Build.MODEL.contains("google_sdk") -> {
                Log.d("SmapApplication", "🔧 Android Studio 에뮬레이터 감지")
                // Android Studio 에뮬레이터는 10.0.2.2 사용
            }
            Build.MANUFACTURER.contains("Genymotion") -> {
                Log.d("SmapApplication", "🔧 Genymotion 에뮬레이터 감지")
                // Genymotion은 다른 IP 범위 사용할 수 있음
            }
            Build.MODEL.contains("BlueStacks") -> {
                Log.d("SmapApplication", "🔧 BlueStacks 에뮬레이터 감지")
                // BlueStacks는 실제 네트워크 어댑터 사용할 수 있음
            }
            else -> {
                Log.d("SmapApplication", "🔧 일반 에뮬레이터 환경")
            }
        }
        
        // 🔥 에뮬레이터 환경 정보 상세 로깅
        Log.d("SmapApplication", "📋 에뮬레이터 정보:")
        Log.d("SmapApplication", "  - 제조사: ${Build.MANUFACTURER}")
        Log.d("SmapApplication", "  - 모델: ${Build.MODEL}")
        Log.d("SmapApplication", "  - 기기: ${Build.DEVICE}")
        Log.d("SmapApplication", "  - 브랜드: ${Build.BRAND}")
        Log.d("SmapApplication", "  - 제품: ${Build.PRODUCT}")
        Log.d("SmapApplication", "  - FINGERPRINT: ${Build.FINGERPRINT}")
        Log.d("SmapApplication", "  - 하드웨어: ${Build.HARDWARE}")
    }

    /**
     * FCM 알림 채널 생성 (Android 8.0+)
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelId = "smap_notification_channel"
            val channelName = "SMAP 알림"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(channelId, channelName, importance).apply {
                description = "SMAP의 주요 알림을 수신합니다."
                enableLights(true)
                enableVibration(true)
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
            Log.d("SmapApplication", "✅ FCM Notification Channel Created")
        }
    }
}