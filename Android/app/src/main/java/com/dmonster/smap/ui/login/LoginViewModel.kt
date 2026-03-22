package com.dmonster.smap.ui.login

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.data.model.SocialLoginResponse
import com.dmonster.smap.data.service.AuthService
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * 로그인 화면 상태
 */
data class LoginUiState(
    val phoneNumber: String = "",
    val password: String = "",
    val showPassword: Boolean = false,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val showError: Boolean = false,
    val isLoggedIn: Boolean = false,
    val isNewUser: Boolean = false,
    val socialLoginData: Map<String, String>? = null
)

/**
 * 로그인 ViewModel (iOS LoginViewModel 기반)
 */
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authService: AuthService
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState(isLoggedIn = authService.isLoggedIn))
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()
    
    /**
     * 전화번호 입력 (숫자만 저장, 표시 시 포맷팅)
     */
    fun onPhoneNumberChange(value: String) {
        // 숫자만 추출하여 저장 (최대 11자리)
        val digits = value.filter { it.isDigit() }.take(11)
        _uiState.value = _uiState.value.copy(phoneNumber = digits)
    }
    
    /**
     * 비밀번호 입력
     */
    fun onPasswordChange(value: String) {
        _uiState.value = _uiState.value.copy(password = value)
    }
    
    /**
     * 비밀번호 표시 토글
     */
    fun toggleShowPassword() {
        _uiState.value = _uiState.value.copy(showPassword = !_uiState.value.showPassword)
    }
    
    /**
     * 입력값 유효성 검사
     */
    val isInputValid: Boolean
        get() {
            return _uiState.value.phoneNumber.length >= 10 && _uiState.value.password.isNotEmpty()
        }
    
    /**
     * 포맷된 전화번호 (표시용)
     */
    val formattedPhoneNumber: String
        get() = formatPhoneNumber(_uiState.value.phoneNumber)
    
    /**
     * 전화번호 포맷팅 (010-1234-5678 형식)
     */
    private fun formatPhoneNumber(digits: String): String {
        return when {
            digits.length <= 3 -> digits
            digits.length <= 6 -> "${digits.substring(0, 3)}-${digits.substring(3)}"
            digits.length <= 10 -> "${digits.substring(0, 3)}-${digits.substring(3, 6)}-${digits.substring(6)}"
            else -> "${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7)}"
        }
    }
    
    /**
     * 전화번호/비밀번호 로그인
     */
    fun login() {
        if (!isInputValid) {
            showErrorMessage("전화번호와 비밀번호를 입력해주세요.")
            return
        }
        
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            
            Log.d("LoginViewModel", "🚀 일반 로그인 시작: ${_uiState.value.phoneNumber}")
            try {
                Log.d("LoginViewModel", "📡 Backend에 로그인 요청 중... (${_uiState.value.phoneNumber})")
                val response = authService.login(
                    phoneNumber = _uiState.value.phoneNumber,
                    password = _uiState.value.password
                )
                
                Log.d("LoginViewModel", "📥 Backend 응답 수신: success=${response.success}")
                if (response.success) {
                    Log.d("LoginViewModel", "✅ 로그인 성공 - 메인으로 이동 준비")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isLoggedIn = true
                    )
                } else {
                    Log.w("LoginViewModel", "❌ 로그인 실패: ${response.message}")
                    showErrorMessage(response.message)
                }
            } catch (e: Exception) {
                Log.e("LoginViewModel", "❌ 로그인 중 예외 발생", e)
                showErrorMessage("네트워크 오류가 발생했습니다: ${e.message}")
            }
            
            _uiState.value = _uiState.value.copy(isLoading = false)
            Log.d("LoginViewModel", "🏁 login 종료 (isLoading = false)")
        }
    }
    
    /**
     * Google 로그인 처리
     */
    fun handleGoogleLoginResult(idToken: String, email: String?, name: String?, googleId: String?, profileImage: String? = null) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            
            try {
                Log.d("LoginViewModel", "📡 Backend에 Google 로그인 요청 중... ($email)")
                val response = authService.googleLogin(
                    idToken = idToken,
                    email = email,
                    name = name,
                    googleId = googleId
                )
                
                Log.d("LoginViewModel", "📥 Backend 응답 수신: success=${response.success}")
                handleSocialLoginResponse(response, "google", email, name, googleId, profileImage)
            } catch (e: Exception) {
                Log.e("LoginViewModel", "❌ Google 로그인 예외 발생", e)
                showErrorMessage("Google 로그인 중 오류가 발생했습니다: ${e.message}")
            }
            
            _uiState.value = _uiState.value.copy(isLoading = false)
            Log.d("LoginViewModel", "🏁 handleGoogleLoginResult 종료 (isLoading = false)")
        }
    }
    
    /**
     * Kakao 로그인 처리
     */
    fun handleKakaoLoginResult(
        accessToken: String,
        email: String?,
        nickname: String?,
        kakaoId: String?,
        profileImage: String? = null
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            
            try {
                Log.d("LoginViewModel", "📡 Backend에 Kakao 로그인 요청 중... ($email)")
                val response = authService.kakaoLogin(
                    accessToken = accessToken,
                    email = email,
                    nickname = nickname,
                    kakaoId = kakaoId,
                    profileImage = profileImage
                )
                
                Log.d("LoginViewModel", "📥 Backend 응답 수신: success=${response.success}")
                handleSocialLoginResponse(response, "kakao", email, nickname, kakaoId, profileImage)
            } catch (e: Exception) {
                Log.e("LoginViewModel", "❌ Kakao 로그인 예외 발생", e)
                showErrorMessage("Kakao 로그인 중 오류가 발생했습니다: ${e.message}")
            }
            
            _uiState.value = _uiState.value.copy(isLoading = false)
            Log.d("LoginViewModel", "🏁 handleKakaoLoginResult 종료 (isLoading = false)")
        }
    }
    
    private fun handleSocialLoginResponse(
        response: SocialLoginResponse,
        provider: String,
        email: String?,
        name: String?,
        socialId: String?,
        profileImage: String? = null
    ) {
        if (response.success == true) {
            val isNewUser = response.isNewUser ?: response.data?.isNewUser ?: false
            android.util.Log.d("LoginViewModel", "📊 Social Login Status - isNewUser: $isNewUser")
            
            if (isNewUser) {
                _uiState.value = _uiState.value.copy(
                    isNewUser = true,
                    socialLoginData = mapOf(
                        "provider" to provider,
                        "email" to (email ?: ""),
                        "name" to (name ?: ""),
                        "nickname" to (name ?: ""), // 닉네임도 이름과 동일하게 초기화
                        "profile_image" to (profileImage ?: ""),
                        "${provider}_id" to (socialId ?: "")
                    )
                )
                android.util.Log.d("LoginViewModel", "✅ 신규 ${provider.uppercase()} 회원 (ProfileImage: ${profileImage != null})")
            } else {
                _uiState.value = _uiState.value.copy(isLoggedIn = true)
                android.util.Log.d("LoginViewModel", "✅ 기존 ${provider.uppercase()} 회원 로그인")
            }
        } else {
            showErrorMessage(response.message ?: "${provider.uppercase()} 로그인에 실패했습니다.")
        }
    }
    
    /**
     * 에러 메시지 표시
     */
    fun showErrorMessage(message: String) {
        _uiState.value = _uiState.value.copy(
            errorMessage = message,
            showError = true,
            isLoading = false
        )
    }
    
    /**
     * 에러 메시지 숨김
     */
    fun dismissError() {
        _uiState.value = _uiState.value.copy(showError = false, errorMessage = null)
    }
    
    /**
     * 전화번호 미리 입력 (기존 가입자가 회원가입에서 넘어올 때)
     */
    fun setPrefilledPhone(phone: String) {
        val digits = phone.filter { it.isDigit() }.take(11)
        _uiState.value = _uiState.value.copy(phoneNumber = digits)
    }
    
    /**
     * 로딩 상태 설정 (외부용)
     */
    fun setLoading(isLoading: Boolean) {
        _uiState.value = _uiState.value.copy(isLoading = isLoading)
    }

    /**
     * 로그아웃
     */
    fun logout() {
        authService.logout()
        _uiState.value = LoginUiState()
    }
}
