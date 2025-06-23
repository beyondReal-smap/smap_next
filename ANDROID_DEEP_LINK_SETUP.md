# Android 딥링크 설정 가이드

## 1. AndroidManifest.xml 설정

`AndroidManifest.xml` 파일에 딥링크를 처리할 Activity를 설정합니다:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.dmonster.smap">

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/AppTheme">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask">
            
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- 딥링크 처리 -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                
                <!-- 커스텀 스키마 -->
                <data android:scheme="smap" />
                
                <!-- 웹 URL (선택사항) -->
                <data android:scheme="https"
                      android:host="yourdomain.com"
                      android:pathPrefix="/group" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

## 2. MainActivity.kt 수정

`MainActivity.kt` 파일에 딥링크 처리 로직을 추가합니다:

```kotlin
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // 딥링크로 앱이 시작된 경우 처리
        handleIntent(intent)
    }
    
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        // 앱이 실행 중일 때 딥링크 수신
        handleIntent(intent)
    }
    
    private fun handleIntent(intent: Intent?) {
        intent?.data?.let { uri ->
            handleDeepLink(uri)
        }
    }
    
    private fun handleDeepLink(uri: Uri) {
        println("딥링크 수신: $uri")
        
        // URI 파싱
        val pathSegments = uri.pathSegments
        
        // 그룹 가입 딥링크 처리
        if (pathSegments.size >= 3 && 
            pathSegments[0] == "group" && 
            pathSegments[2] == "join") {
            
            val groupId = pathSegments[1]
            println("그룹 가입 딥링크: groupId = $groupId")
            
            // 그룹 ID를 SharedPreferences에 저장
            val prefs = getSharedPreferences("smap_prefs", MODE_PRIVATE)
            prefs.edit()
                .putString("pending_group_join", groupId)
                .putLong("pending_group_join_timestamp", System.currentTimeMillis())
                .apply()
            
            // 메인 화면으로 이동
            navigateToMain()
        }
    }
    
    private fun navigateToMain() {
        // 메인 화면으로 이동하는 로직
        // 예: Fragment 전환 또는 새로운 Activity 시작
    }
}
```

## 3. 딥링크 처리 유틸리티 클래스

딥링크 처리를 위한 유틸리티 클래스를 생성합니다:

```kotlin
import android.content.Context
import android.content.SharedPreferences

class DeepLinkManager(private val context: Context) {
    
    private val prefs: SharedPreferences = context.getSharedPreferences("smap_prefs", Context.MODE_PRIVATE)
    
    fun checkPendingGroupJoin(): String? {
        val groupId = prefs.getString("pending_group_join", null)
        val timestamp = prefs.getLong("pending_group_join_timestamp", 0)
        val currentTime = System.currentTimeMillis()
        
        // 5분 이내의 요청만 처리
        if (groupId != null && (currentTime - timestamp) < 300000) {
            println("저장된 그룹 가입 처리: $groupId")
            
            // 저장된 정보 삭제
            clearPendingGroupJoin()
            
            return groupId
        }
        
        return null
    }
    
    fun clearPendingGroupJoin() {
        prefs.edit()
            .remove("pending_group_join")
            .remove("pending_group_join_timestamp")
            .apply()
    }
    
    fun savePendingGroupJoin(groupId: String) {
        prefs.edit()
            .putString("pending_group_join", groupId)
            .putLong("pending_group_join_timestamp", System.currentTimeMillis())
            .apply()
    }
}
```

## 4. 메인 화면에서 그룹 가입 처리

메인 화면에서 저장된 그룹 가입 정보를 확인하고 처리합니다:

```kotlin
class MainFragment : Fragment() {
    
    private lateinit var deepLinkManager: DeepLinkManager
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        deepLinkManager = DeepLinkManager(requireContext())
    }
    
    override fun onResume() {
        super.onResume()
        
        // 딥링크로 전달된 그룹 가입 처리
        checkPendingGroupJoin()
    }
    
    private fun checkPendingGroupJoin() {
        val groupId = deepLinkManager.checkPendingGroupJoin()
        
        if (groupId != null) {
            // 사용자가 로그인되어 있는지 확인
            if (isUserLoggedIn()) {
                // 그룹 가입 API 호출
                joinGroup(groupId)
            } else {
                // 로그인이 필요한 경우 로그인 화면으로 이동
                navigateToLogin()
            }
        }
    }
    
    private fun isUserLoggedIn(): Boolean {
        // 로그인 상태 확인 로직
        return true // 실제 구현에서는 토큰 확인 등
    }
    
    private fun joinGroup(groupId: String) {
        // 그룹 가입 API 호출
        // Retrofit이나 다른 네트워킹 라이브러리 사용
        println("그룹 가입 API 호출: $groupId")
        
        // API 호출 예시
        /*
        apiService.joinGroup(groupId).enqueue(object : Callback<JoinGroupResponse> {
            override fun onResponse(call: Call<JoinGroupResponse>, response: Response<JoinGroupResponse>) {
                if (response.isSuccessful) {
                    // 그룹 가입 성공
                    showSuccessMessage("그룹에 가입되었습니다!")
                } else {
                    // 그룹 가입 실패
                    showErrorMessage("그룹 가입에 실패했습니다.")
                }
            }
            
            override fun onFailure(call: Call<JoinGroupResponse>, t: Throwable) {
                showErrorMessage("네트워크 오류가 발생했습니다.")
            }
        })
        */
    }
    
    private fun navigateToLogin() {
        // 로그인 화면으로 이동
        // 예: Intent로 LoginActivity 시작
    }
    
    private fun showSuccessMessage(message: String) {
        // 성공 메시지 표시
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }
    
    private fun showErrorMessage(message: String) {
        // 오류 메시지 표시
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }
}
```

## 5. App Links 설정 (선택사항)

웹사이트에서도 앱을 열 수 있도록 App Links를 설정할 수 있습니다:

1. `/.well-known/assetlinks.json` 파일을 웹사이트 루트에 생성:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.dmonster.smap",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
  }
}]
```

2. SHA256 인증서 지문 확인 방법:
```bash
keytool -list -v -keystore your-keystore.jks -alias your-alias
```

## 6. 테스트 방법

### 커스텀 스키마 테스트:
```bash
adb shell am start -W -a android.intent.action.VIEW -d "smap://group/123/join" com.dmonster.smap
```

### 웹 URL 테스트:
```bash
adb shell am start -W -a android.intent.action.VIEW -d "https://yourdomain.com/group/123/join" com.dmonster.smap
```

## 7. 디버깅

딥링크가 제대로 작동하지 않을 때 확인할 사항:

1. AndroidManifest.xml의 intent-filter 설정 확인
2. 패키지명이 올바른지 확인
3. 앱이 설치되어 있는지 확인
4. 로그캣에서 딥링크 수신 로그 확인

## 주의사항

- 딥링크는 앱이 설치되어 있어야 작동합니다
- 앱이 설치되어 있지 않으면 Play Store로 이동하도록 웹에서 처리해야 합니다
- 그룹 가입은 사용자가 로그인된 상태에서만 가능합니다
- App Links를 사용할 때는 도메인 소유권을 확인해야 합니다 