package com.dmonster.smap.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.data.model.SMAPUser
import com.dmonster.smap.data.service.AuthService
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class SettingsResult(val operation: String, val success: Boolean, val message: String)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authService: AuthService
) : ViewModel() {

    private val _user = MutableStateFlow<SMAPUser?>(authService.getUserData())
    val user: StateFlow<SMAPUser?> = _user

    // Track active loading operations to prevent shared state conflicts
    private val _activeLoadingOps = MutableStateFlow<Set<String>>(emptySet())
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private fun setLoading(op: String, loading: Boolean) {
        val current = _activeLoadingOps.value.toMutableSet()
        if (loading) current.add(op) else current.remove(op)
        _activeLoadingOps.value = current
        _isLoading.value = current.isNotEmpty()
    }

    private val _userMessage = MutableStateFlow<String?>(null)
    val userMessage: StateFlow<String?> = _userMessage
    
    private val _result = MutableStateFlow<SettingsResult?>(null)
    val result: StateFlow<SettingsResult?> = _result

    fun clearResult() { _result.value = null }

    init {
        refreshProfile()
    }
    
    fun refreshProfile() {
        viewModelScope.launch {
            setLoading("refreshProfile", true)
            val updatedUser = authService.fetchUserProfile()
            if (updatedUser != null) {
                _user.value = updatedUser
            }
            setLoading("refreshProfile", false)
        }
    }

    fun updateProfile(name: String, nickname: String, birth: String?, gender: Int?) {
        viewModelScope.launch {
            setLoading("updateProfile", true)
            val response = authService.updateProfile(name, nickname, birth, gender)
            if (response.success) {
                _user.value = authService.getUserData()
                _result.value = SettingsResult("profile", true, "프로필이 업데이트되었습니다.")
            } else {
                _result.value = SettingsResult("profile", false, response.message ?: "프로필 수정에 실패했습니다.")
            }
            setLoading("updateProfile", false)
        }
    }

    fun uploadProfileImage(imageData: ByteArray) {
        viewModelScope.launch {
            setLoading("uploadImage", true)
            val response = authService.uploadProfileImage(imageData)
            if (response.success) {
                _user.value = authService.getUserData()
                _result.value = SettingsResult("image", true, "프로필 이미지가 변경되었습니다.")
            } else {
                _result.value = SettingsResult("image", false, response.message ?: "이미지 업로드에 실패했습니다.")
            }
            setLoading("uploadImage", false)
        }
    }
    
    fun logout(onSuccess: () -> Unit) {
        viewModelScope.launch {
            authService.logoutWithUnregister()
            onSuccess()
        }
    }

    fun verifyPassword(password: String, onResult: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            setLoading("verifyPassword", true)
            val response = authService.verifyPassword(password)
            onResult(response.success, response.message)
            setLoading("verifyPassword", false)
        }
    }

    fun withdraw(reasonIdx: Int, etcReason: String?, reasons: List<String>, onSuccess: () -> Unit) {
        viewModelScope.launch {
            setLoading("withdraw", true)
            val response = authService.withdraw(reasonIdx, etcReason, reasons)
            if (response.success) {
                onSuccess()
            } else {
                _result.value = SettingsResult("withdraw", false, response.message ?: "탈퇴 처리에 실패했습니다.")
            }
            setLoading("withdraw", false)
        }
    }

    fun changePassword(currentPassword: String, newPassword: String) {
        viewModelScope.launch {
            setLoading("changePassword", true)
            val response = authService.changePassword(currentPassword, newPassword)
            if (response.success) {
                _result.value = SettingsResult("password", true, "비밀번호가 성공적으로 변경되었습니다.")
            } else {
                _result.value = SettingsResult("password", false, response.message ?: "비밀번호 변경에 실패했습니다.")
            }
            setLoading("changePassword", false)
        }
    }
    
    fun clearMessage() {
        _userMessage.value = null
    }
}
