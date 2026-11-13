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

    // 키보드 회피 — 입력 필드에 focused modifier 로 연결
    private enum PanelField: Hashable { case name, address }
    @FocusState private var focusedField: PanelField?
    
    
    
    var body: some View {
        NavigationStack {
            ScrollView {
                ZStack {
                    if let location = viewModel.selectedLocation, !viewModel.isEditMode { 
                        locationInfoView(location: location)
                            .transition(.asymmetric(insertion: .move(edge: .leading), removal: .move(edge: .leading)))
                    } else { 
                        locationEditView 
                            .transition(.asymmetric(insertion: .move(edge: .trailing), removal: .move(edge: .trailing)))
                    }
                }
                .padding(20)
            }
            .background(Color(UIColor.systemGroupedBackground))
            .scrollDismissesKeyboard(.interactively)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) { Text(panelTitle).font(.suite(size: 17, weight: .bold)) }
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: {
                        focusedField = nil
                        viewModel.closeLocationPanel()
                        presentationMode.wrappedValue.dismiss()
                    }) {
                        Text("닫기").font(.suite(size: 16, weight: .medium))
                    }
                    .foregroundColor(SMAPTheme.Color.primary)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    if viewModel.isEditMode {
                        Button("저장") { saveLocation() }
                            .font(.suite(size: 16, weight: .bold))
                            .foregroundColor(SMAPTheme.Color.primary)
                            .disabled(viewModel.isSaving || locationName.isEmpty || locationAddress.isEmpty)
                    }
                }
                // 키보드 상단 완료 버튼 — 다음 필드가 없을 때 손쉽게 키보드 내리기
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("완료") { focusedField = nil }
                        .font(.suite(size: 16, weight: .semibold))
                        .foregroundColor(SMAPTheme.Color.primary)
                }
            }
        }
        .onAppear { setupInitialValues() }
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
    
    private var panelTitle: String { viewModel.selectedLocation != nil ? (viewModel.isEditMode ? "장소 편집" : "장소 정보") : "새 장소 등록" }
    
    private func locationInfoView(location: SavedLocation) -> some View {
        VStack(spacing: 24) {
            // Premium Header Section
            VStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(SMAPTheme.Color.primary.opacity(0.1))
                        .frame(width: 100, height: 100)
                    
                    Circle()
                        .fill(LinearGradient(gradient: Gradient(colors: [SMAPTheme.Color.primary, SMAPTheme.Color.primary.opacity(0.7)]), startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(width: 72, height: 72)
                        .shadow(color: SMAPTheme.Color.primary.opacity(0.3), radius: 10, x: 0, y: 5)
                    
                    Image(systemName: "mappin.and.ellipse")
                        .font(.suite(size: 32, weight: .bold))
                        .foregroundColor(.white)
                }
                
                VStack(spacing: 8) {
                    Text(location.name)
                        .font(.suite(size: 24, weight: .bold))
                        .foregroundColor(.primary)
                        .multilineTextAlignment(.center)
                    
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.circle.fill")
                            .font(.suite(size: 14))
                            .foregroundColor(SMAPTheme.Color.primary)
                        Text(location.address)
                            .font(.suite(size: 15))
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                }
            }
            .padding(.top, 10)
            
            // Info Cards Section
            VStack(spacing: 16) {
                // Coordinate Card
                HStack(spacing: 16) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(SMAPTheme.Color.primary.opacity(0.05))
                            .frame(width: 44, height: 44)
                        Image(systemName: "location.circle.fill")
                            .font(.suite(size: 20))
                            .foregroundColor(SMAPTheme.Color.primary)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("좌표 정보").font(.suite(size: 12, weight: .bold)).foregroundColor(.secondary)
                        Text(String(format: "%.6f, %.6f", location.latitude, location.longitude))
                            .font(.suite(size: 15, weight: .medium))
                            .foregroundColor(.primary)
                    }
                    Spacer()
                }
                .padding(16)
                .background(Color.white)
                .cornerRadius(16)
                .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 4)
                
                // Notification Card
                HStack(spacing: 16) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(location.notifications ? SMAPTheme.Accent.orange.opacity(0.12) : Color.gray.opacity(0.1))
                            .frame(width: 44, height: 44)
                        Image(systemName: location.notifications ? "bell.fill" : "bell.slash.fill")
                            .font(.suite(size: 20))
                            .foregroundColor(location.notifications ? SMAPTheme.Accent.orange : .gray)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("알림 상태").font(.suite(size: 12, weight: .bold)).foregroundColor(.secondary)
                        Text(location.notifications ? "도착 알림 활성화됨" : "알림 꺼짐")
                            .font(.suite(size: 15, weight: .semibold))
                            .foregroundColor(location.notifications ? SMAPTheme.Accent.orange : .secondary)
                    }
                    Spacer()

                    Circle()
                        .fill(location.notifications ? SMAPTheme.Accent.orange : Color.gray.opacity(0.3))
                        .frame(width: 8, height: 8)
                        .accessibilityHidden(true)
                }
                .padding(16)
                .background(Color.white)
                .cornerRadius(16)
                .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 4)
            }
            
            // Actions Section
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    Button(action: { viewModel.startEditing() }) {
                        HStack {
                            Image(systemName: "pencil")
                            Text("정보 수정")
                        }
                        .font(.suite(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(SMAPTheme.Color.primary)
                        .cornerRadius(16)
                        .shadow(color: SMAPTheme.Color.primary.opacity(0.2), radius: 8, x: 0, y: 4)
                    }
                    .accessibilityLabel("정보 수정")
                    
                    Button(action: {
                        HapticManager.shared.impact(style: .light)
                        Task { _ = await viewModel.toggleNotification(for: location) }
                    }) {
                        VStack(spacing: 4) {
                            Image(systemName: location.notifications ? "bell.slash.fill" : "bell.fill")
                                .font(.suite(size: 18))
                            Text(location.notifications ? "알림 끄기" : "알림 켜기")
                                .font(.suite(size: 11, weight: .bold))
                        }
                        .foregroundColor(location.notifications ? SMAPTheme.Accent.orange : SMAPTheme.Color.success)
                        .frame(width: 80, height: 56)
                        .background(Color.white)
                        .cornerRadius(16)
                        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
                    }
                    .accessibilityLabel(location.notifications ? "알림 끄기" : "알림 켜기")
                }
                
                Button(action: {
                    // 즉시 삭제 금지 — confirmation 다이얼로그로 실수 방지.
                    HapticManager.shared.impact(style: .medium)
                    locationPendingDelete = location
                    showDeleteConfirmation = true
                }) {
                    HStack {
                        Image(systemName: "trash")
                        Text("이 장소 삭제")
                    }
                    .font(.suite(size: 15, weight: .medium))
                    .foregroundColor(SMAPTheme.Color.error)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(SMAPTheme.Color.error.opacity(0.05))
                    .cornerRadius(16)
                }
                .accessibilityLabel("이 장소 삭제")
                .accessibilityHint("삭제 전 확인 단계가 있습니다")
            }
            .padding(.top, 8)
            
            Spacer().frame(height: 20)
        }
    }
    
    private var locationEditView: some View {
        VStack(spacing: 24) {
            // Section 1: Target Member Info
            VStack(alignment: .leading, spacing: 12) {
                Label("등록 대상 멤버", systemImage: "person.circle.fill")
                    .font(.suite(size: 14, weight: .bold))
                    .foregroundColor(SMAPTheme.Color.primary)
                
                if let member = viewModel.selectedMember {
                    HStack(spacing: 16) {
                        Group {
                            if let url = getProfileImageUrl(member.mt_file1) {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .empty:
                                        Circle().fill(Color.gray.opacity(0.1))
                                            .overlay(ProgressView().scaleEffect(0.8))
                                    case .success(let image):
                                        image.resizable().aspectRatio(contentMode: .fill)
                                    case .failure(_):
                                        Image(systemName: "person.fill").resizable().padding(10).foregroundColor(.gray).background(Color.gray.opacity(0.1))
                                    @unknown default:
                                        EmptyView()
                                    }
                                }
                            } else {
                                Image(systemName: "person.fill").resizable().padding(10).foregroundColor(.gray).background(Color.gray.opacity(0.1))
                            }
                        }
                        .frame(width: 52, height: 52)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        .shadow(color: Color.black.opacity(0.1), radius: 4, x: 0, y: 2)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(member.displayName)
                                .font(.suite(size: 18, weight: .bold))
                                .foregroundColor(.primary)
                            Text("이 멤버의 장소로 등록됩니다")
                                .font(.suite(size: 12))
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                    }
                    .padding(16)
                    .background(Color.white)
                    .cornerRadius(16)
                    .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 4)
                }
            }
            
            // Section 2: Location Information
            VStack(alignment: .leading, spacing: 12) {
                Label("장소 정보", systemImage: "map.fill")
                    .font(.suite(size: 14, weight: .bold))
                    .foregroundColor(SMAPTheme.Color.primary)
                
                VStack(spacing: 16) {
                    // Search Trigger
                    Button(action: { showLocationSearch = true }) {
                        HStack {
                            Image(systemName: "magnifyingglass").foregroundColor(SMAPTheme.Color.primary)
                            Text("주소 검색으로 찾기").font(.suite(size: 15, weight: .medium))
                            Spacer()
                            Image(systemName: "chevron.right").font(.suite(size: 14, weight: .bold)).foregroundColor(.secondary)
                        }
                        .padding(16)
                        .background(SMAPTheme.Color.primary.opacity(0.05))
                        .cornerRadius(12)
                    }
                    .accessibilityLabel("주소 검색")
                    
                    // Name Input
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("장소 이름").font(.suite(size: 13, weight: .semibold)).foregroundColor(.secondary)
                            Text("*")
                                .foregroundColor(SMAPTheme.Color.error)
                                .accessibilityLabel("필수")
                        }
                        TextField("나만의 장소 이름을 지어주세요", text: $locationName)
                            .font(.suite(size: 16))
                            .focused($focusedField, equals: .name)
                            .submitLabel(.next)
                            .onSubmit { focusedField = .address }
                            .padding(14)
                            .background(Color(UIColor.secondarySystemBackground))
                            .cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(locationName.isEmpty ? SMAPTheme.Color.warning.opacity(0.5) : Color.clear, lineWidth: 1))
                            .accessibilityLabel("장소 이름")
                    }
                    
                    // Address Input (Can be filled manually or via search)
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("상세 주소").font(.suite(size: 13, weight: .semibold)).foregroundColor(.secondary)
                            Text("*")
                                .foregroundColor(SMAPTheme.Color.error)
                                .accessibilityLabel("필수")
                        }
                        TextField("상세 주소를 입력하거나 검색하세요", text: $locationAddress)
                            .font(.suite(size: 15))
                            .focused($focusedField, equals: .address)
                            .submitLabel(.done)
                            .onSubmit { focusedField = nil }
                            .padding(14)
                            .background(Color(UIColor.secondarySystemBackground))
                            .cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(locationAddress.isEmpty ? SMAPTheme.Color.warning.opacity(0.5) : Color.clear, lineWidth: 1))
                            .accessibilityLabel("상세 주소")
                    }
                    
                    // Coordinates Display
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("선택된 좌표").font(.suite(size: 12, weight: .semibold)).foregroundColor(.secondary)
                            Text(String(format: "%.6f, %.6f", locationLatitude, locationLongitude))
                                .font(.suite(size: 14))
                                .foregroundColor(SMAPTheme.Color.primary)
                        }
                        Spacer()
                        Image(systemName: "location.viewfinder").foregroundColor(SMAPTheme.Color.primary)
                    }
                    .padding(14)
                    .background(SMAPTheme.Color.primary.opacity(0.03))
                    .cornerRadius(12)
                }
                .padding(16)
                .background(Color.white)
                .cornerRadius(16)
                .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 4)
            }
            
            // Section 3: Notification Settings
            VStack(alignment: .leading, spacing: 12) {
                Label("알림 설정", systemImage: "bell.badge.fill")
                    .font(.suite(size: 14, weight: .bold))
                    .foregroundColor(SMAPTheme.Color.primary)
                
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("도착 알람 받기").font(.suite(size: 16, weight: .semibold))
                        Text("선택한 멤버가 이 장소에 도착하면 푸시 알림을 받습니다")
                            .font(.suite(size: 12))
                            .foregroundColor(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Toggle("", isOn: $notificationsEnabled).labelsHidden()
                        .tint(SMAPTheme.Color.primary)
                }
                .padding(16)
                .background(Color.white)
                .cornerRadius(16)
                .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 4)
            }
            
            Spacer().frame(height: 32)
        }
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
        focusedField = nil // 저장 누르면 키보드 내리기
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
    
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
}
