package com.dmonster.smap

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.ui.components.BackgroundLocationGuideDialog
import com.dmonster.smap.ui.components.LocationDeniedOverlay
import com.dmonster.smap.ui.login.LoginActivity
import com.dmonster.smap.ui.navigation.MainTabScreen
import com.dmonster.smap.ui.theme.SmapTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    companion object {
        private const val TAG = "MainActivity"
    }

    @Inject lateinit var authService: AuthService

    // Mutable state for overlay so onResume can clear it
    private var showLocationDeniedOverlay = mutableStateOf(false)
    private var showBackgroundGuide = mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val isLoggedIn = authService.isLoggedIn

        Log.d(TAG, "[AUTH_GUARD] Check: $isLoggedIn (Token=${authService.getToken()?.take(5)}..., User=${authService.getUserData()?.displayName})")

        if (!isLoggedIn) {
            Log.e(TAG, "[AUTH_GUARD] Not logged in - Redirecting to LoginActivity")
            navigateToLogin()
            return
        }

        // 딥링크 처리
        handleDeepLink(intent)

        setContent {
            SmapTheme {
                val locationDeniedOverlay by showLocationDeniedOverlay
                val backgroundGuide by showBackgroundGuide

                // Sequential permission launchers
                val backgroundLocationLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestPermission()
                ) { isGranted ->
                    if (isGranted) {
                        startLocationService()
                    }
                }

                val locationPermissionLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestMultiplePermissions()
                ) { permissions ->
                    val locationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                                         permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
                    if (locationGranted) {
                        // Location granted -> check background
                        if (!hasBackgroundLocationPermission()) {
                            showBackgroundGuide.value = true
                        } else {
                            startLocationService()
                        }
                    } else {
                        // Location DENIED -> show persistent overlay
                        showLocationDeniedOverlay.value = true
                    }
                }

                val notificationPermissionLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestPermission()
                ) { _ ->
                    // After notification result (granted or not), request location
                    if (!hasLocationPermissions()) {
                        locationPermissionLauncher.launch(
                            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
                        )
                    } else {
                        // Already has location (edge case)
                        if (!hasBackgroundLocationPermission()) {
                            showBackgroundGuide.value = true
                        } else {
                            startLocationService()
                        }
                    }
                }

                // Permission check on launch
                LaunchedEffect(Unit) {
                    if (hasLocationPermissions()) {
                        // Already has location -> check background
                        if (!hasBackgroundLocationPermission()) {
                            showBackgroundGuide.value = true
                        } else {
                            startLocationService()
                        }
                    } else {
                        // No location permission
                        if (isFirstLaunch()) {
                            // First launch -> sequential: notification first, then location
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                            } else {
                                locationPermissionLauncher.launch(
                                    arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
                                )
                            }
                            markFirstLaunchDone()
                        } else {
                            // Subsequent launch with denied location -> show overlay immediately
                            showLocationDeniedOverlay.value = true
                        }
                    }
                }

                Surface(modifier = Modifier.fillMaxSize()) {
                    // 1. Main content ALWAYS visible first
                    MainTabScreen(
                        onLogout = {
                            stopLocationService()
                            authService.logout()
                            navigateToLogin()
                        }
                    )

                    // 2. Location denied overlay (persistent until user acts)
                    if (locationDeniedOverlay) {
                        LocationDeniedOverlay(
                            onGoToSettings = {
                                showLocationDeniedOverlay.value = false
                                // Open app settings
                                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                                    data = Uri.fromParts("package", packageName, null)
                                }
                                startActivity(intent)
                            },
                            onDismiss = {
                                showLocationDeniedOverlay.value = false
                            }
                        )
                    }

                    // 3. Background location guide
                    if (backgroundGuide) {
                        BackgroundLocationGuideDialog(
                            onConfirm = {
                                showBackgroundGuide.value = false
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                    backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                                } else {
                                    startLocationService()
                                }
                            }
                        )
                    }
                }
            }
        }
    }

    // Re-check when returning from Settings
    override fun onResume() {
        super.onResume()
        // If user returns from Settings and now has location permission
        if (hasLocationPermissions()) {
            showLocationDeniedOverlay.value = false
            if (hasBackgroundLocationPermission()) {
                showBackgroundGuide.value = false
                startLocationService()
            }
        }
    }

    private fun hasLocationPermissions(): Boolean {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
        return fine == PackageManager.PERMISSION_GRANTED || coarse == PackageManager.PERMISSION_GRANTED
    }

    private fun hasBackgroundLocationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun isFirstLaunch(): Boolean {
        val prefs = getSharedPreferences("smap_prefs", MODE_PRIVATE)
        return !prefs.getBoolean("permission_onboarding_done", false)
    }

    private fun markFirstLaunchDone() {
        getSharedPreferences("smap_prefs", MODE_PRIVATE).edit()
            .putBoolean("permission_onboarding_done", true)
            .apply()
    }

    private fun startLocationService() {
        try {
            val intent = Intent(this, LocationService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
            Log.d(TAG, "[LOCATION] LocationService started")
        } catch (e: Exception) {
            Log.e(TAG, "[LOCATION] Failed to start LocationService: ${e.message}")
        }
    }

    private fun stopLocationService() {
        val intent = Intent(this, LocationService::class.java)
        stopService(intent)
        Log.d(TAG, "[LOCATION] LocationService stopped")
    }

    private fun navigateToLogin() {
        val intent = Intent(this, LoginActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right)
        finish()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        intent?.data?.let { uri ->
            Log.d(TAG, "[DEEP_LINK] Received URI: $uri")

            // smap://group/{id}/join 처리
            if (uri.scheme == "smap" && uri.host == "group") {
                val pathSegments = uri.pathSegments
                if (pathSegments.size >= 2 && pathSegments[1] == "join") {
                    val groupId = pathSegments[0]
                    Log.d(TAG, "[DEEP_LINK] Group ID: $groupId")

                    // TODO: ViewModel 등을 통해 그룹 가입 로직 실행
                    // 여기서는 일단 SharedPreferences나 전역 상태에 저장하여 UI에서 처리하게 함
                    getSharedPreferences("smap_prefs", MODE_PRIVATE).edit()
                        .putString("pending_group_id", groupId)
                        .apply()
                }
            }
        }
    }
}
