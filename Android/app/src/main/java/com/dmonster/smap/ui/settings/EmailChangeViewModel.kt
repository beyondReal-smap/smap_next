package com.dmonster.smap.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.data.service.AuthService
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import retrofit2.HttpException

/**
 * 로그인한 회원의 이메일 등록·변경 ViewModel.
 *
 * 가입 ViewModel 의 이메일 인증 규칙(이메일 수정 시 초기화, 늦게 온 응답 무시, 60초 재발송 쿨다운)을
 * 따르되, 가입 쪽을 건드리지 않도록 이 화면 전용으로 따로 둔다. 검증 토큰은 메모리에만 둔다.
 */
@HiltViewModel
class EmailChangeViewModel @Inject constructor(
    private val authService: AuthService
) : ViewModel() {

    companion object {
        const val PURPOSE = "change_email"
        const val CODE_LENGTH = 6
        const val CODE_TTL_SECONDS = 600
        const val RESEND_COOLDOWN_MILLIS = 60_000L
        private val EMAIL_REGEX = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

        const val MSG_DUPLICATE = "이미 다른 계정에서 사용 중인 이메일이에요."
        const val MSG_TOO_MANY = "요청이 많아요. 잠시 후 다시 시도해 주세요."
        const val MSG_TEMPORARY = "일시적인 오류예요. 잠시 후 다시 시도해 주세요."
        const val MSG_INVALID_EMAIL = "올바른 이메일을 입력해 주세요."
        const val MSG_SAME_EMAIL = "현재 사용 중인 이메일이에요."
        const val MSG_WAIT = "잠시 후 다시 시도해 주세요."
        const val MSG_CHECK_CODE = "인증번호를 확인해 주세요."
        const val MSG_CHECK_INPUT = "입력 정보를 확인해 주세요."
        const val MSG_SESSION = "로그인이 만료됐어요. 다시 로그인해 주세요."
        const val MSG_REVERIFY = "인증 정보가 올바르지 않아요. 인증번호를 다시 받아 주세요."
    }

    enum class Step { EMAIL, CODE }

    data class UiState(
        val step: Step = Step.EMAIL,
        /** 서버에 등록된 현재 이메일. 비어 있으면 미등록. */
        val currentEmail: String = "",
        val email: String = "",
        val code: String = "",
        val isLoading: Boolean = false,
        val timerSeconds: Int = 0,
        val verificationToken: String? = null,
        val errorMessage: String? = null,
        val isCompleted: Boolean = false,
    ) {
        val isRegistered: Boolean get() = currentEmail.isNotBlank()
        val normalizedEmail: String get() = normalize(email)
        val isEmailValid: Boolean get() = EMAIL_REGEX.matches(normalizedEmail)
        val isSameAsCurrent: Boolean get() = isRegistered && normalizedEmail == currentEmail
        val canSend: Boolean get() = isEmailValid && !isSameAsCurrent
        val isCodeExpired: Boolean get() = step == Step.CODE && timerSeconds == 0
    }

    private val _uiState = MutableStateFlow(UiState(currentEmail = storedEmail()))
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    private var timerJob: Job? = null
    private var lastSentTime: Long? = null
    /** 초기화·이메일 수정 시 증가시켜, 그 이전에 시작한 요청의 늦은 응답을 버린다. */
    private var generation = 0

    private fun storedEmail(): String = normalize(authService.getUserData()?.mtEmail.orEmpty())

    /** 화면을 열 때·닫을 때 호출해 이전 입력과 인증 상태를 모두 지운다. */
    fun reset() {
        timerJob?.cancel()
        lastSentTime = null
        generation++
        _uiState.value = UiState(currentEmail = storedEmail())
    }

    fun remainingResendSeconds(): Int {
        val sent = lastSentTime ?: return 0
        val elapsed = (System.currentTimeMillis() - sent) / 1000
        return maxOf(0, (RESEND_COOLDOWN_MILLIS / 1000).toInt() - elapsed.toInt())
    }

    fun setEmail(value: String) {
        if (value == _uiState.value.email) return
        // 이메일이 바뀌면 이전 이메일로 받은 인증 상태를 모두 버린다.
        timerJob?.cancel()
        lastSentTime = null
        generation++
        _uiState.value = _uiState.value.copy(
            step = Step.EMAIL, email = value, code = "", timerSeconds = 0,
            verificationToken = null, errorMessage = null, isLoading = false,
        )
    }

    fun setCode(value: String) {
        if (value.length <= CODE_LENGTH && value.all { it.isDigit() }) {
            _uiState.value = _uiState.value.copy(code = value, errorMessage = null)
        }
    }

    /** 2단계에서 1단계로 돌아간다. 인증 상태는 초기화하고, 재발송 쿨다운은 유지한다. */
    fun backToEmail() {
        timerJob?.cancel()
        generation++
        _uiState.value = _uiState.value.copy(
            step = Step.EMAIL, code = "", timerSeconds = 0,
            verificationToken = null, errorMessage = null, isLoading = false,
        )
    }

    fun dismissError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    fun sendCode() {
        val state = _uiState.value
        if (state.isLoading) return
        if (!state.isEmailValid) { showError(MSG_INVALID_EMAIL); return }
        if (state.isSameAsCurrent) { showError(MSG_SAME_EMAIL); return }
        if (remainingResendSeconds() > 0) { showError(MSG_WAIT); return }
        val email = state.normalizedEmail
        val gen = generation
        _uiState.value = state.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            try {
                val result = authService.sendEmailCode(email, PURPOSE)
                if (gen != generation) return@launch
                if (!result.success) { showError(MSG_TEMPORARY); return@launch }
                lastSentTime = System.currentTimeMillis()
                _uiState.value = _uiState.value.copy(
                    step = Step.CODE, email = email, code = "", timerSeconds = CODE_TTL_SECONDS,
                    verificationToken = null,
                )
                startTimer()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (gen == generation) showError(errorMessage(e))
            } finally {
                if (gen == generation) _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    /** "확인": 인증번호 검증 후 이메일 등록까지 이어서 수행한다. 검증이 끝난 토큰이 있으면 등록만 다시 시도한다. */
    fun confirm() {
        val state = _uiState.value
        if (state.isLoading || state.step != Step.CODE) return
        val token = state.verificationToken
        if (token == null && (state.code.length != CODE_LENGTH || state.timerSeconds <= 0)) {
            showError(MSG_CHECK_CODE); return
        }
        val email = state.normalizedEmail
        val gen = generation
        _uiState.value = state.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            try {
                val verified = token ?: verify(email, state.code, gen) ?: return@launch
                val result = authService.changeEmail(email, verified)
                if (gen != generation) return@launch
                if (!result.success) { showError(MSG_TEMPORARY); return@launch }
                authService.updateStoredEmail(email)
                timerJob?.cancel()
                _uiState.value = _uiState.value.copy(currentEmail = email, verificationToken = null, isCompleted = true)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (gen != generation) return@launch
                // 등록 단계에서 토큰이 거절됐다면(400/403) 같은 토큰으로 다시 시도해도 소용없으니 재인증을 안내한다.
                val status = (e as? HttpException)?.code()
                val tokenRejected = (status == 400 || status == 403) && _uiState.value.verificationToken != null
                if (tokenRejected) {
                    _uiState.value = _uiState.value.copy(verificationToken = null, code = "")
                    showError(errorMessage(e))
                } else {
                    showError(errorMessage(e))
                }
            } finally {
                if (gen == generation) _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    /** 코드 검증. 성공하면 토큰을 상태에 저장하고 반환, 늦은 응답이거나 실패면 null. */
    private suspend fun verify(email: String, code: String, gen: Int): String? {
        val result = authService.verifyEmailCode(email, PURPOSE, code)
        if (gen != generation) return null
        val token = result.verificationToken
        if (!result.success || token.isNullOrBlank()) { showError(MSG_CHECK_CODE); return null }
        _uiState.value = _uiState.value.copy(verificationToken = token)
        return token
    }

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (_uiState.value.timerSeconds > 0) {
                delay(1000)
                _uiState.value = _uiState.value.copy(timerSeconds = _uiState.value.timerSeconds - 1)
            }
        }
    }

    private fun showError(message: String) {
        _uiState.value = _uiState.value.copy(errorMessage = message)
    }

    private fun errorMessage(error: Throwable): String {
        if (error !is HttpException) return MSG_TEMPORARY
        return when (error.code()) {
            400 -> try {
                Json.parseToJsonElement(error.response()?.errorBody()?.string().orEmpty())
                    .jsonObject["detail"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() } ?: MSG_CHECK_INPUT
            } catch (_: Exception) { MSG_CHECK_INPUT }
            401 -> MSG_SESSION
            403 -> MSG_REVERIFY
            409 -> MSG_DUPLICATE
            429 -> MSG_TOO_MANY
            else -> MSG_TEMPORARY
        }
    }
}

private fun normalize(email: String) = email.trim().lowercase()
