package com.dmonster.smap.ui.register

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.data.model.LegalContent
import com.dmonster.smap.data.model.RegisterRequest
import com.dmonster.smap.data.model.RegisterStep
import com.dmonster.smap.data.service.AuthService
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * 회원가입 ViewModel (iOS RegisterViewModel 기반)
 */
class RegisterViewModel(application: Application) : AndroidViewModel(application) {
    
    companion object {
        private const val TAG = "RegisterViewModel"
        private const val SMS_API_URL = "https://api3.smap.site/api/v1/sms/send-verification-code"
        private const val CHECK_PHONE_API_URL = "https://api3.smap.site/api/v1/members/check/phone/"
        private const val REGISTER_API_URL = "https://api3.smap.site/api/v1/auth/register"
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
        val showExistingUserAlert: Boolean = false,
        val existingUserPhone: String = "",
        
        // Legal Detail
        val currentLegalDocument: LegalContent.LegalDocument? = null
    )
    
    private val _uiState = MutableStateFlow(RegisterUiState())
    val uiState: StateFlow<RegisterUiState> = _uiState.asStateFlow()
    
    private val authService = AuthService.getInstance(application)
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    private val gson = Gson()
    
    private var timerJob: Job? = null
    private var sentVerificationCode: String? = null
    private var lastSentTime: Long? = null  // 재발송 제한용 (밀리초)
    
    // 재발송 가능 여부 확인 (3분 = 180초 = 180000밀리초)
    private fun canResend(): Boolean {
        return lastSentTime?.let { 
            System.currentTimeMillis() - it >= 180_000 
        } ?: true
    }
    
