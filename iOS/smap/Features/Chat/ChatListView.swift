import SwiftUI

struct ChatListView: View {
    @StateObject private var viewModel = ChatViewModel()
    @State private var showNewDM = false

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color(red: 248/255, green: 250/255, blue: 255/255), .white],
                    startPoint: .top, endPoint: .bottom
                )
                .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Header
                    chatHeader

                    if viewModel.isLoading && viewModel.rooms.isEmpty {
                        Spacer()
                        ProgressView()
                        Spacer()
                    } else if viewModel.rooms.isEmpty {
                        Spacer()
                        emptyState
                        Spacer()
                    } else {
                        roomList
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .task { await viewModel.loadRooms() }
            .refreshable { await viewModel.loadRooms() }
            .sheet(isPresented: $showNewDM) {
                NewDMView { scrIdx in
                    showNewDM = false
                    // Navigate handled by list refresh
                    await viewModel.loadRooms()
                }
            }
            .alert("오류", isPresented: Binding(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("확인", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }

    // MARK: - Header

    private var chatHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("채팅")
                    .font(.suite(size: 22, weight: .bold))
                    .foregroundColor(.black)
                Text("\(viewModel.rooms.count)개의 채팅방")
                    .font(.suite(size: 13))
                    .foregroundColor(.gray)
            }

            Spacer()

            Button(action: { showNewDM = true }) {
                Image(systemName: "square.and.pencil")
                    .font(.suite(size: 20))
                    .foregroundColor(SMAPTheme.Color.primary)
            }
            .accessibilityLabel("새 채팅")
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    // MARK: - Room List

    private var roomList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                // Group chats
                if !viewModel.groupRooms.isEmpty {
                    sectionHeader(title: "그룹 채팅", count: viewModel.groupRooms.count)
                    ForEach(viewModel.groupRooms) { room in
                        NavigationLink(destination: ChatRoomView(room: room)) {
                            ChatRoomCell(room: room)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }

                // DM chats
                if !viewModel.dmRooms.isEmpty {
                    sectionHeader(title: "1:1 채팅", count: viewModel.dmRooms.count)
                        .padding(.top, 8)
                    ForEach(viewModel.dmRooms) { room in
                        NavigationLink(destination: ChatRoomView(room: room)) {
                            ChatRoomCell(room: room)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }
            }
            .padding(.bottom, 20)
        }
    }

    private func sectionHeader(title: String, count: Int) -> some View {
        HStack {
            Text(title)
                .font(.suite(size: 14, weight: .bold))
                .foregroundColor(.gray)
            Text("\(count)")
                .font(.suite(size: 12))
                .foregroundColor(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(Color.gray.opacity(0.4))
                .clipShape(Capsule())
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.suite(size: 48))
                .foregroundColor(.gray.opacity(0.4))
            Text("채팅이 없습니다")
                .font(.suite(size: 17, weight: .medium))
                .foregroundColor(.gray)
            Text("그룹에 참여하면 그룹 채팅이 자동으로 생성됩니다")
                .font(.suite(size: 14))
                .foregroundColor(.gray.opacity(0.7))
                .multilineTextAlignment(.center)
        }
    }
}

// MARK: - Chat Room Cell

struct ChatRoomCell: View {
    let room: ChatRoom

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack {
                Circle()
                    .fill(room.isGroupChat ? SMAPTheme.Color.primary.opacity(0.1) : Color.orange.opacity(0.1))
                    .frame(width: 50, height: 50)

                if room.isGroupChat {
                    Image(systemName: "person.3.fill")
                        .font(.suite(size: 18))
                        .foregroundColor(SMAPTheme.Color.primary)
                } else if let photoPath = room.dm_target_file1, !photoPath.isEmpty,
                          let url = AuthService.getProfileImageURL(photoPath) {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image {
                            image.resizable().aspectRatio(contentMode: .fill)
                                .frame(width: 50, height: 50).clipShape(Circle())
                        } else {
                            dmDefaultAvatar
                        }
                    }
                } else {
                    dmDefaultAvatar
                }
            }

            // Content
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(room.displayTitle)
                        .font(.suite(size: 16, weight: .medium))
                        .foregroundColor(.primary)
                        .lineLimit(1)

                    if room.member_count > 0 && room.isGroupChat {
                        Text("\(room.member_count)")
                            .font(.suite(size: 12))
                            .foregroundColor(.gray)
                    }

                    Spacer()

                    if let time = room.formattedTime {
                        Text(time)
                            .font(.suite(size: 12))
                            .foregroundColor(.gray)
                    }
                }

                HStack {
                    Text(room.last_message ?? "메시지가 없습니다")
                        .font(.suite(size: 14))
                        .foregroundColor(.secondary)
                        .lineLimit(1)

                    Spacer()

                    if room.unread_count > 0 {
                        Text(room.unread_count > 99 ? "99+" : "\(room.unread_count)")
                            .font(.suite(size: 12, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(SMAPTheme.Accent.notificationDot)
                            .clipShape(Capsule())
                            .accessibilityLabel("읽지 않은 메시지 \(room.unread_count)건")
                    }
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    private var dmDefaultAvatar: some View {
        Image(systemName: "person.fill")
            .font(.suite(size: 20))
            .foregroundColor(.orange)
    }
}
