# Android Play Store Release Bugfix Audit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 27 crash-causing and stability issues identified in the Play Store release audit.

**Architecture:** Surgical fixes across Android Kotlin codebase — replace `!!` with safe access, add missing try-catch blocks, fix serialization annotations, harden error handling, and update build config. No architectural changes.

**Tech Stack:** Kotlin, Jetpack Compose, Retrofit, OkHttp, kotlinx.serialization, Hilt, Naver Map SDK

---

### Task 1: Fix all `!!` non-null assertions in HomeScreen.kt

**Files:**
- Modify: `Android/app/src/main/java/com/dmonster/smap/ui/home/HomeScreen.kt`

All these `!!` are guarded by `if (x != null)` checks above, but Kotlin smart-cast doesn't work across lambdas/composables. Replace `!!` with local `val` captures.

- [ ] **Step 1: Fix line 178 — selectedMember lat/lng**

Replace:
```kotlin
update = CameraUpdate.scrollAndZoomTo(LatLng(selectedMember.mltLat!!, selectedMember.mltLong!!), 16.0)
```
With (use local vals captured from the null check):
```kotlin
update = CameraUpdate.scrollAndZoomTo(LatLng(selectedMember.mltLat, selectedMember.mltLong), 16.0)
```
Note: The enclosing `if` already smart-casts `selectedMember` but the `mltLat`/`mltLong` fields are `Double?`. Extract local vals:
```kotlin
val lat = selectedMember.mltLat ?: return@LaunchedEffect
val lng = selectedMember.mltLong ?: return@LaunchedEffect
// then use lat, lng
```
Actually, since the if-check is `if (selectedMember != null && selectedMember.mltLat != null && selectedMember.mltLong != null)`, the simplest safe fix is to replace each `!!` with a `?: return@LaunchedEffect` or capture to local vals before the block.

The pattern for all HomeScreen fixes: Inside the `if (x != null && x.field != null)` blocks, capture nullable fields to local vals at the top of the block:
```kotlin
if (selectedMember != null && selectedMember.mltLat != null && selectedMember.mltLong != null) {
    val lat = selectedMember.mltLat ?: return@LaunchedEffect
    val lng = selectedMember.mltLong ?: return@LaunchedEffect
    cameraPositionState.animate(
        update = CameraUpdate.scrollAndZoomTo(LatLng(lat, lng), 16.0)
            .animate(com.naver.maps.map.CameraAnimation.Fly, 1000)
    )
}
```

- [ ] **Step 2: Fix line 189 — member forEach lat/lng**

Replace:
```kotlin
if (m.mltLat != null && m.mltLong != null) {
    markerPoints.add(LatLng(m.mltLat!!, m.mltLong!!))
}
```
With:
```kotlin
val lat = m.mltLat
val lng = m.mltLong
if (lat != null && lng != null) {
    markerPoints.add(LatLng(lat, lng))
}
```

- [ ] **Step 3: Fix line 196 — schedule forEach lat/lng**

Replace:
```kotlin
if (s.sstLocationLat != null && s.sstLocationLong != null) {
    markerPoints.add(LatLng(s.sstLocationLat!!, s.sstLocationLong!!))
}
```
With:
```kotlin
val lat = s.sstLocationLat
val lng = s.sstLocationLong
if (lat != null && lng != null) {
    markerPoints.add(LatLng(lat, lng))
}
```

- [ ] **Step 4: Fix line 263 — Marker in members.forEach**

Replace:
```kotlin
Marker(
    state = MarkerState(position = LatLng(member.mltLat!!, member.mltLong!!)),
```
With (capture vals before the `if` block at line 256):
```kotlin
val memberLat = member.mltLat
val memberLng = member.mltLong
if (memberLat != null && memberLng != null) {
    // ... existing code using memberLat, memberLng ...
    Marker(
        state = MarkerState(position = LatLng(memberLat, memberLng)),
```

- [ ] **Step 5: Fix line 299 — MapEffect selected member**

Replace:
```kotlin
if (selected != null && selected.mltLat != null && selected.mltLong != null) {
    markerScreenPosition = map.projection.toScreenLocation(LatLng(selected.mltLat!!, selected.mltLong!!))
```
With:
```kotlin
val lat = selected?.mltLat
val lng = selected?.mltLong
if (selected != null && lat != null && lng != null) {
    markerScreenPosition = map.projection.toScreenLocation(LatLng(lat, lng))
```

- [ ] **Step 6: Fix lines 313-314 — markerScreenPosition offset**

