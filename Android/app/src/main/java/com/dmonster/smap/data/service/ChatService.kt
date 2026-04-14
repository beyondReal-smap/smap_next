package com.dmonster.smap.data.service

import android.util.Log
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.*

/**
 * Chat service (delegates to SmapApi via Retrofit).
 */
class ChatService(private val api: SmapApi) {

    companion object {
        private const val TAG = "ChatService"
    }

    suspend fun getChatRooms(): ChatRoomListResponse {
        val response = api.getChatRooms()
        Log.d(TAG, "[getChatRooms] ${response.rooms.size} rooms, unread: ${response.totalUnread}")
        return response
    }

    suspend fun getMessages(scrIdx: Int, before: Int? = null, limit: Int = 50): List<ChatMessage> {
        val messages = api.getChatMessages(scrIdx, before, limit)
        Log.d(TAG, "[getMessages] ${messages.size} messages for room $scrIdx")
        return messages
    }

    suspend fun createDMRoom(targetMtIdx: Int): CreateDMResponse {
        val response = api.createDMRoom(CreateDMRequest(targetMtIdx))
        Log.d(TAG, "[createDMRoom] scr_idx: ${response.scrIdx}, isNew: ${response.isNew}")
        return response
    }
}
