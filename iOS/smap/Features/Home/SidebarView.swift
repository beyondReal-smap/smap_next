//
// SidebarView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

struct SidebarView: View {
    @ObservedObject var viewModel: HomeViewModel
    

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Sidebar Header
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(SMAPTheme.Color.primary)
                        .frame(width: 40, height: 40)
                    Image(systemName: "person.2.fill")
                        .foregroundColor(.white)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("멤버 조회")
                        .font(.suite(size: 20, weight: .bold))
                    Text("멤버를 선택해보세요")
                        .font(.suite(size: 15))
                        .foregroundColor(.secondary)
                }
            }
            .padding(.top, 20)
            .padding(.horizontal, 24)
            .padding(.bottom, 16)

            ScrollView {
                VStack(alignment: .leading, spacing: 16) { // Reduced spacing from 24
                    // Group Selector Section
                    VStack(alignment: .leading, spacing: 8) { // Reduced spacing from 12
                        HStack(spacing: 8) {
                            Circle().fill(Color.red).frame(width: 8, height: 8)
                            Text("그룹 목록").font(.suite(size: 16, weight: .bold))
                        }

                        Menu {
                            ForEach(viewModel.groups) { group in
                                Button(group.sgt_title ?? "이름 없음") {
                                    viewModel.selectGroup(group)
                                }
                            }
                        } label: {
                            HStack {
                                Text(viewModel.selectedGroup?.sgt_title ?? "그룹 선택")
                                    .font(.suite(size: 17))
                                    .foregroundColor(.primary)
                                Spacer()
                                Image(systemName: "chevron.down")
                                    .font(.suite(size: 15))
                                    .foregroundColor(.secondary)
                            }
                            .padding()
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                            .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 4)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.1), lineWidth: 1))
                        }
                    }
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
                    .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
                    .padding(.horizontal, 20)

                    // Date Selector Section
                    VStack(alignment: .leading, spacing: 8) { // Reduced spacing from 12
                        HStack(spacing: 8) {
                            Circle().fill(Color.yellow).frame(width: 8, height: 8)
                            Text("날짜 선택").font(.suite(size: 16, weight: .bold))
                        }

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) { // Reduced spacing from 12
                                ForEach(0..<14) { i in
                                    let date = Calendar.current.date(byAdding: .day, value: i, to: Date()) ?? Date()
                                    DateCell(date: date, isSelected: Calendar.current.isDate(date, inSameDayAs: viewModel.selectedDate)) {
                                        viewModel.selectedDate = date
                                    }
                                }
                            }
                        }
                    }
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
                    .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
                    .padding(.horizontal, 20)

                    // Member List Section
                    VStack(alignment: .leading, spacing: 10) { // Reduced spacing from 12
                        HStack(spacing: 8) {
                            Circle().fill(Color.blue).frame(width: 8, height: 8)
                            Text("멤버 목록").font(.suite(size: 16, weight: .bold))
                            Spacer()
                            Text("\(viewModel.members.count)명")
                                .font(.suite(size: 14))
                                .foregroundColor(.secondary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Capsule().fill(Color.secondary.opacity(0.1)))
                        }

                        VStack(spacing: 8) { // Reduced spacing from 12
                            let currentUserIdx = AuthService.shared.getUserData()?.mt_idx
                            ForEach(viewModel.members) { member in
                                SidebarMemberCell(
                                    member: member,
                                    stats: viewModel.getMemberTodayStats(mtIdx: member.mt_idx),
                                    isSelf: member.mt_idx == currentUserIdx
                                ) {
                                    viewModel.selectMember(member)
                                    withAnimation {
                                        viewModel.isSidebarOpen = false
                                    }
                                }
                            }
                        }
                    }
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
                    .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.gray.opacity(0.1), lineWidth: 1))
                    .padding(.horizontal, 20)
                    .padding(.bottom, 40)
                }
            }
        }
        .frame(width: 320)
        .background(
            Color(red: 245/255, green: 247/255, blue: 250/255)
                .ignoresSafeArea()
        )
        .cornerRadius(24, corners: [.topRight, .bottomRight])
        .shadow(color: Color.black.opacity(0.15), radius: 20, x: 5, y: 0)
    }
}

struct DateCell: View {
    let date: Date
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 4) {
                Text(dayOfWeek)
                    .font(.suite(size: 10))
                Text(dayOfMonth)
                    .font(.suite(size: 14, weight: .bold))
            }
            .frame(width: 50, height: 50)
            .background(isSelected ? SMAPTheme.Color.primary : Color.white)
            .foregroundColor(isSelected ? .white : .primary)
            .cornerRadius(12)
            .shadow(color: Color.black.opacity(0.05), radius: 5)
        }
    }

    var dayOfWeek: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "E"
        return formatter.string(from: date)
    }

    var dayOfMonth: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }
}

