# Phase 2A: Service Layer Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all Services to use Phase 1's APIClient/KeychainManager/UserDefaultsManager, then remove Alamofire dependency — completing the unified network/storage infrastructure.

**Architecture:** Each Service's manual URLRequest/token/error boilerplate is replaced with one-liner APIClient calls. Method signatures remain unchanged so callers (ViewModels, Views) continue to work. AuthService additionally switches from inline Keychain/UserDefaults to the new managers.

**Tech Stack:** Swift, URLSession (via APIClient), XCTest

**Spec:** `docs/superpowers/specs/2026-03-21-ios-refactoring-design.md` (Section 2.3, 2.4 partial)

**Prerequisite:** Phase 1 complete (APIClient, APIEndpoint, NetworkError, KeychainManager, UserDefaultsManager, AppConfiguration all exist and tested)

---

## File Map

### Modified Files
```
smap/Services/
├── GroupService.swift              # URLSession → APIClient (409줄 → ~120줄)
├── NotificationService.swift       # URLSession → APIClient (104줄 → ~40줄)
├── MyPlaceService.swift            # URLSession → APIClient (197줄 → ~70줄)
├── AuthService.swift               # URLSession → APIClient + KeychainManager + UserDefaultsManager (757줄 → ~350줄)
└── LocationService.swift           # → KakaoPlaceSearchService, use AppConfiguration (56줄 → ~45줄)

smap/ViewModels/
└── GroupViewModel.swift            # APIError catch → NetworkError catch

Podfile                             # Alamofire 제거
```

### Deleted Files
```
smap/Helper/Api/Api.swift           # APIClient로 완전 대체됨
```

### New Test Files
```
smapTests/Helpers/
└── MockURLProtocol.swift          # APIClientTests에서 추출 → 공유 헬퍼
smapTests/Services/
├── GroupServiceTests.swift
└── AuthServiceTests.swift
```

**사전작업:** `MockURLProtocol`을 `smapTests/Core/Network/APIClientTests.swift` 하단에서 `smapTests/Helpers/MockURLProtocol.swift`로 추출. 기존 APIClientTests에서도 참조 가능하도록.

**Note:** Response helper structs (`StatsResponse`, `GroupCreateResponse`, `SimpleResponse`, `LocationActionResponse`)는 현재 Service 파일 하단에 정의되어 있음. 이동하지 않고 그대로 유지 — Phase 3에서 Models로 정리.

### 주의사항

1. **HomeService** — `AuthService.swift:655`에 `class HomeService`가 정의되어 있음. LoginView.swift에서 사용 중. AuthService 리팩토링 시 HomeService도 함께 APIClient로 마이그레이션하여 같은 파일에 유지.

2. **ScheduleService** — `RootCoordinatorView.swift:2892`에 정의됨. Phase 3 View 분해 시 별도 파일로 추출 + APIClient 마이그레이션. Phase 2A에서는 건드리지 않음.

3. **GroupSummary** — `LoginView.swift:3249`에 정의됨. GroupService.getGroupSummary()가 사용. Phase 2A에서는 GroupService 내부에 `getGroupSummary` 메서드를 보존하되, 현재 구현을 APIClient 기반으로 변환. `GroupSummary` 타입은 LoginView.swift에 그대로 둠.

4. **AuthService.saveUserData 부작용** — 반드시 보존해야 할 것들:
   - 호환성 UserDefaults 키 (`mt_idx`, `mt_id`, `mt_name`, `mt_email`, `is_logged_in`) 저장
   - `LocationService.sharedInstance.updateUserInfo(...)` 호출
   - `ForceUpdateFCMToken` NotificationCenter 포스트
   - `deleteUserData`에서의 `LocationService.sharedInstance.clearUserInfo()` 호출

5. **Api.shared 호출부** — 3곳 확인됨:
   - `Helper/LocationService.swift:175` — `Api.shared.auth(...)` → APIClient로 교체
   - `Helper/LocationService.swift:364` — `Api.shared.memberLocation(...)` → APIClient로 교체
   - `Main/MainView.swift:1054` — `Api.shared.fileUpload(...)` → APIClient.upload로 교체

