package com.dmonster.smap.ui.login

import com.dmonster.smap.data.model.SocialLoginResponse
import org.junit.Assert.assertEquals
import org.junit.Test

class SocialLoginMessageTest {
    private val serverMessage = "이미 이 이메일로 가입된 계정이 있어요. 이메일과 비밀번호로 로그인해 주세요."

    @Test fun `server message is shown as is`() {
        val response = SocialLoginResponse(success = false, message = serverMessage)
        assertEquals(serverMessage, socialLoginFailureMessage(response, "google"))
        assertEquals(serverMessage, socialLoginFailureMessage(response, "kakao"))
    }

    @Test fun `blank message falls back to error then provider text`() {
        assertEquals("E", socialLoginFailureMessage(SocialLoginResponse(success = false, message = " ", error = "E"), "google"))
        assertEquals("KAKAO 로그인에 실패했습니다.", socialLoginFailureMessage(SocialLoginResponse(success = false), "kakao"))
    }
}
