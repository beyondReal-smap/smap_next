package com.dmonster.smap.ui.login

import com.dmonster.smap.BuildConfig
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * 비밀번호 찾기 ViewModel (iOS ForgotPasswordViewModel 참고)
 */
@HiltViewModel
class ForgotPasswordViewModel @Inject constructor() : ViewModel() {
    
    companion object {
        private const val TAG = "ForgotPasswordVM"
        private val BASE_URL = BuildConfig.API_BASE_URL.trimEnd('/')
        private val CHECK_PHONE_URL = "$BASE_URL/members/check/phone/"
        private val SMS_SEND_URL = "$BASE_URL/sms/send-verification-code"
        private val RESET_PASSWORD_URL = "$BASE_URL/auth/reset-password-by-phone"
    }
    
    enum class Step {
        PHONE,
        VERIFICATION,
        NEW_PASSWORD,
        COMPLETE
    }
    
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; isLenient = true }
    
    // Step state
    private val _currentStep = MutableStateFlow(Step.PHONE)
    val currentStep: StateFlow<Step> = _currentStep.asStateFlow()
    
    // Phone state
    private val _phoneNumber = MutableStateFlow("")
    val phoneNumber: StateFlow<String> = _phoneNumber.asStateFlow()
    
    // Verification state
    private val _verificationCode = MutableStateFlow("")
    val verificationCode: StateFlow<String> = _verificationCode.asStateFlow()
    
    private val _verificationTimer = MutableStateFlow(0)
    val verificationTimer: StateFlow<Int> = _verificationTimer.asStateFlow()
    
    private var sentVerificationCode: String? = null
    
    // Password state
    private val _newPassword = MutableStateFlow("")
    val newPassword: StateFlow<String> = _newPassword.asStateFlow()
    
    private val _confirmPassword = MutableStateFlow("")
    val confirmPassword: StateFlow<String> = _confirmPassword.asStateFlow()
    
    private val _showNewPassword = MutableStateFlow(false)
    val showNewPassword: StateFlow<Boolean> = _showNewPassword.asStateFlow()
    
    private val _showConfirmPassword = MutableStateFlow(false)
    val showConfirmPassword: StateFlow<Boolean> = _showConfirmPassword.asStateFlow()
    
    // Loading & Error state
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()
    
    // Password validation rules
    val isPasswordLengthValid: Boolean get() = _newPassword.value.length >= 8
    val hasPasswordLetter: Boolean get() = _newPassword.value.contains(Regex("[a-zA-Z]"))
    val hasPasswordNumber: Boolean get() = _newPassword.value.contains(Regex("[0-9]"))
    val hasPasswordSpecialChar: Boolean get() = _newPassword.value.contains(Regex("[!@#\$%^&*(),.?\":{}|<>]"))
    
    val isPasswordRulesSatisfied: Boolean get() = 
        isPasswordLengthValid && hasPasswordLetter && hasPasswordNumber && hasPasswordSpecialChar
    
    val passwordsMatch: Boolean get() = 
        _newPassword.value.isNotEmpty() && _newPassword.value == _confirmPassword.value
    
    // MARK: - Input Handlers
    
    fun updatePhoneNumber(value: String) {
        val digits = value.filter { it.isDigit() }
        _phoneNumber.value = digits.take(11)
    }
    
    fun updateVerificationCode(value: String) {
        if (value.length <= 6 && value.all { it.isDigit() }) {
            _verificationCode.value = value
        }
    }
    
    fun updateNewPassword(value: String) {
        _newPassword.value = value
    }
    
    fun updateConfirmPassword(value: String) {
        _confirmPassword.value = value
    }
    
    fun toggleShowNewPassword() {
        _showNewPassword.value = !_showNewPassword.value
    }
    
    fun toggleShowConfirmPassword() {
        _showConfirmPassword.value = !_showConfirmPassword.value
    }
    
    fun clearError() {
        _errorMessage.value = null
    }
    
    // MARK: - Navigation
    
    fun goBack(): Boolean {
        return when (_currentStep.value) {
            Step.PHONE -> false // Dismiss screen
            Step.VERIFICATION -> {
                _currentStep.value = Step.PHONE
                true
            }
            Step.NEW_PASSWORD -> {
                _currentStep.value = Step.VERIFICATION
                true
            }
            Step.COMPLETE -> false // Dismiss screen
        }
    }
    
    // MARK: - API Actions
    
    fun checkUserAndSendCode() {
        val cleanPhone = formatPhoneForAPI(_phoneNumber.value)
        
        if (cleanPhone.length < 10) {
            _errorMessage.value = "올바른 전화번호를 입력해주세요."
            return
        }
        
        _isLoading.value = true
        
        viewModelScope.launch {
            try {
                // Step 1: Check if user exists
                val checkResult = withContext(Dispatchers.IO) {
                    checkPhoneExists(cleanPhone)
                }
                
                if (checkResult == null) {
                    _errorMessage.value = "서버 연결에 실패했습니다."
                    _isLoading.value = false
                    return@launch
                }
                
                if (checkResult) {
                    // Phone number not found (available = true means new user)
                    _errorMessage.value = "가입되지 않은 전화번호입니다."
                    _isLoading.value = false
                } else {
                    // User exists - send verification code
                    sendVerificationCode(cleanPhone)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error checking user: ${e.message}")
                _errorMessage.value = "오류가 발생했습니다."
                _isLoading.value = false
            }
        }
    }
    
    private suspend fun checkPhoneExists(cleanPhone: String): Boolean? {
        return try {
            val request = Request.Builder()
                .url("$CHECK_PHONE_URL$cleanPhone")
                .get()
                .build()
            
            val response = httpClient.newCall(request).execute()
            val body = response.body?.string()
            
            if (response.isSuccessful && body != null) {
                val parsed = json.parseToJsonElement(body).jsonObject
                parsed["available"]?.jsonPrimitive?.boolean
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Check phone error: ${e.message}")
            null
        }
    }
    
    private suspend fun sendVerificationCode(cleanPhone: String) {
        // Test number handling
        if (cleanPhone == "01011111111") {
            _isLoading.value = false
            startTimer()
            _currentStep.value = Step.VERIFICATION
            return
        }
        
        try {
            val result = withContext(Dispatchers.IO) {
                val requestBody = """{"phone_number":"$cleanPhone"}"""

                val request = Request.Builder()
                    .url(SMS_SEND_URL)
                    .post(requestBody.toByteArray().toRequestBody("application/json".toMediaType()))
                    .build()

                val response = httpClient.newCall(request).execute()
                val body = response.body?.string()

                if (response.isSuccessful && body != null) {
                    json.parseToJsonElement(body).jsonObject
                } else {
                    null
                }
            }

            _isLoading.value = false

            if (result != null && result["success"]?.jsonPrimitive?.boolean == true) {
                sentVerificationCode = result["code"]?.jsonPrimitive?.content
                startTimer()
                _currentStep.value = Step.VERIFICATION
            } else {
                _errorMessage.value = result?.get("error")?.jsonPrimitive?.content ?: "인증번호 발송에 실패했습니다."
            }
        } catch (e: Exception) {
            Log.e(TAG, "Send verification error: ${e.message}")
            _isLoading.value = false
            _errorMessage.value = "인증번호 발송에 실패했습니다."
        }
    }
    
    fun verifyCode() {
        val code = _verificationCode.value
        val cleanPhone = formatPhoneForAPI(_phoneNumber.value)
        
        // Test number handling
        if (cleanPhone == "01011111111" && code == "111111") {
            _currentStep.value = Step.NEW_PASSWORD
            return
        }
        
        if (_verificationTimer.value <= 0) {
            _errorMessage.value = "인증 시간이 만료되었습니다. 다시 시도해주세요."
            return
        }
        
        if (code == sentVerificationCode) {
            _currentStep.value = Step.NEW_PASSWORD
        } else {
            _errorMessage.value = "인증번호가 일치하지 않습니다."
        }
    }
    
    fun resetPassword() {
        if (_newPassword.value.length < 8) {
            _errorMessage.value = "비밀번호는 8자 이상이어야 합니다."
            return
        }
        
        if (_newPassword.value != _confirmPassword.value) {
            _errorMessage.value = "비밀번호가 일치하지 않습니다."
            return
        }
        
        _isLoading.value = true
        
        viewModelScope.launch {
            try {
                val cleanPhone = formatPhoneForAPI(_phoneNumber.value)
                
                val result = withContext(Dispatchers.IO) {
                    val jsonBody = """{"phone":"$cleanPhone","new_password":"${_newPassword.value}"}"""

                    val request = Request.Builder()
                        .url(RESET_PASSWORD_URL)
                        .post(jsonBody.toByteArray().toRequestBody("application/json".toMediaType()))
                        .build()

                    val response = httpClient.newCall(request).execute()
                    val body = response.body?.string()

                    if (response.isSuccessful && body != null) {
                        json.parseToJsonElement(body).jsonObject
                    } else {
                        null
                    }
                }

                _isLoading.value = false

                if (result != null && result["success"]?.jsonPrimitive?.boolean == true) {
                    _currentStep.value = Step.COMPLETE
                } else {
                    _errorMessage.value = result?.get("message")?.jsonPrimitive?.content ?: "비밀번호 변경에 실패했습니다."
                }
            } catch (e: Exception) {
                Log.e(TAG, "Reset password error: ${e.message}")
                _isLoading.value = false
                _errorMessage.value = "비밀번호 변경에 실패했습니다."
            }
        }
    }
    
    // MARK: - Helpers
    
    private fun startTimer() {
        _verificationTimer.value = 180
        viewModelScope.launch {
            while (_verificationTimer.value > 0) {
                delay(1000)
                _verificationTimer.value -= 1
            }
        }
    }
    
    private fun formatPhoneForAPI(phone: String): String {
        return phone // Already digits only
    }
}