6. **LoginViewModel 에러 핸들링** — Task 6에서 GroupViewModel과 함께 LoginViewModel의 `APIError` catch도 `NetworkError`로 업데이트.

---

## Task 1: Migrate GroupService to APIClient

**Files:**
- Modify: `smap/Services/GroupService.swift`
- Create: `smapTests/Services/GroupServiceTests.swift`

- [ ] **Step 1: 테스트 작성**

Create: `smapTests/Services/GroupServiceTests.swift`
```swift
import XCTest
@testable import smap

final class GroupServiceTests: XCTestCase {

    var service: GroupService!
    var apiClient: APIClient!

    override func setUp() {
        super.setUp()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        apiClient = APIClient(session: URLSession(configuration: config))
        service = GroupService(apiClient: apiClient)
    }

    override func tearDown() {
        MockURLProtocol.requestHandler = nil
        super.tearDown()
    }

    func testGetCurrentUserGroups_decodesResponse() async throws {
        let json = """
        [{"sgt_idx": 1, "sgt_title": "테스트 그룹"}]
        """.data(using: .utf8)!

        MockURLProtocol.requestHandler = { request in
            XCTAssertTrue(request.url!.path.contains("/groups/current-user"))
            XCTAssertEqual(request.httpMethod, "GET")
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, json)
        }

        let groups = try await service.getCurrentUserGroups()
        XCTAssertEqual(groups.count, 1)
        XCTAssertEqual(groups[0].sgt_title, "테스트 그룹")
    }

    func testDeleteGroup_returnsTrue() async throws {
        MockURLProtocol.requestHandler = { request in
            XCTAssertTrue(request.url!.path.contains("/groups/42"))
            XCTAssertEqual(request.httpMethod, "PUT") // soft delete
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data())
        }

        let result = try await service.deleteGroup(sgtIdx: 42)
        XCTAssertTrue(result)
    }

    func testRemoveMember_sendsDelete() async throws {
        let json = #"{"success": true}"#.data(using: .utf8)!
        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.httpMethod, "DELETE")
            XCTAssertTrue(request.url!.path.contains("/group-members/1/member/2"))
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, json)
        }

        let result = try await service.removeMember(sgtIdx: 1, mtIdx: 2)
        XCTAssertTrue(result)
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

GroupService에 `init(apiClient:)` 이니셜라이저가 없으므로 실패.

- [ ] **Step 3: GroupService를 APIClient 사용으로 리팩토링**

`smap/Services/GroupService.swift` 전체를 다음으로 교체:

```swift
import Foundation

class GroupService {
    static let shared = GroupService()
    private let apiClient: APIClient
    private var token: String? { KeychainManager.shared.getToken() }

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getCurrentUserGroups() async throws -> [SmapGroup] {
        try await apiClient.request(.getCurrentUserGroups, token: token)
    }

    func getGroupMembers(sgtIdx: Int) async throws -> [SmapGroupMember] {
        try await apiClient.request(.getGroupMembers(sgtIdx: sgtIdx), token: token)
    }

    func getGroupStats(sgtIdx: Int) async throws -> GroupStats {
        let result: StatsResponse = try await apiClient.request(.getGroupStats(sgtIdx: sgtIdx), token: token)
        guard result.success, let stats = result.data else {
            throw NetworkError.badRequest(result.message ?? "그룹 통계 로드 실패")
        }
        return stats
    }

    func createGroup(title: String, memo: String) async throws -> SmapGroup {
        let result: GroupCreateResponse = try await apiClient.request(.createGroup(title: title, memo: memo), token: token)
        guard result.success, let group = result.data else {
            throw NetworkError.badRequest(result.message ?? "그룹 생성 실패")
        }
        return group
    }

    func updateGroup(sgtIdx: Int, title: String, memo: String) async throws -> SmapGroup {
        let result: GroupCreateResponse = try await apiClient.request(.updateGroup(sgtIdx: sgtIdx, title: title, memo: memo), token: token)
        guard result.success, let group = result.data else {
            throw NetworkError.badRequest(result.message ?? "그룹 수정 실패")
        }
        return group
    }

