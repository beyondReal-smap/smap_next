package com.dmonster.smap.ui.myplace

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.data.model.SavedLocation
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.data.service.GroupService
import com.dmonster.smap.data.service.MyPlaceService
import com.dmonster.smap.data.GlobalEvent
import com.dmonster.smap.data.GlobalEventBus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import com.dmonster.smap.data.model.KakaoPlace
import com.dmonster.smap.data.model.KakaoPlaceResponse
import com.dmonster.smap.data.model.KakaoAddressResponse
import com.google.gson.Gson

/**
 * 내장소 페이지 ViewModel
 */
class MyPlaceViewModel(application: Application) : AndroidViewModel(application) {

    companion object {
        private const val TAG = "MyPlaceViewModel"
    }

    private val myPlaceService = MyPlaceService.getInstance(application)
    private val groupService = GroupService.getInstance(application)
    private val authService = AuthService.getInstance(application)

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

    private val httpClient = OkHttpClient()
    private val gson = Gson()
    private val KAKAO_API_KEY = "7fbf60571daf54ca5bee8373a1f31d2d"

    private val _pendingPlaceInfo = MutableStateFlow<Triple<String, String, String?>?>(null)
    val pendingPlaceInfo: StateFlow<Triple<String, String, String?>?> = _pendingPlaceInfo.asStateFlow()