Replace:
```kotlin
x = with(LocalDensity.current) { (markerScreenPosition!!.x / density).dp } - 90.dp,
y = with(LocalDensity.current) { (markerScreenPosition!!.y / density).dp } - 180.dp
```
With (capture val before the if block at line 309):
```kotlin
val screenPos = markerScreenPosition
if (selectedMember != null && screenPos != null) {
    Box(
        modifier = Modifier
            .offset(
                x = with(LocalDensity.current) { (screenPos.x / density).dp } - 90.dp,
                y = with(LocalDensity.current) { (screenPos.y / density).dp } - 180.dp
            )
```

- [ ] **Step 7: Build and verify**

Run: `cd Android && ./gradlew compileDebugKotlin 2>&1 | tail -20`
Expected: BUILD SUCCESSFUL

- [ ] **Step 8: Commit**

```bash
git add Android/app/src/main/java/com/dmonster/smap/ui/home/HomeScreen.kt
git commit -m "fix: replace !! with safe null access in HomeScreen to prevent NPE crashes"
```

---

### Task 2: Fix `!!` in ActivityLogScreen, ChatSocketManager, GroupScreen, RegisterScreen

**Files:**
- Modify: `Android/app/src/main/java/com/dmonster/smap/ui/activitylog/ActivityLogScreen.kt`
- Modify: `Android/app/src/main/java/com/dmonster/smap/data/service/ChatSocketManager.kt`
- Modify: `Android/app/src/main/java/com/dmonster/smap/ui/group/GroupScreen.kt`
- Modify: `Android/app/src/main/java/com/dmonster/smap/ui/register/RegisterScreen.kt`

- [ ] **Step 1: Fix ActivityLogScreen.kt line 200**

Replace:
```kotlin
if (stay.stayLatitude != null && stay.stayLongitude != null && 
    stay.stayLatitude != 0.0 && stay.stayLongitude != 0.0) {
    // ... many lines ...
    Marker(
        state = MarkerState(position = LatLng(stay.stayLatitude!!, stay.stayLongitude!!)),
```
With: Capture local vals at top of `stayTimes.forEachIndexed`:
```kotlin
val stayLat = stay.stayLatitude
val stayLng = stay.stayLongitude
if (stayLat != null && stayLng != null && stayLat != 0.0 && stayLng != 0.0) {
    // ... use stayLat, stayLng throughout ...
    Marker(
        state = MarkerState(position = LatLng(stayLat, stayLng)),
```

- [ ] **Step 2: Fix ChatSocketManager.kt line 91-93 — sid!!**

Replace:
```kotlin
sid = handshake.getString("sid")

connectWebSocket(client, sid!!, token)
```
With:
```kotlin
val sessionId = handshake.optString("sid", null)
if (sessionId.isNullOrBlank()) {
    Log.e(TAG, "Failed to get session ID from handshake")
    return
}
sid = sessionId
connectWebSocket(client, sessionId, token)
```

- [ ] **Step 3: Fix ChatSocketManager.kt line 35 — Add CoroutineExceptionHandler**

Replace:
```kotlin
private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
```
With:
```kotlin
private val exceptionHandler = CoroutineExceptionHandler { _, throwable ->
    Log.e(TAG, "Coroutine exception", throwable)
}
private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO + exceptionHandler)
```

- [ ] **Step 4: Fix GroupScreen.kt — all `!!` on selectedGroup/selectedMember**

Pattern for all 5 occurrences (lines 207, 217, 230, 257, 269): Replace the `if + !!` pattern with `?.let`:

Example for line 205-208:
```kotlin
// Before:
if (showEditDialog && selectedGroup != null) {
    EditGroupDialog(
        group = selectedGroup!!,
// After:
if (showEditDialog) {
    selectedGroup?.let { group ->
        EditGroupDialog(
            group = group,
```

Apply same pattern for all 5 occurrences.

- [ ] **Step 5: Fix GroupScreen.kt — wrap startActivity calls in try-catch**

For all 4 `context.startActivity()` calls (lines 249, 285, 296, 335), wrap each in:
```kotlin
try {
    context.startActivity(intent)
} catch (e: Exception) {
    Log.e("GroupScreen", "Failed to start activity", e)
}
```

- [ ] **Step 6: Fix RegisterScreen.kt line 190**

Replace:
```kotlin
if (uiState.showError && uiState.errorMessage != null) {
    Text(
        text = uiState.errorMessage!!,
```
With:
```kotlin
val errorMsg = uiState.errorMessage
if (uiState.showError && errorMsg != null) {
    Text(
        text = errorMsg,
```