    func joinGroup(inviteCode: String) async throws -> Bool {
        // 1. 코드로 그룹 조회
        let group: SmapGroup = try await apiClient.request(.joinGroupByCode(code: inviteCode), token: token)

        // 2. 가입 실행
        guard let mtIdx = AuthService.shared.currentUser?.mt_idx else {
            throw NetworkError.unauthorized
        }
        let _ = try await apiClient.requestRaw(.joinGroupById(sgtIdx: group.sgt_idx, mtIdx: mtIdx), token: token)
        return true
    }

    func joinGroupByCode(code: String) async throws -> Bool {
        try await joinGroup(inviteCode: code)
    }

    func joinGroupById(mt_idx: Int, sgt_idx: Int) async throws -> Bool {
        let _ = try await apiClient.requestRaw(.joinGroupById(sgtIdx: sgt_idx, mtIdx: mt_idx), token: token)
        return true
    }

    // 콜백 기반 래퍼 (기존 UI 코드 호환용)
    func joinGroupById(mt_idx: Int, sgt_idx: Int, completion: @escaping (Bool, String?) -> Void) {
        Task {
            do {
                let success = try await joinGroupById(mt_idx: mt_idx, sgt_idx: sgt_idx)
                completion(success, nil)
            } catch let error as NetworkError {
                completion(false, error.userMessage)
            } catch {
                completion(false, error.localizedDescription)
            }
        }
    }

    func deleteGroup(sgtIdx: Int) async throws -> Bool {
        let _ = try await apiClient.requestRaw(.deleteGroup(sgtIdx: sgtIdx), token: token)
        return true
    }

    func updateMemberRole(sgtIdx: Int, mtIdx: Int, isLeader: Bool) async throws -> Bool {
        let result: SimpleResponse = try await apiClient.request(.updateMemberRole(sgtIdx: sgtIdx, mtIdx: mtIdx, isLeader: isLeader), token: token)
        return result.success
    }

    func removeMember(sgtIdx: Int, mtIdx: Int) async throws -> Bool {
        let result: SimpleResponse = try await apiClient.request(.removeMember(sgtIdx: sgtIdx, mtIdx: mtIdx), token: token)
        return result.success
    }

    /// 그룹 요약 정보 — GroupSummary 타입은 LoginView.swift에 정의됨
    /// 현재 구현이 어떤 엔드포인트를 사용하는지 확인 필요. 기존 코드를 읽어서 동일 엔드포인트 사용.
    func getGroupSummary() async throws -> GroupSummary {
        // 기존 구현 확인: LoginView.swift:3288 참조
        // 엔드포인트가 /groups/current-user/summary 등이면 APIEndpoint에 추가 필요
        // 임시: 기존 URLSession 코드를 APIClient.requestRaw로 래핑
        let url = URL(string: "\(AppConfiguration.apiV1BaseURL)/groups/summary")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(GroupSummary.self, from: data)
    }
}

// MARK: - Response Models (Phase 3에서 Models/로 이동 예정)

struct StatsResponse: Codable {
    let success: Bool
    let message: String?
    let data: GroupStats?
}

struct GroupCreateResponse: Codable {
    let success: Bool
    let message: String?
    let data: SmapGroup?
}

struct SimpleResponse: Codable {
    let success: Bool
    let message: String?
}
```

**Note:** `getGroupSummary()` 메서드의 실제 구현은 기존 코드를 확인하여 정확한 엔드포인트 사용. 빌드 시 컴파일 에러가 나면 기존 코드 참조.

- [ ] **Step 4: 프로젝트에 테스트 파일 추가, 테스트 통과 확인**

```bash
cd /Users/genie/SmapSource/smap_next/iOS
mkdir -p smapTests/Services
```

ruby xcodeproj로 테스트 파일 추가. 빌드 및 테스트 실행.

- [ ] **Step 5: 빌드 확인**

전체 앱 빌드하여 기존 호출부(GroupViewModel 등)가 정상 작동하는지 확인.

- [ ] **Step 6: 커밋**

```bash
git add smap/Services/GroupService.swift smapTests/Services/ smap.xcodeproj/project.pbxproj
git commit -m "refactor: migrate GroupService to use APIClient"
```

---

## Task 2: Migrate NotificationService to APIClient

**Files:**
- Modify: `smap/Services/NotificationService.swift`

- [ ] **Step 1: NotificationService를 APIClient 사용으로 리팩토링**

`smap/Services/NotificationService.swift` 전체를 다음으로 교체:

```swift
import Foundation

