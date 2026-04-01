package com.dmonster.smap.data.service

import android.util.Log
import com.dmonster.smap.data.model.ChatMessage
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import okhttp3.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Socket.IO WebSocket manager for real-time chat.
 * Uses OkHttp WebSocket with Engine.IO/Socket.IO protocol.
 */
class ChatSocketManager(
    private val authService: AuthService
) {
    companion object {
        private const val TAG = "ChatSocketManager"
        private const val BASE_URL = "https://api3.smap.site"
        private const val WS_URL = "wss://api3.smap.site"
    }

    data class ReadReceiptEvent(val scrIdx: Int, val scmsgIdx: Int, val unreadCount: Int)

    private val exceptionHandler = CoroutineExceptionHandler { _, throwable ->
        Log.e(TAG, "Coroutine exception", throwable)
    }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO + exceptionHandler)
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; isLenient = true }

    private var webSocket: WebSocket? = null
    private var sid: String? = null

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected

    private val _newMessage = MutableSharedFlow<ChatMessage>(extraBufferCapacity = 64)
    val newMessage: SharedFlow<ChatMessage> = _newMessage

    private val _readReceipt = MutableSharedFlow<ReadReceiptEvent>(extraBufferCapacity = 64)
    val readReceipt: SharedFlow<ReadReceiptEvent> = _readReceipt

    // MARK: - Connect

    fun connect() {
        val token = authService.getToken() ?: return
        disconnect()

        scope.launch {
            try {
                performHandshake(token)
            } catch (e: Exception) {
                Log.e(TAG, "Connect failed", e)
            }
        }
    }

    fun disconnect() {
        webSocket?.close(1000, "disconnect")
        webSocket = null
        sid = null
        _isConnected.value = false
    }

    // MARK: - Handshake

    private suspend fun performHandshake(token: String) {
        val client = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()

        // Engine.IO polling handshake
        val handshakeUrl = "$BASE_URL/ws/socket.io/?EIO=4&transport=polling"
        val request = Request.Builder().url(handshakeUrl).get().build()
        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: return

        // Parse "0{...json...}"
        val jsonStart = body.indexOf('{')
        if (jsonStart < 0) return
        val jsonStr = body.substring(jsonStart)
        val handshake = JSONObject(jsonStr)
        val sessionId = handshake.optString("sid", null)
        if (sessionId.isNullOrBlank()) {
            Log.e(TAG, "Failed to get session ID from handshake")
            return
        }
        sid = sessionId
        connectWebSocket(client, sessionId, token)
    }

    private fun connectWebSocket(client: OkHttpClient, sid: String, token: String) {
        val wsUrl = "$WS_URL/ws/socket.io/?EIO=4&transport=websocket&sid=$sid"
        val request = Request.Builder().url(wsUrl).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "[WS] Connected")
                // Engine.IO upgrade
                webSocket.send("2probe")

                scope.launch {
                    delay(500)
                    webSocket.send("5") // upgrade
                    delay(300)
                    // Socket.IO connect with auth
                    webSocket.send("40{\"token\":\"$token\"}")
                    _isConnected.value = true

                    // Start ping loop
                    while (_isConnected.value) {
                        delay(25_000)
                        webSocket.send("2") // ping
                    }
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "[WS] Failure: ${t.message}")
                _isConnected.value = false
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "[WS] Closed: $code $reason")
                _isConnected.value = false
            }
        })
    }

    // MARK: - Send Events

    fun joinRoom(scrIdx: Int) {
        webSocket?.send("42[\"join_room\",{\"scr_idx\":$scrIdx}]")
    }

    fun leaveRoom(scrIdx: Int) {
        webSocket?.send("42[\"leave_room\",{\"scr_idx\":$scrIdx}]")
    }

    fun sendMessage(scrIdx: Int, content: String) {
        val escaped = content.replace("\"", "\\\"").replace("\n", "\\n")
        webSocket?.send("42[\"send_message\",{\"scr_idx\":$scrIdx,\"content\":\"$escaped\"}]")
    }

    fun sendReadUpdate(scrIdx: Int, scmsgIdx: Int) {
        webSocket?.send("42[\"read_update\",{\"scr_idx\":$scrIdx,\"scmsg_idx\":$scmsgIdx}]")
    }

    // MARK: - Handle Messages

    private fun handleMessage(text: String) {
        if (text == "3") return // pong

        if (!text.startsWith("42") || text.length <= 2) return

        try {
            val jsonPart = text.substring(2)
            val array = JSONArray(jsonPart)
            val eventName = array.getString(0)
            val data = array.getJSONObject(1)

            when (eventName) {
                "new_message" -> {
                    val msg = json.decodeFromString<ChatMessage>(data.toString())
                    scope.launch { _newMessage.emit(msg) }
                }
                "read_receipt" -> {
                    val event = ReadReceiptEvent(
                        scrIdx = data.getInt("scr_idx"),
                        scmsgIdx = data.getInt("scmsg_idx"),
                        unreadCount = data.getInt("unread_count")
                    )
                    scope.launch { _readReceipt.emit(event) }
                }
                "error" -> {
                    Log.e(TAG, "[WS] Server error: ${data.optString("message")}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "[WS] Parse error: $text", e)
        }
    }
}
