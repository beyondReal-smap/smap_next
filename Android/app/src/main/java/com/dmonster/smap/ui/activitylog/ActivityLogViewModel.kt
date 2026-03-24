package com.dmonster.smap.ui.activitylog

import android.util.Log
import com.dmonster.smap.BuildConfig
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.data.model.LocationLog
import com.dmonster.smap.data.model.StayTime
import com.dmonster.smap.data.model.DailyCount
import com.dmonster.smap.data.model.LocationSummary
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.api.ApiResult
import com.dmonster.smap.data.api.safeApiCall
import com.dmonster.smap.data.service.ActivityLogService
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.data.service.GroupService
import com.dmonster.smap.data.GlobalEvent
import com.dmonster.smap.data.GlobalEventBus
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * 활동로그 페이지 ViewModel
 */
@HiltViewModel
class ActivityLogViewModel @Inject constructor(
    private val activityLogService: ActivityLogService,
    private val groupService: GroupService,
    private val authService: AuthService
) : ViewModel() {

    companion object {
        private const val TAG = "ActivityLogViewModel"
    }
    
    private val dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")

    // Date
    private val _selectedDate = MutableStateFlow(LocalDate.now())
    val selectedDate: StateFlow<LocalDate> = _selectedDate.asStateFlow()

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

    // Location Data
    private val _locationLogs = MutableStateFlow<List<LocationLog>>(emptyList())
    val locationLogs: StateFlow<List<LocationLog>> = _locationLogs.asStateFlow()

    private val _locationSummary = MutableStateFlow<LocationSummary?>(null)
    val locationSummary: StateFlow<LocationSummary?> = _locationSummary.asStateFlow()

    private val _stayTimes = MutableStateFlow<List<StayTime>>(emptyList())
    val stayTimes: StateFlow<List<StayTime>> = _stayTimes.asStateFlow()

    // Member Activity Stats (MemberID -> DailyCounts)
    private val _memberActivityStats = MutableStateFlow<Map<Int, List<DailyCount>>>(emptyMap())
    val memberActivityStats: StateFlow<Map<Int, List<DailyCount>>> = _memberActivityStats.asStateFlow()

    // Loading States
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isLoadingLogs = MutableStateFlow(false)
    val isLoadingLogs: StateFlow<Boolean> = _isLoadingLogs.asStateFlow()

    // Slider State (초기값 0.0 = 시작점)
    private val _sliderValue = MutableStateFlow(0.0)
    val sliderValue: StateFlow<Double> = _sliderValue.asStateFlow()

    private val _isSliderDragging = MutableStateFlow(false)
    val isSliderDragging: StateFlow<Boolean> = _isSliderDragging.asStateFlow()

    // Messages
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // Dialog States
    private val _showGroupSelector = MutableStateFlow(false)
    val showGroupSelector: StateFlow<Boolean> = _showGroupSelector.asStateFlow()

    private val _showMemberSidebar = MutableStateFlow(false)
    val showMemberSidebar: StateFlow<Boolean> = _showMemberSidebar.asStateFlow()

    private var isLoadingGroups = false

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
        if (isLoadingGroups) return
        isLoadingGroups = true
        viewModelScope.launch {
            _isLoading.value = true
            try {
                when (val result = safeApiCall { groupService.getGroups() }) {
                    is ApiResult.Success -> {
                        _groups.value = result.data
                        if (result.data.isNotEmpty() && _selectedGroup.value == null) {
                            selectGroup(result.data.first())
                        }
                    }
                    is ApiResult.Error -> {
                        if (BuildConfig.DEBUG) Log.e(TAG, "그룹 로드 실패 (${result.code})")
                        _errorMessage.value = "그룹을 불러오지 못했습니다 (${result.code})"
                    }
                    is ApiResult.NetworkError -> {
                        if (BuildConfig.DEBUG) Log.e(TAG, "그룹 로드 실패 - 네트워크", result.exception)
                        _errorMessage.value = "네트워크 연결을 확인해주세요"
                    }
                }
            } finally {
                _isLoading.value = false
                isLoadingGroups = false
            }
        }
    }

    private fun loadMembers(groupId: Int) {
        viewModelScope.launch {
            when (val result = safeApiCall { groupService.getGroupMembers(groupId) }) {
                is ApiResult.Success -> {
                    _members.value = result.data

                    // 현재 사용자를 기본 선택 (없으면 첫 번째 멤버)
                    if (result.data.isNotEmpty() && _selectedMember.value == null) {
                        val currentUserIdx = authService.getUserData()?.mtIdx
                        val selfMember = result.data.find { it.mtIdx == currentUserIdx }
                        selectMember(selfMember ?: result.data.first())
                    }

                    // Load activity stats for all members (for sidebar heatmap) - iOS와 동일한 그룹 API 사용
                    loadMemberStats(groupId)
                }
                is ApiResult.Error -> { if (BuildConfig.DEBUG) Log.e(TAG, "멤버 로드 실패 (${result.code})") }
                is ApiResult.NetworkError -> { if (BuildConfig.DEBUG) Log.e(TAG, "멤버 로드 실패 - 네트워크", result.exception) }
            }
        }
    }

    private fun loadMemberStats(groupId: Int) {
        viewModelScope.launch {
            when (val result = safeApiCall { activityLogService.getDailyCountsForGroup(groupId, 14) }) {
                is ApiResult.Success -> {
                    val response = result.data
                    if (response != null && !response.memberDailyCounts.isNullOrEmpty()) {
                        // Transform MemberDailyCount[] to Map<Int, List<DailyCount>>
                        val statsMap = response.memberDailyCounts.associate { memberCount ->
                            memberCount.memberId to (memberCount.dailyCounts ?: emptyList())
                        }
                        if (BuildConfig.DEBUG) Log.d("ActivityLogVM", "Group stats loaded: ${statsMap.size} members, Dates: ${response.startDate} ~ ${response.endDate}")
                        _memberActivityStats.value = statsMap
                    } else {
                        if (BuildConfig.DEBUG) Log.w("ActivityLogVM", "No member stats returned for group $groupId")
                        _memberActivityStats.value = emptyMap()
                    }
                }
                is ApiResult.Error -> {
                    if (BuildConfig.DEBUG) Log.e(TAG, "Failed to load group member stats (${result.code})")
                    _memberActivityStats.value = emptyMap()
                }
                is ApiResult.NetworkError -> {
                    if (BuildConfig.DEBUG) Log.e(TAG, "Failed to load group member stats - network", result.exception)
                    _memberActivityStats.value = emptyMap()
                }
            }
        }
    }

    fun loadActivityData() {
        val member = _selectedMember.value ?: return
        val dateStr = _selectedDate.value.format(dateFormatter)

        viewModelScope.launch {
            _isLoading.value = true
            _isLoadingLogs.value = true
            try {
                val logsDeferred = async { safeApiCall { activityLogService.getLocationLogs(member.mtIdx, dateStr) } }
                val summaryDeferred = async { safeApiCall { activityLogService.getLocationSummary(member.mtIdx, dateStr) } }
                val stayTimesDeferred = async { safeApiCall { activityLogService.getStayTimes(member.mtIdx, dateStr) } }

                when (val result = logsDeferred.await()) {
                    is ApiResult.Success -> {
                        _locationLogs.value = result.data.filter { it.hasValidCoordinates }
                        _sliderValue.value = 0.0
                    }
                    is ApiResult.Error -> _errorMessage.value = "활동 데이터를 불러오지 못했습니다 (${result.code})"
                    is ApiResult.NetworkError -> _errorMessage.value = "네트워크 연결을 확인해주세요"
                }
                when (val result = summaryDeferred.await()) {
                    is ApiResult.Success -> _locationSummary.value = result.data
                    else -> { /* error already handled above */ }
                }
                when (val result = stayTimesDeferred.await()) {
                    is ApiResult.Success -> _stayTimes.value = result.data
                    else -> { /* error already handled above */ }
                }
            } finally {
                _isLoading.value = false
                _isLoadingLogs.value = false
            }
        }
    }

    // MARK: - Date Navigation

    fun selectDate(date: LocalDate) {
        if (!date.isAfter(LocalDate.now())) {
            _selectedDate.value = date
            loadActivityData()
        }
    }

    // MARK: - Selection

    fun selectGroup(group: SmapGroup) {
        _selectedGroup.value = group
        _showGroupSelector.value = false
        _selectedMember.value = null
        _locationLogs.value = emptyList()
        _locationSummary.value = null
        loadMembers(group.sgtIdx)
    }

    fun selectMember(member: SmapGroupMember) {
        _selectedMember.value = member
        _showMemberSidebar.value = false
        loadActivityData()
    }

    /**
     * iOS 스타일 - 멤버 + 날짜를 동시에 선택 (히트맵 셀 탭 시)
     */
    fun selectMemberAndDate(member: SmapGroupMember, date: LocalDate) {
        _selectedMember.value = member
        _selectedDate.value = date
        _showMemberSidebar.value = false
        loadActivityData()
    }

    // MARK: - Dialog Controls

    fun toggleGroupSelector() {
        _showGroupSelector.value = !_showGroupSelector.value
    }

    fun hideGroupSelector() {
        _showGroupSelector.value = false
    }

    fun toggleMemberSidebar() {
        _showMemberSidebar.value = !_showMemberSidebar.value
    }

    fun hideMemberSidebar() {
        _showMemberSidebar.value = false
    }

    // Slider Controls
    fun setSliderValue(value: Double) {
        _sliderValue.value = value
    }

    fun setSliderDragging(dragging: Boolean) {
        _isSliderDragging.value = dragging
    }

    // MARK: - Helpers

    fun getFormattedDate(): String {
        val date = _selectedDate.value
        val formatter = DateTimeFormatter.ofPattern("M월 d일 (E)", java.util.Locale.KOREAN)
        return date.format(formatter)
    }

    fun clearError() {
        _errorMessage.value = null
    }
    
    fun getCurrentUserIdx(): Int? = authService.getUserData()?.mtIdx
}