class NotificationService {
    static let shared = NotificationService()
    private let apiClient: APIClient
    private var token: String? { KeychainManager.shared.getToken() }

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getMemberPushLogs(memberId: Int) async throws -> [PushLog] {
        try await apiClient.request(.getMemberPushLogs(memberId: memberId), token: token)
    }

    func markAsRead(notificationId: Int) async throws -> Bool {
        let (_, response) = try await apiClient.requestRaw(.markNotificationRead(notificationId: notificationId), token: token)
        return response.statusCode == 200
    }

    func markAllAsRead(memberId: Int) async throws -> NotificationActionResponse {
        try await apiClient.request(.markAllNotificationsRead(memberId: memberId), token: token)
    }

    func deleteNotification(notificationId: Int) async throws -> Bool {
        let (_, response) = try await apiClient.requestRaw(.deleteNotification(notificationId: notificationId), token: token)
        return response.statusCode == 200
    }

    func deleteAllNotifications(memberId: Int) async throws -> NotificationActionResponse {
        try await apiClient.request(.deleteAllNotifications(memberId: memberId), token: token)
    }
}
```

- [ ] **Step 2: 빌드 확인**

- [ ] **Step 3: 커밋**

```bash
git add smap/Services/NotificationService.swift
git commit -m "refactor: migrate NotificationService to use APIClient"
```

---

## Task 3: Migrate MyPlaceService to APIClient

**Files:**
- Modify: `smap/Services/MyPlaceService.swift`

- [ ] **Step 1: MyPlaceService를 APIClient 사용으로 리팩토링**

`smap/Services/MyPlaceService.swift` 전체를 다음으로 교체:

```swift
import Foundation

class MyPlaceService {
    static let shared = MyPlaceService()
    private let apiClient: APIClient
    private var token: String? { KeychainManager.shared.getToken() }

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getMemberLocations(memberId: Int) async throws -> [SavedLocation] {
        try await apiClient.request(.getMemberLocations(memberId: memberId), token: token)
    }

    func createLocation(memberId: Int, request: LocationCreateRequest) async throws -> SavedLocation? {
        let result: LocationActionResponse = try await apiClient.request(
            .createLocation(memberId: memberId, request: AnyEncodable(request)),
            token: token
        )
        guard result.success else {
            throw NetworkError.badRequest(result.message ?? "장소 생성 실패")
        }
        return result.data
    }

    func updateLocation(locationId: Int, request: LocationUpdateRequest) async throws -> Bool {
        let _ = try await apiClient.requestRaw(
            .updateLocation(locationId: locationId, request: AnyEncodable(request)),
            token: token
        )
        return true
    }

    func deleteLocation(locationId: Int) async throws -> Bool {
        let _ = try await apiClient.requestRaw(.deleteLocation(locationId: locationId), token: token)
        return true
    }

    func toggleNotification(locationId: Int, enabled: Bool) async throws -> Bool {
        let _ = try await apiClient.requestRaw(
            .toggleLocationNotification(locationId: locationId, enabled: enabled ? "Y" : "N"),
            token: token
        )
        return true
    }
}

// MARK: - Response Models

struct LocationActionResponse: Codable {
    let success: Bool
    let message: String?
    let member_id: Int?
    let slt_idx: Int?
    let data: SavedLocation?
}
```

- [ ] **Step 2: 빌드 확인**

- [ ] **Step 3: 커밋**

```bash
git add smap/Services/MyPlaceService.swift
git commit -m "refactor: migrate MyPlaceService to use APIClient"
```

---

## Task 4: Migrate AuthService to APIClient + KeychainManager + UserDefaultsManager

**Files:**
- Modify: `smap/Services/AuthService.swift`
- Create: `smapTests/Services/AuthServiceTests.swift`

이 태스크가 가장 크고 복잡함. AuthService는 네트워크 + 저장소 + 사용자 상태 관리를 모두 담당.

- [ ] **Step 1: 테스트 작성**

Create: `smapTests/Services/AuthServiceTests.swift`
```swift
import XCTest
@testable import smap

