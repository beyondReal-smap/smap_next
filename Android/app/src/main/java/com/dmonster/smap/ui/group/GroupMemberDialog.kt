package com.dmonster.smap.ui.group

import com.dmonster.smap.BuildConfig
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import com.dmonster.smap.data.model.SmapGroupMember
import com.dmonster.smap.ui.theme.SuiteFont

// MARK: - Member Manage Dialog

@Composable
fun MemberManageDialog(
    member: SmapGroupMember,
    onDismiss: () -> Unit,
    onChangeRole: (Boolean) -> Unit,
    onRemove: () -> Unit,
    isLoading: Boolean
) {
    val isLeader = member.sgdtLeaderChk == "Y"

    // Resolve avatar URL
    val imageUrl = androidx.compose.runtime.remember(member.mtFile1) {
        if (!member.mtFile1.isNullOrBlank()) {
            when {
                member.mtFile1.startsWith("http") -> member.mtFile1
                member.mtFile1.startsWith("/images/") -> "${BuildConfig.IMAGE_BASE_URL}${member.mtFile1}"
                member.mtFile1.startsWith("/") -> "${BuildConfig.IMAGE_BASE_URL}/images${member.mtFile1}"
                else -> "${BuildConfig.IMAGE_BASE_URL}/images/${member.mtFile1}"
            }
        } else null
    }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .wrapContentHeight(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Member Avatar
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .background(Color.Gray.copy(alpha = 0.1f), shape = CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    if (imageUrl != null) {
                        AsyncImage(
                            model = imageUrl,
                            contentDescription = null,
                            modifier = Modifier
                                .fillMaxSize()
                                .clip(CircleShape),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = Color.Gray,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = member.displayName,
                    fontSize = 18.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = if (isLeader) "리더" else "멤버",
                    fontSize = 13.sp,
                    fontFamily = SuiteFont,
                    color = Color.Gray
                )

                Spacer(modifier = Modifier.height(14.dp))

                // Role Toggle
                Button(
                    onClick = { onChangeRole(!isLeader) },
                    enabled = !isLoading,
                    modifier = Modifier.fillMaxWidth().height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isLeader) Color.Gray else Color(0xFF3B82F6)
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.Star,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (isLeader) "리더 해제" else "리더로 지정",
                        fontFamily = SuiteFont
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Remove Button
                OutlinedButton(
                    onClick = onRemove,
                    enabled = !isLoading,
                    modifier = Modifier.fillMaxWidth().height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = Color.Red
                    )
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = Color.Red,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.PersonRemove,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("그룹에서 내보내기", fontFamily = SuiteFont)
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                TextButton(onClick = onDismiss) {
                    Text("닫기", fontFamily = SuiteFont, color = Color.Gray)
                }
            }
        }
    }
}
