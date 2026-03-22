package com.dmonster.smap.ui.home

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.data.service.HomeService
import com.dmonster.smap.data.GlobalEvent
import com.dmonster.smap.data.GlobalEventBus
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

data class MemberStats(
    val completed: Int,
    val ongoing: Int,
    val upcoming: Int
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val homeService: HomeService
) : ViewModel() {

    companion object {
        private const val TAG = "HomeViewModel"
    }

    // Loading State
    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Error State
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // Sidebar State
    private val _isSidebarOpen = MutableStateFlow(false)
    val isSidebarOpen: StateFlow<Boolean> = _isSidebarOpen.asStateFlow()

    // Data States
    private val _groups = MutableStateFlow<List<SmapGroup>>(emptyList())
    val groups: StateFlow<List<SmapGroup>> = _groups.asStateFlow()

    private val _selectedGroup = MutableStateFlow<SmapGroup?>(null)
    val selectedGroup: StateFlow<SmapGroup?> = _selectedGroup.asStateFlow()

    private val _members = MutableStateFlow<List<SmapGroupMember>>(emptyList())
    val members: StateFlow<List<SmapGroupMember>> = _members.asStateFlow()

    private val _selectedMemberId = MutableStateFlow<Int?>(null)
    val selectedMemberId: StateFlow<Int?> = _selectedMemberId.asStateFlow()

    // All schedules for the selected group
    private val _allSchedules = MutableStateFlow<List<SmapSchedule>>(emptyList())
    
    // Filtered schedules (by date and group)
    private val _filteredSchedules = MutableStateFlow<List<SmapSchedule>>(emptyList())
    val filteredSchedules: StateFlow<List<SmapSchedule>> = _filteredSchedules.asStateFlow()

    // Date Selection
    private val _selectedDate = MutableStateFlow<String>("")
    val selectedDate: StateFlow<String> = _selectedDate.asStateFlow()

    // Calendar Days Generator (14 days forward from today, matching iOS)
    private val _daysForCalendar = MutableStateFlow<List<Pair<String, String>>>(emptyList())
    val daysForCalendar: StateFlow<List<Pair<String, String>>> = _daysForCalendar.asStateFlow()

    init {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        _selectedDate.value = today
        generateCalendarDays()
        
        // Load data from API
        loadDataFromAPI()
        
        viewModelScope.launch {
            combine(_allSchedules, _selectedDate, _selectedGroup, _selectedMemberId) { schedules, date, group, memberId ->
                filterSchedules(schedules, date, group, memberId)
            }.collect {
                _filteredSchedules.value = it
            }
        }

        // Global Event Observation
        viewModelScope.launch {
            GlobalEventBus.events.collect { event ->
                when (event) {
                    is GlobalEvent.GroupsChanged -> {
                        Log.d(TAG, "🔄 [Event] Groups changed event received, refreshing data")
                        refreshData()
                    }
                    else -> {}
                }
            }
        }
    }

    /**
     * Generate 14 days forward from today (matching iOS implementation)
     */
    private fun generateCalendarDays() {
        val calendar = Calendar.getInstance()
        
        val days = mutableListOf<Pair<String, String>>()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val displayFormat = SimpleDateFormat("d", Locale.getDefault())
        
        for (i in 0..13) { // 14 days from today
            val dateStr = dateFormat.format(calendar.time)
            val displayStr = displayFormat.format(calendar.time)
            days.add(dateStr to displayStr)
            calendar.add(Calendar.DAY_OF_YEAR, 1)
        }
        _daysForCalendar.value = days
    }

    private fun filterSchedules(
        schedules: List<SmapSchedule>, 
        date: String, 
        group: SmapGroup?,
        memberId: Int?
    ): List<SmapSchedule> {
        if (group == null) return emptyList()
        
        Log.d(TAG, "🔍 [filterSchedules] Total: ${schedules.size}, Target Date: $date, Target Member: $memberId")
        
        val filtered = schedules.filter { schedule ->
            // 1. Filter by date
            val dateStr = schedule.date
            val scheduleDate = try {
                if (!dateStr.isNullOrEmpty() && dateStr.length >= 10) dateStr.substring(0, 10) else ""
            } catch (e: Exception) {
                ""
            }
            if (scheduleDate != date) return@filter false

            // 2. Filter by member (if one is selected)
            // Backend returns mt_idx or mt_schedule_idx
            val sMemberId = schedule.mtIdx ?: schedule.mtScheduleIdx
            
            val isMemberMatch = memberId == null || sMemberId == null || sMemberId == memberId
            if (!isMemberMatch) return@filter false

            // 3. Filter by visibility (sst_show)
            // If sstShow is null, we assume visible for safety (or check if it's 'Y')
            schedule.sstShow != "N"
        }
        
        Log.d(TAG, "📌 [filterSchedules] Filtered: ${filtered.size} schedules match criteria")
        return filtered
    }

    // Group Creation Modal State
    private val _showGroupCreationModal = MutableStateFlow(false)
    val showGroupCreationModal: StateFlow<Boolean> = _showGroupCreationModal.asStateFlow()
    
    private val _isCreatingGroup = MutableStateFlow(false)
    val isCreatingGroup: StateFlow<Boolean> = _isCreatingGroup.asStateFlow()
    
    /**
     * API에서 데이터 로드 (그룹, 멤버, 일정)
     */
    private fun loadDataFromAPI() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            
            try {
                Log.d(TAG, "🚀 [API] 그룹 목록 로드 시작")
                
                // 1. 그룹 목록 조회
                val groups = homeService.getGroups()
                _groups.value = groups
                
                if (groups.isEmpty()) {
                    Log.w(TAG, "⚠️ [API] 그룹이 없습니다 - 그룹 생성 모달 표시")
                    _showGroupCreationModal.value = true
                    _isLoading.value = false
                    return@launch
                }
                
                Log.d(TAG, "✅ [API] ${groups.size}개 그룹 로드 완료")
                
                // 2. 첫 번째 그룹 자동 선택
                if (_selectedGroup.value == null) {
                    selectGroup(groups.first())
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ [API] 데이터 로드 실패", e)
                _errorMessage.value = "데이터를 불러오는데 실패했습니다: ${e.message}"
                // 에러 시에도 그룹이 없으면 모달 표시
                if (_groups.value.isEmpty()) {
                    _showGroupCreationModal.value = true
                }
            } finally {
                _isLoading.value = false
            }
        }
    }
    
    /**
     * 그룹 생성
     */
    fun createGroup(name: String, description: String) {
        viewModelScope.launch {
            _isCreatingGroup.value = true
            
            try {
                Log.d(TAG, "🚀 [API] 그룹 생성 시작: $name")
                val newGroup = homeService.createGroup(name, description)
                
                if (newGroup != null) {
                    Log.d(TAG, "✅ [API] 그룹 생성 성공: ${newGroup.sgtIdx}")
                    _showGroupCreationModal.value = false
                    
                    // 데이터 새로고침
                    loadDataFromAPI()
                    
                    // Global Event 발송
                    GlobalEventBus.emit(GlobalEvent.GroupsChanged)
                } else {
                    _errorMessage.value = "그룹 생성에 실패했습니다. 다시 시도해주세요."
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [API] 그룹 생성 실패", e)
                _errorMessage.value = "그룹 생성 중 오류가 발생했습니다: ${e.message}"
            } finally {
                _isCreatingGroup.value = false
            }
        }
    }
    
    /**
     * 초대코드로 그룹 가입
     */
    fun joinGroup(inviteCode: String) {
        viewModelScope.launch {
            _isCreatingGroup.value = true
            _errorMessage.value = null
            
            try {
                Log.d(TAG, "🚀 [API] 초대코드로 그룹 가입 시작: $inviteCode")
                val success = homeService.joinGroup(inviteCode)
                
                if (success) {
                    Log.d(TAG, "✅ [API] 그룹 가입 성공")
                    _showGroupCreationModal.value = false
                    
                    // 데이터 새로고침
                    loadDataFromAPI()
                    
                    // Global Event 발송
                    GlobalEventBus.emit(GlobalEvent.GroupsChanged)
                } else {
                    _errorMessage.value = "그룹 가입에 실패했습니다. 초대 코드를 확인해주세요."
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [API] 그룹 가입 실패", e)
                _errorMessage.value = "그룹 가입 중 오류가 발생했습니다: ${e.message}"
            } finally {
                _isCreatingGroup.value = false
            }
        }
    }
    
    fun hideGroupCreationModal() {
        _showGroupCreationModal.value = false
    }

    /**
     * 선택된 그룹의 멤버 및 일정 로드
     */
    private fun loadGroupData(groupId: Int) {
        viewModelScope.launch {
            try {
                Log.d(TAG, "🚀 [API] 그룹($groupId) 멤버 및 일정 로드 시작")
                
                // 멤버 목록 조회
                val members = homeService.getGroupMembers(groupId)
                
                // 현재 사용자를 기본 선택 (없으면 첫 번째 멤버)
                if (members.isNotEmpty() && _selectedMemberId.value == null) {
                    val currentUserIdx = homeService.getCurrentUserIdx()
                    val selfMember = members.find { it.mtIdx == currentUserIdx }
                    _selectedMemberId.value = selfMember?.mtIdx ?: members.first().mtIdx
                }
                
                val currentSelectedId = _selectedMemberId.value
                val membersWithSelection = members.map { member -> 
                    member.copy(isSelected = member.mtIdx == currentSelectedId) 
                }
                _members.value = membersWithSelection
                
                Log.d(TAG, "✅ [API] ${members.size}명 멤버 로드 완료")
                
                // 일정 목록 조회 (14일)
                val schedules = homeService.getGroupSchedules(groupId, 14)
                _allSchedules.value = schedules
                
                Log.d(TAG, "✅ [API] ${schedules.size}개 일정 로드 완료")
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ [API] 그룹 데이터 로드 실패", e)
                _errorMessage.value = "그룹 데이터를 불러오는데 실패했습니다"
            }
        }
    }

    /**
     * 데이터 새로고침 (그룹 목록 + 현재 선택된 그룹의 멤버/일정)
     */
    fun refreshData() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            
            try {
                Log.d(TAG, "🔄 [REFRESH] 전체 데이터 새로고침 시작")
                
                // 1. 그룹 목록 새로고침
                val groups = homeService.getGroups()
                _groups.value = groups
                Log.d(TAG, "🔄 [REFRESH] ${groups.size}개 그룹 로드 완료")
                
                // 2. 현재 선택된 그룹의 멤버/일정 새로고침
                val currentGroup = _selectedGroup.value
                if (currentGroup != null) {
                    Log.d(TAG, "🔄 [REFRESH] 그룹(${currentGroup.sgtIdx}) 멤버/일정 새로고침")
                    loadGroupData(currentGroup.sgtIdx)
                } else if (groups.isNotEmpty()) {
                    // 선택된 그룹이 없으면 첫 번째 그룹 선택
                    selectGroup(groups.first())
                }
                
                Log.d(TAG, "✅ [REFRESH] 전체 데이터 새로고침 완료")
            } catch (e: Exception) {
                Log.e(TAG, "❌ [REFRESH] 데이터 새로고침 실패", e)
                _errorMessage.value = "데이터를 새로고침하는데 실패했습니다: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun toggleSidebar() {
        _isSidebarOpen.value = !_isSidebarOpen.value
    }
    
    fun setSidebarOpen(isOpen: Boolean) {
        _isSidebarOpen.value = isOpen
    }

    fun selectDate(date: String) {
        _selectedDate.value = date
    }

    fun selectGroup(group: SmapGroup) {
        _selectedGroup.value = group
        _selectedMemberId.value = null // 그룹 변경 시 멤버 선택 초기화
        // 그룹 변경 시 해당 그룹의 멤버/일정 로드
        loadGroupData(group.sgtIdx)
    }

    fun selectMember(memberId: Int) {
        _selectedMemberId.value = memberId
        val currentList = _members.value.map {
            it.copy(isSelected = (it.mtIdx == memberId))
        }
        _members.value = currentList
    }

    fun clearError() {
        _errorMessage.value = null
    }

    fun deselectAllMembers() {
        _selectedMemberId.value = null
        val currentList = _members.value.map {
            it.copy(isSelected = false)
        }
        _members.value = currentList
    }

    /**
     * Get member schedule stats for today (completed, ongoing, upcoming)
     * Matches iOS getMemberTodayStats() function
     */
    fun getMemberTodayStats(mtIdx: Int): MemberStats {
        val currentTime = System.currentTimeMillis()
        val selectedDateStr = _selectedDate.value
        
        // Filter by member AND date
        val memberSchedules = _allSchedules.value.filter { schedule ->
            // 1. Filter by member ID (mtIdx or mtScheduleIdx)
            val sMemberId = schedule.mtIdx ?: schedule.mtScheduleIdx
            // If ID is null, it might be a group schedule visible to all
            val isMemberMatch = sMemberId == null || sMemberId == mtIdx
            
            // 2. Filter by date
            val scheduleDate = try {
                val date = schedule.date
                if (!date.isNullOrEmpty() && date.length >= 10) date.substring(0, 10) else ""
            } catch (e: Exception) {
                ""
            }
            val isDateMatch = scheduleDate == selectedDateStr
            if (!isDateMatch) return@filter false

            // 3. Filter by visibility
            val isVisible = schedule.sstShow != "N"
            if (!isVisible) return@filter false
            
            if (sMemberId != null) {
                Log.v(TAG, "🔍 [getMemberTodayStats] Comparing schedule member $sMemberId with target $mtIdx -> Match: $isMemberMatch")
            }
            
            isMemberMatch
        }
        
        var completed = 0
        var ongoing = 0
        var upcoming = 0
        
        for (schedule in memberSchedules) {
            val status = getScheduleStatus(schedule, currentTime)
            when (status) {
                "completed" -> completed++
                "ongoing" -> ongoing++
                "upcoming" -> upcoming++
            }
        }
        
        if (memberSchedules.isNotEmpty()) {
            Log.d(TAG, "📊 [getMemberTodayStats] mtIdx: $mtIdx -> Done: $completed, Doing: $ongoing, Will: $upcoming (Total: ${memberSchedules.size})")
        }
        
        return MemberStats(completed, ongoing, upcoming)
    }
    
    private fun getScheduleStatus(schedule: SmapSchedule, currentTime: Long): String {
        val dateTimeFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        
        try {
            val startTime = schedule.date?.let { dateTimeFormat.parse(it)?.time } ?: return "upcoming"
            val endTime = schedule.sstEdate?.let { dateTimeFormat.parse(it)?.time } ?: startTime
            
            return when {
                currentTime >= endTime -> "completed"
                currentTime >= startTime -> "ongoing"
                else -> "upcoming"
            }
        } catch (e: Exception) {
            return "upcoming"
        }
    }

    fun getCurrentUserIdx(): Int? = homeService.getCurrentUserIdx()
}