final class AuthServiceTests: XCTestCase {

    var service: AuthService!
    var apiClient: APIClient!
    var keychain: KeychainManager!
    var defaults: UserDefaultsManager!

    override func setUp() {
        super.setUp()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        apiClient = APIClient(session: URLSession(configuration: config))
        keychain = KeychainManager(service: "com.dmonster.smap.auth-tests")
        let ud = UserDefaults(suiteName: "com.dmonster.smap.auth-tests")!
        ud.removePersistentDomain(forName: "com.dmonster.smap.auth-tests")
        defaults = UserDefaultsManager(defaults: ud)

        service = AuthService(apiClient: apiClient, keychain: keychain, userDefaults: defaults)
    }

    override func tearDown() {
        keychain.deleteToken()
        MockURLProtocol.requestHandler = nil
        super.tearDown()
    }

    func testSaveAndGetToken() {
        service.saveToken("test-token")
        XCTAssertEqual(service.getToken(), "test-token")
    }

    func testLogout_clearsTokenAndUserData() {
        service.saveToken("token")
        let user = SMAPUser(mt_idx: 1, mt_name: "Test")
        service.saveUserData(user)

        service.logout()

        XCTAssertNil(service.getToken())
        XCTAssertNil(service.getUserData())
        XCTAssertNil(service.currentUser)
    }

    func testIsLoggedIn_requiresTokenAndUserData() {
        XCTAssertFalse(service.isLoggedIn)

        service.saveToken("token")
        XCTAssertFalse(service.isLoggedIn) // no user data yet

        let user = SMAPUser(mt_idx: 1, mt_name: "Test")
        service.saveUserData(user)
        XCTAssertTrue(service.isLoggedIn)
    }
}
```

- [ ] **Step 2: AuthService 리팩토링**

핵심 변경사항:
1. `init(apiClient:keychain:userDefaults:)` 생성자 추가 (DI, 테스트용)
2. `saveToken/getToken/deleteToken` → `KeychainManager` 위임
3. `saveUserData/getUserData/deleteUserData` → `UserDefaultsManager` 위임
4. `login/googleLogin/appleLogin/register` → `APIClient` 사용
5. `fetchUserProfile/updateProfile/changePassword/uploadProfileImage` → `APIClient` 사용
6. `baseURL` 프로퍼티 → `AppConfiguration.apiV1BaseURL` 사용
7. 기존 `import Security` 제거 (KeychainManager가 처리)

**수정 방침:**
- `class AuthService: ObservableObject` 유지 (Phase 3에서 @Observable 전환)
- `@Published var currentUser` 유지
- 메서드 시그니처 변경 없음
- `static let shared = AuthService()` 유지 (기본 init)
- 테스트용 `init(apiClient:keychain:userDefaults:)` 추가
- `getFCMToken()` 메서드 보존 (login에서 사용)
- **saveUserData 부작용 반드시 보존:**
  - UserDefaultsManager로 호환성 키 저장 (`store.mtIdx = ...`, `store.isLoggedIn = true` 등)
  - `LocationService.sharedInstance.updateUserInfo(...)` 호출
  - `NotificationCenter.default.post(name: "ForceUpdateFCMToken")` 포스트
- **deleteUserData 부작용 반드시 보존:**
  - UserDefaultsManager.clearAll()
  - `LocationService.sharedInstance.clearUserInfo()` 호출
- **HomeService (AuthService.swift:655)도 함께 마이그레이션:**
  - HomeService의 3개 메서드도 APIClient 사용으로 전환
  - 같은 파일 하단에 유지

변경 범위가 크므로 implementer에게 전체 파일을 새로 작성하도록 지시. 기존 AuthService를 읽고, 모든 메서드를 APIClient 기반으로 재작성.

**Token/UserData 관리 변환 패턴:**
```swift
// Before (inline Keychain)
func saveToken(_ token: String) {
    let data = token.data(using: .utf8)!
    let deleteQuery: [String: Any] = [kSecClass: ..., kSecAttrAccount: tokenKey]
    SecItemDelete(deleteQuery as CFDictionary)
    let addQuery: [String: Any] = [kSecClass: ..., kSecAttrAccount: tokenKey, kSecValueData: data, ...]
    SecItemAdd(addQuery as CFDictionary, nil)
}

