package com.dmonster.smap.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.theme.SmapRadius
import com.dmonster.smap.ui.theme.SmapSize
import com.dmonster.smap.ui.theme.SmapSpacing
import com.dmonster.smap.ui.theme.SmapText

/**
 * 앱 공용 입력창 — iOS `SMAPTextField` 와 같은 규격.
 *
 * 위: 라벨(14 Medium, 보조 글자색) / 가운데: 회색으로 채운 52dp 칸(모서리 12, 평소 테두리 없음,
 * 포커스 시 강조색 1dp·오류 시 오류색 1dp 테두리, 글자 16) / 아래: 도움말·오류(12).
 * 예전에는 Material 외곽선 입력창(흰 칸 + 회색 테두리 + 안에서 떠오르는 라벨 + 앞 아이콘)이라
 * iOS 와 모양이 달랐다(2026-11-17 "iOS 스타일로 입력칸 통일").
 *
 * 오류를 토스트가 아니라 입력창 바로 아래에 두어 어느 칸이 문제인지 알 수 있게 한다.
 * [label] 이 없으면 라벨 줄 없이 칸만 보인다(로그인 화면처럼 안내 글자만으로 충분한 곳).
 */
@Composable
fun SmapTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String?,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    trailingContent: (@Composable () -> Unit)? = null,
    helperText: String? = null,
    errorText: String? = null,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    singleLine: Boolean = true,
    keyboardType: KeyboardType = KeyboardType.Text,
    imeAction: ImeAction = ImeAction.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
) {
    val colors = MaterialTheme.colorScheme
    val isError = errorText != null
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()
    val shape = RoundedCornerShape(SmapRadius.md)
    val palette = inputPalette()
    val borderColor = when {
        isError -> colors.error
        isFocused && !readOnly -> colors.primary
        else -> Color.Transparent
    }
    val textColor = if (enabled) colors.onSurface else colors.onSurface.copy(alpha = 0.38f)

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(SmapSpacing.xs)) {
        if (label != null) {
            Text(text = label, style = SmapText.captionMedium, color = colors.onSurfaceVariant)
        }

        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            enabled = enabled,
            readOnly = readOnly,
            singleLine = singleLine,
            textStyle = SmapText.body.copy(color = textColor),
            cursorBrush = SolidColor(colors.primary),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction),
            keyboardActions = keyboardActions,
            visualTransformation = visualTransformation,
            interactionSource = interactionSource,
            decorationBox = { innerTextField ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .defaultMinSize(minHeight = SmapSize.buttonHeight)
                        .clip(shape)
                        .background(palette.container)
                        .border(1.dp, borderColor, shape)
                        .padding(start = SmapSpacing.md, end = if (trailingContent != null) 0.dp else SmapSpacing.md),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .padding(vertical = if (singleLine) 0.dp else 14.dp),
                        contentAlignment = Alignment.CenterStart,
                    ) {
                        if (value.isEmpty() && placeholder != null) {
                            Text(text = placeholder, style = SmapText.body, color = palette.placeholder, maxLines = if (singleLine) 1 else Int.MAX_VALUE)
                        }
                        innerTextField()
                    }
                    if (trailingContent != null) {
                        CompositionLocalProvider(LocalContentColor provides colors.onSurfaceVariant) {
                            trailingContent()
                        }
                    }
                }
            },
        )

        val supporting = errorText ?: helperText
        if (supporting != null) {
            Text(
                text = supporting,
                style = SmapText.captionSmall,
                color = if (isError) colors.error else colors.onSurfaceVariant,
            )
        }
    }
}

/** 비밀번호 입력창 — 보기/숨기기 토글을 포함한다(iOS SMAPTextField isSecure 와 같은 눈 모양 아이콘). */
@Composable
fun SmapPasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String?,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    helperText: String? = null,
    errorText: String? = null,
    enabled: Boolean = true,
    imeAction: ImeAction = ImeAction.Done,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
) {
    var visible by rememberSaveable { mutableStateOf(false) }
    SmapTextField(
        value = value,
        onValueChange = onValueChange,
        label = label,
        modifier = modifier,
        placeholder = placeholder,
        trailingContent = {
            IconButton(onClick = { visible = !visible }) {
                Icon(
                    imageVector = if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                    contentDescription = if (visible) "비밀번호 숨기기" else "비밀번호 보기",
                    modifier = Modifier.size(22.dp),
                )
            }
        },
        helperText = helperText,
        errorText = errorText,
        enabled = enabled,
        keyboardType = KeyboardType.Password,
        imeAction = imeAction,
        keyboardActions = keyboardActions,
        visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
    )
}

/** 입력 칸 바탕·안내 글자색 — iOS systemGray6 / placeholderText 와 같은 값(라이트·다크). */
private data class InputPalette(val container: Color, val placeholder: Color)

@Composable
private fun inputPalette(): InputPalette =
    if (MaterialTheme.colorScheme.surface.luminance() < 0.5f) {
        InputPalette(container = Color(0xFF1C1C1E), placeholder = Color(0x4DEBEBF5))
    } else {
        InputPalette(container = Color(0xFFF2F2F7), placeholder = Color(0x4D3C3C43))
    }
