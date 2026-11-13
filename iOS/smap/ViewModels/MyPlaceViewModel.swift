//
//  MyPlaceViewModel.swift
//  smap
//
//  Extracted from LoginView.swift - My Place tab ViewModel
//

import Foundation
import SwiftUI

@MainActor
class MyPlaceViewModel: ObservableObject {
    @Published var groups: [SmapGroup] = []
    @Published var selectedGroup: SmapGroup?
    @Published var members: [PlaceMember] = []
    @Published var selectedMember: PlaceMember?
    @Published var locations: [SavedLocation] = []
    @Published var selectedLocation: SavedLocation?
    @Published var isSidebarOpen: Bool = false
    @Published var isLocationPanelOpen: Bool = false
    @Published var isEditMode: Bool = false
    @Published var isLoading: Bool = true // Start with loading true to prevent map init with default coordinates
    @Published var isLoadingLocations: Bool = false
    @Published var isSaving: Bool = false
    @Published var errorMessage: String?
    /// 구독 제한(403 PLACE_LIMIT_EXCEEDED) 안내 문구 — 설정되면 "프리미엄 알아보기" 알림을 띄운다.
    @Published var subscriptionLimitMessage: String?
    @Published var showError: Bool = false
    @Published var targetCoordinate: (lat: Double, lng: Double)?  // For map centering
    @Published var initialMapCenter: (lat: Double, lng: Double)?   // Initial center for map (first location)
    @Published var isHeaderSearchPresented = false

    private let groupService = GroupService.shared
    private let myPlaceService = MyPlaceService.shared

    func loadInitialData() async {
        isLoading = true
        do {
            let fetchedGroups = try await groupService.getCurrentUserGroups()
            self.groups = fetchedGroups
            if let group = fetchedGroups.first(where: { $0.sgt_idx == selectedGroup?.sgt_idx }) ?? fetchedGroups.first {
                self.selectedGroup = group
                self.selectedMember = nil
                self.members = []
                self.locations = []
                self.selectedLocation = nil
                self.isLocationPanelOpen = false
                await loadGroupMembers(sgtIdx: group.sgt_idx)
            } else {
                self.selectedGroup = nil
                self.selectedMember = nil
                self.members = []
                self.locations = []
                self.selectedLocation = nil
                self.isLocationPanelOpen = false
            }
            isLoading = false
        } catch {
            handleError(error)
            isLoading = false
        }
    }

    func loadGroupMembers(sgtIdx: Int) async {
        do {
            let fetchedMembers = try await groupService.getGroupMembers(sgtIdx: sgtIdx)
            let currentUserIdx = AuthService.shared.getUserData()?.mt_idx
            var placeMembers: [PlaceMember] = []
            for (index, member) in fetchedMembers.enumerated() {
                // Select current user by default, otherwise first member
                let isCurrentUser = member.mt_idx == currentUserIdx
                let shouldSelect = isCurrentUser || (currentUserIdx == nil && index == 0)
                var placeMember = PlaceMember(from: member, isSelected: shouldSelect)

                // Use the unwrapped mt_idx from placeMember (defaults to 0 if nil)
                let mtIdx = placeMember.mt_idx
                if mtIdx > 0 {
                    print("📍 [MyPlaceViewModel] Loading locations for member \(mtIdx)")
                    do {
                        let memberLocations = try await myPlaceService.getMemberLocations(memberId: mtIdx)
                        placeMember.locationCount = memberLocations.count
                        print("📍 [MyPlaceViewModel] Member \(mtIdx) has \(memberLocations.count) locations")
                    } catch {
                        print("⚠️ [MyPlaceViewModel] Failed to load locations for member \(mtIdx): \(error)")
                        placeMember.locationCount = 0
                    }
                }
                placeMembers.append(placeMember)
            }
            self.members = placeMembers
            // Select current user first, fallback to first member
            let selfMember = placeMembers.first(where: { $0.mt_idx == currentUserIdx })
            let memberToSelect = selfMember ?? placeMembers.first
            if let member = memberToSelect, member.mt_idx > 0 {
                self.selectedMember = member
                await loadMemberLocations(memberId: member.mt_idx, centerOnFirst: true)
            }
        } catch {
            handleError(error)
        }
    }

    func loadMemberLocations(memberId: Int, centerOnFirst: Bool = false) async {
        isLoadingLocations = true
        do {
            let fetchedLocations = try await myPlaceService.getMemberLocations(memberId: memberId)
            self.locations = fetchedLocations.filter { $0.isVisible }

            // Auto-focus first location if requested
            if centerOnFirst, let first = self.locations.first {
                self.targetCoordinate = (lat: first.latitude, lng: first.longitude)
                self.selectedLocation = first
                // Set initial map center only on first load
                if self.initialMapCenter == nil {
                    self.initialMapCenter = (lat: first.latitude, lng: first.longitude)
                }
            }

            isLoadingLocations = false
        } catch {
            handleError(error)
            isLoadingLocations = false
        }
    }

    func canManageLocation(_ location: SavedLocation) -> Bool {
        guard let currentUserId = AuthService.shared.getUserData()?.mt_idx,
              let ownerId = location.mt_idx else { return false }
        return currentUserId == ownerId
    }

    func selectGroup(_ group: SmapGroup) {
        HapticManager.shared.selection()
        guard selectedGroup?.sgt_idx != group.sgt_idx else { return }
        selectedGroup = group
        Task { await loadGroupMembers(sgtIdx: group.sgt_idx) }
    }

