// ActivityLogSidebarView.swift
// smap
// 활동 로그 사이드바 뷰

import SwiftUI

// MARK: - Sidebar View

struct ActivityLogSidebarView: View {
    @ObservedObject var viewModel: ActivityLogViewModel
    
    @State private var isGroupSelectorOpen = false
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            sidebarHeader
                .padding(.top, 20)
                .padding(.horizontal, 24)
                .padding(.bottom, 16)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Group Selector
                    groupSelectorSection
                    
                    // Member List
                    memberListSection
                }
            }
        }
        .frame(width: 320)
        .background(
            Color(red: 245/255, green: 247/255, blue: 250/255)
                .edgesIgnoringSafeArea(.all)
        )
        .cornerRadius(24, corners: [.topRight, .bottomRight])
        .shadow(color: Color.black.opacity(0.15), radius: 20, x: 5, y: 0)
    }
    
    // MARK: - Header
    
    private var sidebarHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(brandColor)
                    .frame(width: 40, height: 40)
                Image(systemName: "person.fill")
                    .foregroundColor(.white)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text("로그 조회")
                    .font(.suite(size: 20, weight: .bold))
                Text("멤버를 선택해보세요")
                    .font(.suite(size: 15))
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Button(action: {
                viewModel.closeSidebar()
            }) {
                Image(systemName: "xmark")
                    .font(.suite(size: 16, weight: .medium))
                    .foregroundColor(.gray)
                    .frame(width: 32, height: 32)
                    .background(Color.white.opacity(0.6))
                    .clipShape(Circle())
            }
        }
    }
    
    // MARK: - Group Selector
    
    private var groupSelectorSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Circle().fill(Color.red).frame(width: 8, height: 8)
                Text("그룹 목록")
                    .font(.suite(size: 16, weight: .bold))
            }
            
            Menu {
                ForEach(viewModel.groups) { group in
                    Button(group.sgt_title ?? "이름 없음") {
                        Task {
                            await viewModel.selectGroupFromSidebar(group)
                        }
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
    }
    
    // MARK: - Member List
    
    private var memberListSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Circle().fill(Color.green).frame(width: 8, height: 8)
                Text("멤버 목록")
                    .font(.suite(size: 16, weight: .bold))
                Spacer()
                Text("\(viewModel.memberDailyCounts.count)명")
                    .font(.suite(size: 14))
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.secondary.opacity(0.1)))
            }
            
            if viewModel.isDailyCountsLoading {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .padding(.vertical, 20)
            } else if viewModel.memberDailyCounts.isEmpty {
                emptyMemberView
            } else {
                VStack(spacing: 8) {
                    ForEach(viewModel.memberDailyCounts) { member in
                        ActivityLogMemberCell(
                            member: member,
                            isSelected: viewModel.selectedMemberId == member.member_id,
                            selectedDate: viewModel.selectedDate,
                            onMemberTap: {
                                Task {
                                    await viewModel.selectMember(member.member_id)
                                }
                            },
                            onDateTap: { dateString in
                                Task {
                                    await viewModel.selectMemberAndDate(memberId: member.member_id, date: dateString)
                                }
                            }
                        )
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
    
    private var emptyMemberView: some View {
        VStack(spacing: 12) {
            Circle()
                .fill(Color.gray.opacity(0.1))
                .frame(width: 48, height: 48)
                .overlay(
                    Image(systemName: "person.fill")
                        .foregroundColor(.gray)
                )
            
            Text("그룹 멤버가 없습니다")
                .font(.suite(size: 16, weight: .medium))
                .foregroundColor(.gray)
            
            Text("그룹을 선택하거나 멤버를 초대해보세요")
                .font(.suite(size: 14))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }
}

// MARK: - Member Cell with Calendar

struct ActivityLogMemberCell: View {
    let member: MemberDailyCount
    let isSelected: Bool
    let selectedDate: String
    let onMemberTap: () -> Void
    let onDateTap: (String) -> Void
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255)
    private let indigoColor = Color(red: 99/255, green: 102/255, blue: 241/255)
    
    var body: some View {
        Button(action: onMemberTap) {
            VStack(alignment: .leading, spacing: 12) {
                // Member Info Row
                HStack(spacing: 12) {
                    // Avatar
                    ZStack(alignment: .bottomTrailing) {
                        Group {
                            if let url = getProfileImageUrl(member.member_photo) {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                    default:
                                        defaultAvatar
                                    }
                                }
                            } else {
                                defaultAvatar
                            }
                        }
                        .frame(width: 48, height: 48)
                        .clipShape(Circle())
                        .overlay(
                            Circle().stroke(isSelected ? brandColor : Color.clear, lineWidth: 2.5)
                        )
                    }
                    .frame(width: 52, height: 52)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(member.displayName)
                                .font(.suite(size: 17, weight: .medium))
                                .foregroundColor(.primary)
                            
                            Spacer()
                            
                            HStack(spacing: 4) {
                                Text("📊")
                                    .font(.suite(size: 12))
                                Text("활동로그")
                                    .font(.suite(size: 13))
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(brandColor)
                            .font(.suite(size: 22))
                    }
                }
                
                // 14-Day Calendar
                calendarView
            }
            .padding(12)
            .background(isSelected ? brandColor.opacity(0.05) : Color.white.opacity(0.6))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? brandColor.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    // MARK: - Calendar View
    
    private var calendarView: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Header
            HStack {
                Text("2주간 활동")
                    .font(.suite(size: 13))
                    .foregroundColor(.secondary)
                Spacer()
                Text("\(member.activeDaysCount)/14일")
                    .font(.suite(size: 13))
                    .foregroundColor(.secondary)
            }
            
            // Day of Week Headers
            HStack(spacing: 6) {
                ForEach(0..<7) { index in
                    let dayInfo = getDayInfo(for: 13 - index)
                    
                    Text(dayInfo.dayOfWeek)
                        .font(.suite(size: 11, weight: .bold))
                        .foregroundColor(dayInfo.isWeekend ? (dayInfo.isSunday ? .red : .blue) : .gray)
                        .frame(width: 16)
                        .background(dayInfo.isWeekend ? (dayInfo.isSunday ? Color.red.opacity(0.1) : Color.blue.opacity(0.1)) : Color.gray.opacity(0.05))
                        .cornerRadius(2)
                }
            }
            
            // First Row (7 days ago to 13 days ago)
            HStack(spacing: 6) {
                ForEach(0..<7) { col in
                    let dayIndex = col  // 0-6: 13일전 ~ 7일전
                    let offset = 13 - col
                    let dateString = getDateString(daysAgo: offset)
                    let hasActivity = member.activityDistribution[dayIndex]
                    let isSelectedDate = dateString == selectedDate && isSelected
                    let isToday = offset == 0
                    
                    CalendarDayCell(
                        hasActivity: hasActivity,
                        isSelected: isSelectedDate,
                        isToday: isToday,
                        onTap: hasActivity ? { onDateTap(dateString) } : nil
                    )
                }
            }
            
            // Second Row (Today to 6 days ago)
            HStack(spacing: 6) {
                ForEach(0..<7) { col in
                    let dayIndex = 7 + col  // 7-13: 6일전 ~ 오늘
                    let offset = 6 - col
                    let dateString = getDateString(daysAgo: offset)
                    let hasActivity = member.activityDistribution[dayIndex]
                    let isSelectedDate = dateString == selectedDate && isSelected
                    let isToday = offset == 0
                    
                    CalendarDayCell(
                        hasActivity: hasActivity,
                        isSelected: isSelectedDate,
                        isToday: isToday,
                        onTap: hasActivity ? { onDateTap(dateString) } : nil
                    )
                }
            }
            
            // Footer
            HStack {
                Text("1주전")
                    .font(.suite(size: 12))
                    .foregroundColor(.secondary)
                Spacer()
                Text("오늘")
                    .font(.suite(size: 12, weight: .semibold))
                    .foregroundColor(indigoColor)
            }
        }
        .padding(8)
        .background(Color.gray.opacity(0.05))
        .cornerRadius(8)
    }
    
    // MARK: - Helpers
    
    private var defaultAvatar: some View {
        Circle()
            .fill(Color.gray.opacity(0.2))
            .overlay(
                Image(systemName: "person.fill")
                    .foregroundColor(.gray)
            )
    }
    
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
    
    private func getDateString(daysAgo: Int) -> String {
        let calendar = Calendar.current
        if let date = calendar.date(byAdding: .day, value: -daysAgo, to: Date()) {
            return DateFormatter.apiDateOnlyFormatter.string(from: date)
        }
        return ""
    }
    
    private func getDayInfo(for daysAgo: Int) -> (dayOfWeek: String, isWeekend: Bool, isSunday: Bool) {
        let calendar = Calendar.current
        if let date = calendar.date(byAdding: .day, value: -daysAgo, to: Date()) {
            let weekday = calendar.component(.weekday, from: date)
            let dayNames = ["S", "M", "T", "W", "T", "F", "S"]
            let dayOfWeek = dayNames[weekday - 1]
            let isWeekend = weekday == 1 || weekday == 7
            let isSunday = weekday == 1
            return (dayOfWeek, isWeekend, isSunday)
        }
        return ("", false, false)
    }
}

