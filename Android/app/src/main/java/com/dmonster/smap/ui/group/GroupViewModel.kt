package com.dmonster.smap.ui.group

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.data.model.SmapGroup
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.data.service.GroupService
import com.dmonster.smap.data.GlobalEvent
import com.dmonster.smap.data.GlobalEventBus
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

/**
 * 그룹 페이지 ViewModel
 */
@HiltViewModel
class GroupViewModel @Inject constructor(
    private val groupService: GroupService,
    private val authService: AuthService
) : ViewModel() {

    companion object {
        private const val TAG = "GroupViewModel"
    }

    // Current View State
    enum class ViewState { LIST, DETAIL }
    private val _currentView = MutableStateFlow(ViewState.LIST)
    val currentView: StateFlow<ViewState> = _currentView.asStateFlow()

    // Loading States
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isMembersLoading = MutableStateFlow(false)
    val isMembersLoading: StateFlow<Boolean> = _isMembersLoading.asStateFlow()

    // Error State
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // Success Message
    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    // Data States
    private val _groups = MutableStateFlow<List<SmapGroup>>(emptyList())
    val groups: StateFlow<List<SmapGroup>> = _groups.asStateFlow()

    private val _selectedGroup = MutableStateFlow<SmapGroup?>(null)
    val selectedGroup: StateFlow<SmapGroup?> = _selectedGroup.asStateFlow()

    private val _groupMembers = MutableStateFlow<List<SmapGroupMember>>(emptyList())
    val groupMembers: StateFlow<List<SmapGroupMember>> = _groupMembers.asStateFlow()

    private val _groupMemberCounts = MutableStateFlow<Map<Int, Int>>(emptyMap())
    val groupMemberCounts: StateFlow<Map<Int, Int>> = _groupMemberCounts.asStateFlow()

    private val _groupScheduleCounts = MutableStateFlow<Map<Int, Int>>(emptyMap())
    private val _groupLocationCounts = MutableStateFlow<Map<Int, Int>>(emptyMap())
    
    val weeklyScheduleCount: StateFlow<Int> = combine(_selectedGroup, _groupScheduleCounts) { group, counts ->
        group?.let { counts[it.sgtIdx] } ?: 0
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val totalLocationCount: StateFlow<Int> = combine(_selectedGroup, _groupLocationCounts) { group, counts ->
        group?.let { counts[it.sgtIdx] } ?: 0
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    // Dialog States
    private val _showCreateDialog = MutableStateFlow(false)
    val showCreateDialog: StateFlow<Boolean> = _showCreateDialog.asStateFlow()

    private val _showEditDialog = MutableStateFlow(false)
    val showEditDialog: StateFlow<Boolean> = _showEditDialog.asStateFlow()

    private val _showDeleteDialog = MutableStateFlow(false)
    val showDeleteDialog: StateFlow<Boolean> = _showDeleteDialog.asStateFlow()

    private val _showShareDialog = MutableStateFlow(false)
    val showShareDialog: StateFlow<Boolean> = _showShareDialog.asStateFlow()

    private val _showMemberManageDialog = MutableStateFlow(false)
    val showMemberManageDialog: StateFlow<Boolean> = _showMemberManageDialog.asStateFlow()

    private val _selectedMember = MutableStateFlow<SmapGroupMember?>(null)
    val selectedMember: StateFlow<SmapGroupMember?> = _selectedMember.asStateFlow()

    private val _showInviteBottomSheet = MutableStateFlow(false)
    val showInviteBottomSheet: StateFlow<Boolean> = _showInviteBottomSheet.asStateFlow()

    private val _showQRCodeDialog = MutableStateFlow(false)
    val showQRCodeDialog: StateFlow<Boolean> = _showQRCodeDialog.asStateFlow()

    // Invite Code
    private val _inviteCode = MutableStateFlow("")
    val inviteCode: StateFlow<String> = _inviteCode.asStateFlow()

    // Action Loading States
    private val _isCreating = MutableStateFlow(false)
    val isCreating: StateFlow<Boolean> = _isCreating.asStateFlow()

    private val _isJoining = MutableStateFlow(false)
    val isJoining: StateFlow<Boolean> = _isJoining.asStateFlow()

    init {
        loadGroups()
    }

    // MARK: - Data Loading

    fun loadGroups() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            try {
                val groups = groupService.getGroups()
                _groups.value = groups
                Log.d(TAG, "✅ ${groups.size}개 그룹 로드")

                // Load member counts for each group
                val memberCounts = groups.associate { it.sgtIdx to (it.memberCount ?: 0) }.toMutableMap()
                _groupMemberCounts.value = memberCounts

                // Optionally refresh secondary counts if needed (but API memberCount should be reliable)
                for (group in groups) {
                    try {
                        val members = groupService.getGroupMembers(group.sgtIdx)
                        memberCounts[group.sgtIdx] = members.size
                        _groupMemberCounts.value = memberCounts.toMap()
                    } catch (e: Exception) {
                        Log.w(TAG, "⚠️ [loadGroups] Failed to get detailed members for group ${group.sgtIdx}")
                    }
                }

            } catch (e: Exception) {
                Log.e(TAG, "❌ 그룹 로드 실패", e)
                _errorMessage.value = "그룹을 불러오는데 실패했습니다"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun loadGroupMembers(group: SmapGroup) {
        viewModelScope.launch {
            _isMembersLoading.value = true

            try {
                val members = groupService.getGroupMembers(group.sgtIdx)
                _groupMembers.value = members
                Log.d(TAG, "✅ ${members.size}명 멤버 로드")

                // Update member count
                _groupMemberCounts.value = _groupMemberCounts.value.toMutableMap().apply {
                    put(group.sgtIdx, members.size)
                }

                // Load schedule count
                val scheduleCount = groupService.getGroupScheduleCount(group.sgtIdx)
                Log.d(TAG, "📊 [loadGroupMembers] Schedule Count: $scheduleCount")
                _groupScheduleCounts.value = _groupScheduleCounts.value.toMutableMap().apply {
                    put(group.sgtIdx, scheduleCount)
                }

                // Load location count
                val locationCount = groupService.getGroupLocationCount(group.sgtIdx)
                Log.d(TAG, "📊 [loadGroupMembers] Location Count: $locationCount")
                _groupLocationCounts.value = _groupLocationCounts.value.toMutableMap().apply {
                    put(group.sgtIdx, locationCount)
                }

            } catch (e: Exception) {
                Log.e(TAG, "❌ 멤버/통계 로드 실패", e)
                _errorMessage.value = "정보를 불러오는데 실패했습니다"
            } finally {
                _isMembersLoading.value = false
            }
        }
    }

    // MARK: - Navigation

    fun selectGroup(group: SmapGroup) {
        _selectedGroup.value = group
        _currentView.value = ViewState.DETAIL
        loadGroupMembers(group)
    }

    fun backToList() {
        _currentView.value = ViewState.LIST
        _selectedGroup.value = null
        _groupMembers.value = emptyList()
    }

    // MARK: - Dialog Controls

    fun showCreateDialog() { _showCreateDialog.value = true }
    fun hideCreateDialog() { _showCreateDialog.value = false }

    fun showEditDialog() { _showEditDialog.value = true }
    fun hideEditDialog() { _showEditDialog.value = false }

    fun showDeleteDialog() { _showDeleteDialog.value = true }
    fun hideDeleteDialog() { _showDeleteDialog.value = false }

    fun showShareDialog() { _showShareDialog.value = true }
    fun hideShareDialog() { _showShareDialog.value = false }

    fun showInviteBottomSheet() { _showInviteBottomSheet.value = true }
    fun hideInviteBottomSheet() { _showInviteBottomSheet.value = false }

    fun showQRCodeDialog() { _showQRCodeDialog.value = true }
    fun hideQRCodeDialog() { _showQRCodeDialog.value = false }

    fun showMemberManageDialog(member: SmapGroupMember) {
        _selectedMember.value = member
        _showMemberManageDialog.value = true
    }
    fun hideMemberManageDialog() {
        _showMemberManageDialog.value = false
        _selectedMember.value = null
    }

    // MARK: - Actions

    fun updateInviteCode(code: String) {
        // 대문자로 변환하고 영문 알파벳(A-Z)과 숫자(0-9)만 허용 (한글 제외)
        val filtered = code.uppercase().filter { it in 'A'..'Z' || it in '0'..'9' }
        _inviteCode.value = filtered
    }

    fun joinGroupByCode() {
        val code = _inviteCode.value.trim()
        if (code.isEmpty()) return

        viewModelScope.launch {
            _isJoining.value = true
            try {
                val success = groupService.joinGroupByCode(code)
                if (success) {
                    _successMessage.value = "그룹에 가입되었습니다"
                    _inviteCode.value = ""
                    loadGroups()
                    GlobalEventBus.tryEmit(GlobalEvent.GroupsChanged)
                } else {
                    _errorMessage.value = "그룹 가입에 실패했습니다"
                }
            } catch (e: Exception) {
                _errorMessage.value = "그룹 가입 중 오류가 발생했습니다"
            } finally {
                _isJoining.value = false
            }
        }
    }

    fun createGroup(title: String, description: String) {
        if (title.isBlank()) return

        viewModelScope.launch {
            _isCreating.value = true
            try {
                val group = groupService.createGroup(title, description.ifBlank { null })
                if (group != null) {
                    _successMessage.value = "그룹이 생성되었습니다"
                    hideCreateDialog()
                    loadGroups()
                    GlobalEventBus.tryEmit(GlobalEvent.GroupsChanged)
                } else {
                    _errorMessage.value = "그룹 생성에 실패했습니다"
                }
            } catch (e: Exception) {
                _errorMessage.value = "그룹 생성 중 오류가 발생했습니다"
            } finally {
                _isCreating.value = false
            }
        }
    }

    fun updateGroup(title: String, description: String) {
        val group = _selectedGroup.value ?: return
        if (title.isBlank()) return

        viewModelScope.launch {
            try {
                val success = groupService.updateGroup(group.sgtIdx, title, description.ifBlank { null })
                if (success) {
                    _successMessage.value = "그룹이 수정되었습니다"
                    hideEditDialog()
                    loadGroups()
                    // Update selected group
                    _selectedGroup.value = group.copy(
                        sgtTitle = title,
                        sgtMemo = description
                    )
                    GlobalEventBus.tryEmit(GlobalEvent.GroupsChanged)
                } else {
                    _errorMessage.value = "그룹 수정에 실패했습니다"
                }
            } catch (e: Exception) {
                _errorMessage.value = "그룹 수정 중 오류가 발생했습니다"
            }
        }
    }

    fun deleteGroup() {
        val group = _selectedGroup.value ?: return

        viewModelScope.launch {
            try {
                val success = groupService.deleteGroup(group.sgtIdx)
                if (success) {
                    _successMessage.value = "그룹이 삭제되었습니다"
                    hideDeleteDialog()
                    backToList()
                    loadGroups()
                    GlobalEventBus.tryEmit(GlobalEvent.GroupsChanged)
                } else {
                    _errorMessage.value = "그룹 삭제에 실패했습니다"
                }
            } catch (e: Exception) {
                _errorMessage.value = "그룹 삭제 중 오류가 발생했습니다"
            }
        }
    }

    fun leaveGroup() {
        val group = _selectedGroup.value ?: return
        val user = authService.getUserData() ?: return

        viewModelScope.launch {
            try {
                val mtIdx = user.mtIdx ?: return@launch
                val success = groupService.removeMember(group.sgtIdx, mtIdx)
                if (success) {
                    _successMessage.value = "그룹에서 탈퇴되었습니다"
                    hideDeleteDialog()
                    backToList()
                    loadGroups()
                    GlobalEventBus.tryEmit(GlobalEvent.GroupsChanged)
                } else {
                    _errorMessage.value = "그룹 탈퇴에 실패했습니다"
                }
            } catch (e: Exception) {
                _errorMessage.value = "그룹 탈퇴 중 오류가 발생했습니다"
            }
        }
    }

    fun updateMemberRole(isLeader: Boolean) {
        val group = _selectedGroup.value ?: return
        val member = _selectedMember.value ?: return

        viewModelScope.launch {
            try {
                val success = groupService.updateMemberRole(group.sgtIdx, member.mtIdx, isLeader)
                if (success) {
                    _successMessage.value = if (isLeader) "리더로 변경되었습니다" else "멤버로 변경되었습니다"
                    hideMemberManageDialog()
                    loadGroupMembers(group)
                } else {
                    _errorMessage.value = "역할 변경에 실패했습니다"
                }
            } catch (e: Exception) {
                _errorMessage.value = "역할 변경 중 오류가 발생했습니다"
            }
        }
    }

    fun removeMember() {
        val group = _selectedGroup.value ?: return
        val member = _selectedMember.value ?: return

        viewModelScope.launch {
            try {
                val success = groupService.removeMember(group.sgtIdx, member.mtIdx)
                if (success) {
                    _successMessage.value = "멤버가 탈퇴되었습니다"
                    hideMemberManageDialog()
                    loadGroupMembers(group)
                } else {
                    _errorMessage.value = "멤버 탈퇴에 실패했습니다"
                }
            } catch (e: Exception) {
                _errorMessage.value = "멤버 탈퇴 중 오류가 발생했습니다"
            }
        }
    }

    // MARK: - Helpers

    fun isCurrentUserOwner(): Boolean {
        val user = authService.getUserData() ?: return false
        val member = _groupMembers.value.find { it.mtIdx == user.mtIdx }
        return member?.sgdtOwnerChk == "Y"
    }

    fun getTotalMembers(): Int {
        return _groupMemberCounts.value.values.sum()
    }

    fun clearError() { _errorMessage.value = null }
    fun clearSuccess() { _successMessage.value = null }
}