    func selectMember(_ member: PlaceMember) {
        HapticManager.shared.selection()
        guard selectedMember?.mt_idx != member.mt_idx else { return }
        for i in members.indices { members[i].isSelected = members[i].mt_idx == member.mt_idx }
        selectedMember = member
        Task {
            await loadMemberLocations(memberId: member.mt_idx, centerOnFirst: true)
        }
        // Keep sidebar open to show locations list
    }

    func selectLocationFromSidebar(_ location: SavedLocation) {
        selectedLocation = location
        targetCoordinate = (lat: location.latitude, lng: location.longitude)
        // Ensure detail panel is closed when selecting from sidebar
        isLocationPanelOpen = false
        // Close sidebar to show the map update
        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { isSidebarOpen = false }
    }

    func selectLocationFromMarker(_ location: SavedLocation) {
        selectedLocation = location
        targetCoordinate = (lat: location.latitude, lng: location.longitude)
        // Open Location Detail Panel only when marker is tapped
        isEditMode = false
        isLocationPanelOpen = true
    }

    func closeLocationPanel() {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            isLocationPanelOpen = false
            selectedLocation = nil
            isEditMode = false
        }
    }

    func startEditing() {
        guard let location = selectedLocation, canManageLocation(location) else { return }
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            isEditMode = true
        }
    }

    func startNewLocation(latitude: Double, longitude: Double) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            selectedLocation = nil
            isEditMode = true
            isLocationPanelOpen = true
        }
    }

    func saveLocation(title: String, address: String, latitude: Double, longitude: Double, notifications: Bool) async -> Bool {
        guard let memberId = selectedMember?.mt_idx else { return false }
        isSaving = true
        do {
            if let existingLocation = selectedLocation {
                guard canManageLocation(existingLocation) else { isSaving = false; return false }
                let request = LocationUpdateRequest(slt_title: title, slt_add: address, slt_lat: latitude, slt_long: longitude, slt_enter_alarm: notifications ? "Y" : "N")
                let success = try await myPlaceService.updateLocation(memberId: memberId, locationId: existingLocation.slt_idx, request: request)
                if !success { throw APIError(detail: nil, message: "장소 정보 수정 내용이 서버에 반영되지 않았습니다. 다시 시도해주세요.") }
            } else {
                let request = LocationCreateRequest(title: title, address: address, latitude: latitude, longitude: longitude, enterAlarm: notifications ? "Y" : "N")
                _ = try await myPlaceService.createLocation(memberId: memberId, request: request)
            }

            // Reload and sync
            await loadMemberLocations(memberId: memberId)

            // Critical: Update selectedLocation to the newly saved/updated version to refresh map/UI
            if let existing = selectedLocation {
                if let updated = locations.first(where: { $0.slt_idx == existing.slt_idx }) {
                    selectedLocation = updated
                }
            } else if let latest = locations.last { // For newly created, usually last in the fetched list
                selectedLocation = latest
            }

            if let index = members.firstIndex(where: { $0.mt_idx == memberId }) {
                members[index].locationCount = locations.count
            }

            isSaving = false
            isLocationPanelOpen = false
            isEditMode = false
            return true
        } catch {
            handleError(error)
            isSaving = false
            return false
        }
    }

    func deleteLocation(_ location: SavedLocation) async -> Bool {
        guard canManageLocation(location) else { return false }
        guard let memberId = selectedMember?.mt_idx else { return false }
        isSaving = true
        do {
            _ = try await myPlaceService.deleteLocation(locationId: location.slt_idx)
            await loadMemberLocations(memberId: memberId)
            if let index = members.firstIndex(where: { $0.mt_idx == memberId }) { members[index].locationCount = locations.count }
            isSaving = false
            isLocationPanelOpen = false
            return true
        } catch {
            handleError(error)
            isSaving = false
            return false
        }
    }

    func toggleNotification(for location: SavedLocation) async -> Bool {
        guard canManageLocation(location) else { return false }
        // Optimistic UI update: update local state immediately to prevent layout jitter
        let newNotificationState = !location.notifications
        let newAlarmValue = newNotificationState ? "Y" : "N"
        if let index = locations.firstIndex(where: { $0.slt_idx == location.slt_idx }) {
            locations[index].slt_enter_alarm = newAlarmValue
            // Also update selectedLocation if it's the same location
            if selectedLocation?.slt_idx == location.slt_idx {
                selectedLocation = locations[index]
            }
        }

        do {
            // Make the API call (no need to reload all locations)
            _ = try await myPlaceService.toggleNotification(locationId: location.slt_idx, enabled: newNotificationState)
            return true
        } catch {
            // Revert on error
            let revertAlarmValue = newNotificationState ? "N" : "Y"
            if let index = locations.firstIndex(where: { $0.slt_idx == location.slt_idx }) {
                locations[index].slt_enter_alarm = revertAlarmValue
                if selectedLocation?.slt_idx == location.slt_idx {
                    selectedLocation = locations[index]
                }
            }
            handleError(error)
            return false
        }
    }

    func toggleSidebar() { withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { isSidebarOpen.toggle() } }
    func openSidebar() { withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { isSidebarOpen = true } }
    func closeSidebar() { withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { isSidebarOpen = false } }

    private func handleError(_ error: Error) {
        if case NetworkError.subscriptionLimit(_, let message)? = error as? NetworkError {
            subscriptionLimitMessage = message
            return
        }
        if let apiError = error as? APIError { errorMessage = apiError.message ?? "알 수 없는 오류" }
        else { errorMessage = error.localizedDescription }
        showError = true
    }
}
