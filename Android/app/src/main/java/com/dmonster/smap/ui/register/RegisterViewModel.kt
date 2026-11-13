package com.dmonster.smap.ui.register

import com.dmonster.smap.BuildConfig
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.data.model.LegalContent
import com.dmonster.smap.data.model.RegisterRequest
import com.dmonster.smap.data.model.RegisterStep
import com.dmonster.smap.data.service.AuthService
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
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
import java.util.concurrent.TimeUnit

/**
 * 회원가입 ViewModel (iOS RegisterViewModel 기반)
 */
@HiltViewModel
class RegisterViewModel @Inject constructor(
    private val authService: AuthService
) : ViewModel() {

    companion object {
        private const val TAG = "RegisterViewModel"
        private val SMS_API_URL = "${BuildConfig.API_BASE_URL}sms/send-verification-code"
        private val VERIFY_CODE_API_URL = "${BuildConfig.API_BASE_URL}sms/verify-code"
        private val CHECK_PHONE_API_URL = "${BuildConfig.API_BASE_URL}members/check/phone/"
        private val REGISTER_API_URL = "${BuildConfig.API_BASE_URL}auth/register"
        private val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    // UI State
    data class RegisterUiState(
        val currentStep: RegisterStep = RegisterStep.TERMS,
        val registerData: RegisterRequest = RegisterRequest(),
        val isLoading: Boolean = false,
        val isVerificationLoading: Boolean = false,
        val errorMessage: String? = null,
        val showError: Boolean = false,

        // Verification
        val verificationCode: String = "",
        val verificationSent: Boolean = false,
        val verificationTimer: Int = 0,

        // Password
        val passwordConfirm: String = "",
        val showPassword: Boolean = false,
        val showPasswordConfirm: Boolean = false,

        // Registration complete
        val isRegistrationComplete: Boolean = false,
        val socialSessionExpired: Boolean = false,
        val showExistingUserAlert: Boolean = false,
        val existingUserPhone: String = "",

        // Legal Detail
        val currentLegalDocument: LegalContent.LegalDocument? = null
    )

    private val _uiState = MutableStateFlow(RegisterUiState())
    val uiState: StateFlow<RegisterUiState> = _uiState.asStateFlow()
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; isLenient = true }
    
    private var timerJob: Job? = null
    private var errorJob: Job? = null
    private var lastSentTime: Long? = null  // 재발송 제한용 (밀리초)
    
    // 재발송 가능 여부 확인 (3분 = 180초 = 180000밀리초)
    private fun canResend(): Boolean {
        return lastSentTime?.let { 
            System.currentTimeMillis() - it >= 60_000
        } ?: true
    }
    
    // 재발송까지 남은 시간 (초)
    fun remainingResendTime(): Int {
        return lastSentTime?.let {
            val elapsed = (System.currentTimeMillis() - it) / 1000
            maxOf(0, 60 - elapsed.toInt())
        } ?: 0
    }
    
    // MARK: - Terms Agreement
    
    fun setAgree1(value: Boolean) {
        _uiState.value = _uiState.value.copy(
            registerData = _uiState.value.registerData.copy(mtAgree1 = value)
        )
    }
    
    fun setAgree2(value: Boolean) {
        _uiState.value = _uiState.value.copy(
            registerData = _uiState.value.registerData.copy(mtAgree2 = value)
        )
    }
    
    fun setAgree3(value: Boolean) {
        _uiState.value = _uiState.value.copy(
            registerData = _uiState.value.registerData.copy(mtAgree3 = value)
        )
    }
    
    fun setAgree4(value: Boolean) {
        _uiState.value = _uiState.value.copy(
            registerData = _uiState.value.registerData.copy(mtAgree4 = value)
        )
    }
    
    fun setAgree5(value: Boolean) {
        _uiState.value = _uiState.value.copy(
            registerData = _uiState.value.registerData.copy(mtAgree5 = value)
        )
    }
    
    fun setAllTerms(value: Boolean) {
        _uiState.value = _uiState.value.copy(
            registerData = _uiState.value.registerData.copy(
                mtAgree1 = value,
                mtAgree2 = value,
                mtAgree3 = value,
                mtAgree4 = value,
                mtAgree5 = value
            )
        )
    }

    fun showLegalDocument(document: LegalContent.LegalDocument) {
        _uiState.value = _uiState.value.copy(currentLegalDocument = document)
    }

    fun hideLegalDocument() {
        _uiState.value = _uiState.value.copy(currentLegalDocument = null)
    }
    
    val isAllTermsAgreed: Boolean
        get() = with(_uiState.value.registerData) {
            mtAgree1 && mtAgree2 && mtAgree3 && mtAgree4 && mtAgree5
        }
    
    val isRequiredTermsAgreed: Boolean
        get() = with(_uiState.value.registerData) {
            mtAgree1 && mtAgree2 && mtAgree3
        }
    
    // MARK: - Phone Number
    
    fun setPhoneNumber(phone: String) {
        if (_uiState.value.registerData.mtId != phone) {
            timerJob?.cancel()
            lastSentTime = null
            _uiState.value = _uiState.value.copy(
                registerData = _uiState.value.registerData.copy(mtId = phone, mtEmail = phone, emailVerificationToken = null),
                verificationCode = "", verificationSent = false, verificationTimer = 0
            )
        }
    }

    val formattedPhoneNumber: String get() = _uiState.value.registerData.mtId
    val isPhoneValid: Boolean get() = _uiState.value.registerData.mtId.trim().matches(Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))

    // MARK: - Verification Code
    
    fun setVerificationCode(code: String) {
        if (code.length <= 6 && code.all { it.isDigit() }) {
            _uiState.value = _uiState.value.copy(verificationCode = code)
        }
    }
    
    fun sendVerificationCode() {
        val email = _uiState.value.registerData.mtId.trim().lowercase()
        if (_uiState.value.isVerificationLoading) return
        if (_uiState.value.registerData.emailVerificationToken != null) { _uiState.value = _uiState.value.copy(currentStep = RegisterStep.BASIC_INFO); return }
        if (!isPhoneValid) { showError("올바른 이메일을 입력해주세요"); return }
        if (!canResend()) { showError("잠시 후 다시 시도해주세요"); return }
        _uiState.value = _uiState.value.copy(isVerificationLoading = true)
        viewModelScope.launch {
            try {
                val result = authService.sendEmailCode(email, "register")
                if (_uiState.value.registerData.mtId.trim().lowercase() != email) return@launch
                if (!result.success) { showError("인증번호 발송에 실패했습니다"); return@launch }
                lastSentTime = System.currentTimeMillis()
                _uiState.value = _uiState.value.copy(verificationSent = true, verificationTimer = 600,
                    currentStep = RegisterStep.VERIFICATION,
                    registerData = _uiState.value.registerData.copy(mtId = email, mtEmail = email, emailVerificationToken = null))
                startTimer()
            } catch (e: Exception) {
                showError(com.dmonster.smap.data.service.emailAuthError(e))
            } finally {
                _uiState.value = _uiState.value.copy(isVerificationLoading = false)
            }
        }
    }

    fun verifyCode() {
        val state = _uiState.value
        if (state.isVerificationLoading) return
        if (state.registerData.emailVerificationToken != null) { nextStep(); return }
        if (state.verificationCode.length != 6 || state.verificationTimer <= 0) { showError("인증번호를 확인해주세요"); return }
        val email = state.registerData.mtId.trim().lowercase()
        _uiState.value = state.copy(isVerificationLoading = true)
        viewModelScope.launch {
            try {
                val result = authService.verifyEmailCode(email, "register", state.verificationCode)
                if (_uiState.value.registerData.mtId.trim().lowercase() != email) return@launch
                val token = result.verificationToken
                if (!result.success || token.isNullOrBlank()) { showError("인증번호 확인에 실패했습니다"); return@launch }
                timerJob?.cancel()
                _uiState.value = _uiState.value.copy(registerData = _uiState.value.registerData.copy(emailVerificationToken = token))
                nextStep()
            } catch (e: Exception) {
                showError(com.dmonster.smap.data.service.emailAuthError(e))
            } finally {
                _uiState.value = _uiState.value.copy(isVerificationLoading = false)
            }
        }
    }

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (_uiState.value.verificationTimer > 0) {
                delay(1000)
                _uiState.value = _uiState.value.copy(
                    verificationTimer = _uiState.value.verificationTimer - 1
                )
            }
        }
    }
    
    // MARK: - Basic Info
    
    fun setName(name: String) {
        _uiState.value = _uiState.value.copy(
            registerData = _uiState.value.registerData.copy(mtName = name)
        )
    }
    
    fun setNickname(nickname: String) {
        _uiState.value = _uiState.value.copy(
            registerData = _uiState.value.registerData.copy(mtNickname = nickname)
        )
    }
    
    fun setPassword(password: String) {
        _uiState.value = _uiState.value.copy(
            registerData = _uiState.value.registerData.copy(mtPwd = password)
        )
    }
    
    fun setPasswordConfirm(password: String) {
        _uiState.value = _uiState.value.copy(passwordConfirm = password)
    }
    
    fun toggleShowPassword() {
        _uiState.value = _uiState.value.copy(showPassword = !_uiState.value.showPassword)
    }
    
    fun toggleShowPasswordConfirm() {
        _uiState.value = _uiState.value.copy(showPasswordConfirm = !_uiState.value.showPasswordConfirm)
    }
    
    // 비밀번호 복잡성 검사
    val isPasswordLengthValid: Boolean
        get() = (_uiState.value.registerData.mtPwd?.length ?: 0) >= 8
    
    val hasPasswordLetter: Boolean
        get() = _uiState.value.registerData.mtPwd?.let { password -> password.any { it in 'A'..'Z' } && password.any { it in 'a'..'z' } } ?: false
    
    val hasPasswordNumber: Boolean
        get() = _uiState.value.registerData.mtPwd?.any { it.isDigit() } ?: false
    
    val hasPasswordSpecialChar: Boolean
        get() {
            val specialChars = "!@#\$%^&*(),.?\":{}|<>"
            return _uiState.value.registerData.mtPwd?.any { it in specialChars } ?: false
        }
    
    val isPasswordValid: Boolean
        get() = com.dmonster.smap.data.model.isServerPasswordValid(_uiState.value.registerData.mtPwd.orEmpty())
    
    val isPasswordMatch: Boolean
        get() = _uiState.value.registerData.mtPwd == _uiState.value.passwordConfirm
    
    // 이메일 형식 검사 (선택이지만 입력 시 형식 체크)
    val isEmailValid: Boolean
        get() {
            val email = _uiState.value.registerData.mtEmail
            if (email.isNullOrBlank()) return true // 선택이므로 빈 값은 유효
            return android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()
        }
    
    val isBasicInfoValid: Boolean
        get() {
            val data = _uiState.value.registerData
            val basicFieldsValid = data.mtName.isNotBlank() && data.mtNickname.isNotBlank() && isEmailValid
            
            return basicFieldsValid && isPasswordValid && isPasswordMatch
        }
    
    val isProfileValid: Boolean
        get() {
            // Apple Guideline 5.1.1: 생년월일과 성별은 선택 사항으로 변경
            return true
        }
    
    // MARK: - Profile
    
    fun setBirthDate(birth: String) {
        _uiState.value = _uiState.value.copy(
            registerData = _uiState.value.registerData.copy(mtBirth = birth)
        )
    }
    
    fun setGender(gender: Int) {
        _uiState.value = _uiState.value.copy(
            registerData = _uiState.value.registerData.copy(mtGender = gender)
        )
    }
    
    fun setEmail(email: String) {
        setPhoneNumber(email)
    }
    
    fun setOptionalPhone(phone: String) {
        _uiState.value = _uiState.value.copy(registerData = _uiState.value.registerData.copy(mtHp = phone.filter { it.isDigit() }.take(11).ifBlank { null }))
    }

    // MARK: - Navigation
    
    fun nextStep() {
        val currentStep = _uiState.value.currentStep
        val nextStep = when (currentStep) {
            RegisterStep.TERMS -> {
                RegisterStep.PHONE
            }
            RegisterStep.PHONE -> RegisterStep.VERIFICATION  // sendVerificationCode에서 처리
            RegisterStep.VERIFICATION -> RegisterStep.BASIC_INFO
            RegisterStep.BASIC_INFO -> RegisterStep.PROFILE
            RegisterStep.PROFILE -> {
                if (_uiState.value.registerData.emailVerificationToken.isNullOrBlank()) { showError("이메일 인증이 필요합니다"); return }
                completeRegistration()
                return
            }
            RegisterStep.COMPLETE -> return
        }
        _uiState.value = _uiState.value.copy(currentStep = nextStep)
    }
    
    fun previousStep() {
        val currentStep = _uiState.value.currentStep
        val prevStep = when (currentStep) {
            RegisterStep.TERMS -> return
            RegisterStep.PHONE -> RegisterStep.TERMS
            RegisterStep.VERIFICATION -> RegisterStep.PHONE
            RegisterStep.BASIC_INFO -> {
                if (isSocialAccount) RegisterStep.TERMS else RegisterStep.VERIFICATION
            }
            RegisterStep.PROFILE -> RegisterStep.BASIC_INFO
            RegisterStep.COMPLETE -> return
        }
        _uiState.value = _uiState.value.copy(currentStep = prevStep)
    }
    
    // MARK: - Registration
    
    private fun completeRegistration() {
        if (isSocialAccount && (authService.pendingSocialProvider == null || authService.pendingSocialToken == null)) {
            _uiState.value = _uiState.value.copy(socialSessionExpired = true)
            return
        }
        _uiState.value = _uiState.value.copy(isLoading = true)

        viewModelScope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    val data = _uiState.value.registerData.copy(
                        socialProvider = authService.pendingSocialProvider,
                        socialToken = authService.pendingSocialToken
                    )
                    val requestBody = json.encodeToString(data)
                        .toRequestBody("application/json".toMediaType())

                    val request = Request.Builder()
                        .url(REGISTER_API_URL)
                        .post(requestBody)
                        .build()

                    val response = client.newCall(request).execute()
                    val body = response.body?.string()

                    Triple(response.isSuccessful, response.code, body)
                }

                val (isSuccessful, responseCode, body) = result

                if (isSuccessful && body != null) {
                    val parsed = json.parseToJsonElement(body).jsonObject
                    if (parsed["success"]?.jsonPrimitive?.content != "true") {
                        _uiState.value = _uiState.value.copy(isLoading = false)
                        showError("회원가입에 실패했습니다")
                        return@launch
                    }
                    val dataObject = parsed["data"]?.jsonObject ?: throw IllegalStateException("회원가입 응답 누락")
                    val token = dataObject["token"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() } ?: throw IllegalStateException("인증 토큰 누락")
                    val refresh = dataObject["refresh_token"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() } ?: throw IllegalStateException("갱신 토큰 누락")
                    val userJson = dataObject["user"] ?: throw IllegalStateException("사용자 정보 누락")
                    val user = json.decodeFromJsonElement(com.dmonster.smap.data.model.SMAPUser.serializer(), userJson)
                    authService.saveToken(token)
                    authService.saveRefreshToken(refresh)
                    authService.saveUserData(user)
                    authService.pendingSocialProvider = null
                    authService.pendingSocialToken = null
                    _uiState.value = _uiState.value.copy(isLoading = false, currentStep = RegisterStep.COMPLETE, isRegistrationComplete = true)
                } else {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                    if (responseCode == 401 && authService.pendingSocialProvider != null) {
                        authService.pendingSocialProvider = null
                        authService.pendingSocialToken = null
                        _uiState.value = _uiState.value.copy(socialSessionExpired = true)
                        return@launch
                    }
                    val errorMessage = when (responseCode) {
                        400 -> try { org.json.JSONObject(body.orEmpty()).optString("detail").ifBlank { "입력 정보를 확인해주세요." } } catch (_: Exception) { "입력 정보를 확인해주세요." }
                        409 -> "이미 가입된 이메일입니다."
                        429 -> "요청이 많습니다. 잠시 후 다시 시도해주세요."
                        502, 503 -> "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
                        else -> "회원가입에 실패했습니다."
                    }
                    showError(errorMessage)
                }
            } catch (e: Exception) {
                Log.e(TAG, "회원가입 오류", e)
                _uiState.value = _uiState.value.copy(isLoading = false)
                showError("네트워크 오류가 발생했습니다")
            }
        }
    }
    
    // MARK: - Social Data
    
    fun applySocialData(data: Map<String, String>?) {
        if (data == null) return

        val nickname = data["nickname"] ?: data["name"] ?: ""

        // Determine type and id based on provider
        val (mtType, mtId) = when (data["provider"]) {
            "google" -> 4 to "google_${data["google_id"] ?: ""}"
            "kakao" -> 2 to "kakao_${data["kakao_id"] ?: ""}"
            else -> _uiState.value.registerData.mtType to _uiState.value.registerData.mtId
        }

        val registerData = _uiState.value.registerData.copy(
            mtEmail = data["email"],
            mtName = data["name"] ?: "",
            mtNickname = nickname,
            mtGoogleId = data["google_id"],
            mtKakaoId = data["kakao_id"],
            mtFile1 = data["picture"] ?: data["profile_image"],
            mtType = mtType,
            mtId = mtId
        )

        _uiState.value = _uiState.value.copy(registerData = registerData)
    }

    fun clearSocialSession() {
        authService.pendingSocialProvider = null
        authService.pendingSocialToken = null
    }
    
    val isSocialAccount: Boolean
        get() = with(_uiState.value.registerData) {
            mtGoogleId != null || mtKakaoId != null
        }
    
    // MARK: - Error Handling
    
    private fun showError(message: String) {
        _uiState.value = _uiState.value.copy(
            errorMessage = message,
            showError = true
        )

        errorJob?.cancel()
        errorJob = viewModelScope.launch {
            delay(3000)
            _uiState.value = _uiState.value.copy(showError = false)
        }
    }
    
    fun dismissError() {
        _uiState.value = _uiState.value.copy(
            showError = false,
            errorMessage = null
        )
    }
    
    fun dismissExistingUserAlert() {
        _uiState.value = _uiState.value.copy(showExistingUserAlert = false)
    }
}
