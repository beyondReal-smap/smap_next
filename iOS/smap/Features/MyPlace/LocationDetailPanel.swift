//
// LocationDetailPanel.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

struct LocationDetailPanel: View {
    @ObservedObject var viewModel: MyPlaceViewModel
    @Environment(\.presentationMode) var presentationMode
    var initialCoordinates: (lat: Double, lng: Double)?
    var initialName: String? = nil
    var initialAddress: String? = nil
    
    @State private var locationName: String = ""
    @State private var locationAddress: String = ""
    @State private var locationLatitude: Double = 37.5665
    @State private var locationLongitude: Double = 126.9780
    @State private var notificationsEnabled: Bool = true
    @State private var showLocationSearch: Bool = false
    @State private var isInitialized: Bool = false

    // 파괴적 액션 보호 — 실수 삭제 방지
    @State private var showDeleteConfirmation: Bool = false
    @State private var locationPendingDelete: SavedLocation?

    // 보기 화면은 반만, 편집·등록은 크게 연다(키보드와 입력칸이 함께 보이게).
    @State private var detent: PresentationDetent = .medium

    var body: some View {
        // 36단계 재설계와 같은 모양 — 일정 상세 시트처럼(Android LocationDetailSheet 와 같은 구성).
        // 이전: 남색 원 아이콘 + 그림자 카드(좌표·알림 상태) + 남색 수정 버튼·알림 버튼·연한 빨강 삭제 버튼.
        // 지금: 회색 바탕 위 흰 묶음(SMAPSection) + 공용 행(SMAPListRow), 아래에 [삭제][편집] / [저장].
        // 색은 내장소 탭 강조색(보라)을 환경값(smapAccent)으로 물려받는다.
        VStack(spacing: 0) {
            header
            ScrollView {
                Group {
                    if let location = viewModel.selectedLocation, !viewModel.isEditMode {
                        locationInfoView(location: location)
                    } else {
                        locationEditView
                    }
                }
                .padding(.horizontal, SMAPTheme.Spacing.md)
                .padding(.bottom, SMAPTheme.Spacing.md)
            }
            .scrollDismissesKeyboard(.interactively)
            bottomButtons
        }
        .background(SMAPTheme.Surface.canvas.ignoresSafeArea())
        .presentationDetents([.medium, .large], selection: $detent)
        .presentationDragIndicator(.visible)
        .onAppear {
            setupInitialValues()
            if viewModel.isEditMode || viewModel.selectedLocation == nil { detent = .large }
        }
        .onChange(of: viewModel.isEditMode) { _, editing in
            if editing { withAnimation { detent = .large } }
        }
        .sheet(isPresented: $showLocationSearch) {
            NavigationStack {
                LocationSearchView { place in
                    locationName = place.place_name
                    locationAddress = place.road_address_name.isEmpty ? place.address_name : place.road_address_name
                    if let lat = Double(place.y), let lng = Double(place.x) {
                        locationLatitude = lat
                        locationLongitude = lng
                    }
                    showLocationSearch = false // Explicitly close and prevent refresh
                    HapticManager.shared.notification(type: .success)
                }.navigationBarItems(leading: Button(action: { showLocationSearch = false }) {
                    Text("취소")
                        .font(.suite(size: 16))
                })
            }
        }
        .confirmationDialog(
            "이 장소를 삭제할까요?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible,
            presenting: locationPendingDelete
        ) { location in
            Button("삭제", role: .destructive) {
                Task {
                    HapticManager.shared.notification(type: .warning)
                    let success = await viewModel.deleteLocation(location)
                    if success {
                        HapticManager.shared.notification(type: .success)
                        presentationMode.wrappedValue.dismiss()
                    } else {
                        HapticManager.shared.notification(type: .error)
                    }
                    locationPendingDelete = nil
                }
            }
            Button("취소", role: .cancel) {
                locationPendingDelete = nil
            }
        } message: { location in
            Text("\"\(location.slt_title ?? "이 장소")\" 은(는) 삭제 후 복구할 수 없습니다.")
        }
    }

    // MARK: - 머리 줄 [닫기] 제목

    private var header: some View {
        HStack(spacing: 0) {
            Button(action: {
                hideKeyboard()
                viewModel.closeLocationPanel()
                presentationMode.wrappedValue.dismiss()
            }) {
                Image(systemName: "xmark")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                    .frame(width: 48, height: 48)
            }
            .accessibilityLabel("닫기")
            Text(panelTitle)
                .font(SMAPTheme.Font.headline)
                .foregroundStyle(SMAPTheme.Surface.onSurface)
                .lineLimit(1)
                .frame(maxWidth: .infinity)
                .accessibilityAddTraits(.isHeader)
            Color.clear.frame(width: 48, height: 48)
        }
        .padding(.horizontal, SMAPTheme.Spacing.xs)
        .padding(.top, 14)
    }

    private var panelTitle: String {
        // 다른 멤버의 장소면 대상이 누구인지 제목에 드러낸다 (본인 장소로 착각 방지)
        let owner = viewModel.isViewingOtherMember ? viewModel.selectedMember?.displayName : nil
        if viewModel.selectedLocation != nil {
            guard viewModel.isEditMode else { return owner.map { "\($0)님의 장소" } ?? "장소 정보" }
            return owner.map { "\($0)님의 장소 편집" } ?? "장소 편집"
        }
        return owner.map { "\($0)님의 장소 추가" } ?? "새 장소 등록"
    }

    // MARK: - 보기

