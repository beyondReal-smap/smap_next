package com.dmonster.smap.ui.group

/**
 * 초대 메시지·링크에서 초대 코드만 꺼낸다 (iOS InviteCodeParser 와 같은 규칙).
 *
 * 코드는 대개 카카오톡·문자로 받은 초대 메시지에서 복사해 넣는다. 메시지 전체를 붙여 넣으면 링크의 영문·숫자까지
 * 붙어 엉뚱한 코드가 됐다. 메시지 형식:
 * "[SMAP] OO 그룹에 초대합니다!\n초대 코드: 5JDZRMNVEV\n링크: https://…/group/12/join?code=5JDZRMNVEV"
 */
object InviteCodeParser {
    private val patterns = listOf(
        Regex("""[?&]code=([A-Za-z0-9]+)"""),                       // 1) 링크의 code= 값
        Regex("""코드\s*[:：]?\s*([A-Za-z0-9]+)"""),                 // 2) "코드:" 뒤 값
        Regex("""(?<![A-Za-z0-9#])([A-Z0-9]{6,12})(?![A-Za-z0-9])"""), // 3) 대문자·숫자 6~12자 낱말(주소의 소문자 낱말·#색상값 제외)
    )

    /** 영문 대문자·숫자만 남긴다 */
    fun sanitize(text: String): String = text.uppercase().filter { it in 'A'..'Z' || it in '0'..'9' }

    /**
     * 위 규칙 순서로 찾고, 다 아니면 전체를 거른 값이 코드 길이(4~12자)일 때만.
     * 초대와 무관한 긴 글이면 null — 입력창을 그대로 둔다(엉뚱한 글자로 채우지 않게).
     */
    fun extract(text: String): String? {
        for (pattern in patterns) {
            pattern.find(text)?.let { return sanitize(it.groupValues[1]) }
        }
        return sanitize(text).takeIf { it.length in 4..12 }
    }
}
