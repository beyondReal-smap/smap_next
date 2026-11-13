package com.dmonster.smap.ui.schedule

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.BuildConfig
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

    // Pull-to-refresh
    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    // Action Loading (Fix #8: shared loading state for update/delete)
    private val _isCreating = MutableStateFlow(false)
    val isCreating: StateFlow<Boolean> = _isCreating.asStateFlow()

    private val _isActionLoading = MutableStateFlow(false)
    val isActionLoading: StateFlow<Boolean> = _isActionLoading.asStateFlow()

    init {
        loadGroups()

        // Global Event Observation
        viewModelScope.launch {
            GlobalEventBus.events.collect { event ->
                when (event) {
                    is GlobalEvent.GroupsChanged -> {
                        if (BuildConfig.DEBUG) Log.d(TAG, "[Event] Groups changed event received, refreshing data")
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
                    Log.e(TAG, "그룹 로드 실패 (${result.code})")
                    _errorMessage.value = "그룹을 불러오지 못했습니다 (${result.code})"
                }
                is ApiResult.NetworkError -> {
                    Log.e(TAG, "그룹 로드 실패 - 네트워크", result.exception)
                    _errorMessage.value = "네트워크 연결을 확인해주세요"
                }
            }
            _isLoading.value = false
        }
    }

    /**
     * Suspend version of groups loading for use in refresh().
     */
    private suspend fun loadGroupsSuspend() {
        when (val result = safeApiCall { groupService.getGroups() }) {
            is ApiResult.Success -> {
                _groups.value = result.data
                if (result.data.isNotEmpty() && _selectedGroup.value == null) {
                    _selectedGroup.value = result.data.first()
                }
            }
            is ApiResult.Error -> {
                Log.e(TAG, "그룹 로드 실패 (${result.code})")
                _errorMessage.value = "그룹을 불러오지 못했습니다 (${result.code})"
            }
            is ApiResult.NetworkError -> {
                Log.e(TAG, "그룹 로드 실패 - 네트워크", result.exception)
                _errorMessage.value = "네트워크 연결을 확인해주세요"
            }
        }
    }

    fun loadSchedules() {
        val group = _selectedGroup.value ?: return
        val month = _currentMonth.value

        viewModelScope.launch {
            loadSchedulesSuspend(group, month)
        }
    }

    /**
     * Suspend version of schedule loading for use in refresh() and selectGroup().
     */
    private suspend fun loadSchedulesSuspend(group: SmapGroup? = null, month: YearMonth? = null) {
        val g = group ?: _selectedGroup.value ?: return
        val m = month ?: _currentMonth.value

        _isLoadingSchedules.value = true
        when (val result = safeApiCall {
            scheduleService.getSchedules(
                groupId = g.sgtIdx,
                year = m.year,
                month = m.monthValue
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
                if (BuildConfig.DEBUG) {
                    Log.d(TAG, "${schedules.size}개 일정 로드 (멤버 매핑 완료)")
                    schedules.take(5).forEach { s ->
                        Log.d(TAG, "Schedule: title=${s.displayTitle}, creatorId=${s.mtScheduleIdx ?: s.mtIdx}, validName=${s.validMemberName}")
                    }
                }
            }
            is ApiResult.Error -> {
                Log.e(TAG, "일정 로드 실패 (${result.code})")
                _errorMessage.value = "일정을 불러오지 못했습니다 (${result.code})"
            }
            is ApiResult.NetworkError -> {
                Log.e(TAG, "일정 로드 실패 - 네트워크", result.exception)
                _errorMessage.value = "네트워크 연결을 확인해주세요"
            }
        }
        _isLoadingSchedules.value = false
    }

    /**
     * Suspend version of member loading. Fix #7: await members before loading schedules.
     */
    private suspend fun loadMembersSuspend(groupId: Int) {
        when (val result = safeApiCall { groupService.getGroupMembers(groupId) }) {
            is ApiResult.Success -> _members.value = result.data
            is ApiResult.Error -> Log.e(TAG, "멤버 로드 실패 (${result.code})")
            is ApiResult.NetworkError -> Log.e(TAG, "멤버 로드 실패 - 네트워크", result.exception)
        }
    }

    // MARK: - Navigation

    fun selectDate(date: LocalDate) {
        _selectedDate.value = date
    }

    // Fix #13: Reset selectedDate to first day of new month when navigating
    fun goToPreviousMonth() {
        _currentMonth.value = _currentMonth.value.minusMonths(1)
        _selectedDate.value = _currentMonth.value.atDay(1)
        loadSchedules()
    }

    fun goToNextMonth() {
        _currentMonth.value = _currentMonth.value.plusMonths(1)
        _selectedDate.value = _currentMonth.value.atDay(1)
        loadSchedules()
    }

    fun goToToday() {
        _currentMonth.value = YearMonth.now()
        _selectedDate.value = LocalDate.now()
        loadSchedules()
    }

    // Fix #7: Await loadMembers before loadSchedules to avoid race condition
    fun selectGroup(group: SmapGroup) {
        _selectedGroup.value = group
        _showGroupSelector.value = false
        viewModelScope.launch {
            loadMembersSuspend(group.sgtIdx)
            loadSchedulesSuspend(group)
        }
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

    fun dismissEventDetail() {
        _showEventDetail.value = null
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
        val currentUserId = user.mtIdx ?: return
        // 일반 멤버는 항상 본인, 그룹장·리더만 허용된 타인을 대상으로 할 수 있다
        val userId = ScheduleTargetPolicy.resolveCreateTargetId(_members.value, currentUserId, targetMemberId)

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
                    _successMessage.value = "일정을 추가했어요"
                    hideCreateDialog()
                    loadSchedules()
                }
                is ApiResult.Error -> _errorMessage.value = "일정 생성에 실패했습니다 (${result.code})"
                is ApiResult.NetworkError -> _errorMessage.value = "네트워크 연결을 확인해주세요"
            }
            _isCreating.value = false
        }
    }

    // Fix #8: Add _isActionLoading for update/delete
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
            _isActionLoading.value = true
            try {
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
            } finally {
                _isActionLoading.value = false
            }
        }
    }

    fun deleteSchedule(scheduleId: String, groupId: Int, deleteOption: String = "this") {
        viewModelScope.launch {
            _isActionLoading.value = true
            try {
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
            } finally {
                _isActionLoading.value = false
            }
        }
    }

    // MARK: - Permissions

    /** 로그인한 본인 mt_idx (일정 생성 기본 대상). 로그인 상태면 항상 존재 */
    val currentUserId: Int get() = authService.getUserData()?.mtIdx ?: 0

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

    // Fix #3: Multi-day events now show on intermediate days by checking date range
    fun getSchedulesForDate(date: LocalDate): List<SmapSchedule> {
        val dateStr = date.toString() // "yyyy-MM-dd"
        val filtered = _schedules.value.filter { schedule ->
            val startDate = schedule.date?.take(10) ?: return@filter false
            val endDate = schedule.sstEdate?.take(10) ?: startDate
            dateStr in startDate..endDate
        }
        if (BuildConfig.DEBUG) {
            Log.d(TAG, "getSchedulesForDate: date=$dateStr, total=${_schedules.value.size}, filtered=${filtered.size}")
        }
        return filtered
    }

    // Fix #3: Include all dates in range for multi-day events
    fun getEventDates(): Set<LocalDate> {
        val dates = mutableSetOf<LocalDate>()
        _schedules.value.forEach { schedule ->
            val startStr = schedule.date?.take(10) ?: return@forEach
            val endStr = schedule.sstEdate?.take(10) ?: startStr
            try {
                var current = LocalDate.parse(startStr)
                val end = LocalDate.parse(endStr)
                while (!current.isAfter(end)) {
                    dates.add(current)
                    current = current.plusDays(1)
                }
            } catch (e: Exception) {
                // skip invalid dates
            }
        }
        if (BuildConfig.DEBUG) {
            Log.d(TAG, "getEventDates: ${dates.size} event dates found")
        }
        return dates
    }

    // Fix #2: Inline loading logic so isRefreshing is set to false only after completion
    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            try {
                loadGroupsSuspend()
                val group = _selectedGroup.value
                if (group != null) {
                    loadMembersSuspend(group.sgtIdx)
                    loadSchedulesSuspend(group)
                }
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    fun clearError() { _errorMessage.value = null }
    fun clearSuccess() { _successMessage.value = null }
}
