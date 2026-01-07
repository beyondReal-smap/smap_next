package com.dmonster.smap.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont

@Composable
fun LocationPermissionDialog(
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = BrandColors.Primary,
                    modifier = Modifier.size(48.dp)
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    text = "위치 정보 액세스 안내",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = SuiteFont,
                    textAlign = TextAlign.Center
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    text = "SMAP은 앱이 닫혀 있을 때나 사용 중이 아닐 때도 '활동 로그' 기록 및 '그룹 멤버와 실시간 위치 공유' 기능을 지원하기 위해 위치 데이터를 수집합니다.\n\n앱을 정상적으로 사용하려면 위치 권한을 '항상 허용'으로 설정해 주세요.\n\n수집된 위치 정보는 서비스 제공 목적 이외에 다른 용도로 사용되지 않습니다.",
                    style = TextStyle(
                        fontSize = 14.sp,
                        fontFamily = SuiteFont,
                        color = Color.Gray,
                        textAlign = TextAlign.Center,
                        lineHeight = 20.sp,
                        lineBreak = LineBreak(
                            strategy = LineBreak.Strategy.HighQuality,
                            strictness = LineBreak.Strictness.Normal,
                            wordBreak = LineBreak.WordBreak.Phrase
                        )
                    )
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("나중에", fontFamily = SuiteFont)
                    }
                    
                    Button(
                        onClick = onConfirm,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = BrandColors.Primary)
                    ) {
                        Text("설정하기", fontFamily = SuiteFont, color = Color.White)
                    }
                }
            }
        }
    }
}

@Composable
fun BackgroundLocationGuideDialog(
    onConfirm: () -> Unit
) {
    Dialog(
        onDismissRequest = {},
        properties = DialogProperties(
            dismissOnBackPress = false,
            dismissOnClickOutside = false,
            usePlatformDefaultWidth = false
        )
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "백그라운드 위치 설정 안내",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = SuiteFont,
                    textAlign = TextAlign.Center
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    text = "이동 경로 자동 기록을 위해 이어지는 시스템 설정 화면에서 반드시 권한을 '항상 허용'으로 변경해 주세요.",
                    style = TextStyle(
                        fontSize = 14.sp,
                        fontFamily = SuiteFont,
                        color = Color.DarkGray,
                        textAlign = TextAlign.Center,
                        lineHeight = 20.sp,
                        lineBreak = LineBreak(
                            strategy = LineBreak.Strategy.HighQuality,
                            strictness = LineBreak.Strictness.Normal,
                            wordBreak = LineBreak.WordBreak.Phrase
                        )
                    )
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Button(
                    onClick = onConfirm,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = BrandColors.Primary)
                ) {
                    Text("네, 알겠습니다", fontFamily = SuiteFont, color = Color.White)
                }
            }
        }
    }
}
