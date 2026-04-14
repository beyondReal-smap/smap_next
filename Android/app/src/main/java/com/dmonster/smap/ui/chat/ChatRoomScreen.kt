package com.dmonster.smap.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.data.model.ChatMessage
import com.dmonster.smap.data.model.ChatRoom
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

@Composable
fun ChatRoomScreen(
    room: ChatRoom,
    viewModel: ChatViewModel,
    onBack: () -> Unit
) {
    val messages by viewModel.messages.collectAsState()
    val inputText by viewModel.inputText.collectAsState()
    val hasMore by viewModel.hasMore.collectAsState()
    val listState = rememberLazyListState()
    val currentUserIdx = viewModel.getCurrentUserIdx()

    LaunchedEffect(room) { viewModel.enterRoom(room) }
    DisposableEffect(Unit) { onDispose { viewModel.leaveRoom() } }

    // Auto scroll to bottom on new messages
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(Color.White)) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().background(Color.White)
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "뒤로")
            }
            Column {
                Text(room.displayTitle, fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                Text("${room.memberCount}명", fontFamily = SuiteFont, fontSize = 12.sp, color = Color.Gray)
            }
        }
        HorizontalDivider(color = Color.Gray.copy(0.1f))

        // Messages
        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            state = listState,
            contentPadding = PaddingValues(vertical = 8.dp)
        ) {
            if (hasMore) {
                item {
                    TextButton(
                        onClick = { viewModel.loadMore() },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("이전 메시지 불러오기", fontFamily = SuiteFont, fontSize = 13.sp, color = BrandColors.Primary)
                    }
                }
            }
            items(messages, key = { it.scmsgIdx }) { message ->
                val isMe = message.mtIdx == currentUserIdx
                val msgIndex = messages.indexOf(message)
                val showProfile = !isMe && (msgIndex == 0 || messages[msgIndex - 1].mtIdx != message.mtIdx)
                MessageBubble(message = message, isMe = isMe, showProfile = showProfile)
            }
        }

        // Input bar
        HorizontalDivider(color = Color.Gray.copy(0.1f))
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = inputText,
                onValueChange = { viewModel.setInputText(it) },
                placeholder = { Text("메시지를 입력하세요", fontFamily = SuiteFont, fontSize = 15.sp) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(20.dp),
                maxLines = 4,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = BrandColors.Primary,
                    unfocusedBorderColor = Color.Gray.copy(0.3f)
                )
            )
            Spacer(Modifier.width(8.dp))
            IconButton(
                onClick = { viewModel.sendMessage() },
                enabled = inputText.trim().isNotEmpty()
            ) {
                Icon(Icons.Filled.Send, "전송",
                    tint = if (inputText.trim().isNotEmpty()) BrandColors.Primary else Color.Gray)
            }
        }
    }
}

@Composable
private fun MessageBubble(message: ChatMessage, isMe: Boolean, showProfile: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 2.dp),
        horizontalArrangement = if (isMe) Arrangement.End else Arrangement.Start,
        verticalAlignment = Alignment.Bottom
    ) {
        if (!isMe) {
            if (showProfile) {
                Box(
                    modifier = Modifier.size(32.dp).clip(CircleShape).background(Color.Gray.copy(0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text((message.mtNickname ?: "?").take(1), fontSize = 14.sp, color = Color.Gray)
                }
            } else {
                Spacer(Modifier.width(32.dp))
            }
            Spacer(Modifier.width(6.dp))
        }

        Column(horizontalAlignment = if (isMe) Alignment.End else Alignment.Start) {
            if (showProfile && !isMe) {
                Text(message.mtNickname ?: "알 수 없음", fontFamily = SuiteFont, fontSize = 12.sp,
                    fontWeight = FontWeight.Medium, color = Color.Gray,
                    modifier = Modifier.padding(start = 4.dp, bottom = 2.dp))
            }

            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = if (isMe) Arrangement.End else Arrangement.Start) {
                if (isMe) { MessageInfo(message, isMe) }

                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = if (isMe) BrandColors.Primary else Color(0xFFF0F0F0)
                ) {
                    Text(
                        message.scmsgContent,
                        fontFamily = SuiteFont, fontSize = 15.sp,
                        color = if (isMe) Color.White else Color.Black,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                            .widthIn(max = 240.dp)
                    )
                }

                if (!isMe) { MessageInfo(message, isMe) }
            }
        }

        if (isMe) { Spacer(Modifier.width(0.dp)) }
    }
}

@Composable
private fun MessageInfo(message: ChatMessage, isMe: Boolean) {
    Column(
        modifier = Modifier.padding(horizontal = 4.dp),
        horizontalAlignment = if (isMe) Alignment.End else Alignment.Start
    ) {
        if (message.unreadCount > 0) {
            Text("${message.unreadCount}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = BrandColors.Primary)
        }
        // Time parsing simplified
        val timeStr = message.scmsgWdate.let {
            if (it.length >= 16) it.substring(11, 16) else ""
        }
        Text(timeStr, fontSize = 10.sp, color = Color.Gray)
    }
}
