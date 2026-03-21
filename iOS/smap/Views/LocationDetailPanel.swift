//
//  LocationDetailPanel.swift
//  smap
//
//  장소 정보/편집 하단 시트
//

import SwiftUI

// MARK: - Location Detail Panel

struct LocationDetailPanel: View {
    @ObservedObject var viewModel: MyPlaceViewModel
    @Environment(\.presentationMode) var presentationMode
    
    // 새 장소 등록 시 초기 좌표
    var initialCoordinates: (lat: Double, lng: Double)?
    
    // 입력 상태
    @State private var locationName: String = ""
    @State private var locationAddress: String = ""
    @State private var locationLatitude: Double = 37.5665
    @State private var locationLongitude: Double = 126.9780
    @State private var notificationsEnabled: Bool = true
    
    // 장소 검색 시트
    @State private var showLocationSearch: Bool = false
    
    private let brandColor = Color(red: 1/255, green: 19/255, blue: 163/255)
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    if let location = viewModel.selectedLocation, !viewModel.isEditMode {
                        // 보기 모드
                        locationInfoView(location: location)
                    } else {
                        // 편집/등록 모드
                        locationEditView
                    }
                }
                .padding(20)
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text(panelTitle)
                        .font(.suite(size: 17, weight: .semibold))
                }
                
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("닫기") {
                        viewModel.closeLocationPanel()
                        presentationMode.wrappedValue.dismiss()
                    }
                    .foregroundColor(brandColor)
                }
                
                if viewModel.isEditMode {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("저장") {
                            saveLocation()
                        }
                        .font(.suite(size: 16, weight: .bold))
                        .foregroundColor(brandColor)
                        .disabled(viewModel.isSaving || locationName.isEmpty || locationAddress.isEmpty)
                    }
                }
            }
        }
        .onAppear {
            setupInitialValues()
        }
        .sheet(isPresented: $showLocationSearch) {
            NavigationView {
                LocationSearchView { place in
                    locationName = place.place_name
                    locationAddress = place.road_address_name.isEmpty ? place.address_name : place.road_address_name
                    if let lat = Double(place.y), let lng = Double(place.x) {
                        locationLatitude = lat
                        locationLongitude = lng
                    }
                }
                .navigationBarItems(leading: Button(action: {
                    showLocationSearch = false
                }) {
                    Text("취소")
                        .font(.suite(size: 16))
                })
            }
        }
    }
    
    // MARK: - Computed Properties
    
    private var panelTitle: String {
        if viewModel.selectedLocation != nil {
            return viewModel.isEditMode ? "장소 편집" : "장소 정보"
        }
        return "새 장소 등록"
    }
    
    // MARK: - Info View (Read-only)
    
    private func locationInfoView(location: SavedLocation) -> some View {
        VStack(spacing: 20) {
            // 장소 아이콘 & 이름
            VStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(LinearGradient(
                            gradient: Gradient(colors: [brandColor, Color.purple]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 72, height: 72)
                    
                    Image(systemName: "mappin.and.ellipse")
                        .font(.suite(size: 32))
                        .foregroundColor(.white)
                }
                
                Text(location.name)
                    .font(.suite(size: 22, weight: .bold))
                    .foregroundColor(.primary)
                
                Text(location.address)
                    .font(.suite(size: 15))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.vertical, 10)
            
            // 상세 정보 카드
            VStack(spacing: 0) {
                infoRow(icon: "location.fill", title: "좌표", value: String(format: "%.6f, %.6f", location.latitude, location.longitude))
                
                Divider().padding(.horizontal, 16)
                
                HStack {
                    Image(systemName: "bell.fill")
                        .foregroundColor(brandColor)
                        .frame(width: 24)
                    
                    Text("도착 알림")
                        .font(.suite(size: 15))
                    
                    Spacer()
                    
                    Toggle("", isOn: .constant(location.notifications))
                        .labelsHidden()
                        .disabled(true)
                }
                .padding(16)
            }
            .background(Color.white)
            .cornerRadius(12)
            
            // 액션 버튼들
            if viewModel.canManageLocation(location) {
                VStack(spacing: 12) {
                    Button(action: {
                        viewModel.startEditing()
                    }) {
                        HStack {
                            Image(systemName: "pencil")
                            Text("편집")
                        }
                        .font(.suite(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(brandColor)
                        .cornerRadius(12)
                    }
                    
                    Button(action: {
                        toggleNotification(location: location)
                    }) {
                        HStack {
                            Image(systemName: location.notifications ? "bell.slash" : "bell")
                            Text(location.notifications ? "알림 끄기" : "알림 켜기")
                        }
                        .font(.suite(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(location.notifications ? Color.orange : Color.green)
                        .cornerRadius(12)
                    }
                    
                    Button(action: {
                        deleteLocation(location: location)
                    }) {
                        HStack {
                            Image(systemName: "trash")
                            Text("삭제")
                        }
                        .font(.suite(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color.red)
                        .cornerRadius(12)
                    }
                }
            }
        }
    }
    
    private func infoRow(icon: String, title: String, value: String) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(brandColor)
                .frame(width: 24)
            
            Text(title)
                .font(.suite(size: 15))
                .foregroundColor(.secondary)
            
            Spacer()
            
            Text(value)
                .font(.suite(size: 15))
                .foregroundColor(.primary)
        }
        .padding(16)
    }
    
    // MARK: - Edit View
    
    private var locationEditView: some View {
        VStack(spacing: 20) {
            // 장소 검색 버튼
            Button(action: {
                showLocationSearch = true
            }) {
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(brandColor)
                    Text("장소 검색")
                        .font(.suite(size: 16, weight: .medium))
                        .foregroundColor(.primary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .foregroundColor(.secondary)
                }
                .padding(16)
                .background(Color.white)
                .cornerRadius(12)
            }
            
            // 장소 이름
            VStack(alignment: .leading, spacing: 8) {
                Text("장소 이름")
                    .font(.suite(size: 14, weight: .semibold))
                    .foregroundColor(.secondary)
                
                TextField("장소 이름을 입력하세요", text: $locationName)
                    .font(.suite(size: 16))
                    .padding(14)
                    .background(Color.white)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(locationName.isEmpty ? Color.red.opacity(0.5) : Color.clear, lineWidth: 1)
                    )
            }
            
            // 주소
            VStack(alignment: .leading, spacing: 8) {
                Text("주소")
                    .font(.suite(size: 14, weight: .semibold))
                    .foregroundColor(.secondary)
                
                TextField("주소를 입력하세요", text: $locationAddress)
                    .font(.suite(size: 16))
                    .padding(14)
                    .background(Color.white)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(locationAddress.isEmpty ? Color.red.opacity(0.5) : Color.clear, lineWidth: 1)
                    )
            }
            
            // 좌표 (읽기 전용)
            VStack(alignment: .leading, spacing: 8) {
                Text("좌표")
                    .font(.suite(size: 14, weight: .semibold))
                    .foregroundColor(.secondary)
                
                Text(String(format: "%.6f, %.6f", locationLatitude, locationLongitude))
                    .font(.suite(size: 16))
                    .foregroundColor(.secondary)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(UIColor.systemGray6))
                    .cornerRadius(12)
            }
            
            // 알림 설정
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("도착 알림")
                        .font(.suite(size: 16, weight: .medium))
                    Text("이 장소 도착 시 알림을 받습니다")
                        .font(.suite(size: 13))
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Toggle("", isOn: $notificationsEnabled)
                    .labelsHidden()
            }
            .padding(16)
            .background(Color.white)
            .cornerRadius(12)
            
            Spacer().frame(height: 20)
        }
    }
    
    // MARK: - Actions
    
    private func setupInitialValues() {
        if let location = viewModel.selectedLocation {
            // 기존 장소 편집
            locationName = location.name
            locationAddress = location.address
            locationLatitude = location.latitude
            locationLongitude = location.longitude
            notificationsEnabled = location.notifications
        } else if let coords = initialCoordinates {
            // 새 장소 (지도 탭으로 생성)
            locationLatitude = coords.lat
            locationLongitude = coords.lng
            notificationsEnabled = true
        }
    }
    
    private func saveLocation() {
        Task {
            let success = await viewModel.saveLocation(
                title: locationName,
                address: locationAddress,
                latitude: locationLatitude,
                longitude: locationLongitude,
                notifications: notificationsEnabled
            )
            
            if success {
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
    
    private func toggleNotification(location: SavedLocation) {
        Task {
            _ = await viewModel.toggleNotification(for: location)
        }
    }
    
    private func deleteLocation(location: SavedLocation) {
        Task {
            let success = await viewModel.deleteLocation(location)
            if success {
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

// MARK: - Preview

struct LocationDetailPanel_Previews: PreviewProvider {
    static var previews: some View {
        LocationDetailPanel(viewModel: MyPlaceViewModel())
    }
}