// After (KeychainManager)
func saveToken(_ token: String) {
    keychain.saveToken(token)
}
```

**Network 호출 변환 패턴:**
```swift
// Before
func login(phoneNumber: String, password: String, fcmToken: String?) async throws -> LoginResponse {
    let url = URL(string: "\(baseURL)/auth/login")!
    var urlRequest = URLRequest(url: url)
    urlRequest.httpMethod = "POST"
    urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
    urlRequest.httpBody = try JSONEncoder().encode(request)
    let (data, response) = try await URLSession.shared.data(for: urlRequest)
    // ... error handling, decoding
}

// After
func login(phoneNumber: String, password: String, fcmToken: String?) async throws -> LoginResponse {
    let cleanPhone = phoneNumber.replacingOccurrences(of: "-", with: "")
    let response: LoginResponse = try await apiClient.request(
        .login(mt_id: cleanPhone, mt_pwd: password, fcmToken: fcmToken ?? getFCMToken()),
        token: nil  // 로그인은 토큰 불필요
    )
    if response.success, let loginData = response.data {
        if let token = loginData.token { saveToken(token) }
        if let user = loginData.user { saveUserData(user) }
    }
    return response
}
```

- [ ] **Step 3: 프로젝트에 테스트 파일 추가, 테스트 통과 확인**

- [ ] **Step 4: 전체 빌드 확인**

기존 LoginViewModel, RootCoordinatorView 등 AuthService 호출부가 정상 작동하는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add smap/Services/AuthService.swift smapTests/Services/ smap.xcodeproj/project.pbxproj
git commit -m "refactor: migrate AuthService to APIClient + KeychainManager + UserDefaultsManager"
```

---

## Task 5: Rename LocationService → KakaoPlaceSearchService

**Files:**
- Modify: `smap/Services/LocationService.swift`

- [ ] **Step 1: 파일 내용 수정**

`smap/Services/LocationService.swift`의 내용을 수정:
- 하드코딩된 API 키를 `AppConfiguration.kakaoAPIKey`로 교체
- 클래스 이름은 이미 `KakaoLocationSearchService` — 유지

```swift
import Foundation
import Combine

struct KakaoPlace: Codable, Identifiable {
    var id: String { id_api }
    let id_api: String
    let place_name: String
    let address_name: String
    let road_address_name: String
    let x: String
    let y: String

    enum CodingKeys: String, CodingKey {
        case id_api = "id"
        case place_name, address_name, road_address_name, x, y
    }
}

struct KakaoPlaceResponse: Codable {
    let documents: [KakaoPlace]
}

class KakaoLocationSearchService: ObservableObject {
    static let shared = KakaoLocationSearchService()

    private init() {}

    func searchLocation(query: String) async throws -> [KakaoPlace] {
        guard let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://dapi.kakao.com/v2/local/search/keyword.json?query=\(encodedQuery)") else {
            throw NSError(domain: "LocationService", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("KakaoAK \(AppConfiguration.kakaoAPIKey)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw NSError(domain: "LocationService", code: 0, userInfo: [NSLocalizedDescriptionKey: "API Request Failed"])
        }

        let result = try JSONDecoder().decode(KakaoPlaceResponse.self, from: data)
        return result.documents
    }
}
```

**Note:** Kakao API는 별도의 인증 체계(KakaoAK)를 사용하므로 APIClient를 통하지 않고 직접 URLSession 사용 유지. 변경 사항은 API 키 소스만 하드코딩 → AppConfiguration.

- [ ] **Step 2: LocationSearchView.swift에서 하드코딩된 API 키 확인**

`smap/Views/LocationSearchView.swift`에도 같은 API 키가 하드코딩되어 있을 수 있음. 있다면 `AppConfiguration.kakaoAPIKey`로 교체.

```bash
grep -n "7fbf60" smap/Views/LocationSearchView.swift
```

해당 줄의 API 키를 `AppConfiguration.kakaoAPIKey`로 교체.

- [ ] **Step 3: 빌드 확인 & 커밋**

