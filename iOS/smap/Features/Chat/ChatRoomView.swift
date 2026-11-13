import SwiftUI
import Combine

struct ChatRoomView: View {
    let room: ChatRoom
    @StateObject private var viewModel = ChatRoomViewModel()
    @Environment(\.dismiss) private var dismiss
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Header
            chatHeader

            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 0) {
                        // Load more button
                        if viewModel.hasMore {
                            Button(action: { Task { await viewModel.loadMore() } }) {
                                Text("이전 메시지 불러오기")
                                    .font(.suite(size: 13))
                                    .foregroundColor(SMAPTheme.Color.primary)
                                    .padding(8)
                            }
                        }

                        ForEach(Array(viewModel.messages.enumerated()), id: \.element.id) { index, message in
                            let showDate = index == 0 || message.dateString != viewModel.messages[index - 1].dateString
                            let showProfile = !message.isMyMessage &&
                                (index == 0 || viewModel.messages[index - 1].mt_idx != message.mt_idx)

                            if showDate {
                                dateSeparator(message.dateString)
                            }

                            MessageBubble(
                                message: message,
                                isMyMessage: message.isMyMessage,
                                showProfile: showProfile
                            )
                            .id(message.id)
                        }
                    }
                    .padding(.vertical, 8)
                }
                .onTapGesture { isInputFocused = false }
                .onChange(of: viewModel.messages.count) { _, _ in
                    if let last = viewModel.messages.last {
                        withAnimation(.easeOut(duration: 0.2)) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }

            // Input bar
            inputBar
        }
        .toolbar(.hidden, for: .navigationBar)
        .toolbar(.hidden, for: .tabBar)
        .task {
            viewModel.setup(room: room)
            await viewModel.loadMessages()
        }
        .onDisappear {
            viewModel.cleanup()
        }
    }

    // MARK: - Header

    private var chatHeader: some View {
        HStack(spacing: 12) {
            Button(action: { dismiss() }) {
                Image(systemName: "chevron.left")
                    .font(.suite(size: 18, weight: .medium))
                    .foregroundColor(.primary)
                    .frame(width: 44, height: 44) // 최소 44pt 터치타깃 확보
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("뒤로")

            VStack(alignment: .leading, spacing: 1) {
                Text(room.displayTitle)
                    .font(.suite(size: 17, weight: .bold))
                    .lineLimit(1)
                Text("\(room.member_count)명")
                    .font(.suite(size: 12))
                    .foregroundColor(.gray)
            }

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.white)
        .shadow(color: .black.opacity(0.05), radius: 2, y: 2)
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("메시지를 입력하세요", text: $viewModel.inputText, axis: .vertical)
                .font(.suite(size: 15))
                .lineLimit(1...5)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color(UIColor.systemGray6))
                .cornerRadius(20)
                .focused($isInputFocused)

            Button(action: { viewModel.sendMessage() }) {
                Image(systemName: "paperplane.fill")
                    .font(.suite(size: 18))
                    .foregroundColor(viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                     ? .gray : SMAPTheme.Color.primary)
                    .frame(width: 44, height: 44) // 최소 44pt 터치타깃 확보
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("메시지 전송")
            .disabled(viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.white)
        .shadow(color: .black.opacity(0.05), radius: 2, y: -2)
    }

    private func dateSeparator(_ dateStr: String) -> some View {
        HStack {
            Spacer()
            Text(dateStr)
                .font(.suite(size: 12))
                .foregroundColor(.gray)
                .padding(.horizontal, 16)
                .padding(.vertical, 4)
                .background(Color.gray.opacity(0.1))
                .clipShape(Capsule())
            Spacer()
        }
        .padding(.vertical, 12)
    }
}

// MARK: - Message Bubble