- [ ] **Step 7: Build and verify**

Run: `cd Android && ./gradlew compileDebugKotlin 2>&1 | tail -20`
Expected: BUILD SUCCESSFUL

- [ ] **Step 8: Commit**

```bash
git add Android/app/src/main/java/com/dmonster/smap/ui/activitylog/ActivityLogScreen.kt \
       Android/app/src/main/java/com/dmonster/smap/data/service/ChatSocketManager.kt \
       Android/app/src/main/java/com/dmonster/smap/ui/group/GroupScreen.kt \
       Android/app/src/main/java/com/dmonster/smap/ui/register/RegisterScreen.kt
git commit -m "fix: replace !! with safe null access in ActivityLog, Chat, Group, Register screens"
```

---

### Task 3: Fix @SerialName annotations in SettingsModels.kt

**Files:**
- Modify: `Android/app/src/main/java/com/dmonster/smap/data/model/SettingsModels.kt`

- [ ] **Step 1: Add @SerialName to ChangePasswordRequest (lines 30-34)**

Replace:
```kotlin
@Serializable
data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String
)
```
With:
```kotlin
@Serializable
data class ChangePasswordRequest(
    @SerialName("current_password") val currentPassword: String,
    @SerialName("new_password") val newPassword: String
)
```

- [ ] **Step 2: Add @SerialName to VerifyPasswordRequest (lines 111-114)**

Replace:
```kotlin
@Serializable
data class VerifyPasswordRequest(
    val currentPassword: String
)
```
With:
```kotlin
@Serializable
data class VerifyPasswordRequest(
    @SerialName("current_password") val currentPassword: String
)
```

- [ ] **Step 3: Verify the SmapApi endpoint definitions match**

Check `SmapApi.kt` to confirm `changePassword` and `verifyPassword` endpoints use these request bodies. The serialization names must match what the backend expects.

- [ ] **Step 4: Build and verify**

Run: `cd Android && ./gradlew compileDebugKotlin 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add Android/app/src/main/java/com/dmonster/smap/data/model/SettingsModels.kt
git commit -m "fix: add @SerialName annotations to password request models for correct API serialization"
```

---

### Task 4: Add 401 token expiry handling in AuthInterceptor

**Files:**
- Modify: `Android/app/src/main/java/com/dmonster/smap/data/api/AuthInterceptor.kt`

- [ ] **Step 1: Add 401 response handling**

Replace the full AuthInterceptor file:
```kotlin
package com.dmonster.smap.data.api

import android.content.SharedPreferences
import android.util.Log
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

class AuthInterceptor @Inject constructor(
    private val prefs: SharedPreferences
) : Interceptor {
    companion object {
        private const val TAG = "AuthInterceptor"
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val token = prefs.getString("auth_token", null)
        val request = chain.request().newBuilder().apply {
            token?.let { addHeader("Authorization", "Bearer $it") }
        }.build()

        val response = chain.proceed(request)

        if (response.code == 401) {
            Log.w(TAG, "401 Unauthorized - clearing auth token")
            prefs.edit().remove("auth_token").apply()
        }

        return response
    }
}
```

Note: Full logout-and-redirect requires an event bus or broadcast, which is beyond scope. Clearing the token ensures the next API call or app restart routes to login.

- [ ] **Step 2: Build and verify**

Run: `cd Android && ./gradlew compileDebugKotlin 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add Android/app/src/main/java/com/dmonster/smap/data/api/AuthInterceptor.kt
git commit -m "fix: handle 401 responses by clearing expired auth token"
```

---

### Task 5: Fix LocationService — getBatteryLevel + sendLocationToServer

**Files:**
- Modify: `Android/app/src/main/java/com/dmonster/smap/LocationService.kt`

- [ ] **Step 1: Wrap getBatteryLevel() in try-catch (lines 392-397)**

Replace:
```kotlin
private fun getBatteryLevel(): String {
    val intent = registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val level = intent?.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = intent?.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1) ?: -1
    return if (level != -1 && scale != -1) ((level * 100) / scale.toFloat()).toInt().toString() else "0"
}
```
With:
```kotlin
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
```

- [ ] **Step 2: Add 401 handling in sendLocationToServer (lines 347-364)**

