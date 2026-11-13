package com.dmonster.smap.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * 비밀번호 찾기 ViewModel (iOS ForgotPasswordViewModel 참고)
 * 입력이 이메일이면 메일 인증, 숫자 10~11자리 전화번호면 SMS 인증 경로로 진행한다.
 * 인증 성공 여부는 항상 서버 응답으로만 판정한다(앱에서 코드를 비교하지 않는다).
 */
@HiltViewModel
class ForgotPasswordViewModel @Inject constructor(private val authService: com.dmonster.smap.data.service.AuthService) : ViewModel() {

    companion object {
        const val RESEND_COOLDOWN_MS = 60_000L
        const val EMAIL_TIMER_SECONDS = 600
        const val SMS_TIMER_SECONDS = 180 // 서버 SMS 인증번호 유효시간(3분)
        const val MSG_WAIT = "잠시 후 다시 시도해주세요."
        private val EMAIL_REGEX = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

        /** 입력 종류 판별. 전화번호는 하이픈·공백 제거 후 숫자 10~11자리 */
        fun classify(input: String): InputKind {
            val trimmed = input.trim()
            if (EMAIL_REGEX.matches(trimmed)) return InputKind.EMAIL
            val digits = trimmed.replace("-", "").replace(" ", "")
            if (digits.length in 10..11 && digits.all { it in '0'..'9' }) return InputKind.PHONE
            return InputKind.INVALID
        }

        /** 서버로 보낼 정규화 값: 이메일은 소문자, 전화번호는 숫자만 */
        fun normalize(input: String): String = when (classify(input)) {
            InputKind.PHONE -> input.trim().replace("-", "").replace(" ", "")
            else -> input.trim().lowercase()
        }
    }

    enum class InputKind { EMAIL, PHONE, INVALID }

    enum class Step {
        PHONE,
        VERIFICATION,
        NEW_PASSWORD,
        COMPLETE
    }
    
    
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
    private var smsVerified = false

    // 인증번호를 실제로 보낸 경로(안내 문구·완료 안내에 사용)
    private val _sentKind = MutableStateFlow(InputKind.EMAIL)
    val sentKind: StateFlow<InputKind> = _sentKind.asStateFlow()
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
            smsVerified = false
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
        val kind = classify(_phoneNumber.value)
        val target = normalize(_phoneNumber.value)
        if (_isLoading.value) return
        if (kind == InputKind.INVALID) { _errorMessage.value = "올바른 이메일 또는 전화번호를 입력해주세요."; return }
        if (lastSentTime != 0L && System.currentTimeMillis() - lastSentTime < RESEND_COOLDOWN_MS) { _errorMessage.value = MSG_WAIT; return }
        _isLoading.value = true
        viewModelScope.launch {
            try {
                if (kind == InputKind.PHONE) {
                    val result = authService.sendSmsCode(target)
                    if (normalize(_phoneNumber.value) != target) return@launch
                    if (!result.success) { _errorMessage.value = result.error ?: "인증번호 발송에 실패했습니다."; return@launch }
                } else {
                    val result = authService.sendEmailCode(target, "reset_password")
                    if (normalize(_phoneNumber.value) != target) return@launch
                    if (!result.success) { _errorMessage.value = "인증번호 발송에 실패했습니다."; return@launch }
                }
                lastSentTime = System.currentTimeMillis()
                verificationToken = null
                smsVerified = false
                _sentKind.value = kind
                _verificationCode.value = ""
                startTimer(if (kind == InputKind.PHONE) SMS_TIMER_SECONDS else EMAIL_TIMER_SECONDS)
                _currentStep.value = Step.VERIFICATION
            } catch (e: Exception) { _errorMessage.value = com.dmonster.smap.data.service.emailAuthError(e) }
            finally { _isLoading.value = false }
        }
    }

    fun verifyCode() {
        if (_isLoading.value) return
        if (verificationToken != null || smsVerified) { _currentStep.value = Step.NEW_PASSWORD; return }
        if (_verificationCode.value.length != 6 || _verificationTimer.value <= 0) { _errorMessage.value = "인증번호를 확인해주세요."; return }
        val target = normalize(_phoneNumber.value)
        val kind = _sentKind.value
        _isLoading.value = true
        viewModelScope.launch {
            try {
                if (kind == InputKind.PHONE) {
                    // 인증번호 비교는 서버가 한다. 성공 응답일 때만 다음 단계로 간다.
                    val result = authService.verifySmsCode(target, _verificationCode.value)
                    if (normalize(_phoneNumber.value) != target) return@launch
                    if (!result.success) { _errorMessage.value = result.error ?: "인증번호 확인에 실패했습니다."; return@launch }
                    smsVerified = true
                } else {
                    val result = authService.verifyEmailCode(target, "reset_password", _verificationCode.value)
                    if (normalize(_phoneNumber.value) != target) return@launch
                    val token = result.verificationToken
                    if (!result.success || token.isNullOrBlank()) { _errorMessage.value = "인증번호 확인에 실패했습니다."; return@launch }
                    verificationToken = token
                }
                timerJob?.cancel()
                _currentStep.value = Step.NEW_PASSWORD
            } catch (e: Exception) { _errorMessage.value = com.dmonster.smap.data.service.emailAuthError(e) }
            finally { _isLoading.value = false }
        }
    }

    fun resetPassword() {
        if (_isLoading.value) return
        if (!isPasswordRulesSatisfied || !passwordsMatch) { _errorMessage.value = "비밀번호 규칙과 확인값을 확인해주세요."; return }
        val kind = _sentKind.value
        val target = normalize(_phoneNumber.value)
        val token = verificationToken
        if (kind == InputKind.PHONE) {
            if (!smsVerified) { _errorMessage.value = "문자 인증이 필요합니다."; return }
        } else if (token == null) { _errorMessage.value = "이메일 인증이 필요합니다."; return }
        _isLoading.value = true
        viewModelScope.launch {
            try {
                if (kind == InputKind.PHONE) {
                    val result = authService.resetPasswordByPhone(target, _newPassword.value)
                    if (result.success) { smsVerified = false; _currentStep.value = Step.COMPLETE }
                    else _errorMessage.value = result.message ?: "비밀번호 변경에 실패했습니다."
                } else {
                    val result = authService.resetPasswordByEmail(target, token!!, _newPassword.value)
                    if (result.success) { verificationToken = null; _currentStep.value = Step.COMPLETE }
                    else _errorMessage.value = "비밀번호 변경에 실패했습니다."
                }
            } catch (e: Exception) {
                _errorMessage.value = com.dmonster.smap.data.service.emailAuthError(e)
                // 서버의 SMS 인증 완료 상태는 5분만 유지된다. 400이면 인증을 다시 받도록 되돌린다.
                if (kind == InputKind.PHONE && e is retrofit2.HttpException && e.code() == 400) {
                    smsVerified = false
                    _verificationCode.value = ""
                    _currentStep.value = Step.VERIFICATION
                }
            }
            finally { _isLoading.value = false }
        }
    }

    // MARK: - Helpers
    
    private fun startTimer(seconds: Int) {
        timerJob?.cancel()
        _verificationTimer.value = seconds
        timerJob = viewModelScope.launch {
            while (_verificationTimer.value > 0) {
                delay(1000)
                _verificationTimer.value -= 1
            }
        }
    }
}
