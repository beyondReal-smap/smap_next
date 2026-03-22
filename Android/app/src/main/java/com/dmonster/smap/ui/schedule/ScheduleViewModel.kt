package com.dmonster.smap.ui.schedule

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.data.api.ApiResult
import com.dmonster.smap.data.api.safeApiCall
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.model.SmapSchedule
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.data.service.GroupService
import com.dmonster.smap.data.service.ScheduleService
import com.dmonster.smap.data.GlobalEvent
import com.dmonster.smap.data.GlobalEventBus
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter

/**
 * 일정 페이지 ViewModel
 */
@HiltViewModel
class ScheduleViewModel @Inject constructor(
    private val scheduleService: ScheduleService,
    private val groupService: GroupService,
    private val authService: AuthService
) : ViewModel() {

    companion object {
        private const val TAG = "ScheduleViewModel"
    }

    // Current Month
    private val _currentMonth = MutableStateFlow(YearMonth.now())
    val currentMonth: StateFlow<YearMonth> = _currentMonth.asStateFlow()

    // Selected Date
    private val _selectedDate = MutableStateFlow(LocalDate.now())
    val selectedDate: StateFlow<LocalDate> = _selectedDate.asStateFlow()

    // Schedules
    private val _schedules = MutableStateFlow<List<SmapSchedule>>(emptyList())
    val schedules: StateFlow<List<SmapSchedule>> = _schedules.asStateFlow()

    // Groups
    private val _groups = MutableStateFlow<List<SmapGroup>>(emptyList())
    val groups: StateFlow<List<SmapGroup>> = _groups.asStateFlow()

    private val _selectedGroup = MutableStateFlow<SmapGroup?>(null)
    val selectedGroup: StateFlow<SmapGroup?> = _selectedGroup.asStateFlow()

    // Members
    private val _members = MutableStateFlow<List<SmapGroupMember>>(emptyList())
    val members: StateFlow<List<SmapGroupMember>> = _members.asStateFlow()

    private val _selectedMember = MutableStateFlow<SmapGroupMember?>(null)
    val selectedMember: StateFlow<SmapGroupMember?> = _selectedMember.asStateFlow()

    // Loading States
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isLoadingSchedules = MutableStateFlow(false)
    val isLoadingSchedules: StateFlow<Boolean> = _isLoadingSchedules.asStateFlow()

    // Messages
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    // Dialog States
    private val _showGroupSelector = MutableStateFlow(false)
    val showGroupSelector: StateFlow<Boolean> = _showGroupSelector.asStateFlow()

    private val _showEventDetail = MutableStateFlow<SmapSchedule?>(null)
    val showEventDetail: StateFlow<SmapSchedule?> = _showEventDetail.asStateFlow()

    private val _showCreateDialog = MutableStateFlow(false)
    val showCreateDialog: StateFlow<Boolean> = _showCreateDialog.asStateFlow()

    private val _showEditDialog = MutableStateFlow<SmapSchedule?>(null)
    val showEditDialog: StateFlow<SmapSchedule?> = _showEditDialog.asStateFlow()

    private val _showDeleteDialog = MutableStateFlow<SmapSchedule?>(null)
    val showDeleteDialog: StateFlow<SmapSchedule?> = _showDeleteDialog.asStateFlow()

    private val _editOption = MutableStateFlow<String?>(null)
    val editOption: StateFlow<String?> = _editOption.asStateFlow()

    // Action Loading
    private val _isCreating = MutableStateFlow(false)
    val isCreating: StateFlow<Boolean> = _isCreating.asStateFlow()

    init {
        loadGroups()
        
        // Global Event Observation
        viewModelScope.launch {
            GlobalEventBus.events.collect { event ->
                when (event) {
                    is GlobalEvent.GroupsChanged -> {
                        Log.d(TAG, "🔄 [Event] Groups changed event received, refreshing data")
                        loadGroups()
                    }
                    else -> {}
                }
            }
        }
    }

    // MARK: - Data Loading

    private fun loadGroups() {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = safeApiCall { groupService.getGroups() }) {
                is ApiResult.Success -> {
                    _groups.value = result.data
                    if (result.data.isNotEmpty() && _selectedGroup.value == null) {
                        selectGroup(result.data.first())
                    }
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "❌ 그룹 로드 실패 (${result.code})")
                    _errorMessage.value = "그룹을 불러오지 못했습니다 (${result.code})"
                }
                is ApiResult.NetworkError -> {
                    Log.e(TAG, "❌ 그룹 로드 실패 - 네트워크", result.exception)
                    _errorMessage.value = "네트워크 연결을 확인해주세요"
                }
            }
            _isLoading.value = false
        }
    }

    fun loadSchedules() {
        val group = _selectedGroup.value ?: return
        val month = _currentMonth.value

        viewModelScope.launch {
            _isLoadingSchedules.value = true
            when (val result = safeApiCall {
                scheduleService.getSchedules(
                    groupId = group.sgtIdx,
                    year = month.year,
                    month = month.monthValue
                )
            }) {
                is ApiResult.Success -> {
                    val schedules = result.data
                    val members = _members.value
                    schedules.forEach { s ->
                        val creatorId = s.mtScheduleIdx ?: s.mtIdx
                        val member = members.find { it.mtIdx == creatorId }
                        if (member != null) {
                            s.memberNameOverride = member.displayName
                            s.memberPhotoOverride = member.mtFile1
                        }
                    }

                    _schedules.value = schedules
                    Log.d(TAG, "✅ ${schedules.size}개 일정 로드 (멤버 매핑 완료)")

                    schedules.take(5).forEach { s ->
                        Log.d(TAG, "📅 Schedule: title=${s.displayTitle}, creatorId=${s.mtScheduleIdx ?: s.mtIdx}, validName=${s.validMemberName}")
                    }
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "❌ 일정 로드 실패 (${result.code})")
                    _errorMessage.value = "일정을 불러오지 못했습니다 (${result.code})"
                }
                is ApiResult.NetworkError -> {
                    Log.e(TAG, "❌ 일정 로드 실패 - 네트워크", result.exception)
                    _errorMessage.value = "네트워크 연결을 확인해주세요"
                }
            }
            _isLoadingSchedules.value = false
        }
    }

    private fun loadMembers(groupId: Int) {
        viewModelScope.launch {
            when (val result = safeApiCall { groupService.getGroupMembers(groupId) }) {
                is ApiResult.Success -> _members.value = result.data
                is ApiResult.Error -> Log.e(TAG, "❌ 멤버 로드 실패 (${result.code})")
                is ApiResult.NetworkError -> Log.e(TAG, "❌ 멤버 로드 실패 - 네트워크", result.exception)
            }
        }
    }

    // MARK: - Navigation

    fun selectDate(date: LocalDate) {
        _selectedDate.value = date
    }

    fun goToPreviousMonth() {
        _currentMonth.value = _currentMonth.value.minusMonths(1)
        loadSchedules()
    }

    fun goToNextMonth() {
        _currentMonth.value = _currentMonth.value.plusMonths(1)
        loadSchedules()
    }

    fun goToToday() {
        _currentMonth.value = YearMonth.now()
        _selectedDate.value = LocalDate.now()
        loadSchedules()
    }

    fun selectGroup(group: SmapGroup) {
        _selectedGroup.value = group
        _showGroupSelector.value = false
        loadMembers(group.sgtIdx)
        loadSchedules()
    }

    fun selectMember(member: SmapGroupMember?) {
        _selectedMember.value = member
    }

    // MARK: - Dialog Controls

    fun toggleGroupSelector() {
        _showGroupSelector.value = !_showGroupSelector.value
    }

    fun hideGroupSelector() {
        _showGroupSelector.value = false
    }

    fun showEventDetail(schedule: SmapSchedule) {
        _showEventDetail.value = schedule
    }

    fun hideEventDetail() {
        _showEventDetail.value = null
    }

    fun showCreateDialog() {
        _showCreateDialog.value = true
    }

    fun hideCreateDialog() {
        _showCreateDialog.value = false
    }

    fun showEditDialog(schedule: SmapSchedule) {
        _showEditDialog.value = schedule
        _editOption.value = null
        _showEventDetail.value = null
    }

    fun showEditDialogWithOption(schedule: SmapSchedule, option: String) {
        _showEditDialog.value = schedule
        _editOption.value = option
        _showEventDetail.value = null
    }

    fun hideEditDialog() {
        _showEditDialog.value = null
        _editOption.value = null
    }

    fun showDeleteDialog(schedule: SmapSchedule) {
        _showDeleteDialog.value = schedule
        _showEventDetail.value = null
    }

    fun hideDeleteDialog() {
        _showDeleteDialog.value = null
    }

    // MARK: - Actions

    fun createSchedule(
        targetMemberId: Int? = null,
        title: String,
        startDate: String,
        endDate: String,
        isAllDay: Boolean,
        memo: String?,
        locationName: String?,
        locationLat: Double?,
        locationLng: Double?,
        alarmTime: String?,
        repeatConfig: String?
    ) {
        val group = _selectedGroup.value ?: return
        val user = authService.getUserData() ?: return
        val userId = targetMemberId ?: user.mtIdx ?: return

        if (title.isBlank()) return

        viewModelScope.launch {
            _isCreating.value = true
            when (val result = safeApiCall {
                scheduleService.createSchedule(
                    groupId = group.sgtIdx,
                    memberId = userId,
                    title = title,
                    startDate = startDate,
                    endDate = endDate,
                    isAllDay = isAllDay,
                    memo = memo,
                    locationName = locationName,
                    locationLat = locationLat,
                    locationLng = locationLng,
                    alarmTime = alarmTime,
                    repeatConfig = repeatConfig
                )
            }) {
                is ApiResult.Success -> {
                    if (result.data != null) {
                        _successMessage.value = "일정이 생성되었습니다"
                        hideCreateDialog()
                        loadSchedules()
                    } else {
                        _errorMessage.value = "일정 생성에 실패했습니다"
                    }
                }
                is ApiResult.Error -> _errorMessage.value = "일정 생성에 실패했습니다 (${result.code})"
                is ApiResult.NetworkError -> _errorMessage.value = "네트워크 연결을 확인해주세요"
            }
            _isCreating.value = false
        }
    }

    fun updateSchedule(
        scheduleId: String,
        title: String,
        startDate: String,
        endDate: String,
        isAllDay: Boolean,
        memo: String?,
        locationName: String?,
        locationLat: Double?,
        locationLng: Double?,
        alarmTime: String?,
        repeatConfig: String?,
        editOption: String
    ) {
        if (title.isBlank()) return

        viewModelScope.launch {
            when (val result = safeApiCall {
                scheduleService.updateSchedule(
                    scheduleId = scheduleId,
                    title = title,
                    startDate = startDate,
                    endDate = endDate,
                    isAllDay = isAllDay,
                    memo = memo,
                    locationName = locationName,
                    locationLat = locationLat,
                    locationLng = locationLng,
                    alarmTime = alarmTime,
                    repeatConfig = repeatConfig,
                    repeatJson = _showEditDialog.value?.sstRepeatJson,
                    parentIdx = _showEditDialog.value?.sstPidx,
                    groupId = _showEditDialog.value?.sgtIdx ?: 0,
                    editOption = editOption
                )
            }) {
                is ApiResult.Success -> {
                    if (result.data) {
                        _successMessage.value = "일정이 수정되었습니다"
                        hideEditDialog()
                        loadSchedules()
                    } else {
                        _errorMessage.value = "일정 수정에 실패했습니다"
                    }
                }
                is ApiResult.Error -> _errorMessage.value = "일정 수정에 실패했습니다 (${result.code})"
                is ApiResult.NetworkError -> _errorMessage.value = "네트워크 연결을 확인해주세요"
            }
        }
    }

    fun deleteSchedule(scheduleId: String, groupId: Int, deleteOption: String = "this") {
        viewModelScope.launch {
            when (val result = safeApiCall { scheduleService.deleteSchedule(scheduleId, groupId, deleteOption) }) {
                is ApiResult.Success -> {
                    if (result.data) {
                        _successMessage.value = "일정이 삭제되었습니다"
                        hideDeleteDialog()
                        loadSchedules()
                    } else {
                        _errorMessage.value = "일정 삭제에 실패했습니다"
                    }
                }
                is ApiResult.Error -> _errorMessage.value = "일정 삭제에 실패했습니다 (${result.code})"
                is ApiResult.NetworkError -> _errorMessage.value = "네트워크 연결을 확인해주세요"
            }
        }
    }

    // MARK: - Permissions

    fun canManageSchedule(schedule: SmapSchedule): Boolean {
        val currentUser = authService.getUserData() ?: return false
        val creatorId = schedule.mtScheduleIdx ?: schedule.mtIdx ?: return false
        
        // 1. Own data
        if (creatorId == currentUser.mtIdx) return true
        
        val currentMember = _members.value.find { it.mtIdx == currentUser.mtIdx } ?: return false
        
        // 2. Owner can manage anything
        if (currentMember.sgdtOwnerChk == "Y") return true
        
        // 3. Leader can manage anything except Owner's data
        if (currentMember.sgdtLeaderChk == "Y") {
            val targetMember = _members.value.find { it.mtIdx == creatorId }
            // If target is Owner, leader cannot manage
            if (targetMember?.sgdtOwnerChk == "Y") return false
            return true
        }
        
        return false
    }

    // MARK: - Helpers

    fun getSchedulesForDate(date: LocalDate): List<SmapSchedule> {
        val dateStr = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val filtered = _schedules.value.filter { schedule ->
            schedule.date?.startsWith(dateStr) == true
        }
        Log.d(TAG, "📆 getSchedulesForDate: date=$dateStr, total=${_schedules.value.size}, filtered=${filtered.size}")
        return filtered
    }

    fun getEventDates(): Set<LocalDate> {
        val dates = _schedules.value.mapNotNull { schedule ->
            schedule.date?.let {
                try {
                    LocalDate.parse(it.take(10))
                } catch (e: Exception) {
                    null
                }
            }
        }.toSet()
        Log.d(TAG, "📆 getEventDates: ${dates.size} event dates found")
        return dates
    }

    fun clearError() { _errorMessage.value = null }
    fun clearSuccess() { _successMessage.value = null }
}
