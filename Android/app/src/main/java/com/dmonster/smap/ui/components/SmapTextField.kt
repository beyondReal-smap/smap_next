package com.dmonster.smap.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.dmonster.smap.ui.theme.SmapRadius
import com.dmonster.smap.ui.theme.SmapText
import com.dmonster.smap.ui.theme.SmapTextStyle

/**
 * 앱 공용 입력창.
 *
 * 색을 모두 colorScheme 에서 가져온다. 기존 화면은 배경을 흰색으로 고정하고 글자색은
 * Material 기본값을 써서, 다크 모드에서 흰 배경에 흰 글자가 될 수 있었다.
 *
 * [errorText] 가 있으면 테두리와 도움말이 오류 색으로 바뀌고, 없으면 [helperText] 를 보여준다.
 * 오류를 토스트가 아니라 입력창 바로 아래에 두어 어느 칸이 문제인지 알 수 있게 한다.
 */
@Composable
fun SmapTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    leadingIcon: ImageVector? = null,
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
    Column(modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text(label) },
            placeholder = placeholder?.let { { Text(it, style = SmapTextStyle.inputPlaceholder.copy(color = colors.onSurfaceVariant)) } },
            leadingIcon = leadingIcon?.let { { Icon(it, contentDescription = null) } },
            trailingIcon = trailingContent,
            isError = isError,
            enabled = enabled,
            readOnly = readOnly,
            singleLine = singleLine,
            textStyle = SmapTextStyle.inputText,
            shape = RoundedCornerShape(SmapRadius.md),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction),
            keyboardActions = keyboardActions,
            visualTransformation = visualTransformation,
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = colors.onSurface,
                unfocusedTextColor = colors.onSurface,
                focusedContainerColor = colors.surface,
                unfocusedContainerColor = colors.surface,
                disabledContainerColor = colors.surfaceVariant,
                focusedBorderColor = colors.primary,
                unfocusedBorderColor = colors.outline,
                focusedLeadingIconColor = colors.primary,
                unfocusedLeadingIconColor = colors.onSurfaceVariant,
                focusedLabelColor = colors.primary,
                unfocusedLabelColor = colors.onSurfaceVariant,
                cursorColor = colors.primary,
            ),
        )
        val supporting = errorText ?: helperText
        if (supporting != null) {
            Text(
                text = supporting,
                style = SmapText.caption,
                color = if (isError) colors.error else colors.onSurfaceVariant,
                modifier = Modifier.padding(start = 4.dp, top = 6.dp),
            )
        }
    }
}

/** 비밀번호 입력창 — 보기/숨기기 토글을 포함한다. */
@Composable
fun SmapPasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
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
        leadingIcon = leadingIcon,
        trailingContent = {
            IconButton(onClick = { visible = !visible }) {
                Icon(
                    imageVector = if (visible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                    contentDescription = if (visible) "비밀번호 숨기기" else "비밀번호 보기",
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
