package com.dmonster.smap.data.api

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.Assert.*
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import okhttp3.MediaType.Companion.toMediaType

class SmapApiTest {
    private lateinit var server: MockWebServer
    private lateinit var api: SmapApi

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()

        val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; isLenient = true }
        val retrofit = Retrofit.Builder()
            .baseUrl(server.url("/"))
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
        api = retrofit.create(SmapApi::class.java)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `getCurrentUserGroups returns list`() = runTest {
        server.enqueue(
            MockResponse().setBody("""[{"sgt_idx": 1, "sgt_title": "Test Group"}]""")
        )
        val groups = api.getCurrentUserGroups()
        assertEquals(1, groups.size)
        assertEquals("Test Group", groups[0].sgtTitle)
    }

    @Test
    fun `getCurrentUserGroups sends GET to correct path`() = runTest {
        server.enqueue(MockResponse().setBody("[]"))
        api.getCurrentUserGroups()
        val request = server.takeRequest()
        assertEquals("GET", request.method)
        assertTrue(request.path!!.contains("groups/current-user"))
    }

    @Test
    fun `getCurrentUserGroups returns empty list`() = runTest {
        server.enqueue(MockResponse().setBody("[]"))
        val groups = api.getCurrentUserGroups()
        assertTrue(groups.isEmpty())
    }

    @Test
    fun `getGroupMembers sends GET with groupId in path`() = runTest {
        server.enqueue(MockResponse().setBody("[]"))
        api.getGroupMembers(42)
        val request = server.takeRequest()
        assertEquals("GET", request.method)
        assertTrue(request.path!!.contains("group-members/member/42"))
    }

    @Test
    fun `getLocations sends GET with memberId in path`() = runTest {
        server.enqueue(MockResponse().setBody("[]"))
        api.getLocations(7)
        val request = server.takeRequest()
        assertEquals("GET", request.method)
        assertTrue(request.path!!.contains("locations/member/7"))
    }
    @Test
    fun `email authentication requests use backend contract`() = runTest {
        server.enqueue(MockResponse().setBody("""{"success":true}"""))
        assertTrue(api.sendEmailCode(com.dmonster.smap.data.model.EmailCodeRequest("person@example.com", "register")).success)
        val send = server.takeRequest()
        assertEquals("/auth/email/send-code", send.path)
        assertTrue(send.body.readUtf8().contains("\"purpose\":\"register\""))

        server.enqueue(MockResponse().setBody("""{"success":true,"verification_token":"test-token"}"""))
        assertEquals("test-token", api.verifyEmailCode(com.dmonster.smap.data.model.EmailCodeRequest("person@example.com", "register", "123456")).verificationToken)
        val verify = server.takeRequest()
        assertEquals("/auth/email/verify-code", verify.path)
        assertTrue(verify.body.readUtf8().contains("\"code\":\"123456\""))

        server.enqueue(MockResponse().setBody("""{"success":true}"""))
        assertTrue(api.resetPasswordByEmail(com.dmonster.smap.data.model.EmailResetRequest("person@example.com", "test-token", "Password1!")).success)
        val reset = server.takeRequest()
        assertEquals("/auth/reset-password-by-email", reset.path)
        assertTrue(reset.body.readUtf8().contains("\"verification_token\":\"test-token\""))
    }

    @Test
    fun `invite join uses wrapped server response without decoding group`() = runTest {
        server.enqueue(MockResponse().setBody("""{"success":true,"data":{"sgt_idx":42,"mt_idx":7}}"""))
        api.joinGroupFromInvite(42, com.dmonster.smap.data.model.JoinGroupRequest(7, 42, "CODE")).close()
        val request = server.takeRequest()
        assertEquals("/groups/42/join", request.path)
        val body = request.body.readUtf8()
        assertTrue(body.contains("\"mt_idx\":7"))
        assertTrue(body.contains("\"sgt_code\":\"CODE\""))
    }

    @Test
    fun `invite links parse code and legacy format`() {
        val withCode = com.dmonster.smap.data.model.parseInviteLink("smap://group/42/join?code=A%2BB")
        assertEquals(42, withCode?.groupId)
        assertEquals("A+B", withCode?.code)
        assertNull(com.dmonster.smap.data.model.parseInviteLink("smap://group/42/join")?.code)
        assertNull(com.dmonster.smap.data.model.parseInviteLink("smap://group/no/join"))
    }

    @Test
    fun `registration serializes social credentials`() {
        val body = Json.encodeToString(com.dmonster.smap.data.model.RegisterRequest.serializer(),
            com.dmonster.smap.data.model.RegisterRequest(socialProvider = "google", socialToken = "sample"))
        assertTrue(body.contains("\"social_provider\":\"google\""))
        assertTrue(body.contains("\"social_token\":\"sample\""))
    }

    @Test
    fun `unregister sends fcm token in request body`() = runTest {
        server.enqueue(MockResponse().setBody("""{"success":true}"""))
        api.unregisterFcmToken(com.dmonster.smap.data.model.FcmUnregisterRequest("sample")).close()
        val request = server.takeRequest()
        assertEquals("/fcm-token/unregister", request.path)
        assertEquals("POST", request.method)
        assertEquals("{\"fcm_token\":\"sample\"}", request.body.readUtf8())
    }

    @Test
    fun `refresh authentication failures differ from server failures`() {
        assertTrue(isInvalidRefreshStatus(401))
        assertFalse(isInvalidRefreshStatus(403))
        assertFalse(isInvalidRefreshStatus(500))
        assertFalse(isInvalidRefreshStatus(503))
    }

    @Test
    fun `cancelled requests propagate cancellation`() = runTest {
        try {
            safeApiCall<Unit> { throw kotlinx.coroutines.CancellationException("cancelled") }
            fail("취소가 전파되어야 합니다.")
        } catch (_: kotlinx.coroutines.CancellationException) { }
    }

    @Test
    fun `password rules require uppercase lowercase number and permitted special`() {
        assertTrue(com.dmonster.smap.data.model.isServerPasswordValid("Password1!"))
        assertFalse(com.dmonster.smap.data.model.isServerPasswordValid("password1!"))
        assertFalse(com.dmonster.smap.data.model.isServerPasswordValid("PASSWORD1!"))
    }
    @Test
    fun `private fields can be absent in group and profile responses`() {
        val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; isLenient = true; encodeDefaults = true }
        val body = """{"mt_idx":8,"mt_name":"member","mt_nickname":"nick","mt_file1":"photo"}"""
        val member = json.decodeFromString<com.dmonster.smap.data.model.SmapGroupMember>(body)
        val profile = json.decodeFromString<com.dmonster.smap.data.model.SMAPUser>(body)
        assertNull(member.mtId)
        assertNull(member.mtEmail)
        assertNull(profile.mtId)
        assertNull(profile.mtHp)
        assertNull(profile.mtEmail)
        assertNull(profile.mtBirth)
    }
}
