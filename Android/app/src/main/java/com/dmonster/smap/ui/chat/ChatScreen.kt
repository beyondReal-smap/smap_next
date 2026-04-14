package com.dmonster.smap.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dmonster.smap.data.model.ChatRoom
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

@Composable
fun ChatScreen(
    viewModel: ChatViewModel = hiltViewModel(),
    onRoomClick: (ChatRoom) -> Unit = {}
) {
    val rooms by viewModel.rooms.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val groupRooms by viewModel.groupRooms.collectAsState(emptyList())
    val dmRooms by viewModel.dmRooms.collectAsState(emptyList())

    LaunchedEffect(Unit) { viewModel.loadRooms() }

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFFF8FAFF))) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("채팅", fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                Text("${rooms.size}개의 채팅방", fontFamily = SuiteFont, fontSize = 13.sp, color = Color.Gray)
            }
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { /* TODO: show NewDM */ }) {
                Icon(Icons.Filled.Edit, "새 채팅", tint = BrandColors.Primary)
            }
        }

        when {
            isLoading && rooms.isEmpty() -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = BrandColors.Primary)
                }
            }
            rooms.isEmpty() -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.Chat, null, modifier = Modifier.size(48.dp), tint = Color.Gray.copy(0.4f))
                        Spacer(Modifier.height(16.dp))
                        Text("채팅이 없습니다", fontFamily = SuiteFont, fontSize = 17.sp, color = Color.Gray)
                        Spacer(Modifier.height(8.dp))
                        Text("그룹에 참여하면 그룹 채팅이 자동으로 생성됩니다",
                            fontFamily = SuiteFont, fontSize = 14.sp, color = Color.Gray.copy(0.7f))
                    }
                }
            }
            else -> {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    if (groupRooms.isNotEmpty()) {
                        item { SectionHeader("그룹 채팅", groupRooms.size) }
                        items(groupRooms, key = { it.scrIdx }) { room ->
                            ChatRoomItem(room = room, onClick = { onRoomClick(room) })
                        }
                    }
                    if (dmRooms.isNotEmpty()) {
                        item { SectionHeader("1:1 채팅", dmRooms.size) }
                        items(dmRooms, key = { it.scrIdx }) { room ->
                            ChatRoomItem(room = room, onClick = { onRoomClick(room) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String, count: Int) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(title, fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color.Gray)
        Spacer(Modifier.width(6.dp))
        Text("$count", fontFamily = SuiteFont, fontSize = 12.sp, color = Color.White,
            modifier = Modifier.background(Color.Gray.copy(0.4f), CircleShape).padding(horizontal = 8.dp, vertical = 2.dp))
    }
}

@Composable
private fun ChatRoomItem(room: ChatRoom, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Avatar
        Box(
            modifier = Modifier.size(50.dp).clip(CircleShape)
                .background(if (room.isGroupChat) BrandColors.Primary.copy(0.1f) else Color(0xFFFFF3E0)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                if (room.isGroupChat) Icons.Filled.Groups else Icons.Filled.Person,
                null, tint = if (room.isGroupChat) BrandColors.Primary else Color(0xFFFF9800),
                modifier = Modifier.size(22.dp)
            )
        }
        Spacer(Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(room.displayTitle, fontFamily = SuiteFont, fontWeight = FontWeight.Medium,
                    fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            }
            Spacer(Modifier.height(4.dp))
            Text(room.lastMessage ?: "메시지가 없습니다", fontFamily = SuiteFont, fontSize = 14.sp,
                color = Color.Gray, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(8.dp))

        Column(horizontalAlignment = Alignment.End) {
            // Unread badge
            if (room.unreadCount > 0) {
                Text(
                    if (room.unreadCount > 99) "99+" else "${room.unreadCount}",
                    fontFamily = SuiteFont, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color.White,
                    modifier = Modifier.background(Color.Red, RoundedCornerShape(10.dp))
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                )
            }
        }
    }
}