    init {
        performInitialLoad()
        
        // Global Event Observation
        viewModelScope.launch {
            GlobalEventBus.events.collect { event ->
                when (event) {
                    is GlobalEvent.GroupsChanged -> {
                        Log.d(TAG, "🔄 [Event] Groups changed event received, refreshing data")
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
            
            try {
                // 1. Load Groups
                val groups = groupService.getGroups()
                _groups.value = groups
                
                if (groups.isNotEmpty()) {
                    val firstGroup = groups.first()
                    _selectedGroup.value = firstGroup
                    
                    // 2. Load Members
                    val members = groupService.getGroupMembers(firstGroup.sgtIdx)
                    _members.value = members
                    
                    if (members.isNotEmpty()) {
                        val firstMember = members.first()
                        _selectedMember.value = firstMember
                        
                        // 3. Load Locations
                        val locations = myPlaceService.getLocations(firstMember.mtIdx)
                        _locations.value = locations
                        
                        // 4. Auto-select first location for initial pan
                        if (locations.isNotEmpty()) {
                            _selectedLocation.value = locations.first()
                        }
                    } else {
                        _members.value = emptyList()
                        _locations.value = emptyList()
                    }
                } else {
                    _groups.value = emptyList()
                    _members.value = emptyList()
                    _locations.value = emptyList()
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ 초기 데이터 로드 실패", e)
                _errorMessage.value = "데이터를 불러오는데 실패했습니다"
            } finally {
                // Ensure at least 1 second loading for smoothness
                val elapsed = System.currentTimeMillis() - startTime
                if (elapsed < 1000) {
                    kotlinx.coroutines.delay(1000 - elapsed)
                }
                _isMapLoading.value = false
            }
        }
    }

    // MARK: - Data Loading

    private fun loadGroups() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val groups = groupService.getGroups()
                _groups.value = groups
                
                if (groups.isNotEmpty() && _selectedGroup.value == null) {
                    selectGroup(groups.first())
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ 그룹 로드 실패", e)
                _errorMessage.value = "그룹을 불러오는데 실패했습니다"
            } finally {
                _isLoading.value = false
            }
        }
    }

    private fun loadMembers(groupId: Int) {
        viewModelScope.launch {
            try {
                val members = groupService.getGroupMembers(groupId)
                _members.value = members
                
                // 첫 번째 멤버 자동 선택
                if (members.isNotEmpty() && _selectedMember.value == null) {
                    selectMember(members.first())
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ 멤버 로드 실패", e)
            }
        }
    }

    fun loadLocations() {
        val member = _selectedMember.value ?: return

        viewModelScope.launch {
            _isLoadingLocations.value = true
            try {
                val locations = myPlaceService.getLocations(member.mtIdx)
                _locations.value = locations
                Log.d(TAG, "✅ ${locations.size}개 장소 로드")
            } catch (e: Exception) {
                Log.e(TAG, "❌ 장소 로드 실패", e)
                _errorMessage.value = "장소를 불러오는데 실패했습니다"
            } finally {
                _isLoadingLocations.value = false
            }
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
        
        // Try to reverse geocode to get address
        viewModelScope.launch {
            val address = reverseGeocode(lat, lng)
            if (address != null) {
                // If we successfully got an address, pre-fill it
                _pendingPlaceInfo.value = Triple("지도에서 선택한 장소", address, null)
            }
        }
    }

    fun hideAddDialog() {
        _showAddDialog.value = false
        _pendingLocation.value = null
        _pendingPlaceInfo.value = null
    }

    fun showEditDialog(location: SavedLocation) {
        _showEditDialog.value = location
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

    private suspend fun reverseGeocode(lat: Double, lng: Double): String? {
        return kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            try {
                val url = "https://dapi.kakao.com/v2/local/geo/coord2address.json?x=$lng&y=$lat"
                val request = Request.Builder()
                    .url(url)
                    .addHeader("Authorization", "KakaoAK $KAKAO_API_KEY")
                    .build()

                val response = httpClient.newCall(request).execute()
                if (response.isSuccessful) {
                    val body = response.body?.string()
                    val result = gson.fromJson(body, KakaoAddressResponse::class.java)
                    val doc = result.documents.firstOrNull()
                    doc?.roadAddress?.addressName ?: doc?.address?.addressName
                } else {
                    null
                }
            } catch (e: Exception) {
                Log.e(TAG, "Reverse geocoding failed", e)
                null
            }
        }
    }

    fun performSearch() {
        val query = _searchQuery.value
        if (query.isBlank()) return

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
                    val body = response.body?.string()
                    val result = gson.fromJson(body, KakaoPlaceResponse::class.java)
                    _searchResults.value = result.documents
                    _hasSearched.value = true
                } else {
                    _errorMessage.value = "검색에 실패했습니다"
                }
            } catch (e: Exception) {
                Log.e(TAG, "Search failed", e)
                _errorMessage.value = "검색 중 오류가 발생했습니다"
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
        memo: String?
    ) {
        val group = _selectedGroup.value ?: return
        val member = _selectedMember.value ?: return
        // val coords = _pendingLocation.value ?: return // Removed
        
        if (title.isBlank()) return

        viewModelScope.launch {
            _isCreating.value = true
            try {
                val location = myPlaceService.createLocation(
                    memberId = member.mtIdx,
                    groupId = group.sgtIdx,
                    title = title,
                    address = address,
                    lat = lat,
                    lng = lng,
                    memo = memo
                )
                if (location != null) {
                    _successMessage.value = "장소가 저장되었습니다"
                    hideAddDialog()
                    loadLocations()
                } else {
                    _errorMessage.value = "장소 저장에 실패했습니다"
                }
            } catch (e: Exception) {
                _errorMessage.value = "장소 저장 중 오류가 발생했습니다"
            } finally {
                _isCreating.value = false
            }
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
            try {
                val success = myPlaceService.updateLocation(
                    locationId = locationId,
                    title = title,
                    address = address,
                    lat = lat,
                    lng = lng,
                    memo = memo,
                    enterAlarm = enterAlarm
                )
                if (success) {
                    _successMessage.value = "장소가 수정되었습니다"
                    hideEditDialog()
                    loadLocations()
                } else {
                    _errorMessage.value = "장소 수정에 실패했습니다"
                }
            } catch (e: Exception) {
                _errorMessage.value = "장소 수정 중 오류가 발생했습니다"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun toggleLocationNotification(location: SavedLocation) {
        viewModelScope.launch {
            val newStatus = if (location.sltEnterAlarm == "Y") "N" else "Y"
            try {
                val success = myPlaceService.updateLocation(
                    locationId = location.sltIdx,
                    title = location.name,
                    address = location.address,
                    lat = location.latitude,
                    lng = location.longitude,
                    memo = location.memo,
                    enterAlarm = newStatus
                )
                if (success) {
                    // Update active states immediately for UI feedback
                    val updatedLocation = location.copy(sltEnterAlarm = newStatus)
                    
                    if (_showEditDialog.value?.sltIdx == location.sltIdx) {
                        _showEditDialog.value = updatedLocation
                    }
                    
                    if (_selectedLocation.value?.sltIdx == location.sltIdx) {
                        _selectedLocation.value = updatedLocation
                    }

                    // Refresh list for consistency
                    loadLocations()
                } else {
                    _errorMessage.value = "알림 설정 변경에 실패했습니다"
                }
            } catch (e: Exception) {
                _errorMessage.value = "알림 설정 변경 중 오류가 발생했습니다"
            }
        }
    }

    fun deleteLocation(locationId: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val success = myPlaceService.deleteLocation(locationId)
                if (success) {
                    _successMessage.value = "장소가 삭제되었습니다"
                    hideDeleteDialog()
                    if (_selectedLocation.value?.sltIdx == locationId) {
                        _selectedLocation.value = null
                    }
                    loadLocations()
                } else {
                    _errorMessage.value = "장소 삭제에 실패했습니다"
                }
            } catch (e: Exception) {
                _errorMessage.value = "장소 삭제 중 오류가 발생했습니다"
            } finally {
                _isLoading.value = false
            }
        }
    }

    // MARK: - Helpers

    fun getLocationsWithCoordinates(): List<SavedLocation> {
        return _locations.value.filter { it.hasValidCoordinates }
    }

    fun clearError() { _errorMessage.value = null }
    fun clearSuccess() { _successMessage.value = null }
}
