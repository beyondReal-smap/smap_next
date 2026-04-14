package com.dmonster.smap.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// =========================================================================
// Chat Room
// =========================================================================

@Serializable
data class ChatRoom(
    @SerialName("scr_idx") val scrIdx: Int,
    @SerialName("sgt_idx") val sgtIdx: Int? = null,
    @SerialName("scr_type") val scrType: String = "group",
    @SerialName("scr_title") val scrTitle: String? = null,
    @SerialName("scr_udate") val scrUdate: String? = null,
    @SerialName("unread_count") val unreadCount: Int = 0,
    @SerialName("last_message") val lastMessage: String? = null,
    @SerialName("last_message_time") val lastMessageTime: String? = null,
    @SerialName("member_count") val memberCount: Int = 0,
    @SerialName("dm_target_nickname") val dmTargetNickname: String? = null,
    @SerialName("dm_target_file1") val dmTargetFile1: String? = null
) {
    val isGroupChat: Boolean get() = scrType == "group"

    val displayTitle: String
        get() = if (isGroupChat) scrTitle ?: "그룹 채팅" else dmTargetNickname ?: "1:1 채팅"
}

@Serializable
data class ChatRoomListResponse(
    val rooms: List<ChatRoom>,
    @SerialName("total_unread") val totalUnread: Int = 0
)

// =========================================================================
// Chat Message
// =========================================================================

@Serializable
data class ChatMessage(
    @SerialName("scmsg_idx") val scmsgIdx: Int,
    @SerialName("scr_idx") val scrIdx: Int,
    @SerialName("mt_idx") val mtIdx: Int,
    @SerialName("mt_nickname") val mtNickname: String? = null,
    @SerialName("mt_file1") val mtFile1: String? = null,
    @SerialName("scmsg_type") val scmsgType: String = "text",
    @SerialName("scmsg_content") val scmsgContent: String,
    @SerialName("scmsg_wdate") val scmsgWdate: String,
    @SerialName("unread_count") var unreadCount: Int = 0
)

// =========================================================================
// Requests
// =========================================================================

@Serializable
data class CreateDMRequest(
    @SerialName("target_mt_idx") val targetMtIdx: Int
)

@Serializable
data class CreateDMResponse(
    @SerialName("scr_idx") val scrIdx: Int,
    @SerialName("is_new") val isNew: Boolean = false
)