    // 재발송까지 남은 시간 (초)
    fun remainingResendTime(): Int {
        return lastSentTime?.let {
            val elapsed = (System.currentTimeMillis() - it) / 1000
            maxOf(0, 180 - elapsed.toInt())
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
        // 숫자만 추출하여 저장 (최대 11자리)
        val digits = phone.filter { it.isDigit() }.take(11)
        _uiState.value = _uiState.value.copy(
            registerData = _uiState.value.registerData.copy(mtId = digits)
        )
    }
    
    /**
     * 포맷된 전화번호 (표시용)
     */
    val formattedPhoneNumber: String
        get() {
            val digits = _uiState.value.registerData.mtId
            return when {
                digits.length <= 3 -> digits
                digits.length <= 6 -> "${digits.substring(0, 3)}-${digits.substring(3)}"
                digits.length <= 10 -> "${digits.substring(0, 3)}-${digits.substring(3, 6)}-${digits.substring(6)}"
                else -> "${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7)}"
            }
        }
    
    val isPhoneValid: Boolean
        get() {
            val digits = _uiState.value.registerData.mtId
            return digits.length == 11 && digits.startsWith("010")
        }
    
    // MARK: - Verification Code
    
    fun setVerificationCode(code: String) {
        if (code.length <= 6 && code.all { it.isDigit() }) {
            _uiState.value = _uiState.value.copy(verificationCode = code)
        }
    }
    
    fun sendVerificationCode() {
        val phone = _uiState.value.registerData.mtId.filter { it.isDigit() }
        
        if (!isPhoneValid) {
            showError("올바른 전화번호를 입력해주세요")
            return
        }
        
        // 재발송 제한 확인
        if (!canResend()) {
            val remaining = remainingResendTime()
            val minutes = remaining / 60
            val seconds = remaining % 60
            showError("인증번호 재발송은 ${minutes}분 ${seconds}초 후에 가능합니다")
            return
        }
        
        // 테스트 번호 처리
        if (phone == "01011111111") {
            Log.d(TAG, "📱 테스트 번호 - 실제 SMS 발송 생략")
            sentVerificationCode = null  // 테스트 번호는 111111로 고정
            lastSentTime = System.currentTimeMillis()
            _uiState.value = _uiState.value.copy(
                isVerificationLoading = false,
                verificationSent = true,
                verificationTimer = 180,
                currentStep = RegisterStep.VERIFICATION
            )
            startTimer()
            return
        }
        
        _uiState.value = _uiState.value.copy(isVerificationLoading = true)
        
        viewModelScope.launch(Dispatchers.IO) {
            try {
                // 전화번호 중복 확인
                val checkRequest = Request.Builder()
                    .url("$CHECK_PHONE_API_URL$phone")
                    .get()
                    .build()
                
                val checkResponse = client.newCall(checkRequest).execute()
                val checkBody = checkResponse.body?.string()
                
                Log.d(TAG, "📱 전화번호 중복 확인 응답: $checkBody")
                Log.d(TAG, "📱 응답 코드: ${checkResponse.code}")
                
                // available: false 이면서 명시적으로 존재하는 경우만 기존 사용자로 처리
                // API 응답이 {"available": true} 이거나 응답이 없으면 신규 사용자로 처리
                val isExistingUser = checkBody?.let { body ->
                    // available 필드가 명시적으로 false인 경우만
                    body.contains("\"available\":false") || body.contains("\"available\": false")
                } ?: false
                
                if (isExistingUser) {
                    Log.d(TAG, "⚠️ 이미 가입된 전화번호 감지")
                    _uiState.value = _uiState.value.copy(
                        isVerificationLoading = false,
                        showExistingUserAlert = true,
                        existingUserPhone = _uiState.value.registerData.mtId
                    )
                    return@launch
                }
                
                Log.d(TAG, "✅ 신규 전화번호 - SMS 발송 진행")
                
                // SMS 발송
                val smsRequestBody = mapOf("phone_number" to phone)
                val requestBody = gson.toJson(smsRequestBody)
                    .toRequestBody("application/json".toMediaType())
                
                val smsRequest = Request.Builder()
                    .url(SMS_API_URL)
                    .post(requestBody)
                    .build()
                
                val smsResponse = client.newCall(smsRequest).execute()
                val smsBody = smsResponse.body?.string()
                
                Log.d(TAG, "SMS 응답: $smsBody")
                
                if (smsResponse.isSuccessful && smsBody?.contains("\"success\":true") == true) {
                    // 백엔드에서 반환된 인증번호 저장 (iOS와 동일하게 'code' 필드 파싱)
                    val codeMatch = Regex("\"code\"\\s*:\\s*\"?(\\d+)\"?").find(smsBody ?: "")
                    sentVerificationCode = codeMatch?.groupValues?.get(1)
                    lastSentTime = System.currentTimeMillis()
                    
                    Log.d(TAG, "✅ 인증번호 발송 성공 - 코드 저장됨: ${sentVerificationCode != null}")
                    
                    _uiState.value = _uiState.value.copy(
                        isVerificationLoading = false,
                        verificationSent = true,
                        verificationTimer = 180,  // 3분
                        currentStep = RegisterStep.VERIFICATION
                    )
                    
                    startTimer()
                } else {
                    _uiState.value = _uiState.value.copy(isVerificationLoading = false)
                    showError("인증번호 발송에 실패했습니다")
                }
            } catch (e: Exception) {
                Log.e(TAG, "SMS 발송 오류", e)
                _uiState.value = _uiState.value.copy(isVerificationLoading = false)
                showError("네트워크 오류가 발생했습니다")
            }
        }
    }
    
    fun verifyCode() {
        val inputCode = _uiState.value.verificationCode
        val phone = _uiState.value.registerData.mtId.filter { it.isDigit() }
        
        if (inputCode.length != 6) {
            showError("6자리 인증번호를 입력해주세요")
            return
        }
        
        // 타이머 만료 확인
        if (_uiState.value.verificationTimer <= 0) {
            showError("인증번호가 만료되었습니다. 재발송해주세요")
            return
        }
        
        // 테스트 번호 처리
        if (phone == "01011111111") {
            if (inputCode == "111111") {
                Log.d(TAG, "✅ 테스트 번호 인증 성공")
                timerJob?.cancel()
                nextStep()
            } else {
                showError("인증번호가 올바르지 않습니다")
            }
            return
        }
        
        // 저장된 인증번호와 비교
        if (sentVerificationCode == null) {
            showError("인증번호 발송 정보가 없습니다. 다시 요청해주세요")
            return
        }
        
        if (inputCode == sentVerificationCode) {
            Log.d(TAG, "✅ 인증번호 확인 성공")
            sentVerificationCode = null  // 사용된 코드 삭제
            timerJob?.cancel()
            nextStep()
        } else {
            Log.d(TAG, "❌ 인증번호 불일치 - 입력: $inputCode, 저장된 코드: $sentVerificationCode")
            showError("인증번호가 일치하지 않습니다")
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
        get() = _uiState.value.registerData.mtPwd?.any { it.isLetter() } ?: false
    
    val hasPasswordNumber: Boolean
        get() = _uiState.value.registerData.mtPwd?.any { it.isDigit() } ?: false
    
    val hasPasswordSpecialChar: Boolean
        get() {
            val specialChars = "!@#\$%^&*(),.?\":{}|<>_+-=[];'/\\"
            return _uiState.value.registerData.mtPwd?.any { it in specialChars } ?: false
        }
    
    val isPasswordValid: Boolean
        get() = isPasswordLengthValid && hasPasswordLetter && hasPasswordNumber && hasPasswordSpecialChar
    
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
            
            return if (isSocialAccount) {
                basicFieldsValid
            } else {
                basicFieldsValid && isPasswordValid && isPasswordMatch
            }
        }
    
    val isProfileValid: Boolean
        get() {
            val data = _uiState.value.registerData
            val hasBirthDate = !data.mtBirth.isNullOrBlank()
            val hasGender = data.mtGender == 1 || data.mtGender == 2
            return hasBirthDate && hasGender
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
        _uiState.value = _uiState.value.copy(
            registerData = _uiState.value.registerData.copy(mtEmail = email.ifBlank { null })
        )
    }
    
    // MARK: - Navigation
    
    fun nextStep() {
        val currentStep = _uiState.value.currentStep
        val nextStep = when (currentStep) {
            RegisterStep.TERMS -> {
                if (isSocialAccount) RegisterStep.BASIC_INFO else RegisterStep.PHONE
            }
            RegisterStep.PHONE -> RegisterStep.VERIFICATION  // sendVerificationCode에서 처리
            RegisterStep.VERIFICATION -> RegisterStep.BASIC_INFO
            RegisterStep.BASIC_INFO -> RegisterStep.PROFILE
            RegisterStep.PROFILE -> {
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
                if (isSocialAccount) RegisterStep.TERMS else RegisterStep.PHONE
            }
            RegisterStep.PROFILE -> RegisterStep.BASIC_INFO
            RegisterStep.COMPLETE -> return
        }
        _uiState.value = _uiState.value.copy(currentStep = prevStep)
    }
    
    // MARK: - Registration
    
    private fun completeRegistration() {
        _uiState.value = _uiState.value.copy(isLoading = true)
        
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val requestBody = gson.toJson(_uiState.value.registerData)
                    .toRequestBody("application/json".toMediaType())
                
                val request = Request.Builder()
                    .url(REGISTER_API_URL)
                    .post(requestBody)
                    .build()
                
                val response = client.newCall(request).execute()
                val body = response.body?.string()
                
                Log.d(TAG, "회원가입 응답: $body")
                
                if (response.isSuccessful && body?.contains("\"success\":true") == true) {
                    // 토큰 저장
                    val tokenMatch = Regex("\"token\":\"([^\"]+)\"").find(body)
                    tokenMatch?.groupValues?.get(1)?.let { token ->
                        authService.saveToken(token)
                    }
                    
                    // 사용자 데이터 저장
                    try {
                        val jsonObject = com.google.gson.JsonParser.parseString(body).asJsonObject
                        val dataObject = jsonObject.getAsJsonObject("data")
                        val userObject = dataObject?.getAsJsonObject("user")
                        if (userObject != null) {
                            val user = gson.fromJson(userObject, com.dmonster.smap.data.model.SMAPUser::class.java)
                            authService.saveUserData(user)
                            Log.d(TAG, "회원가입 완료 - 사용자 데이터 저장: ${user.mtNickname}")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "사용자 데이터 파싱 오류", e)
                    }
                    
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        currentStep = RegisterStep.COMPLETE,
                        isRegistrationComplete = true
                    )
                } else {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                    
                    val errorMessage = if (response.code == 409) {
                        Log.w(TAG, "회원가입 중복 오류 (409): $body")
                        "이미 가입된 정보(전화번호, 이메일 등)가 있거나\n이미 사용 중인 닉네임입니다."
                    } else {
                        Log.w(TAG, "회원가입 실패 (${response.code}): $body")
                        Regex("\"message\":\"([^\"]+)\"").find(body ?: "")
                            ?.groupValues?.get(1) ?: "회원가입에 실패했습니다"
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
        
        val registerData = _uiState.value.registerData.copy(
            mtEmail = data["email"],
            mtName = data["name"] ?: "",
            mtGoogleId = data["google_id"],
            mtKakaoId = data["kakao_id"],
            mtFile1 = data["picture"] ?: data["profile_image"]
        )
        
        // provider에 따라 mt_type 설정
        when (data["provider"]) {
            "google" -> {
                registerData.mtType = 4
                registerData.mtId = "google_${data["google_id"] ?: ""}"
            }
            "kakao" -> {
                registerData.mtType = 2
                registerData.mtId = "kakao_${data["kakao_id"] ?: ""}"
            }
        }
        
        // 닉네임과 이름이 모두 비어있는 경우 방지
        val nickname = data["nickname"] ?: data["name"] ?: ""
        registerData.mtNickname = nickname
        
        _uiState.value = _uiState.value.copy(registerData = registerData)
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
        
        viewModelScope.launch {
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
