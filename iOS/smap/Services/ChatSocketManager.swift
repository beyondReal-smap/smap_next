import Foundation
import Combine

/// Socket.IO 프로토콜 기반 채팅 WebSocket 매니저
/// Engine.IO 핸드셰이크 → WebSocket 업그레이드 → Socket.IO 이벤트 처리
@MainActor
final class ChatSocketManager: ObservableObject {
    static let shared = ChatSocketManager()

    @Published var isConnected = false
    @Published var lastError: String?

    /// 새 메시지 수신 시 발행
    let newMessagePublisher = PassthroughSubject<ChatMessage, Never>()
    /// 읽음 수 변경 시 발행
    let readReceiptPublisher = PassthroughSubject<ReadReceiptEvent, Never>()

    private var webSocketTask: URLSessionWebSocketTask?
    private var pingTimer: Timer?
    private var token: String?
    private var sid: String?

    private let baseURL = "wss://api3.aiagnt.kr"

    struct ReadReceiptEvent {
        let scrIdx: Int
        let scmsgIdx: Int
        let unreadCount: Int
    }

    // MARK: - Connect

    func connect() {
        guard let token = AuthService.shared.getToken() else {
            lastError = "인증 토큰이 없습니다."
            return
        }
        self.token = token
        disconnect()
        performHandshake(token: token)
    }

    func disconnect() {
        pingTimer?.invalidate()
        pingTimer = nil
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        sid = nil
        isConnected = false
    }

    // MARK: - Engine.IO Handshake

    private func performHandshake(token: String) {
        // Engine.IO polling handshake to get sid
        let handshakeURL = "https://api3.aiagnt.kr/ws/socket.io/?EIO=4&transport=polling"
        guard let url = URL(string: handshakeURL) else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        Task {
            do {
                let (data, _) = try await URLSession.shared.data(for: request)
                guard let responseStr = String(data: data, encoding: .utf8) else { return }

                // Engine.IO response format: "0{...json...}"
                // Find JSON part after the digit prefix
                if let jsonStart = responseStr.firstIndex(of: "{"),
                   let jsonData = String(responseStr[jsonStart...]).data(using: .utf8) {
                    let handshake = try JSONDecoder().decode(EngineIOHandshake.self, from: jsonData)
                    self.sid = handshake.sid
                    self.connectWebSocket(sid: handshake.sid, token: token)
                }
            } catch {
                print("❌ [ChatSocket] Handshake failed: \(error)")
                self.lastError = "WebSocket 연결 실패"
            }
        }
    }

    private struct EngineIOHandshake: Codable {
        let sid: String
        let upgrades: [String]
        let pingInterval: Int
        let pingTimeout: Int
    }

    // MARK: - WebSocket Connection

    private func connectWebSocket(sid: String, token: String) {
        let wsURL = "wss://api3.aiagnt.kr/ws/socket.io/?EIO=4&transport=websocket&sid=\(sid)"
        guard let url = URL(string: wsURL) else { return }

        let session = URLSession(configuration: .default)
        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()

        // Engine.IO upgrade probe
        sendRaw("2probe")

        // Wait for "3probe" response, then send "5" (upgrade)
        Task {
            try? await Task.sleep(nanoseconds: 500_000_000)
            self.sendRaw("5")

            // Socket.IO connect with auth
            try? await Task.sleep(nanoseconds: 300_000_000)
            let authPayload = "{\"token\":\"\(token)\"}"
            self.sendRaw("40\(authPayload)")

            self.isConnected = true
            self.startPing()
            self.receiveMessages()
        }
    }

    // MARK: - Send Events

    func joinRoom(scrIdx: Int) {
        let payload = "[\"join_room\",{\"scr_idx\":\(scrIdx)}]"
        sendRaw("42\(payload)")
    }

    func leaveRoom(scrIdx: Int) {
        let payload = "[\"leave_room\",{\"scr_idx\":\(scrIdx)}]"
        sendRaw("42\(payload)")
    }

    func sendMessage(scrIdx: Int, content: String) {
        let escaped = content.replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
        let payload = "[\"send_message\",{\"scr_idx\":\(scrIdx),\"content\":\"\(escaped)\"}]"
        sendRaw("42\(payload)")
    }

    func sendReadUpdate(scrIdx: Int, scmsgIdx: Int) {
        let payload = "[\"read_update\",{\"scr_idx\":\(scrIdx),\"scmsg_idx\":\(scmsgIdx)}]"
        sendRaw("42\(payload)")
    }

    // MARK: - Receive

    private func receiveMessages() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    Task { @MainActor in
                        self?.handleMessage(text)
                    }
                default:
                    break
                }
                Task { @MainActor in self?.receiveMessages() } // Continue listening
            case .failure(let error):
                print("❌ [ChatSocket] Receive error: \(error)")
                Task { @MainActor in
                    self?.isConnected = false
                    self?.lastError = "연결이 끊어졌습니다."
                }
            }
        }
    }

    private func handleMessage(_ text: String) {
        // Engine.IO pong
        if text == "3" { return }

        // Socket.IO event: "42[event_name, data]"
        guard text.hasPrefix("42"), text.count > 2 else { return }

        let jsonPart = String(text.dropFirst(2))
        guard let data = jsonPart.data(using: .utf8),
              let array = try? JSONSerialization.jsonObject(with: data) as? [Any],
              let eventName = array.first as? String,
              array.count > 1 else { return }

        switch eventName {
        case "new_message":
            if let msgData = array[1] as? [String: Any],
               let jsonData = try? JSONSerialization.data(withJSONObject: msgData),
               let message = try? JSONDecoder().decode(ChatMessage.self, from: jsonData) {
                newMessagePublisher.send(message)
            }
        case "read_receipt":
            if let receiptData = array[1] as? [String: Any],
               let scrIdx = receiptData["scr_idx"] as? Int,
               let scmsgIdx = receiptData["scmsg_idx"] as? Int,
               let unreadCount = receiptData["unread_count"] as? Int {
                readReceiptPublisher.send(ReadReceiptEvent(scrIdx: scrIdx, scmsgIdx: scmsgIdx, unreadCount: unreadCount))
            }
        case "error":
            if let errData = array[1] as? [String: Any],
               let message = errData["message"] as? String {
                lastError = message
            }
        default:
            break
        }
    }

    // MARK: - Ping

    private func startPing() {
        pingTimer = Timer.scheduledTimer(withTimeInterval: 25, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.sendRaw("2") } // Engine.IO ping
        }
    }

    // MARK: - Raw Send

    private func sendRaw(_ text: String) {
        webSocketTask?.send(.string(text)) { error in
            if let error {
                print("❌ [ChatSocket] Send error: \(error)")
            }
        }
    }
}
