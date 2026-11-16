package com.dmonster.smap.ui.group

import org.junit.Assert.assertEquals
import org.junit.Test

class InviteCodeParserTest {
    @Test
    fun `초대 메시지 전체를 붙여 넣으면 코드만 남는다`() {
        val message = "[SMAP] 우리 가족 그룹에 초대합니다!\n초대 코드: 5JDZRMNVEV\n링크: https://nextstep.aiagnt.kr/group/12/join?code=5JDZRMNVEV"
        assertEquals("5JDZRMNVEV", InviteCodeParser.extract(message))
    }

    @Test
    fun `링크만 붙여 넣으면 code 값을 쓴다`() {
        assertEquals("AB12CD34", InviteCodeParser.extract("https://nextstep.aiagnt.kr/group/3/join?code=ab12cd34"))
    }

    @Test
    fun `코드 뒤 값을 쓴다`() {
        assertEquals("XY9876", InviteCodeParser.extract("코드:XY9876 입니다"))
    }

    @Test
    fun `대문자 낱말이 하나면 그 낱말을 쓴다`() {
        assertEquals("QWER1234", InviteCodeParser.extract("이걸로 들어와 QWER1234 ㅎㅎ"))
    }

    @Test
    fun `코드만 붙여 넣으면 대문자로 정리한다`() {
        assertEquals("5JDZ", InviteCodeParser.extract(" 5jdz "))
    }

    @Test
    fun `초대와 무관한 긴 글이면 null`() {
        assertEquals(null, InviteCodeParser.extract("오늘 저녁 뭐 먹을까요? display flex gap twelve pixels"))
    }

    @Test
    fun `색상값은 코드로 보지 않는다`() {
        assertEquals(null, InviteCodeParser.extract("color: #444444; background: #FFFFFF; margin: 0 auto;"))
    }

    @Test
    fun `직접 칠 때는 영문 대문자와 숫자만 남긴다`() {
        assertEquals("AB3", InviteCodeParser.sanitize("a-b 3한"))
    }
}
