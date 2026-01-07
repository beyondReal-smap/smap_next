package com.dmonster.smap.ui.register

import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.dmonster.smap.MainActivity
import com.dmonster.smap.R
import com.dmonster.smap.ui.login.LoginActivity
import com.dmonster.smap.ui.theme.SmapTheme

/**
 * 회원가입 Activity
 */
class RegisterActivity : ComponentActivity() {
    
    companion object {
        private const val TAG = "RegisterActivity"
        const val EXTRA_SOCIAL_DATA = "social_data"
    }
    
    private val viewModel: RegisterViewModel by viewModels()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 소셜 로그인 데이터 가져오기
        @Suppress("UNCHECKED_CAST")
        val socialData = intent.getSerializableExtra(EXTRA_SOCIAL_DATA) as? HashMap<String, String>
        
        setContent {
            SmapTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color.White
                ) {
                    RegisterScreen(
                        viewModel = viewModel,
                        socialData = socialData,
                        onComplete = {
                            Log.d(TAG, "✅ 회원가입 완료 - MainActivity로 이동")
                            navigateToMain()
                        },
                        onBack = {
                            Log.d(TAG, "← 뒤로가기 - LoginActivity로 이동")
                            navigateToLogin(null)
                        },
                        onExistingUser = { phone ->
                            Log.d(TAG, "⚠️ 기존 가입자 발견 - LoginActivity로 이동 (phone: $phone)")
                            navigateToLogin(phone)
                        }
                    )
                }
            }
        }
    }
    
    private fun navigateToMain() {
        val intent = Intent(this, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left)
        finish()
    }
    
    private fun navigateToLogin(prefilledPhone: String?) {
        val intent = Intent(this, LoginActivity::class.java)
        prefilledPhone?.let {
            intent.putExtra("prefilled_phone", it)
        }
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right)
        finish()
    }
}