```bash
git add smap/Services/LocationService.swift smap/Views/LocationSearchView.swift
git commit -m "refactor: replace hardcoded Kakao API key with AppConfiguration"
```

---

## Task 6: Update ViewModel Error Handling

**Files:**
- Modify: `smap/ViewModels/GroupViewModel.swift`
- Modify: `smap/ViewModels/LoginViewModel.swift`

- [ ] **Step 1: handleError 메서드 업데이트**

`GroupViewModel.swift`의 `handleError` 메서드 변경:

```swift
// 변경 전 (line 259-266)
private func handleError(_ error: Error) {
    if let apiError = error as? APIError {
        self.errorMessage = apiError.message ?? apiError.detail ?? "오류가 발생했습니다."
    } else {
        self.errorMessage = error.localizedDescription
    }
    self.showError = true
}

// 변경 후
private func handleError(_ error: Error) {
    if let networkError = error as? NetworkError {
        self.errorMessage = networkError.userMessage
    } else {
        self.errorMessage = error.localizedDescription
    }
    self.showError = true
}
```

- [ ] **Step 2: joinGroupById 콜백 래퍼의 에러 처리 확인**

GroupService의 콜백 래퍼가 이미 NetworkError를 처리하도록 Task 1에서 변경됨. GroupViewModel에서 다른 곳에서 `APIError`를 직접 참조하는지 확인:

```bash
grep -n "APIError" smap/ViewModels/GroupViewModel.swift
```

모든 `APIError` 참조를 `NetworkError`로 업데이트.

- [ ] **Step 3: LoginViewModel에서도 APIError → NetworkError 교체**

```bash
grep -n "as? APIError" smap/ViewModels/LoginViewModel.swift
```

발견되는 모든 `as? APIError` 패턴을 동일한 방식으로 교체:
```swift
// 변경 전
} catch let error as APIError {
    self.errorMessage = error.message ?? "..."
}

// 변경 후
} catch let error as NetworkError {
    self.errorMessage = error.userMessage
}
```

- [ ] **Step 4: Views에서 APIError 참조 확인 (빌드 깨짐 방지)**

```bash
grep -rn "as? APIError" smap/Views/
```

Views의 `APIError` 참조는 `struct APIError`(LoginModels.swift)가 여전히 존재하므로 컴파일은 되지만, Services가 더 이상 `APIError`를 throw하지 않으므로 해당 catch 분기가 실행되지 않음. **이것은 의도된 동작** — Phase 3 View 분해 시 정리.

- [ ] **Step 5: 빌드 확인 & 커밋**

```bash
git add smap/ViewModels/GroupViewModel.swift smap/ViewModels/LoginViewModel.swift
git commit -m "refactor: update ViewModels to catch NetworkError instead of APIError"
```

---

## Task 7: Remove Alamofire + Api.swift

**Files:**
- Modify: `Podfile`
- Delete: `smap/Helper/Api/Api.swift`
- Modify: `smap/AppDelegate.swift` (Api.swift 사용부 교체)

- [ ] **Step 1: Api.swift 호출부 확인**

```bash
grep -rn "Api\.shared\|Api()" smap/
```

`Api.shared`를 사용하는 곳을 모두 찾아서 APIClient 호출로 교체.

**확인된 3개 호출부:**

1. `smap/Helper/LocationService.swift:175` — `Api.shared.auth(dic:)`
   → APIClient 사용으로 교체 (auth 토큰 인증용)

2. `smap/Helper/LocationService.swift:364` — `Api.shared.memberLocation(dic:)`
   → APIClient 사용으로 교체:
   ```swift
   // Before
   Api.shared.memberLocation(dic: dic) { response, error in ... }

   // After
   Task {
       do {
           let _ = try await APIClient.shared.requestRaw(
               .createLocationLog(params: dic),
               token: KeychainManager.shared.getToken()
           )
       } catch {
           print("Location log error: \(error)")
       }
   }
   ```