Replace:
```kotlin
} else {
    Log.w(TAG, "Location upload failed: HTTP ${response.code()}")
    // Re-enqueue on server error for retry
    if (response.code() >= 500) {
        enqueueLocation(request)
    }
}
```
With:
```kotlin
} else {
    Log.w(TAG, "Location upload failed: HTTP ${response.code()}")
    if (response.code() >= 500) {
        enqueueLocation(request)
    }
    // Don't retry 4xx — client errors won't self-resolve
}
```
(No change needed — the current behavior is correct: 4xx errors are dropped because they indicate bad request data that won't succeed on retry. The 401 token clearing is handled by AuthInterceptor from Task 4.)

- [ ] **Step 3: Wrap requestLocationUpdates in try-catch for SecurityException**

Find the `requestLocationUpdates()` call in `startLocationTracking()` and wrap it:
```kotlin
try {
    fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
} catch (e: SecurityException) {
    Log.e(TAG, "Location permission revoked during request", e)
    stopSelf()
}
```

- [ ] **Step 4: Build and verify**

Run: `cd Android && ./gradlew compileDebugKotlin 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add Android/app/src/main/java/com/dmonster/smap/LocationService.kt
git commit -m "fix: add try-catch in getBatteryLevel and SecurityException guard in location tracking"
```

---

### Task 6: Fix response.body?.string() error handling across ViewModels

**Files:**
- Modify: `Android/app/src/main/java/com/dmonster/smap/data/service/ActivityLogService.kt`
- Modify: `Android/app/src/main/java/com/dmonster/smap/ui/myplace/MyPlaceViewModel.kt`

Note: RegisterViewModel.kt and ForgotPasswordViewModel.kt already have outer try-catch blocks wrapping the entire `withContext(Dispatchers.IO)` block that catches `Exception`. The `response.body?.string()` calls are already protected. Only ActivityLogService and MyPlaceViewModel need fixes.

- [ ] **Step 1: Fix ActivityLogService.kt getLocationLogs (lines 35-48)**

Replace:
```kotlin
suspend fun getLocationLogs(memberId: Int, date: String): List<LocationLog> {
    val response = api.getLocationLogs(memberId, date)
    val body = response.body()?.string() ?: return emptyList()
    val trimmed = body.trim()
```
With:
```kotlin
suspend fun getLocationLogs(memberId: Int, date: String): List<LocationLog> {
    return try {
        val response = api.getLocationLogs(memberId, date)
        val body = response.body()?.string() ?: return emptyList()
        val trimmed = body.trim()
        if (trimmed == "[]" || trimmed.startsWith("[")) {
            Log.d(TAG, "[getLocationLogs] empty or array response, returning empty list")
            return emptyList()
        }
        val parsed = json.decodeFromString<LocationLogListResponse>(trimmed)
        val logs = parsed.data ?: emptyList()
        Log.d(TAG, "[getLocationLogs] ${logs.size} logs loaded")
        logs
    } catch (e: Exception) {
        Log.e(TAG, "[getLocationLogs] Failed to load logs", e)
        emptyList()
    }
}
```

- [ ] **Step 2: Fix MyPlaceViewModel.kt reverse geocoding (around line 371-378)**

Wrap the `decodeFromString` in the existing try-catch, or add one if missing:
```kotlin
if (response.isSuccessful) {
    val body = response.body?.string() ?: return@withContext null
    try {
        val result = json.decodeFromString<KakaoAddressResponse>(body)
        // ...
    } catch (e: Exception) {
        Log.e(TAG, "Failed to parse address response", e)
        null
    }
}
```

- [ ] **Step 3: Fix MyPlaceViewModel.kt search (around line 407-408)**

Same pattern — wrap `decodeFromString` in try-catch:
```kotlin
if (response.isSuccessful) {
    val body = response.body?.string() ?: ""
    try {
        val result = json.decodeFromString<KakaoPlaceResponse>(body)
        _searchResults.value = result.documents
    } catch (e: Exception) {
        Log.e(TAG, "Failed to parse search response", e)
        _errorMessage.value = "검색 결과 처리에 실패했습니다"
    }
    _hasSearched.value = true
}
```

- [ ] **Step 4: Build and verify**

Run: `cd Android && ./gradlew compileDebugKotlin 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add Android/app/src/main/java/com/dmonster/smap/data/service/ActivityLogService.kt \
       Android/app/src/main/java/com/dmonster/smap/ui/myplace/MyPlaceViewModel.kt
git commit -m "fix: add error handling for response body parsing in ActivityLog and MyPlace"
```

---

### Task 7: Fix FCM infinite retry loop

**Files:**
- Modify: `Android/app/src/main/java/com/dmonster/smap/MyFirebaseMessagingService.kt`

- [ ] **Step 1: Add retry count limit (lines 94-149)**

The `reason` string grows on each retry (`reason + "_retry"`). Use this to limit retries:

In `onFailure` callback, replace:
```kotlin
override fun onFailure(call: Call, e: IOException) {
    Log.e(TAG, "❌ [FCM FORCE] 네트워크 오류: ${e.message}")
    CoroutineScope(Dispatchers.Main).launch {
        kotlinx.coroutines.delay(3000)
        forceSendTokenToServer(context, token, mtIdx, reason + "_retry")
    }
}
```
With:
```kotlin
override fun onFailure(call: Call, e: IOException) {
    Log.e(TAG, "❌ [FCM FORCE] 네트워크 오류: ${e.message}")
    val retryCount = reason.count { it == '_' && reason.contains("retry") }
    if (retryCount < 3) {
        CoroutineScope(Dispatchers.Main).launch {
            kotlinx.coroutines.delay(3000L * (retryCount + 1))
            forceSendTokenToServer(context, token, mtIdx, reason + "_retry")
        }
    } else {
        Log.e(TAG, "❌ [FCM FORCE] 최대 재시도 횟수 초과, 포기")
    }
}
```

- [ ] **Step 2: Fix response handling — use response.use {}**

Replace:
```kotlin
override fun onResponse(call: Call, response: Response) {
    response.body?.string()?.let { responseBody ->
        try {
            // ...
        } catch (e: Exception) {
            // ...
        }
    }
    response.close()
}
```
With:
```kotlin
override fun onResponse(call: Call, response: Response) {
    response.use { resp ->
        resp.body?.string()?.let { responseBody ->
            try {
                val jsonResponse = JSONObject(responseBody)
                val success = jsonResponse.optBoolean("success", false)
                if (success) {
                    Log.d(TAG, "✅ [FCM FORCE] FCM 토큰 강제 업데이트 성공!")
                    saveTokenUpdateTime(context)
                    saveTokenToPreferences(context, token)
                } else {
                    Log.e(TAG, "❌ [FCM FORCE] 서버 오류: ${jsonResponse.optString("message")}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [FCM FORCE] JSON 파싱 오류: ${e.message}")
            }
        }
    }
}
```

- [ ] **Step 3: Build and verify**

Run: `cd Android && ./gradlew compileDebugKotlin 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add Android/app/src/main/java/com/dmonster/smap/MyFirebaseMessagingService.kt
git commit -m "fix: limit FCM retry to 3 attempts with backoff, use response.use for cleanup"
```

---

### Task 8: Fix build.gradle.kts — signing credentials and minification

**Files:**
- Modify: `Android/app/build.gradle.kts`

- [ ] **Step 1: Move signing credentials to gradle.properties references (lines 37-44)**

Replace:
```kotlin
signingConfigs {
    create("release") {
        storeFile = file("smap.jks")
        storePassword = "dmonster"
        keyAlias = "key0"
        keyPassword = "dmonster"
    }
}
```
With:
```kotlin
signingConfigs {
    create("release") {
        storeFile = file("smap.jks")
        storePassword = project.findProperty("STORE_PASSWORD")?.toString() ?: ""
        keyAlias = project.findProperty("KEY_ALIAS")?.toString() ?: "key0"
        keyPassword = project.findProperty("KEY_PASSWORD")?.toString() ?: ""
    }
}
```

- [ ] **Step 2: Add signing properties to gradle.properties**

Add to `Android/gradle.properties`:
```properties
# Signing credentials (move to local.properties for production)
STORE_PASSWORD=dmonster
KEY_ALIAS=key0
KEY_PASSWORD=dmonster
```

- [ ] **Step 3: Enable minification for release (line 59)**

Replace:
```kotlin
isMinifyEnabled = false  // 🔥 크래시 문제 해결을 위해 비활성화
isShrinkResources = false
```
With:
```kotlin
isMinifyEnabled = true
isShrinkResources = true
```

- [ ] **Step 4: Build release to check for ProGuard issues**

Run: `cd Android && ./gradlew assembleRelease 2>&1 | tail -30`
If ProGuard errors appear, fix in Task 9.

- [ ] **Step 5: Commit**

```bash
git add Android/app/build.gradle.kts Android/gradle.properties
git commit -m "fix: externalize signing credentials, enable R8 minification for release"
```

---

### Task 9: Update ProGuard rules

**Files:**
- Modify: `Android/app/proguard-rules.pro`

- [ ] **Step 1: Add Hilt, Kotlinx Serialization, and Retrofit interface rules**

Append to end of file:
```proguard
# ==========================================
# Hilt Dependency Injection
# ==========================================
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keepclassmembers class * {
    @dagger.hilt.android.lifecycle.HiltViewModel <init>(...);
}

# ==========================================
# Kotlinx Serialization
# ==========================================
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.dmonster.smap.**$$serializer { *; }
-keepclassmembers class com.dmonster.smap.** {
    *** Companion;
}
-keepclasseswithmembers class com.dmonster.smap.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# ==========================================
# Retrofit API Interfaces
# ==========================================
-keep,allowobfuscation interface com.dmonster.smap.data.api.** { *; }
```

- [ ] **Step 2: Build release again**

Run: `cd Android && ./gradlew assembleRelease 2>&1 | tail -30`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add Android/app/proguard-rules.pro
git commit -m "fix: add ProGuard rules for Hilt, Kotlinx Serialization, and Retrofit interfaces"
```

---

### Task 10: Fix deep link validation and RegisterActivity cast safety

**Files:**
- Modify: `Android/app/src/main/java/com/dmonster/smap/MainActivity.kt`
- Modify: `Android/app/src/main/java/com/dmonster/smap/ui/register/RegisterActivity.kt`

- [ ] **Step 1: Add groupId validation in handleDeepLink (lines 285-290)**

Replace:
```kotlin
if (pathSegments.size >= 2 && pathSegments[1] == "join") {
    val groupId = pathSegments[0]
    Log.d(TAG, "[DEEP_LINK] Group ID: $groupId")

    getSharedPreferences("smap_prefs", MODE_PRIVATE).edit()
        .putString("pending_group_id", groupId)
        .apply()
}
```
With:
```kotlin
if (pathSegments.size >= 2 && pathSegments[1] == "join") {
    val groupId = pathSegments[0]
    if (groupId.toIntOrNull() != null) {
        Log.d(TAG, "[DEEP_LINK] Group ID: $groupId")
        getSharedPreferences("smap_prefs", MODE_PRIVATE).edit()
            .putString("pending_group_id", groupId)
            .apply()
    } else {
        Log.e(TAG, "[DEEP_LINK] Invalid group ID: $groupId")
    }
}
```

- [ ] **Step 2: Wrap RegisterActivity getSerializableExtra in try-catch (lines 39-44)**

Replace:
```kotlin
val socialData = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    intent.getSerializableExtra(EXTRA_SOCIAL_DATA, HashMap::class.java) as? HashMap<String, String>
} else {
    @Suppress("DEPRECATION", "UNCHECKED_CAST")
    intent.getSerializableExtra(EXTRA_SOCIAL_DATA) as? HashMap<String, String>
}
```
With:
```kotlin
val socialData = try {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getSerializableExtra(EXTRA_SOCIAL_DATA, HashMap::class.java) as? HashMap<String, String>
    } else {
        @Suppress("DEPRECATION", "UNCHECKED_CAST")
        intent.getSerializableExtra(EXTRA_SOCIAL_DATA) as? HashMap<String, String>
    }
} catch (e: Exception) {
    Log.e("RegisterActivity", "Failed to parse social data", e)
    null
}
```

- [ ] **Step 3: Build and verify**

Run: `cd Android && ./gradlew compileDebugKotlin 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add Android/app/src/main/java/com/dmonster/smap/MainActivity.kt \
       Android/app/src/main/java/com/dmonster/smap/ui/register/RegisterActivity.kt
git commit -m "fix: validate deep link group ID and add try-catch for social data deserialization"
```

---

### Task 11: Clean up network_security_config.xml

**Files:**
- Modify: `Android/app/src/main/res/xml/network_security_config.xml`

- [ ] **Step 1: Remove unnecessary IP addresses and DNS entries from production domain-config**

Remove from the first `<domain-config>` (production):
- All `76.76.19.*` IP addresses (Vercel IPs — already covered by domain names)
- All DNS server IPs (`8.8.8.8`, `8.8.4.4`, `1.1.1.1`, `1.0.0.1`) — DNS IPs are never targets of HTTP traffic

Keep: actual production domains (smap.site, vercel.app, naver map domains, googleapis.com, etc.)

- [ ] **Step 2: Build and verify**

Run: `cd Android && ./gradlew compileDebugKotlin 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add Android/app/src/main/res/xml/network_security_config.xml
git commit -m "fix: remove dev IP addresses and DNS entries from production network security config"
```
