package com.dmonster.smap.data.service

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class ServerGuidanceMessageTest {
    private fun http(code: Int, body: String) =
        HttpException(Response.error<Any>(code, body.toResponseBody("application/json".toMediaType())))

    @Test fun `400 detail is passed through`() {
        assertEquals("계정을 특정할 수 없습니다. 고객센터에 문의해주세요.",
            serverGuidanceMessage(http(400, """{"detail":"계정을 특정할 수 없습니다. 고객센터에 문의해주세요."}""")))
    }

    @Test fun `429 uses detail or generic wait text`() {
        assertEquals("잠시 후 다시", serverGuidanceMessage(http(429, """{"detail":"잠시 후 다시"}""")))
        assertEquals("시도 횟수가 많습니다. 잠시 후 다시 시도해주세요.", serverGuidanceMessage(http(429, """{"detail":{"retry_after":30}}""")))
    }

    @Test fun `other statuses and network errors return null`() {
        assertNull(serverGuidanceMessage(http(401, """{"detail":"x"}""")))
        assertNull(serverGuidanceMessage(http(422, "{}")))
        assertNull(serverGuidanceMessage(java.io.IOException("x")))
        assertNull(serverGuidanceMessage(http(400, "not json")))
    }
}
