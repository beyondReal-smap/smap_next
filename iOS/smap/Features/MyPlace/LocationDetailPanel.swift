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
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        NavigationView {
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
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) { Text(panelTitle).font(.suite(size: 17, weight: .bold)) }
                ToolbarItem(placement: .navigationBarLeading) { 
                    Button(action: { 
                        viewModel.closeLocationPanel()
                        presentationMode.wrappedValue.dismiss()
                    }) {
                        Text("닫기").font(.suite(size: 16, weight: .medium))
                    }
                    .foregroundColor(brandColor) 
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    if viewModel.isEditMode {
                        Button("저장") { saveLocation() }
                            .font(.suite(size: 16, weight: .bold))
                            .foregroundColor(brandColor)
                            .disabled(viewModel.isSaving || locationName.isEmpty || locationAddress.isEmpty)
                    }
                }
            }
        }
        .onAppear { setupInitialValues() }
        .sheet(isPresented: $showLocationSearch) {
            NavigationView {
                LocationSearchView { place in
                    locationName = place.place_name
                    locationAddress = place.road_address_name.isEmpty ? place.address_name : place.road_address_name
                    if let lat = Double(place.y), let lng = Double(place.x) { 
                        locationLatitude = lat
                        locationLongitude = lng 
                    }
                    showLocationSearch = false // Explicitly close and prevent refresh
                }.navigationBarItems(leading: Button(action: { showLocationSearch = false }) {
                    Text("취소")
                        .font(.suite(size: 16))
                })
            }
        }
    }
    
    private var panelTitle: String { viewModel.selectedLocation != nil ? (viewModel.isEditMode ? "장소 편집" : "장소 정보") : "새 장소 등록" }
    
    private func locationInfoView(location: SavedLocation) -> some View {
        VStack(spacing: 24) {
            // Premium Header Section
            VStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(brandColor.opacity(0.1))
                        .frame(width: 100, height: 100)
                    
                    Circle()
                        .fill(LinearGradient(gradient: Gradient(colors: [brandColor, brandColor.opacity(0.7)]), startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(width: 72, height: 72)
                        .shadow(color: brandColor.opacity(0.3), radius: 10, x: 0, y: 5)
                    
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
                            .foregroundColor(brandColor)
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
                            .fill(brandColor.opacity(0.05))
                            .frame(width: 44, height: 44)
                        Image(systemName: "location.circle.fill")
                            .font(.suite(size: 20))
                            .foregroundColor(brandColor)
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
                            .fill(location.notifications ? Color.orange.opacity(0.1) : Color.gray.opacity(0.1))
                            .frame(width: 44, height: 44)
                        Image(systemName: location.notifications ? "bell.fill" : "bell.slash.fill")
                            .font(.suite(size: 20))
                            .foregroundColor(location.notifications ? .orange : .gray)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("알림 상태").font(.suite(size: 12, weight: .bold)).foregroundColor(.secondary)
                        Text(location.notifications ? "도착 알림 활성화됨" : "알림 꺼짐")
                            .font(.suite(size: 15, weight: .semibold))
                            .foregroundColor(location.notifications ? .orange : .secondary)
                    }
                    Spacer()
                    
                    Circle()
                        .fill(location.notifications ? Color.orange : Color.gray.opacity(0.3))
                        .frame(width: 8, height: 8)
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
                        .background(brandColor)
                        .cornerRadius(16)
                        .shadow(color: brandColor.opacity(0.2), radius: 8, x: 0, y: 4)
                    }
                    
                    Button(action: { Task { _ = await viewModel.toggleNotification(for: location) } }) {
                        VStack(spacing: 4) {
                            Image(systemName: location.notifications ? "bell.slash.fill" : "bell.fill")
                                .font(.suite(size: 18))
                            Text(location.notifications ? "알림 끄기" : "알림 켜기")
                                .font(.suite(size: 11, weight: .bold))
                        }
                        .foregroundColor(location.notifications ? .orange : .green)
                        .frame(width: 80, height: 56)
                        .background(Color.white)
                        .cornerRadius(16)
                        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
                    }
                }
                
                Button(action: { Task { let success = await viewModel.deleteLocation(location); if success { presentationMode.wrappedValue.dismiss() } } }) {
                    HStack {
                        Image(systemName: "trash")
                        Text("이 장소 삭제")
                    }
                    .font(.suite(size: 15, weight: .medium))
                    .foregroundColor(.red)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.red.opacity(0.05))
                    .cornerRadius(16)
                }
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
                    .foregroundColor(brandColor)
                
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
                    .foregroundColor(brandColor)
                
                VStack(spacing: 16) {
                    // Search Trigger
                    Button(action: { showLocationSearch = true }) {
                        HStack {
                            Image(systemName: "magnifyingglass").foregroundColor(brandColor)
                            Text("주소 검색으로 찾기").font(.suite(size: 15, weight: .medium))
                            Spacer()
                            Image(systemName: "chevron.right").font(.suite(size: 14, weight: .bold)).foregroundColor(.secondary)
                        }
                        .padding(16)
                        .background(brandColor.opacity(0.05))
                        .cornerRadius(12)
                    }
                    
                    // Name Input
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("장소 이름").font(.suite(size: 13, weight: .semibold)).foregroundColor(.secondary)
                            Text("*").foregroundColor(.red)
                        }
                        TextField("나만의 장소 이름을 지어주세요", text: $locationName)
                            .font(.suite(size: 16))
                            .padding(14)
                            .background(Color(UIColor.secondarySystemBackground))
                            .cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(locationName.isEmpty ? Color.orange.opacity(0.3) : Color.clear, lineWidth: 1))
                    }
                    
                    // Address Input (Can be filled manually or via search)
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("상세 주소").font(.suite(size: 13, weight: .semibold)).foregroundColor(.secondary)
                            Text("*").foregroundColor(.red)
                        }
                        TextField("상세 주소를 입력하거나 검색하세요", text: $locationAddress)
                            .font(.suite(size: 15))
                            .padding(14)
                            .background(Color(UIColor.secondarySystemBackground))
                            .cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(locationAddress.isEmpty ? Color.orange.opacity(0.3) : Color.clear, lineWidth: 1))
                    }
                    
                    // Coordinates Display
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("선택된 좌표").font(.suite(size: 12, weight: .semibold)).foregroundColor(.secondary)
                            Text(String(format: "%.6f, %.6f", locationLatitude, locationLongitude))
                                .font(.suite(size: 14))
                                .foregroundColor(brandColor)
                        }
                        Spacer()
                        Image(systemName: "location.viewfinder").foregroundColor(brandColor)
                    }
                    .padding(14)
                    .background(brandColor.opacity(0.03))
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
                    .foregroundColor(brandColor)
                
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
                        .tint(brandColor)
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
    
    private func saveLocation() { Task { let success = await viewModel.saveLocation(title: locationName, address: locationAddress, latitude: locationLatitude, longitude: locationLongitude, notifications: notificationsEnabled); if success { presentationMode.wrappedValue.dismiss() } } }
    
    private func getProfileImageUrl(_ path: String?) -> URL? {
        return AuthService.getProfileImageURL(path)
    }
}