    private func locationInfoView(location: SavedLocation) -> some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.md) {
            HStack(spacing: 12) {
                SMAPRowIcon(systemImage: "mappin.and.ellipse", emphasized: true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(location.name)
                        .font(SMAPTheme.Font.title)
                        .foregroundStyle(SMAPTheme.Surface.onSurface)
                    Text(location.address)
                        .font(SMAPTheme.Font.secondary)
                        .foregroundStyle(SMAPTheme.Surface.onSurfaceMuted)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, SMAPTheme.Spacing.xs)
            .padding(.vertical, SMAPTheme.Spacing.sm)

            SMAPSection {
                SMAPListRow(
                    title: "도착 알림",
                    subtitle: location.notifications ? "도착하면 알려 드려요" : "꺼져 있어요",
                    leading: { SMAPRowIcon(systemImage: "bell") },
                    trailing: {
                        Toggle("도착 알림", isOn: Binding(
                            get: { location.notifications },
                            set: { _ in toggleNotification(location) }
                        ))
                        .labelsHidden()
                    }
                )
            }
        }
    }

    // MARK: - 편집 / 새로 등록

    private var locationEditView: some View {
        VStack(alignment: .leading, spacing: SMAPTheme.Spacing.lg) {
            if viewModel.selectedLocation == nil, let member = viewModel.selectedMember {
                SMAPSection(title: "누구의 장소") {
                    SMAPListRow(title: member.displayName, subtitle: "이 멤버의 장소로 등록돼요", leading: {
                        SMAPAvatar(name: member.displayName, imagePath: member.mt_file1, size: 40)
                    })
                }
            }

            SMAPSection(title: "어디") {
                SMAPListRow(
                    title: "주소 검색으로 찾기",
                    action: { showLocationSearch = true },
                    leading: { SMAPRowIcon(systemImage: "magnifyingglass") },
                    trailing: {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(SMAPTheme.Surface.outline)
                    }
                )
                SMAPRowDivider()
                VStack(spacing: SMAPTheme.Spacing.sm) {
                    SMAPTextField("예: 우리 집, 학교, 학원", text: $locationName, label: "장소 이름", submitLabel: .next)
                    SMAPTextField("주소를 입력해 주세요", text: $locationAddress, label: "주소", submitLabel: .done) { hideKeyboard() }
                }
                .padding(SMAPTheme.Spacing.md)
            }

            SMAPSection(title: "알림") {
                SMAPListRow(
                    title: "도착 알림",
                    subtitle: "멤버가 도착하면 알림을 받아요",
                    leading: { SMAPRowIcon(systemImage: "bell") },
                    trailing: {
                        Toggle("도착 알림", isOn: $notificationsEnabled).labelsHidden()
                    }
                )
            }
        }
        .padding(.top, SMAPTheme.Spacing.sm)
    }

    // MARK: - 아래 고정 버튼 — 보기: [삭제][편집], 편집·등록: [저장]

    @ViewBuilder
    private var bottomButtons: some View {
        if let location = viewModel.selectedLocation, !viewModel.isEditMode {
            if viewModel.canManageLocation(location) {
                HStack(spacing: SMAPTheme.Spacing.sm) {
                    // 삭제는 보조 동작이라 좁게(일정 상세와 같은 비율). 즉시 삭제하지 않고 확인을 거친다.
                    SMAPButton("삭제", style: .secondary) {
                        HapticManager.shared.impact(style: .medium)
                        locationPendingDelete = location
                        showDeleteConfirmation = true
                    }
                    .frame(width: 110)
                    .accessibilityHint("삭제 전 확인 단계가 있습니다")
                    SMAPButton("편집") { viewModel.startEditing() }
                }
                .padding(.horizontal, SMAPTheme.Spacing.md)
                .padding(.vertical, SMAPTheme.Spacing.sm)
            }
        } else {
            SMAPButton(
                viewModel.selectedLocation == nil ? "장소 추가" : "저장",
                isLoading: viewModel.isSaving,
                isDisabled: viewModel.isSaving || locationName.isEmpty || locationAddress.isEmpty
            ) { saveLocation() }
            .padding(.horizontal, SMAPTheme.Spacing.md)
            .padding(.vertical, SMAPTheme.Spacing.sm)
        }
    }

    private func toggleNotification(_ location: SavedLocation) {
        HapticManager.shared.impact(style: .light)
        Task { _ = await viewModel.toggleNotification(for: location) }
    }

    private func hideKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }

    private func setupInitialValues() {
        guard !isInitialized else { return } // Prevent overwriting by .onAppear
        
        if let location = viewModel.selectedLocation { 
            locationName = location.name
            locationAddress = location.address
            locationLatitude = location.latitude
            locationLongitude = location.longitude
            notificationsEnabled = location.notifications 
        } else {
            if let name = initialName { locationName = name }
            if let address = initialAddress { locationAddress = address }
            if let coords = initialCoordinates { 
                locationLatitude = coords.lat
                locationLongitude = coords.lng 
            }
            notificationsEnabled = true
        }
        isInitialized = true
    }
    
    private func saveLocation() {
        hideKeyboard() // 저장 누르면 키보드 내리기
        Task {
            let success = await viewModel.saveLocation(
                title: locationName,
                address: locationAddress,
                latitude: locationLatitude,
                longitude: locationLongitude,
                notifications: notificationsEnabled
            )
            if success {
                HapticManager.shared.notification(type: .success)
                presentationMode.wrappedValue.dismiss()
            } else {
                HapticManager.shared.notification(type: .error)
            }
        }
    }

}
