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
import com.dmonster.smap.ui.components.LocationPermissionDialog
import com.dmonster.smap.ui.login.LoginActivity
import com.dmonster.smap.ui.navigation.MainTabScreen
import com.dmonster.smap.ui.theme.SmapTheme

class MainActivity : ComponentActivity() {

    companion object {
        private const val TAG = "MainActivity"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        val authService = AuthService.getInstance(this)
        val isLoggedIn = authService.isLoggedIn
        
        Log.d(TAG, "🔍 [AUTH_GUARD] Check: $isLoggedIn (Token=${authService.getToken()?.take(5)}..., User=${authService.getUserData()?.displayName})")

        if (!isLoggedIn) {
            Log.e(TAG, "🚫 [AUTH_GUARD] Not logged in - Redirecting to LoginActivity")
            navigateToLogin()
            return
        }

        setContent {
            SmapTheme {
                var showDisclosure by remember { mutableStateOf(false) }
                var showBackgroundGuide by remember { mutableStateOf(false) }
                
                // Permission Launchers
                val permissionLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestMultiplePermissions()
                ) { permissions ->
                    val locationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                                        permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
                    val notificationGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        permissions[Manifest.permission.POST_NOTIFICATIONS] == true
                    } else {
                        true
                    }

                    if (locationGranted) {
                        checkAndRequestBackgroundLocation(onShowGuide = { showBackgroundGuide = true })
                    }
                    
                    if (notificationGranted) {
                        Log.d(TAG, "✅ [FCM] Notification permission granted")
                    }
                }

                val backgroundLocationLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestPermission()
                ) { isGranted ->
                    if (isGranted) {
                        startLocationService()
                    }
                }

                // Initial Check
                LaunchedEffect(Unit) {
                    val hasLocation = hasLocationPermissions()
                    val hasNotification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
                    } else {
                        true
                    }

                    if (!hasLocation || !hasNotification) {
                        showDisclosure = true
                    } else if (!hasBackgroundLocationPermission()) {
                        showBackgroundGuide = true
                    } else {
                        startLocationService()
                    }
                }

                Surface(modifier = Modifier.fillMaxSize()) {
                    MainTabScreen(
                        onLogout = {
                            stopLocationService()
                            authService.logout()
                            navigateToLogin()
                        }
                    )

                    if (showDisclosure) {
                        LocationPermissionDialog(
                            onConfirm = {
                                showDisclosure = false
                                val permissions = mutableListOf(
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                    Manifest.permission.ACCESS_COARSE_LOCATION
                                )
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                    permissions.add(Manifest.permission.POST_NOTIFICATIONS)
                                }
                                permissionLauncher.launch(permissions.toTypedArray())
                            },
                            onDismiss = { showDisclosure = false }
                        )
                    }

                    if (showBackgroundGuide) {
                        BackgroundLocationGuideDialog(
                            onConfirm = {
                                showBackgroundGuide = false
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

    private fun checkAndRequestBackgroundLocation(onShowGuide: () -> Unit) {
        if (!hasBackgroundLocationPermission()) {
            onShowGuide()
        } else {
            startLocationService()
        }
    }

    private fun startLocationService() {
        try {
            val intent = Intent(this, LocationService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
            Log.d(TAG, "✅ [LOCATION] LocationService started")
        } catch (e: Exception) {
            Log.e(TAG, "❌ [LOCATION] Failed to start LocationService: ${e.message}")
        }
    }

    private fun stopLocationService() {
        val intent = Intent(this, LocationService::class.java)
        stopService(intent)
        Log.d(TAG, "🛑 [LOCATION] LocationService stopped")
    }

    private fun navigateToLogin() {
        val intent = Intent(this, LoginActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right)
        finish()
    }
}

