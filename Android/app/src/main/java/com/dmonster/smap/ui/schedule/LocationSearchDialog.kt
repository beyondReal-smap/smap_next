package com.dmonster.smap.ui.schedule

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.PinDrop
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dmonster.smap.data.service.KakaoLocationService
import com.dmonster.smap.data.service.KakaoPlace
import com.dmonster.smap.ui.theme.BrandColors
import com.dmonster.smap.ui.theme.SuiteFont
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationSearchDialog(
    onDismiss: () -> Unit,
    onSelect: (KakaoPlace) -> Unit
) {
    var query by remember { mutableStateOf("") }
    var places by remember { mutableStateOf<List<KakaoPlace>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val service = remember { KakaoLocationService() }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFFF2F2F7),
        tonalElevation = 0.dp,
        dragHandle = { BottomSheetDefaults.DragHandle() },
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = Color(0xFFF2F2F7),
            tonalElevation = 0.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 16.dp)
            ) {
            // Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "장소 검색",
                    fontSize = 18.sp,
                    fontFamily = SuiteFont,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.CenterEnd)
                ) {
                    Icon(Icons.Default.Close, contentDescription = "닫기")
                }
            }

            // Search Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text("지번, 도로명, 건물명 검색", fontFamily = SuiteFont) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    leadingIcon = {
                        Icon(Icons.Default.Search, null, tint = BrandColors.Primary)
                    },
                    trailingIcon = {
                        if (query.isNotEmpty()) {
                            IconButton(onClick = { query = "" }) {
                                Icon(Icons.Default.Close, null, tint = Color.Gray, modifier = Modifier.size(20.dp))
                            }
                        }
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White,
                        focusedBorderColor = BrandColors.Primary.copy(alpha = 0.2f),
                        unfocusedBorderColor = Color.Transparent
                    ),
                    singleLine = true
                )

                Button(
                    onClick = {
                        if (query.isNotBlank()) {
                            scope.launch {
                                isLoading = true
                                places = service.searchLocation(query)
                                isLoading = false
                            }
                        }
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (query.isBlank()) Color.LightGray else BrandColors.Primary
                    ),
                    modifier = Modifier.height(52.dp)
                ) {
                    Text("검색", fontFamily = SuiteFont, fontWeight = FontWeight.Bold)
                }
            }

            Divider(color = Color.Gray.copy(alpha = 0.1f))

            // Result List
            Box(modifier = Modifier.weight(1f)) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center),
                        color = BrandColors.Primary
                    )
                } else if (places.isEmpty()) {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = Color.White,
                            shadowElevation = 4.dp
                        ) {
                            Icon(
                                imageVector = if (query.isEmpty()) Icons.Default.LocationOn else Icons.Default.Search,
                                contentDescription = null,
                                modifier = Modifier.padding(24.dp).size(40.dp),
                                tint = BrandColors.Primary.copy(alpha = 0.6f)
                            )
                        }
                        Spacer(modifier = Modifier.height(20.dp))
                        Text(
                            text = if (query.isEmpty()) "어디를 찾으시나요?" else "검색 결과 없음",
                            fontFamily = SuiteFont,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = if (query.isEmpty()) 
                                "지번, 도로명 혹은 건물명을 입력하여\n원하는 장소를 검색해 보세요."
                                else "'$query'에 대한 검색 결과가 없습니다.\n다른 검색어를 입력해 보세요.",
                            fontFamily = SuiteFont,
                            fontSize = 14.sp,
                            color = Color.Gray,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        item {
                            Text(
                                text = "검색 결과 ${places.size}건",
                                fontFamily = SuiteFont,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.Gray,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )
                        }
                        items(places) { place ->
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onSelect(place) },
                                shape = RoundedCornerShape(16.dp),
                                color = Color.White,
                                shadowElevation = 2.dp,
                                tonalElevation = 0.dp
                            ) {
                                Row(
                                    modifier = Modifier.padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                                ) {
                                    Surface(
                                        shape = CircleShape,
                                        color = BrandColors.Primary.copy(alpha = 0.1f),
                                        modifier = Modifier.size(40.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.PinDrop,
                                            contentDescription = null,
                                            modifier = Modifier.padding(8.dp),
                                            tint = BrandColors.Primary
                                        )
                                    }

                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = place.placeName,
                                            fontFamily = SuiteFont,
                                            fontSize = 16.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.Black
                                        )
                                        Text(
                                            text = place.roadAddressName.ifBlank { place.addressName },
                                            fontFamily = SuiteFont,
                                            fontSize = 13.sp,
                                            color = Color.Gray
                                        )
                                    }

                                    Icon(
                                        Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                        null,
                                        tint = Color.Gray.copy(alpha = 0.3f),
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    }
}