3. `smap/Main/MainView.swift:1054` — `Api.shared.fileUpload(dic:photoName:photo:)`
   → APIClient.upload 사용으로 교체:
   ```swift
   // Before
   Api.shared.fileUpload(dic: dic, photoName: "mt_file1", photo: photoData) { response, error in ... }

   // After
   Task {
       do {
           let _ = try await APIClient.shared.upload(
               .uploadProfileImage,
               fileData: photoData,
               fileName: "profile.jpg",
               fieldName: "mt_file1",
               additionalFields: ["mt_idx": mtIdx],
               token: KeychainManager.shared.getToken()
           )
       } catch {
           print("Upload error: \(error)")
       }
   }
   ```

**Note:** `UserApi.shared`는 KakaoSDK의 UserApi이므로 건드리지 않음.

- [ ] **Step 2: Podfile에서 Alamofire 제거**

```ruby
# 제거
pod 'Alamofire', '~> 5.5'
```

- [ ] **Step 3: Api.swift 삭제**

```bash
git rm smap/Helper/Api/Api.swift
```

프로젝트 파일에서도 참조 제거 (ruby xcodeproj 사용).

- [ ] **Step 4: AppDelegate에서 import Alamofire 제거**

```bash
grep -n "import Alamofire" smap/AppDelegate.swift
```

해당 import 줄 삭제.

- [ ] **Step 5: pod install**

```bash
cd /Users/genie/SmapSource/smap_next/iOS && pod install
```

- [ ] **Step 6: 빌드 확인**

```bash
xcodebuild build -workspace smap.xcworkspace -scheme smap -destination 'generic/platform=iOS Simulator' 2>&1 | grep -E "BUILD|error:" | tail -5
```

- [ ] **Step 7: 커밋**

```bash
git add Podfile Podfile.lock smap.xcodeproj/project.pbxproj smap/AppDelegate.swift
git rm smap/Helper/Api/Api.swift
git commit -m "chore: remove Alamofire dependency and legacy Api.swift"
```

---

## Task 8: Full Build & Test Verification

- [ ] **Step 1: 전체 테스트 실행**

```bash
xcodebuild test -workspace smap.xcworkspace -scheme smap -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:smapTests -quiet 2>&1 | tail -30
```

Expected: 모든 기존 테스트(30개) + 새 테스트(GroupServiceTests 3개 + AuthServiceTests 3개) = 36개 이상 통과

- [ ] **Step 2: 전체 빌드 확인**

```bash
xcodebuild build -workspace smap.xcworkspace -scheme smap -destination 'generic/platform=iOS Simulator' 2>&1 | grep "BUILD"
```

Expected: BUILD SUCCEEDED

- [ ] **Step 3: 남은 APIError 참조 확인**

```bash
grep -rn "throw APIError\|as? APIError" smap/Services/ smap/ViewModels/
```

Expected: Services/와 ViewModels/에서 `APIError` 참조 0개 (LoginModels.swift의 struct 정의는 유지)

---

## Summary

| Task | 핵심 작업 | 변경 파일 |
|------|----------|----------|
| 1 | GroupService → APIClient | 1 수정 + 1 테스트 |
| 2 | NotificationService → APIClient | 1 수정 |
| 3 | MyPlaceService → APIClient | 1 수정 |
| 4 | AuthService → APIClient + KeychainManager + UserDefaultsManager | 1 수정 + 1 테스트 |
| 5 | LocationService → AppConfiguration.kakaoAPIKey | 1-2 수정 |
| 6 | GroupViewModel + LoginViewModel → NetworkError catch | 2 수정 |
| 7 | Alamofire 제거 + Api.swift 삭제 | Podfile, LocationService, MainView, 1 삭제 |
| 8 | 전체 검증 | 없음 |

**Phase 2A 완료 후 상태:**
- 모든 Services가 APIClient를 통해 네트워크 요청
- AuthService가 KeychainManager/UserDefaultsManager 사용
- Alamofire 의존성 완전 제거
- 외부 의존성: 10개 → 4개 (Firebase, Google/Kakao SDK, NMapsMap, SwiftyStoreKit)
- 통합 에러 핸들링 (NetworkError)

**Phase 2B에서 할 일:**
- AppDelegate 분해 (FCMService, DeepLinkService 추출)
- SmapApp.swift 생성 + Storyboard 제거
- SwiftyStoreKit → StoreKit 2 전환
