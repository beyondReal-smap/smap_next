package com.dmonster.smap.ui.login

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.data.api.ApiResult
import com.dmonster.smap.data.api.safeApiCall
import com.dmonster.smap.data.billing.BillingManager
import com.dmonster.smap.data.model.SocialLoginResponse
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.data.service.SubscriptionService
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
) {
    val isInputValid: Boolean
        // 로그인 아이디는 이메일만 받는다(2026-11-17 전화번호 로그인 제거 — 새로 시작하는 앱 기준).
        // 필드 이름 phoneNumber 는 전화번호 시절 이름이다. 호출부가 같은 이름을 써서 그대로 두었다.
        get() = android.util.Patterns.EMAIL_ADDRESS.matcher(phoneNumber.trim()).matches() && password.isNotEmpty()
}

/**
 * 로그인 ViewModel (iOS LoginViewModel 기반)
 */
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authService: AuthService,
    private val subscriptionService: SubscriptionService,
    private val billingManager: BillingManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState(isLoggedIn = authService.isLoggedIn))
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()
    
    /**
     * 전화번호 입력 (숫자만 저장, 표시 시 포맷팅)
     */
    fun onPhoneNumberChange(value: String) {
        _uiState.value = _uiState.value.copy(phoneNumber = value.take(200))
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
     * 전화번호/비밀번호 로그인
     */
    fun login() {
        if (!_uiState.value.isInputValid) {
            showErrorMessage("이메일과 비밀번호를 확인해주세요.")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)

            Log.d("LoginViewModel", "🚀 일반 로그인 시작: ${_uiState.value.phoneNumber}")
            when (val result = safeApiCall {
                authService.login(
                    phoneNumber = _uiState.value.phoneNumber,
                    password = _uiState.value.password
                )
            }) {
                is ApiResult.Success -> {
                    val response = result.data
                    Log.d("LoginViewModel", "📥 Backend 응답 수신: success=${response.success}")
                    if (response.success) {
                        Log.d("LoginViewModel", "✅ 로그인 성공 - 메인으로 이동 준비")
                        viewModelScope.launch { subscriptionService.refreshSubscriptionStatus() }
                        viewModelScope.launch { billingManager.reprocessPendingPurchases() }
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            isLoggedIn = true
                        )
                    } else {
                        Log.w("LoginViewModel", "❌ 로그인 실패: ${response.message}")
                        showErrorMessage(response.message)
                    }
                }
                is ApiResult.Error -> {
                    Log.e("LoginViewModel", "❌ 로그인 실패 (${result.code})")
                    showErrorMessage("로그인에 실패했습니다 (${result.code})")
                }
                is ApiResult.NetworkError -> {
                    Log.e("LoginViewModel", "❌ 로그인 중 네트워크 오류", result.exception)
                    showErrorMessage("네트워크 연결을 확인해주세요")
                }
            }
        }
    }
    
    /**
     * Google 로그인 처리
     */
    fun handleGoogleLoginResult(idToken: String, email: String?, name: String?, googleId: String?, profileImage: String? = null) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)

            Log.d("LoginViewModel", "📡 Backend에 Google 로그인 요청 중... ($email)")
            when (val result = safeApiCall {
                authService.googleLogin(
                    idToken = idToken,
                    email = email,
                    name = name,
                    googleId = googleId
                )
            }) {
                is ApiResult.Success -> {
                    Log.d("LoginViewModel", "📥 Backend 응답 수신: success=${result.data.success}")
                    handleSocialLoginResponse(result.data, "google", email, name, googleId, profileImage, idToken)
                }
                is ApiResult.Error -> {
                    Log.e("LoginViewModel", "❌ Google 로그인 실패 (${result.code})")
                    showErrorMessage("Google 로그인에 실패했습니다 (${result.code})")
                }
                is ApiResult.NetworkError -> {
                    Log.e("LoginViewModel", "❌ Google 로그인 네트워크 오류", result.exception)
                    showErrorMessage("네트워크 연결을 확인해주세요")
                }
            }
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

            Log.d("LoginViewModel", "📡 Backend에 Kakao 로그인 요청 중... ($email)")
            when (val result = safeApiCall {
                authService.kakaoLogin(
                    accessToken = accessToken,
                    email = email,
                    nickname = nickname,
                    kakaoId = kakaoId,
                    profileImage = profileImage
                )
            }) {
                is ApiResult.Success -> {
                    Log.d("LoginViewModel", "📥 Backend 응답 수신: success=${result.data.success}")
                    handleSocialLoginResponse(result.data, "kakao", email, nickname, kakaoId, profileImage, accessToken)
                }
                is ApiResult.Error -> {
                    Log.e("LoginViewModel", "❌ Kakao 로그인 실패 (${result.code})")
                    showErrorMessage("Kakao 로그인에 실패했습니다 (${result.code})")
                }
                is ApiResult.NetworkError -> {
                    Log.e("LoginViewModel", "❌ Kakao 로그인 네트워크 오류", result.exception)
                    showErrorMessage("네트워크 연결을 확인해주세요")
                }
            }
        }
    }
    
    private fun handleSocialLoginResponse(
        response: SocialLoginResponse,
        provider: String,
        email: String?,
        name: String?,
        socialId: String?,
        profileImage: String? = null,
        providerToken: String
    ) {
        if (response.success == true) {
            val isNewUser = response.isNewUser ?: response.data?.isNewUser ?: false
            android.util.Log.d("LoginViewModel", "📊 Social Login Status - isNewUser: $isNewUser")
            
            if (isNewUser) {
                authService.pendingSocialProvider = provider
                authService.pendingSocialToken = providerToken
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
                viewModelScope.launch { subscriptionService.refreshSubscriptionStatus() }
                viewModelScope.launch { billingManager.reprocessPendingPurchases() }
                _uiState.value = _uiState.value.copy(isLoggedIn = true)
                android.util.Log.d("LoginViewModel", "✅ 기존 ${provider.uppercase()} 회원 로그인")
            }
        } else {
            // 서버가 준 안내 문구(예: 같은 이메일의 기존 계정 안내)를 그대로 보여 주고, 가입 화면으로는 넘어가지 않는다
            showErrorMessage(socialLoginFailureMessage(response, provider))
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
     * 로그인 성공 상태 초기화 (one-shot event 소비 후 호출)
     */
    fun resetLoginState() {
        _uiState.value = _uiState.value.copy(isLoggedIn = false)
    }

    /**
     * 신규 회원 상태 초기화 (one-shot event 소비 후 호출)
     */
    fun resetNewUserState() {
        _uiState.value = _uiState.value.copy(isNewUser = false)
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
        viewModelScope.launch {
            authService.logoutWithUnregister()
            _uiState.value = LoginUiState()
        }
    }
}

/** 소셜 로그인 success=false 응답에서 사용자에게 보여 줄 문구. 서버 message 를 우선한다. */
internal fun socialLoginFailureMessage(response: SocialLoginResponse, provider: String): String =
    response.message?.takeIf { it.isNotBlank() }
        ?: response.error?.takeIf { it.isNotBlank() }
        ?: "${provider.uppercase()} 로그인에 실패했습니다."