struct SidebarMemberCell: View {
    let member: SmapGroupMember
    let stats: (completed: Int, ongoing: Int, upcoming: Int)
    var isSelf: Bool = false
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                MemberAvatarView(member: member, isSelf: isSelf)

                MemberStatsView(name: isSelf ? "\(member.displayName) (나)" : member.displayName, stats: stats)

                Spacer()
            }
            .padding(12)
            .background(member.isSelected ? SMAPTheme.Color.primary.opacity(0.05) : Color.white.opacity(0.6))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(member.isSelected ? SMAPTheme.Color.primary.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
    }
}

struct MemberAvatarView: View {
    let member: SmapGroupMember
    var isSelf: Bool = false
    

    var body: some View {
        let _ = print("🔍 [MemberAvatarView] \(member.mt_name ?? "unknown"): mt_file1 = '\(member.mt_file1 ?? "nil")', URL = \(getProfileImageUrl(member.mt_file1)?.absoluteString ?? "nil")")
        ZStack(alignment: .bottomTrailing) {
            // Profile Image with Selection Border
            Group {
                if let url = getProfileImageUrl(member.mt_file1) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .empty:
                            ProgressView()
                                .frame(width: 44, height: 44)
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 44, height: 44)
                                .clipShape(Circle())
                        case .failure:
                            placeholderCircle
                        @unknown default:
                            placeholderCircle
                        }
                    }
                } else {
                    placeholderCircle
                }
            }
            .overlay(
                Circle()
                    .stroke(member.isSelected ? SMAPTheme.Color.primary : Color.clear, lineWidth: 2.5)
            )

            // Crown Icon (Owner) - 테두리 위에 표시
            if member.sgdt_owner_chk == "Y" {
                Circle()
                    .fill(Color.yellow)
                    .frame(width: 16, height: 16)
                    .overlay(Image(systemName: "crown.fill").font(.suite(size: 8)).foregroundColor(.white))
                    .offset(x: 4, y: 4)
            }
        }
        .frame(width: 52, height: 52)
    }

    var placeholderCircle: some View {
        Circle()
            .fill(Color.gray.opacity(0.2))
            .frame(width: 44, height: 44)
            .overlay(
                Image(systemName: "person.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.gray)
            )
    }

    var placeholderView: some View {
        placeholderCircle
    }

    func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
}

struct MemberStatsView: View {
    let name: String
    let stats: (completed: Int, ongoing: Int, upcoming: Int)

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(name)
                .font(.suite(size: 17, weight: .medium))
                .foregroundColor(.primary)

            HStack(spacing: 8) {
                StatItemView(label: "완료", count: stats.completed, color: .green)
                StatItemView(label: "진행", count: stats.ongoing, color: .orange)
                StatItemView(label: "예정", count: stats.upcoming, color: .blue)
            }
        }
    }
}

struct StatItemView: View {
    let label: String
    let count: Int
    let color: Color

    var body: some View {
        HStack(spacing: 2) {
            Text(label).font(.suite(size: 10)).foregroundColor(.gray)
            Text("\(count)").font(.suite(size: 13, weight: .bold)).foregroundColor(color)
        }
    }
}

struct FloatingActionHomeButton: View {
    let count: Int
    let action: () -> Void

    
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255) // Pink-500

    var body: some View {
        Button(action: {
            HapticManager.shared.impact(style: .medium)
            action()
        }) {
            ZStack(alignment: .topTrailing) {
                // Main Button Circle
                Circle()
                    .fill(SMAPTheme.Color.primary)
                    .frame(width: 56, height: 56)
                    .shadow(color: SMAPTheme.Color.primary.opacity(0.3), radius: 12, x: 0, y: 8)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.suite(size: 22))
                            .foregroundColor(.white)
                    )

                // Badge (Pink)
                if count > 0 {
                    Text(count > 99 ? "99+" : "\(count)")
                        .font(.suite(size: 12, weight: .bold)) // Size increased from 10
                        .foregroundColor(.white)
                        .frame(minWidth: 24, minHeight: 24) // Dimension increased from 20
                        .background(pinkColor)
                        .clipShape(Circle())
                        .offset(x: 4, y: -4)
                }
            }
        }
        .accessibilityLabel("멤버 조회")
    }
}
