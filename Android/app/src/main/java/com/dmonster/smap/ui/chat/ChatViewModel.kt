package com.dmonster.smap.ui.chat

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dmonster.smap.data.api.ApiResult
import com.dmonster.smap.data.api.safeApiCall
import com.dmonster.smap.data.model.ChatMessage
import com.dmonster.smap.data.model.ChatRoom
import com.dmonster.smap.data.service.AuthService
import com.dmonster.smap.data.service.ChatService
import com.dmonster.smap.data.service.ChatSocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val chatService: ChatService,
    private val authService: AuthService,
    private val socketManager: ChatSocketManager
) : ViewModel() {

    private val _rooms = MutableStateFlow<List<ChatRoom>>(emptyList())
    val rooms: StateFlow<List<ChatRoom>> = _rooms

    private val _totalUnread = MutableStateFlow(0)
    val totalUnread: StateFlow<Int> = _totalUnread

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage

    val groupRooms: Flow<List<ChatRoom>> = _rooms.map { it.filter { r -> r.isGroupChat } }
    val dmRooms: Flow<List<ChatRoom>> = _rooms.map { it.filter { r -> !r.isGroupChat } }

    fun loadRooms() {
        viewModelScope.launch {
            _isLoading.value = true
            when (val result = safeApiCall { chatService.getChatRooms() }) {
                is ApiResult.Success -> {
                    _rooms.value = result.data.rooms
                    _totalUnread.value = result.data.totalUnread
                }
                is ApiResult.Error -> _errorMessage.value = "채팅방을 불러올 수 없습니다."
                is ApiResult.NetworkError -> _errorMessage.value = "네트워크 연결을 확인해주세요."
            }
            _isLoading.value = false
        }
    }

    // MARK: - Chat Room

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages

    private val _inputText = MutableStateFlow("")
    val inputText: StateFlow<String> = _inputText

    private val _hasMore = MutableStateFlow(true)
    val hasMore: StateFlow<Boolean> = _hasMore

    private var currentRoom: ChatRoom? = null

    fun setInputText(text: String) { _inputText.value = text }

    fun enterRoom(room: ChatRoom) {
        currentRoom = room
        socketManager.connect()

        viewModelScope.launch {
            socketManager.newMessage.collect { msg ->
                if (msg.scrIdx == room.scrIdx) {
                    _messages.value = _messages.value + msg
                    socketManager.sendReadUpdate(room.scrIdx, msg.scmsgIdx)
                }
            }
        }
        viewModelScope.launch {
            socketManager.readReceipt.collect { event ->
                if (event.scrIdx == room.scrIdx) {
                    _messages.value = _messages.value.map {
                        if (it.scmsgIdx == event.scmsgIdx) it.copy(unreadCount = event.unreadCount) else it
                    }
                }
            }
        }

        loadMessages(room.scrIdx)
    }

    private fun loadMessages(scrIdx: Int) {
        viewModelScope.launch {
            when (val result = safeApiCall { chatService.getMessages(scrIdx) }) {
                is ApiResult.Success -> {
                    _messages.value = result.data
                    _hasMore.value = result.data.size >= 50
                    socketManager.joinRoom(scrIdx)
                    result.data.lastOrNull()?.let {
                        socketManager.sendReadUpdate(scrIdx, it.scmsgIdx)
                    }
                }
                else -> Log.e("ChatVM", "loadMessages failed")
            }
        }
    }

    fun loadMore() {
        val room = currentRoom ?: return
        val firstMsg = _messages.value.firstOrNull() ?: return
        viewModelScope.launch {
            when (val result = safeApiCall { chatService.getMessages(room.scrIdx, firstMsg.scmsgIdx) }) {
                is ApiResult.Success -> {
                    _messages.value = result.data + _messages.value
                    _hasMore.value = result.data.size >= 50
                }
                else -> {}
            }
        }
    }

    fun sendMessage() {
        val text = _inputText.value.trim()
        val room = currentRoom ?: return
        if (text.isEmpty()) return
        _inputText.value = ""
        socketManager.sendMessage(room.scrIdx, text)
    }

    fun leaveRoom() {
        currentRoom?.let { socketManager.leaveRoom(it.scrIdx) }
        currentRoom = null
        _messages.value = emptyList()
    }

    fun getCurrentUserIdx(): Int = authService.getMtIdx()

    fun createDM(targetMtIdx: Int, onSuccess: (Int) -> Unit) {
        viewModelScope.launch {
            when (val result = safeApiCall { chatService.createDMRoom(targetMtIdx) }) {
                is ApiResult.Success -> onSuccess(result.data.scrIdx)
                is ApiResult.Error -> _errorMessage.value = "채팅방 생성에 실패했습니다."
                is ApiResult.NetworkError -> _errorMessage.value = "네트워크 연결을 확인해주세요."
            }
        }
    }
}
