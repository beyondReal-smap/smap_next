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
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading
    
    private val _userMessage = MutableStateFlow<String?>(null)
    val userMessage: StateFlow<String?> = _userMessage
    
    init {
        refreshProfile()
    }
    
    fun refreshProfile() {
        viewModelScope.launch {
            _isLoading.value = true
            val updatedUser = authService.fetchUserProfile()
            if (updatedUser != null) {
                _user.value = updatedUser
            }
            _isLoading.value = false
        }
    }
    
    fun updateProfile(name: String, nickname: String, birth: String?, gender: Int?) {
        viewModelScope.launch {
            _isLoading.value = true
            val response = authService.updateProfile(name, nickname, birth, gender)
            if (response.success) {
                _user.value = authService.getUserData()
                _userMessage.value = "프로필이 업데이트되었습니다."
            } else {
                _userMessage.value = response.message ?: "업데이트 실패"
            }
            _isLoading.value = false
        }
    }
    
    fun uploadProfileImage(imageData: ByteArray) {
        viewModelScope.launch {
            _isLoading.value = true
            val response = authService.uploadProfileImage(imageData)
            if (response.success) {
                _user.value = authService.getUserData()
                _userMessage.value = "프로필 이미지가 변경되었습니다."
            } else {
                _userMessage.value = response.message ?: "이미지 업로드 실패"
            }
            _isLoading.value = false
        }
    }
    
    fun logout(onSuccess: () -> Unit) {
        authService.logout()
        onSuccess()
    }

    fun verifyPassword(password: String, onResult: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            val response = authService.verifyPassword(password)
            onResult(response.success, response.message)
            _isLoading.value = false
        }
    }

    fun withdraw(reasonIdx: Int, etcReason: String?, reasons: List<String>, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            val response = authService.withdraw(reasonIdx, etcReason, reasons)
            if (response.success) {
                onSuccess()
            } else {
                _userMessage.value = response.message ?: "탈퇴 처리 실패"
            }
            _isLoading.value = false
        }
    }
    
    fun changePassword(currentPassword: String, newPassword: String) {
        viewModelScope.launch {
            _isLoading.value = true
            val response = authService.changePassword(currentPassword, newPassword)
            if (response.success) {
                _userMessage.value = "비밀번호가 성공적으로 변경되었습니다."
            } else {
                _userMessage.value = response.message ?: "비밀번호 변경 실패"
            }
            _isLoading.value = false
        }
    }
    
    fun clearMessage() {
        _userMessage.value = null
    }
}
