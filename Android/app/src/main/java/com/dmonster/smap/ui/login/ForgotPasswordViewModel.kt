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
import kotlinx.coroutines.Job
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
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * 비밀번호 찾기 ViewModel (iOS ForgotPasswordViewModel 참고)
 */
@HiltViewModel
class ForgotPasswordViewModel @Inject constructor(private val authService: com.dmonster.smap.data.service.AuthService) : ViewModel() {
    
    companion object {
        private const val TAG = "ForgotPasswordVM"
        private val BASE_URL = BuildConfig.API_BASE_URL.trimEnd('/')
        private val CHECK_PHONE_URL = "$BASE_URL/members/check/phone/"
        private val SMS_SEND_URL = "$BASE_URL/sms/send-verification-code"
        private val VERIFY_CODE_URL = "$BASE_URL/sms/verify-code"
        private val RESET_PASSWORD_URL = "$BASE_URL/auth/reset-password-by-phone"
        private val httpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    enum class Step {
        PHONE,
        VERIFICATION,
        NEW_PASSWORD,
        COMPLETE
    }
    
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
    
    private var timerJob: Job? = null
    private var verificationToken: String? = null
    private var lastSentTime = 0L
    
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
    val hasPasswordLetter: Boolean get() = _newPassword.value.contains(Regex("[a-z]")) && _newPassword.value.contains(Regex("[A-Z]"))
    val hasPasswordNumber: Boolean get() = _newPassword.value.contains(Regex("[0-9]"))
    val hasPasswordSpecialChar: Boolean get() = _newPassword.value.contains(Regex("[!@#\$%^&*(),.?\":{}|<>]"))
    
    val isPasswordRulesSatisfied: Boolean get() = 
        com.dmonster.smap.data.model.isServerPasswordValid(_newPassword.value)
    
    val passwordsMatch: Boolean get() = 
        _newPassword.value.isNotEmpty() && _newPassword.value == _confirmPassword.value
    
    // MARK: - Input Handlers
    
    fun updatePhoneNumber(value: String) {
        if (_phoneNumber.value != value) {
            _phoneNumber.value = value
            verificationToken = null
            lastSentTime = 0L
            timerJob?.cancel()
            _verificationTimer.value = 0
        }
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
        val email = _phoneNumber.value.trim().lowercase()
        if (_isLoading.value) return
        if (!email.matches(Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))) { _errorMessage.value = "올바른 이메일을 입력해주세요."; return }
        if (lastSentTime != 0L && System.currentTimeMillis() - lastSentTime < 60000) { _errorMessage.value = "잠시 후 다시 시도해주세요."; return }
        _isLoading.value = true
        viewModelScope.launch {
            try {
                val result = authService.sendEmailCode(email, "reset_password")
                if (_phoneNumber.value.trim().lowercase() != email) return@launch
                if (!result.success) { _errorMessage.value = "인증번호 발송에 실패했습니다."; return@launch }
                lastSentTime = System.currentTimeMillis()
                verificationToken = null
                startTimer()
                _currentStep.value = Step.VERIFICATION
            } catch (e: Exception) { _errorMessage.value = com.dmonster.smap.data.service.emailAuthError(e) }
            finally { _isLoading.value = false }
        }
    }

    fun verifyCode() {
        if (_isLoading.value) return
        if (verificationToken != null) { _currentStep.value = Step.NEW_PASSWORD; return }
        if (_verificationCode.value.length != 6 || _verificationTimer.value <= 0) { _errorMessage.value = "인증번호를 확인해주세요."; return }
        val email = _phoneNumber.value.trim().lowercase()
        _isLoading.value = true
        viewModelScope.launch {
            try {
                val result = authService.verifyEmailCode(email, "reset_password", _verificationCode.value)
                if (_phoneNumber.value.trim().lowercase() != email) return@launch
                val token = result.verificationToken
                if (!result.success || token.isNullOrBlank()) { _errorMessage.value = "인증번호 확인에 실패했습니다."; return@launch }
                verificationToken = token
                timerJob?.cancel()
                _currentStep.value = Step.NEW_PASSWORD
            } catch (e: Exception) { _errorMessage.value = com.dmonster.smap.data.service.emailAuthError(e) }
            finally { _isLoading.value = false }
        }
    }

    fun resetPassword() {
        if (_isLoading.value) return
        if (!isPasswordRulesSatisfied || !passwordsMatch) { _errorMessage.value = "비밀번호 규칙과 확인값을 확인해주세요."; return }
        val token = verificationToken ?: run { _errorMessage.value = "이메일 인증이 필요합니다."; return }
        _isLoading.value = true
        viewModelScope.launch {
            try {
                val result = authService.resetPasswordByEmail(_phoneNumber.value.trim().lowercase(), token, _newPassword.value)
                if (result.success) { verificationToken = null; _currentStep.value = Step.COMPLETE }
                else _errorMessage.value = "비밀번호 변경에 실패했습니다."
            } catch (e: Exception) { _errorMessage.value = com.dmonster.smap.data.service.emailAuthError(e) }
            finally { _isLoading.value = false }
        }
    }

    // MARK: - Helpers
    
    private fun startTimer() {
        timerJob?.cancel()
        _verificationTimer.value = 600
        timerJob = viewModelScope.launch {
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
