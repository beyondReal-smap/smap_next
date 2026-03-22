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
}
