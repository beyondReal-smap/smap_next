package com.dmonster.smap.ui.myplace

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.BuildConfig
import com.dmonster.smap.data.api.ApiResult
import com.dmonster.smap.data.api.safeApiCall
import com.dmonster.smap.data.model.SavedLocation
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.data.service.GroupService
import com.dmonster.smap.data.service.MyPlaceService
import com.dmonster.smap.data.GlobalEvent
import com.dmonster.smap.data.GlobalEventBus
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import com.dmonster.smap.data.model.KakaoPlace
import com.dmonster.smap.data.model.KakaoPlaceResponse
import com.dmonster.smap.data.model.KakaoAddressResponse
import kotlinx.serialization.json.Json

/**
 * 내장소 페이지 ViewModel
 */
@HiltViewModel
class MyPlaceViewModel @Inject constructor(
    private val myPlaceService: MyPlaceService,
    private val groupService: GroupService,
    private val authService: AuthService
) : ViewModel() {

    companion object {
        private const val TAG = "MyPlaceViewModel"
        private val httpClient = OkHttpClient()
    }

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

    // Locations
    private val _locations = MutableStateFlow<List<SavedLocation>>(emptyList())
    val locations: StateFlow<List<SavedLocation>> = _locations.asStateFlow()

    private val _selectedLocation = MutableStateFlow<SavedLocation?>(null)
    val selectedLocation: StateFlow<SavedLocation?> = _selectedLocation.asStateFlow()

    // Loading States
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isLoadingLocations = MutableStateFlow(false)
    val isLoadingLocations: StateFlow<Boolean> = _isLoadingLocations.asStateFlow()

    // Messages
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    // Dialog States
    private val _showGroupSelector = MutableStateFlow(false)
    val showGroupSelector: StateFlow<Boolean> = _showGroupSelector.asStateFlow()

    private val _showMemberSidebar = MutableStateFlow(false)
    val showMemberSidebar: StateFlow<Boolean> = _showMemberSidebar.asStateFlow()

    private val _showAddDialog = MutableStateFlow(false)
    val showAddDialog: StateFlow<Boolean> = _showAddDialog.asStateFlow()

    private val _showEditDialog = MutableStateFlow<SavedLocation?>(null)
    val showEditDialog: StateFlow<SavedLocation?> = _showEditDialog.asStateFlow()

    private val _showDeleteDialog = MutableStateFlow<SavedLocation?>(null)
    val showDeleteDialog: StateFlow<SavedLocation?> = _showDeleteDialog.asStateFlow()

    // Action Loading
    private val _isCreating = MutableStateFlow(false)
    val isCreating: StateFlow<Boolean> = _isCreating.asStateFlow()

    // Map Center (for location add)
    private val _pendingLocation = MutableStateFlow<Pair<Double, Double>?>(null)
    val pendingLocation: StateFlow<Pair<Double, Double>?> = _pendingLocation.asStateFlow()

    // Search States
    private val _showSearchScreen = MutableStateFlow(false)
    val showSearchScreen: StateFlow<Boolean> = _showSearchScreen.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _searchResults = MutableStateFlow<List<KakaoPlace>>(emptyList())
    val searchResults: StateFlow<List<KakaoPlace>> = _searchResults.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    private val _hasSearched = MutableStateFlow(false)
    val hasSearched: StateFlow<Boolean> = _hasSearched.asStateFlow()

    private val _isMapLoading = MutableStateFlow(true)
    val isMapLoading: StateFlow<Boolean> = _isMapLoading.asStateFlow()

    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; isLenient = true }
    private val KAKAO_API_KEY = BuildConfig.KAKAO_API_KEY

    private val _pendingPlaceInfo = MutableStateFlow<Triple<String, String, String?>?>(null)
    val pendingPlaceInfo: StateFlow<Triple<String, String, String?>?> = _pendingPlaceInfo.asStateFlow()

    init {
        // performInitialLoad() is called from LaunchedEffect in MyPlaceScreen
        // to ensure data refreshes on every visit to the screen.

        // Global Event Observation
        viewModelScope.launch {
            GlobalEventBus.events.collect { event ->
                when (event) {
                    is GlobalEvent.GroupsChanged -> {
                        if (BuildConfig.DEBUG) Log.d(TAG, "[Event] Groups changed event received, refreshing data")
                        performInitialLoad()
                    }
                    else -> {}
                }
            }
        }
    }

    fun performInitialLoad() {
        viewModelScope.launch {
            _isMapLoading.value = true
            val startTime = System.currentTimeMillis()

            when (val result = safeApiCall { groupService.getGroups() }) {
                is ApiResult.Success -> {
                    val groups = result.data
                    _groups.value = groups

                    if (groups.isNotEmpty()) {
                        val firstGroup = groups.first()
                        _selectedGroup.value = firstGroup

                        // Load Members
                        when (val membersResult = safeApiCall { groupService.getGroupMembers(firstGroup.sgtIdx) }) {
                            is ApiResult.Success -> {
                                _members.value = membersResult.data
                                if (membersResult.data.isNotEmpty()) {
                                    val firstMember = membersResult.data.first()
                                    _selectedMember.value = firstMember

                                    // Load Locations
                                    when (val locsResult = safeApiCall { myPlaceService.getLocations(firstMember.mtIdx) }) {
                                        is ApiResult.Success -> {
                                            _locations.value = locsResult.data
                                            if (locsResult.data.isNotEmpty()) {
                                                _selectedLocation.value = locsResult.data.first()
                                            }
                                        }
                                        else -> {
                                            if (BuildConfig.DEBUG) Log.e(TAG, "Location load failed during initial load")
                                            _locations.value = emptyList()
                                        }
                                    }
                                } else {
                                    _members.value = emptyList()
                                    _locations.value = emptyList()
                                }
                            }
                            else -> {
                                if (BuildConfig.DEBUG) Log.e(TAG, "Member load failed during initial load")
                                _members.value = emptyList()
                                _locations.value = emptyList()
                            }
                        }
                    } else {
                        _groups.value = emptyList()
                        _members.value = emptyList()
                        _locations.value = emptyList()
                    }
                }
                is ApiResult.Error -> {
                    if (BuildConfig.DEBUG) Log.e(TAG, "Initial data load failed (${result.code})")
                    _errorMessage.value = "데이터를 불러오지 못했습니다 (${result.code})"
                }
                is ApiResult.NetworkError -> {
                    if (BuildConfig.DEBUG) Log.e(TAG, "Initial data load failed - network", result.exception)
                    _errorMessage.value = "네트워크 연결을 확인해주세요"
                }
            }

            // Ensure at least 1 second loading for smoothness
            val elapsed = System.currentTimeMillis() - startTime
            if (elapsed < 1000) {
                kotlinx.coroutines.delay(1000 - elapsed)
            }
            _isMapLoading.value = false
        }
    }

    // MARK: - Data Loading

    private fun loadMembers(groupId: Int) {
        viewModelScope.launch {
            when (val result = safeApiCall { groupService.getGroupMembers(groupId) }) {
                is ApiResult.Success -> {
                    _members.value = result.data
                    if (result.data.isNotEmpty() && _selectedMember.value == null) {
                        val currentUserIdx = authService.getUserData()?.mtIdx
                        val selfMember = result.data.find { it.mtIdx == currentUserIdx }
                        selectMember(selfMember ?: result.data.first())
                    }
                }
                is ApiResult.Error -> { if (BuildConfig.DEBUG) Log.e(TAG, "Member load failed (${result.code})") }
                is ApiResult.NetworkError -> { if (BuildConfig.DEBUG) Log.e(TAG, "Member load failed - network", result.exception) }
            }
        }
    }

    fun loadLocations() {
        val member = _selectedMember.value ?: return

        viewModelScope.launch {
            _isLoadingLocations.value = true
            when (val result = safeApiCall { myPlaceService.getLocations(member.mtIdx) }) {
                is ApiResult.Success -> {
                    _locations.value = result.data
                    if (BuildConfig.DEBUG) Log.d(TAG, "${result.data.size} locations loaded")
                }
                is ApiResult.Error -> {
                    if (BuildConfig.DEBUG) Log.e(TAG, "Location load failed (${result.code})")
                    _errorMessage.value = "장소 정보를 불러오지 못했습니다 (${result.code})"
                }
                is ApiResult.NetworkError -> {
                    if (BuildConfig.DEBUG) Log.e(TAG, "Location load failed - network", result.exception)
                    _errorMessage.value = "네트워크 연결을 확인해주세요"
                }
            }
            _isLoadingLocations.value = false
        }
    }

    // MARK: - Selection

    fun selectGroup(group: SmapGroup) {
        _selectedGroup.value = group
        _showGroupSelector.value = false
        _selectedMember.value = null
        _locations.value = emptyList()
        loadMembers(group.sgtIdx)
    }

    fun selectMember(member: SmapGroupMember) {
        _selectedMember.value = member
        _selectedLocation.value = null  // Clear selection when switching members
        loadLocations()
    }

    fun selectLocation(location: SavedLocation?) {
        _selectedLocation.value = location
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

    fun showAddDialog(lat: Double, lng: Double) {
        _pendingLocation.value = lat to lng
        _showAddDialog.value = true
        
        // Try to reverse geocode to get address for potential manual add
        viewModelScope.launch {
            val result = reverseGeocode(lat, lng)
            if (result != null) {
                val (name, address) = result
                _pendingPlaceInfo.value = Triple(name ?: "", address ?: "", null)
            }
        }
    }

    fun hideAddDialog() {
        _showAddDialog.value = false
        _pendingLocation.value = null
        _pendingPlaceInfo.value = null
    }

    fun showEditDialog(location: SavedLocation) {
        _pendingLocation.value = null
        _pendingPlaceInfo.value = null
        _selectedLocation.value = location // 마커 선택 상태 업데이트 (빨간색 마커로 변경)
        _showEditDialog.value = location
        _showAddDialog.value = false
    }

    fun hideEditDialog() {
        _showEditDialog.value = null
        _pendingLocation.value = null
        _pendingPlaceInfo.value = null
    }

    fun showDeleteDialog(location: SavedLocation) {
        _showDeleteDialog.value = location
    }

    fun hideDeleteDialog() {
        _showDeleteDialog.value = null
    }

    // MARK: - Search Actions

    fun showSearchScreen() {
        _showSearchScreen.value = true
        _searchQuery.value = ""
        _searchResults.value = emptyList()
        _hasSearched.value = false
    }

    fun hideSearchScreen() {
        _showSearchScreen.value = false
    }

    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
        if (query.isEmpty()) {
            _searchResults.value = emptyList()
            _hasSearched.value = false
        }
    }

    private suspend fun reverseGeocode(lat: Double, lng: Double): Pair<String?, String?>? {
        return kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            try {
                val url = "https://dapi.kakao.com/v2/local/geo/coord2address.json?x=$lng&y=$lat"
                val request = Request.Builder()
                    .url(url)
                    .addHeader("Authorization", "KakaoAK $KAKAO_API_KEY")
                    .build()

                val response = httpClient.newCall(request).execute()
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: return@withContext null
                    try {
                        val result = json.decodeFromString<KakaoAddressResponse>(body)
                        val doc = result.documents.firstOrNull()
                        val address = doc?.roadAddress?.addressName ?: doc?.address?.addressName
                        val building = doc?.roadAddress?.buildingName
                        building to address
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to parse address response", e)
                        null
                    }
                } else {
                    null
                }
            } catch (e: Exception) {
                if (BuildConfig.DEBUG) Log.e(TAG, "Reverse geocoding failed", e)
                null
            }
        }
    }

    fun performSearch() {
        val query = _searchQuery.value
        if (query.isBlank()) return

        // API 키 미설정 시 network 호출 전에 즉시 가드 — 빈 키로 호출하면 401 이 내려와
        // "검색에 실패했습니다" 로만 표시되어 원인 파악이 어렵기 때문이다.
        if (KAKAO_API_KEY.isBlank()) {
            if (BuildConfig.DEBUG) Log.e(TAG, "KAKAO_API_KEY is empty — check local.properties")
            _errorMessage.value = "주소 검색 키가 설정되지 않았습니다. 앱 재설치 후 다시 시도해주세요."
            return
        }

        viewModelScope.launch {
            _isSearching.value = true
            try {
                val url = "https://dapi.kakao.com/v2/local/search/keyword.json?query=${java.net.URLEncoder.encode(query, "UTF-8")}"
                val request = Request.Builder()
                    .url(url)
                    .addHeader("Authorization", "KakaoAK $KAKAO_API_KEY")
                    .build()

                // Execute on IO dispatcher
                val response = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                    httpClient.newCall(request).execute()
                }

                if (response.isSuccessful) {
                    val body = response.body?.string() ?: ""
                    try {
                        val result = json.decodeFromString<KakaoPlaceResponse>(body)
                        _searchResults.value = result.documents
                        _hasSearched.value = true
                    } catch (e: Exception) {
                        if (BuildConfig.DEBUG) Log.e(TAG, "Failed to parse search response", e)
                        _errorMessage.value = "검색 결과 처리에 실패했습니다"
                    }
                } else {
                    if (BuildConfig.DEBUG) Log.e(TAG, "Search HTTP ${response.code}: ${response.body?.string()?.take(200)}")
                    _errorMessage.value = when (response.code) {
                        401, 403 -> "주소 검색 인증에 실패했습니다 (키 확인 필요)"
                        429 -> "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
                        else -> "검색에 실패했습니다 (${response.code})"
                    }
                }
            } catch (e: Exception) {
                if (BuildConfig.DEBUG) Log.e(TAG, "Search failed", e)
                _errorMessage.value = "검색 중 오류가 발생했습니다: ${e.message ?: ""}".trim()
            } finally {
                _isSearching.value = false
            }
        }
    }

    fun onPlaceSelected(place: KakaoPlace) {
        _pendingPlaceInfo.value = Triple(place.displayName, place.displayAddress, null)
        _pendingLocation.value = place.latitude to place.longitude
        _showSearchScreen.value = false
        
        // Only show add dialog if we're not already in edit mode
        if (_showEditDialog.value == null) {
            _showAddDialog.value = true
        }
    }

    // MARK: - Actions

    fun createLocation(
        title: String,
        address: String,
        lat: Double,
        lng: Double,
        memo: String?,
        enterAlarm: String = "Y"
    ) {
        val group = _selectedGroup.value ?: return
        val member = _selectedMember.value ?: return

        if (title.isBlank()) return

        viewModelScope.launch {
            _isCreating.value = true
            when (val result = safeApiCall {
                myPlaceService.createLocation(
                    memberId = member.mtIdx,
                    groupId = group.sgtIdx,
                    title = title,
                    address = address,
                    lat = lat,
                    lng = lng,
                    memo = memo,
                    enterAlarm = enterAlarm
                )
            }) {
                is ApiResult.Success -> {
                    if (result.data != null) {
                        _successMessage.value = "장소가 저장되었습니다"
                        hideAddDialog()
                        loadLocations()
                    } else {
                        _errorMessage.value = "장소 저장에 실패했습니다"
                    }
                }
                is ApiResult.Error -> _errorMessage.value = "장소 저장에 실패했습니다 (${result.code})"
                is ApiResult.NetworkError -> _errorMessage.value = "네트워크 연결을 확인해주세요"
            }
            _isCreating.value = false
        }
    }

    fun updateLocation(
        locationId: Int,
        title: String,
        address: String,
        lat: Double,
        lng: Double,
        memo: String?,
        enterAlarm: String? = null
    ) {
        if (title.isBlank()) return

        viewModelScope.launch {
            _isLoading.value = true
            when (val result = safeApiCall {
                myPlaceService.updateLocation(
                    locationId = locationId,
                    title = title,
                    address = address,
                    lat = lat,
                    lng = lng,
                    memo = memo,
                    enterAlarm = enterAlarm
                )
            }) {
                is ApiResult.Success -> {
                    if (result.data) {
                        _successMessage.value = "장소가 수정되었습니다"
                        hideEditDialog()
                        loadLocations()
                    } else {
                        _errorMessage.value = "장소 수정에 실패했습니다"
                    }
                }
                is ApiResult.Error -> _errorMessage.value = "장소 수정에 실패했습니다 (${result.code})"
                is ApiResult.NetworkError -> _errorMessage.value = "네트워크 연결을 확인해주세요"
            }
            _isLoading.value = false
        }
    }

    // TODO: Replace with a dedicated PATCH endpoint for notification toggle when available.
    // Currently sends a full update with all fields from the existing location.
    fun toggleLocationNotification(location: SavedLocation) {
        viewModelScope.launch {
            val newStatus = if (location.sltEnterAlarm == "Y") "N" else "Y"
            when (val result = safeApiCall {
                myPlaceService.updateLocation(
                    locationId = location.sltIdx,
                    title = location.name,
                    address = location.address,
                    lat = location.latitude,
                    lng = location.longitude,
                    memo = location.memo,
                    enterAlarm = newStatus
                )
            }) {
                is ApiResult.Success -> {
                    if (result.data) {
                        val updatedLocation = location.copy(sltEnterAlarm = newStatus)

                        if (_showEditDialog.value?.sltIdx == location.sltIdx) {
                            _showEditDialog.value = updatedLocation
                        }

                        if (_selectedLocation.value?.sltIdx == location.sltIdx) {
                            _selectedLocation.value = updatedLocation
                        }

                        loadLocations()
                    } else {
                        _errorMessage.value = "알림 설정 변경에 실패했습니다"
                    }
                }
                is ApiResult.Error -> _errorMessage.value = "알림 설정 변경에 실패했습니다 (${result.code})"
                is ApiResult.NetworkError -> _errorMessage.value = "네트워크 연결을 확인해주세요"
            }
        }
    }

    fun deleteLocation(locationId: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = safeApiCall { myPlaceService.deleteLocation(locationId) }) {
                is ApiResult.Success -> {
                    if (result.data) {
                        _successMessage.value = "장소가 삭제되었습니다"
                        hideDeleteDialog()
                        hideEditDialog()
                        if (_selectedLocation.value?.sltIdx == locationId) {
                            _selectedLocation.value = null
                        }
                        loadLocations()
                    } else {
                        _errorMessage.value = "장소 삭제에 실패했습니다"
                    }
                }
                is ApiResult.Error -> _errorMessage.value = "장소 삭제에 실패했습니다 (${result.code})"
                is ApiResult.NetworkError -> _errorMessage.value = "네트워크 연결을 확인해주세요"
            }
            _isLoading.value = false
        }
    }

    // MARK: - Permissions

    fun canManageLocation(location: SavedLocation): Boolean {
        val currentUser = authService.getUserData() ?: return false
        
        // 1. Own data
        if (location.mtIdx == currentUser.mtIdx) return true
        
        val currentMember = _members.value.find { it.mtIdx == currentUser.mtIdx } ?: return false
        
        // 2. Owner can manage anything
        if (currentMember.sgdtOwnerChk == "Y") return true
        
        // 3. Leader can manage anything except Owner's data
        if (currentMember.sgdtLeaderChk == "Y") {
            val targetMember = _members.value.find { it.mtIdx == location.mtIdx }
            // If target is Owner, leader cannot manage
            if (targetMember?.sgdtOwnerChk == "Y") return false
            return true
        }
        
        return false
    }

    // MARK: - Helpers

    fun clearSelection() {
        _selectedLocation.value = null
    }

    fun clearError() { _errorMessage.value = null }
    fun clearSuccess() { _successMessage.value = null }

    fun getCurrentUserIdx(): Int? = authService.getUserData()?.mtIdx
}