struct MessageBubble: View {
    let message: ChatMessage
    let isMyMessage: Bool
    let showProfile: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 6) {
            if isMyMessage { Spacer(minLength: 60) }

            if !isMyMessage {
                if showProfile {
                    profileAvatar
                } else {
                    Color.clear.frame(width: 32, height: 32)
                }
            }

            VStack(alignment: isMyMessage ? .trailing : .leading, spacing: 2) {
                if showProfile && !isMyMessage {
                    Text(message.mt_nickname ?? "알 수 없음")
                        .font(.suite(size: 12, weight: .medium))
                        .foregroundColor(.gray)
                        .padding(.leading, 4)
                }

                HStack(alignment: .bottom, spacing: 4) {
                    if isMyMessage {
                        messageInfo
                    }

                    Text(message.scmsg_content)
                        .font(.suite(size: 15))
                        .foregroundColor(isMyMessage ? .white : .primary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(isMyMessage ? SMAPTheme.Color.primary : Color(UIColor.systemGray6))
                        .cornerRadius(16)

                    if !isMyMessage {
                        messageInfo
                    }
                }
            }

            if !isMyMessage { Spacer(minLength: 60) }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 2)
    }

    private var messageInfo: some View {
        VStack(alignment: isMyMessage ? .trailing : .leading, spacing: 1) {
            if message.unread_count > 0 {
                Text("\(message.unread_count)")
                    .font(.suite(size: 10, weight: .bold))
                    .foregroundColor(SMAPTheme.Color.primary)
            }
            Text(message.formattedTime)
                .font(.suite(size: 10))
                .foregroundColor(.gray)
        }
    }

    private var profileAvatar: some View {
        Group {
            if let photoPath = message.mt_file1, !photoPath.isEmpty,
               let url = AuthService.getProfileImageURL(photoPath) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().aspectRatio(contentMode: .fill)
                            .frame(width: 32, height: 32).clipShape(Circle())
                    } else {
                        defaultAvatar
                    }
                }
            } else {
                defaultAvatar
            }
        }
    }

    private var defaultAvatar: some View {
        Circle()
            .fill(Color.gray.opacity(0.2))
            .frame(width: 32, height: 32)
            .overlay(Image(systemName: "person.fill").font(.suite(size: 14)).foregroundColor(.gray))
    }
}

// MARK: - ChatRoomViewModel

@MainActor
class ChatRoomViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var inputText = ""
    @Published var hasMore = true

    private var room: ChatRoom?
    private var currentUserIdx: Int?
    private let chatService = ChatService.shared
    private let socketManager = ChatSocketManager.shared
    private var cancellables = Set<AnyCancellable>()

    func setup(room: ChatRoom) {
        self.room = room
        self.currentUserIdx = AuthService.shared.getUserData()?.mt_idx

        socketManager.connect()

        socketManager.newMessagePublisher
            .receive(on: RunLoop.main)
            .sink { [weak self] message in
                guard message.scr_idx == room.scr_idx else { return }
                self?.messages.append(message)
                // Auto read
                self?.socketManager.sendReadUpdate(scrIdx: room.scr_idx, scmsgIdx: message.scmsg_idx)
            }
            .store(in: &cancellables)

        socketManager.readReceiptPublisher
            .receive(on: RunLoop.main)
            .sink { [weak self] event in
                guard event.scrIdx == room.scr_idx else { return }
                if let idx = self?.messages.firstIndex(where: { $0.scmsg_idx == event.scmsgIdx }) {
                    self?.messages[idx].unread_count = event.unreadCount
                }
            }
            .store(in: &cancellables)
    }

    func loadMessages() async {
        guard let room else { return }
        do {
            let msgs = try await chatService.getMessages(scrIdx: room.scr_idx)
            self.messages = msgs
            self.hasMore = msgs.count >= 50

            // Join room and mark as read
            socketManager.joinRoom(scrIdx: room.scr_idx)
            if let last = msgs.last {
                socketManager.sendReadUpdate(scrIdx: room.scr_idx, scmsgIdx: last.scmsg_idx)
            }
        } catch {
            print("❌ [ChatRoomVM] loadMessages error: \(error)")
        }
    }

    func loadMore() async {
        guard let room, let firstMsg = messages.first else { return }
        do {
            let older = try await chatService.getMessages(scrIdx: room.scr_idx, before: firstMsg.scmsg_idx)
            self.messages.insert(contentsOf: older, at: 0)
            self.hasMore = older.count >= 50
        } catch {
            print("❌ [ChatRoomVM] loadMore error: \(error)")
        }
    }

    func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, let room else { return }
        inputText = ""
        socketManager.sendMessage(scrIdx: room.scr_idx, content: text)
    }

    func cleanup() {
        if let room {
            socketManager.leaveRoom(scrIdx: room.scr_idx)
        }
        cancellables.removeAll()
    }
}

// MARK: - Helper extension

extension ChatMessage {
    var isMyMessage: Bool {
        guard let data = UserDefaults.standard.data(forKey: "smap_user_data"),
              let user = try? JSONDecoder().decode(SMAPUser.self, from: data) else { return false }
        return mt_idx == user.mt_idx
    }
}
