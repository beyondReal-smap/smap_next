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
                _userMessage.value = "프로필이 업데이트되었습니다."
            } else {
                _userMessage.value = response.message ?: "업데이트 실패"
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
                _userMessage.value = "프로필 이미지가 변경되었습니다."
            } else {
                _userMessage.value = response.message ?: "이미지 업로드 실패"
            }
            setLoading("uploadImage", false)
        }
    }
    
    fun logout(onSuccess: () -> Unit) {
        authService.logout()
        onSuccess()
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
                _userMessage.value = response.message ?: "탈퇴 처리 실패"
            }
            setLoading("withdraw", false)
        }
    }

    fun changePassword(currentPassword: String, newPassword: String) {
        viewModelScope.launch {
            setLoading("changePassword", true)
            val response = authService.changePassword(currentPassword, newPassword)
            if (response.success) {
                _userMessage.value = "비밀번호가 성공적으로 변경되었습니다."
            } else {
                _userMessage.value = response.message ?: "비밀번호 변경 실패"
            }
            setLoading("changePassword", false)
        }
    }
    
    fun clearMessage() {
        _userMessage.value = null
    }
}