// MARK: - Calendar Day Cell

struct CalendarDayCell: View {
    let hasActivity: Bool
    let isSelected: Bool
    let isToday: Bool
    let onTap: (() -> Void)?
    
    private let pinkColor = Color(red: 236/255, green: 72/255, blue: 153/255)
    private let indigoColor = Color(red: 99/255, green: 102/255, blue: 241/255)
    
    var body: some View {
        Button(action: {
            onTap?()
        }) {
            ZStack {
                if isSelected {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [pinkColor, Color(red: 244/255, green: 63/255, blue: 94/255)]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(pinkColor.opacity(0.6), lineWidth: 1)
                        )
                        .shadow(color: pinkColor.opacity(0.3), radius: 2)
                } else if hasActivity {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(indigoColor.opacity(0.8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(indigoColor.opacity(0.3), lineWidth: 0.5)
                        )
                } else {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(Color.gray.opacity(0.2), lineWidth: 0.5)
                        )
                }
                
                if isToday {
                    Text("●")
                        .font(.suite(size: 8))
                        .foregroundColor(isSelected || hasActivity ? .white : .gray)
                }
            }
            .frame(width: 16, height: 16)
            .overlay(
                isToday ?
                RoundedRectangle(cornerRadius: 4)
                    .stroke(indigoColor, lineWidth: 1.5)
                : nil
            )
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(onTap == nil)
    }
}

// MARK: - Corner Radius Extension

extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners
    
    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

// MARK: - Preview

struct ActivityLogSidebarView_Previews: PreviewProvider {
    static var previews: some View {
        ActivityLogSidebarView(viewModel: ActivityLogViewModel())
    }
}
