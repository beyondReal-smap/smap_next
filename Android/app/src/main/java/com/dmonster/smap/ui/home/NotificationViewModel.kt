package com.dmonster.smap.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.data.model.PushLog
import com.dmonster.smap.data.model.NotificationSummary
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.data.service.NotificationService
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * 알림 화면 ViewModel
 */
@HiltViewModel
class NotificationViewModel @Inject constructor(
    private val notificationService: NotificationService,
    private val authService: AuthService
) : ViewModel() {
    
    private val _logs = MutableStateFlow<List<PushLog>>(emptyList())
    val logs: StateFlow<List<PushLog>> = _logs.asStateFlow()
    
    private val _summary = MutableStateFlow(NotificationSummary())
    val summary: StateFlow<NotificationSummary> = _summary.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    init {
        loadNotifications()
    }
    
    fun loadNotifications() {
        val mtIdx = authService.getMtIdx() ?: return
        
        viewModelScope.launch {
            _isLoading.value = true
            val fetchedLogs = notificationService.getMemberPushLogs(mtIdx)
            _logs.value = fetchedLogs
            
            // Calculate summary
            val total = fetchedLogs.size
            val unread = fetchedLogs.count { it.pltReadChk == "N" }
            val read = total - unread
            _summary.value = NotificationSummary(total, unread, read)
            
            _isLoading.value = false
        }
    }
    
    fun markAllAsRead() {
        val mtIdx = authService.getMtIdx() ?: return
        
        viewModelScope.launch {
            val success = notificationService.markAllAsRead(mtIdx)
            if (success) {
                // Refresh data
                loadNotifications()
            }
        }
    }

    fun deleteAllLogs() {
        val mtIdx = authService.getMtIdx() ?: return
        
        viewModelScope.launch {
            val success = notificationService.deleteAllPushLogs(mtIdx)
            if (success) {
                // Refresh data
                loadNotifications()
            }
        }
    }
}
