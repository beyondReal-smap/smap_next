//
//  LocationService.swift
//  smap
//
//  Created by  Corp. Dmonster on 12/15/23.
//

import UIKit
import CoreLocation
import CoreMotion
import WebKit

// iOS 14+ 권장사항을 완전히 준수하여 UI 응답성 경고 방지

public class LocationService: NSObject, CLLocationManagerDelegate{
    public static var sharedInstance = LocationService()
    let locationManager: CLLocationManager
    
    let userNotiCenter = UNUserNotificationCenter.current()
    
    let activityManager = CMMotionActivityManager()
    let pedoMeter = CMPedometer()
    
    var savedMtIdx = ""
    
    var lastLocation: CLLocation = CLLocation(latitude: 0.0, longitude: 0.0)
    var locationAuthStatus: CLAuthorizationStatus?
    private var pendingAuthCompletion: (() -> Void)? = nil
    
    // 🌐 웹뷰 통신을 위한 참조
    weak var webView: WKWebView?
    
    override public init() {
        self.locationManager = CLLocationManager()
            
        self.locationManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        self.locationManager.distanceFilter = 10
        
        super.init()
        self.locationManager.delegate = self
        
        // iOS 14+에서는 초기화 시 권한 요청 없이 delegate만 설정
        // locationManagerDidChangeAuthorization이 자동으로 호출되어 현재 상태 처리
        print("📍 [LOCATION] LocationService 초기화 완료 - delegate 설정됨")
        
        NotificationCenter.default.addObserver(self, selector: #selector(self.appStateChange(_:)), name: NSNotification.Name(rawValue: "appStateChange"), object: nil)
    }
    
    // MARK: - 🌐 웹뷰 설정 메서드
    
    /// 웹뷰 참조 설정 (MainView에서 호출)
    public func setWebView(_ webView: WKWebView) {
        print("🔥🔥🔥 [CRITICAL] LocationService webView 설정됨! 🔥🔥🔥")
        self.webView = webView
    }
    
    // MARK: - 📍 위치 권한 처리 (iOS 14+ 최적화)
    
    /// 위치 권한 요청 (iOS 14+ 권장: delegate 완전 기반)
    public func startLocationUpdatesWithPermissionCheck(completion: (() -> Void)? = nil) {
        print("📍 [LOCATION] 위치 업데이트 시작 - delegate 기반 권한 처리")
        
        // 백그라운드에서 안전하게 위치 업데이트 시작
        DispatchQueue.global(qos: .utility).async {
            DispatchQueue.main.async {
                // 프리퍼미션 전에 시스템 팝업을 유발하지 않기 위해 여기서는 requestWhenInUseAuthorization를 호출하지 않는다
                // startUpdatingLocation은 호출하되, 권한 팝업은 MainView에서 명시적으로만 띄움
                if #available(iOS 14.0, *) {
                    let status = self.locationManager.authorizationStatus
                    print("📍 [LOCATION] startLocationUpdates - 현재 상태: \(status.rawValue)")
                    if status == .notDetermined { self.pendingAuthCompletion = completion } else { completion?() }
                } else {
                    let status = CLLocationManager.authorizationStatus()
                    print("📍 [LOCATION] startLocationUpdates - 현재 상태: \(status.rawValue)")
                    if status == .notDetermined { self.pendingAuthCompletion = completion } else { completion?() }
                }
                self.locationManager.startUpdatingLocation()
                print("📍 [LOCATION] 위치 업데이트 요청 완료 - 시스템 팝업은 별도 경로에서 처리")
            }
        }
    }

    /// 명시적으로 시스템 위치 권한 팝업을 띄움 (프리퍼미션 이후 호출)
    public func requestWhenInUseAuthorization(completion: (() -> Void)? = nil) {
        DispatchQueue.main.async {
            if #available(iOS 14.0, *) {
                let status = self.locationManager.authorizationStatus
                if status == .notDetermined {
                    self.pendingAuthCompletion = completion
                    self.locationManager.requestWhenInUseAuthorization()
                } else {
                    completion?()
                }
            } else {
                let status = CLLocationManager.authorizationStatus()
                if status == .notDetermined {
                    self.pendingAuthCompletion = completion
                    self.locationManager.requestWhenInUseAuthorization()
                } else {
                    completion?()
                }
            }
        }
    }
    
    /// 권한 상태별 처리 로직 분리
    private func handleAuthorizationStatus(_ authStatus: CLAuthorizationStatus) {
        switch authStatus {
        case .notDetermined:
            print("📍 [LOCATION] 위치 권한 미설정")
        case .denied, .restricted:
            print("📍 [LOCATION] 위치 권한 거부됨")
            self.handleLocationPermissionDenied()
        case .authorizedWhenInUse:
            print("📍 [LOCATION] 앱 사용 중 위치 권한 허용")
            self.configureBackgroundLocationIfNeeded()
        case .authorizedAlways:
            print("📍 [LOCATION] 항상 위치 권한 허용")
            self.configureBackgroundLocationIfNeeded()
        @unknown default:
            print("📍 [LOCATION] 알 수 없는 위치 권한 상태")
        }
    }
    
    /// 위치 권한 거부 시 처리
    private func handleLocationPermissionDenied() {
        print("⚠️ [LOCATION] 위치 권한이 거부되었습니다")
        // 필요시 사용자에게 설정 페이지 이동 안내
    }
    
    private func configureBackgroundLocationIfNeeded() {
        // delegate에서만 호출되므로 이미 권한이 허용된 상태
        print("📍 [LOCATION] 백그라운드 위치 업데이트 설정 시작")
        
        // 백그라운드 스레드에서 위치 서비스 확인 및 설정 (UI 응답성 보장)
        DispatchQueue.global(qos: .utility).async {
            let isLocationEnabled = CLLocationManager.locationServicesEnabled()
            
            DispatchQueue.main.async {
                if isLocationEnabled {
                    // 백그라운드 위치 업데이트 활성화
                    self.locationManager.allowsBackgroundLocationUpdates = true
                    self.locationManager.pausesLocationUpdatesAutomatically = false
                    self.locationManager.showsBackgroundLocationIndicator = true
                    self.locationManager.startMonitoringSignificantLocationChanges()
                    print("✅ [LOCATION] 백그라운드 위치 업데이트 설정 완료")
                } else {
                    print("⚠️ [LOCATION] 위치 서비스가 비활성화됨")
                }
            }
        }
    }
    

    
    /// ⚠️ Deprecated: startLocationUpdatesWithPermissionCheck() 사용 권장
    @available(*, deprecated, message: "iOS 14+ 권장: startLocationUpdatesWithPermissionCheck() 사용")
    public func startUpdatingLocation(){
        print("⚠️ [LOCATION] deprecated 메서드 호출됨. startLocationUpdatesWithPermissionCheck() 사용 권장")
        // 안전한 메서드로 리다이렉트
        startLocationUpdatesWithPermissionCheck()
    }
    
    public func getLastLocation() -> CLLocation {
        return self.lastLocation
    }
    
    public func auth() {
        Utils.shared.getToken { mt_token_id in
            var dic = Dictionary<String, Any>()
            dic["mt_token_id"] = mt_token_id
            
            print("🔐 [AUTH] 인증 시도 시작 - 토큰: \(String(mt_token_id.prefix(20)))...")
            
            Api.shared.auth(dic: dic) { response, error in
                if let error = error {
                    print("❌ [AUTH] 네트워크 오류: \(error)")
                    self.handleAuthFailure(reason: "네트워크 오류")
                    return
                }
                
                if let response = response {
                    if response.success == "true" {
                        print("✅ [AUTH] 인증 성공!")
                        guard let authData = response.data else { return }
                        self.receiveAuth(authData: authData)
                    } else {
                        let failMessage = response.message ?? "알 수 없는 오류"
                        print("❌ [AUTH] 인증 실패: \(failMessage)")
                        
                        // 신규 토큰인 경우 특별 처리
                        if failMessage.contains("신규앱토큰") {
                            print("🆕 [AUTH] 신규 토큰 감지 - 토큰 등록 시도")
                            self.handleNewTokenRegistration(token: mt_token_id)
                        } else {
                            self.handleAuthFailure(reason: failMessage)
                        }
                    }
                } else {
                    print("❌ [AUTH] 응답 없음")
                    self.handleAuthFailure(reason: "서버 응답 없음")
                }
            }
        }
    }
    
    private func handleNewTokenRegistration(token: String) {
        print("🆕 [AUTH] 신규 토큰 등록 프로세스 시작")
        
        // 일단 임시 mt_idx 설정 (실제 등록 프로세스가 구현될 때까지)
        let tempMtIdx = "temp_\(Int(Date().timeIntervalSince1970))"
        self.savedMtIdx = tempMtIdx
        Utils.shared.setMtIdx(mtIdx: tempMtIdx)
        
        print("⚠️ [AUTH] 임시 mt_idx 설정: \(tempMtIdx)")
        print("⚠️ [AUTH] 실제 토큰 등록은 웹에서 진행해주세요")
        
        // 위치 데이터 전송을 계속 진행
        if self.lastLocation.coordinate.latitude != 0.0 && self.lastLocation.coordinate.longitude != 0.0 {
            print("📍 [AUTH] 임시 인증으로 위치 데이터 전송 시도")
            // memberLocation 호출하지 않고 웹뷰로만 전송
        }
    }
    
    private func handleAuthFailure(reason: String) {
        print("❌ [AUTH] 인증 실패 처리: \(reason)")
        
        // 인증 실패해도 위치 수집은 계속 진행
        print("📍 [AUTH] 인증 실패했지만 위치 수집은 계속 진행")
        
        // 임시 식별자로 위치 서비스 유지
        let fallbackMtIdx = "guest_\(Int(Date().timeIntervalSince1970))"
        self.savedMtIdx = fallbackMtIdx
        
        print("⚠️ [AUTH] 게스트 모드로 전환: \(fallbackMtIdx)")
        print("⚠️ [AUTH] 로그인 후 정상적인 위치 추적이 가능합니다")
    }
    
    private func receiveAuth(authData: AuthData) {
        guard let mt_idx = authData.mt_idx else { return }
        self.savedMtIdx = String(mt_idx)
        Utils.shared.setMtIdx(mtIdx: String(mt_idx))
        if self.lastLocation.coordinate.latitude != 0.0 && self.lastLocation.coordinate.longitude != 0.0 {
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
            
            let dateTime = dateFormatter.string(from: self.lastLocation.timestamp)
            
            var mltGpsDataList: [MltGpsData] = []
            
//            print("origin lat =============== \(self.lastLocation.coordinate.latitude)")
//            print("origin lat =============== \(self.lastLocation.coordinate.longitude)")
//            print("convert lat =============== \(String(format: "%.5f", self.lastLocation.coordinate.latitude))")
//            print("convert long =============== \(String(format: "%.5f", self.lastLocation.coordinate.longitude))")
            
            var speed = self.lastLocation.speed
            if self.lastLocation.speed < 0 {
                speed = 0
            }
            
            let mlt_lat = String(format: "%.5f", self.lastLocation.coordinate.latitude)
            let mlt_long = String(format: "%.5f", self.lastLocation.coordinate.longitude)
            
//            let mltGpsData = MltGpsData(
//                mlt_lat: String(self.lastLocation.coordinate.latitude),
//                mlt_long: String(self.lastLocation.coordinate.longitude),
//                mlt_speed: String(self.lastLocation.speed),
//                mlt_accuacy: String(self.lastLocation.horizontalAccuracy),
//                mlt_gps_time: dateTime
//            )
            let mltGpsData = MltGpsData(
                mlt_lat: mlt_lat,
                mlt_long: mlt_long,
                mlt_speed: String(speed),
                mlt_accuacy: String(self.lastLocation.horizontalAccuracy),
                mlt_gps_time: dateTime
            )
            
            mltGpsDataList.append(mltGpsData)
            
            self.memberLocation(mltGpsDataList: mltGpsDataList)
        }
    }
    
    private func memberLocation(mltGpsDataList: [MltGpsData]){
        // 🔍 여러 방법으로 mt_idx 찾기 시도
        var mt_idx = Utils.shared.getMtIdx()
        if mt_idx == "" {
            mt_idx = self.savedMtIdx
        }
        
        // 🆕 UserDefaults에서도 mt_idx 확인 (WebViewController에서 저장한 값)
        if mt_idx == "" || mt_idx == "null" {
            if let userDefaultsMtIdx = UserDefaults.standard.string(forKey: "mt_idx"), !userDefaultsMtIdx.isEmpty {
                mt_idx = userDefaultsMtIdx
                self.savedMtIdx = userDefaultsMtIdx // 캐시에도 저장
                print("✅ [LOCATION] UserDefaults에서 mt_idx 복원: \(userDefaultsMtIdx)")
            }
        }
        
        print("mt_idx - \(mt_idx)")
        
        // 🚨 mt_idx가 비어있으면 웹뷰에서 사용자 정보를 받을 때까지 대기
        if mt_idx == "" || mt_idx == "null" {
            print("⚠️ [LOCATION] mt_idx가 비어있음 - 웹뷰에서 사용자 정보 대기")
            print("⚠️ [LOCATION] Utils.getMtIdx(): '\(Utils.shared.getMtIdx())'")
            print("⚠️ [LOCATION] savedMtIdx: '\(self.savedMtIdx)'")
            print("⚠️ [LOCATION] UserDefaults mt_idx: '\(UserDefaults.standard.string(forKey: "mt_idx") ?? "없음")'")
            print("💡 [LOCATION] 프론트엔드에서 SmapApp.user.sendUserInfo() 호출 필요")
            
            // 위치 데이터는 저장해두고 사용자 정보 수신 후 전송
            return
        }
        
        if mt_idx != "" && mt_idx != "null" {
            var mltGpsData = Dictionary<String, [MltGpsData]>()
            mltGpsData["mlt_gps_data"] = mltGpsDataList
            
            guard let mltGpsDataJson = try? JSONEncoder().encode(mltGpsData) else {
                return
            }
            
            guard let mltGpsDataJsonString = String(data: mltGpsDataJson, encoding: .utf8) else {
                return
            }
            
            print("mltGpsDataJsonString \(mltGpsDataJsonString)")
            
            // 배터리 정보
            UIDevice.current.isBatteryMonitoringEnabled = true
            let batteryRemain = UIDevice.current.batteryLevel
            let batteryPercent = String(Int(batteryRemain * 100))
            
            self.getStepCount { stepCount in
                // 🔄 FastAPI create_location_log 액션에 맞게 데이터 개별 필드로 전송
                if let firstGpsData = mltGpsDataList.first {
                    let dateFormatter = DateFormatter()
                    dateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
                    let currentTimeString = dateFormatter.string(from: Date())
                    
                    var dic = Dictionary<String, Any>()
                    dic["mt_idx"] = mt_idx
                    dic["mlt_lat"] = Double(firstGpsData.mlt_lat) ?? 0.0
                    dic["mlt_long"] = Double(firstGpsData.mlt_long) ?? 0.0
                    dic["mlt_accuracy"] = Double(firstGpsData.mlt_accuacy) ?? 0.0
                    dic["mlt_speed"] = Double(firstGpsData.mlt_speed) ?? 0.0
                    dic["mlt_altitude"] = self.lastLocation.altitude
                    dic["mlt_timestamp"] = currentTimeString
                    dic["mlt_battery"] = batteryPercent
                    dic["mlt_fine_location"] = "N"
                    dic["mlt_location_chk"] = "N"
                    dic["mt_health_work"] = String(stepCount)
                    
                    print("📍 [LOCATION] FastAPI로 전송할 위치 데이터:")
                    print("   📍 mt_idx: \(mt_idx)")
                    print("   📍 위도: \(dic["mlt_lat"] ?? "nil")")
                    print("   📍 경도: \(dic["mlt_long"] ?? "nil")")
                    print("   📍 정확도: \(dic["mlt_accuracy"] ?? "nil")")
                    print("   📍 속도: \(dic["mlt_speed"] ?? "nil")")
                    print("   📍 고도: \(dic["mlt_altitude"] ?? "nil")")
                    print("   📍 배터리: \(batteryPercent)%")
                    print("   📍 걸음수: \(stepCount)")
                    
                    Api.shared.memberLocation(dic: dic) { response, error in
                        if let error = error {
                            print("❌ [API] 위치 데이터 전송 실패: \(error)")
                            return
                        }
                        
                        if let response = response {
                            print("✅ [API] 위치 데이터 전송 성공: \(response.success ?? "unknown")")
                            print("📍 [API] 서버 응답: \(response.message ?? "")")
                        } else {
                            print("⚠️ [API] 서버 응답 없음")
                        }
                    }
                } else {
                    print("⚠️ [LOCATION] GPS 데이터가 비어있어 전송하지 않음")
                }
            }
        
        }
    }
    
    private func getStepCount(completionHandler: @escaping(Int) -> Void) {
        // 걸음정보
        let now = Date()
        let startDate = Calendar.current.startOfDay(for: now)
        
        if CMPedometer.isStepCountingAvailable() {
            self.pedoMeter.queryPedometerData(from: startDate, to: now) { (data, error) in
                var stepData: Int = 0
                if error == nil {
                    if let response = data {
                        stepData = Int(truncating: response.numberOfSteps)
                    }
                }
                
                completionHandler(stepData)
            }
        } else {
            completionHandler(0)
        }
    }
    
    @objc func appStateChange(_ notification: Notification){
        print("LocationService appStateChange")
        let state = notification.userInfo?["state"] as? String
        if state == "foreground" {
            // 포그라운드 복귀 시 안전하게 위치 업데이트 재시작
            DispatchQueue.main.async {
                self.locationManager.stopUpdatingLocation()
                self.locationManager.startUpdatingLocation()
            }
        }
    }
    
    // MARK: - CLLocationManagerDelegate
    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        print("🔥🔥🔥 [CRITICAL] LocationService didUpdateLocations 호출됨! 실제 위치 데이터 수신! 🔥🔥🔥")
        print("locations ====> \(locations)")
        print("mt_idx - \(savedMtIdx)")
        
        if locations.count > 0 {
            
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
            
            var mltGpsDataList: [MltGpsData] = []
            
            locations.forEach { location in
                var speed = location.speed
                if location.speed < 0 {
                    speed = 0
                }
                
                let mlt_lat = String(format: "%.5f", location.coordinate.latitude)
                let mlt_long = String(format: "%.5f", location.coordinate.longitude)
                
                let dateTime = dateFormatter.string(from: location.timestamp)
                
                let mltGpsData = MltGpsData(
                    mlt_lat: mlt_lat,
                    mlt_long: mlt_long,
                    mlt_speed: String(speed),
                    mlt_accuacy: String(location.horizontalAccuracy),
                    mlt_gps_time: dateTime
                )
                
                mltGpsDataList.append(mltGpsData)
                
                self.lastLocation = location
                
                // 🔥🔥🔥 [CRITICAL] 웹뷰로 위치 데이터 전송 🔥🔥🔥
                sendLocationToWebView(location)
            }
            
            if mltGpsDataList.count > 0 {
                self.memberLocation(mltGpsDataList: mltGpsDataList)
            }
        }
    }
    
    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("❌ [LOCATION] 위치 정보 가져오기 실패: \(error.localizedDescription)")
    }
    
    // MARK: - 📍 CLLocationManagerDelegate (iOS 14+ 최적화)
    
    // MARK: - 📍 iOS 14+ Delegate 메서드
    @available(iOS 14.0, *)
    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        // iOS 14+: manager 파라미터 사용 (안전)
        let locationAuthorizationStatus = manager.authorizationStatus
        self.handleAuthorizationStatusChange(locationAuthorizationStatus)
    }
    
    // MARK: - 📍 iOS 13 이하 Delegate 메서드
    public func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        // iOS 13 이하: status 파라미터 직접 사용 (안전)
        self.handleAuthorizationStatusChange(status)
    }
    
    // MARK: - 📍 권한 상태 변경 공통 처리
    private func handleAuthorizationStatusChange(_ locationAuthorizationStatus: CLAuthorizationStatus) {
        self.locationAuthStatus = locationAuthorizationStatus
        print("📍 [LOCATION] 권한 상태 변경: \(locationAuthorizationStatus)")
        
        switch locationAuthorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            print("✅ [LOCATION] GPS 권한 허용됨 - 위치 업데이트 시작")
            
            // 백그라운드 스레드에서 위치 업데이트 설정 (UI 응답성 보장)
            DispatchQueue.global(qos: .utility).async {
                self.configureBackgroundLocationIfNeeded()
                // 권한 허용되었으면 위치 업데이트 보장 시작
                self.locationManager.startUpdatingLocation()
                
                // iOS 14+에서는 자동 권한 업그레이드 요청 비활성화
                // 앱에서 필요시 수동으로 Always 권한 요청
                if locationAuthorizationStatus == .authorizedWhenInUse {
                    print("📍 [LOCATION] WhenInUse 권한 허용됨 - Always 권한은 필요시 별도 요청")
                }
            }
            // pending completion 호출
            if let done = self.pendingAuthCompletion { self.pendingAuthCompletion = nil; DispatchQueue.main.async { done() } }
            
        case .restricted:
            print("⚠️ [LOCATION] GPS 권한 제한됨 (기업 정책 등)")
            self.handleLocationPermissionDenied()
            if let done = self.pendingAuthCompletion { self.pendingAuthCompletion = nil; DispatchQueue.main.async { done() } }
            
        case .notDetermined:
            print("🔄 [LOCATION] GPS 권한 미설정 상태")
            // 이미 권한 요청이 진행 중이므로 추가 요청하지 않음
            
        case .denied:
            print("❌ [LOCATION] GPS 권한 거부됨")
            self.handleLocationPermissionDenied()
            if let done = self.pendingAuthCompletion { self.pendingAuthCompletion = nil; DispatchQueue.main.async { done() } }
            
        @unknown default:
            print("❓ [LOCATION] 알 수 없는 권한 상태")
            if let done = self.pendingAuthCompletion { self.pendingAuthCompletion = nil; DispatchQueue.main.async { done() } }
        }
    }
    
    // MARK: - 🔧 공개 메서드 (외부 호출용)
    
    /// 위치 권한 상태 확인 (delegate 기반, 직접 권한 요청 없음)
    public func checkLocationPermissionStatus(completion: @escaping (Bool) -> Void) {
        print("📍 [LOCATION] 위치 권한 상태 확인 - delegate 기반")
        
        // iOS 14+ 권장 방식: 직접 권한 요청 금지
        // 현재 delegate에서 관리되는 상태만 확인
        let isAuthorized = self.locationAuthStatus == .authorizedAlways || 
                          self.locationAuthStatus == .authorizedWhenInUse
        
        print("📍 [LOCATION] 현재 권한 상태: \(isAuthorized ? "허용" : "미허용")")
        
        if !isAuthorized {
            print("📍 [LOCATION] 권한이 필요한 경우 startLocationUpdatesWithPermissionCheck() 사용")
        }
        
        completion(isAuthorized)
    }
    

    
    // MARK: - 👤 사용자 정보 처리 메서드
    
    /// 웹뷰에서 전달받은 사용자 정보 업데이트
    public func updateUserInfo(mtIdx: String, mtId: String, mtName: String) {
        print("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨")
        print("🚨 [LOCATION-SERVICE-2025-08-07] 사용자 정보 업데이트 수신!! 🚨")
        print("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨")
        print("👤 [LOCATION-USER] 사용자 정보 업데이트 시작")
        print("   👤 mt_idx: \(mtIdx)")
        print("   👤 mt_id: \(mtId)")
        print("   👤 mt_name: \(mtName)")
        
        // 기존 인증 프로세스 건너뛰고 직접 mt_idx 설정
        self.savedMtIdx = mtIdx
        Utils.shared.setMtIdx(mtIdx: mtIdx)
        
        print("✅ [LOCATION-USER] 사용자 정보 설정 완료 - 인증 프로세스 건너뛰기")
        print("💾 [LOCATION-USER] savedMtIdx: \(self.savedMtIdx)")
        print("💾 [LOCATION-USER] Utils.getMtIdx(): \(Utils.shared.getMtIdx())")
        
        // 📍 현재 위치가 있다면 즉시 서버로 전송
        if self.lastLocation.coordinate.latitude != 0.0 && self.lastLocation.coordinate.longitude != 0.0 {
            print("📍 [LOCATION-USER] 저장된 위치 정보 발견 - 즉시 서버 전송")
            
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
            let dateTime = dateFormatter.string(from: self.lastLocation.timestamp)
            
            var mltGpsDataList: [MltGpsData] = []
            let mltGpsData = MltGpsData(
                mlt_lat: String(format: "%.5f", self.lastLocation.coordinate.latitude),
                mlt_long: String(format: "%.5f", self.lastLocation.coordinate.longitude),
                mlt_speed: String(max(0, self.lastLocation.speed)),
                mlt_accuacy: String(self.lastLocation.horizontalAccuracy),
                mlt_gps_time: dateTime
            )
            
            mltGpsDataList.append(mltGpsData)
            self.memberLocation(mltGpsDataList: mltGpsDataList)
        } else {
            print("📍 [LOCATION-USER] 저장된 위치 정보 없음 - 위치 업데이트 대기")
        }
    }
    
    /// 사용자 로그아웃 시 정보 정리
    public func clearUserInfo() {
        print("👤 [LOCATION-USER] 사용자 정보 정리 시작")
        
        self.savedMtIdx = ""
        Utils.shared.removeMtIdx()
        
        print("✅ [LOCATION-USER] 사용자 정보 정리 완료")
        print("💾 [LOCATION-USER] savedMtIdx: \(self.savedMtIdx)")
        print("💾 [LOCATION-USER] Utils.getMtIdx(): \(Utils.shared.getMtIdx())")
    }
    
    // MARK: - 🌐 웹뷰 통신 메서드
    
    private func sendLocationToWebView(_ location: CLLocation) {
        guard let webView = self.webView else {
            print("⚠️ [LOCATION] 웹뷰 참조가 없음 - 위치 데이터 전송 건너뜀")
            return
        }
        
        print("🔥🔥🔥 [CRITICAL] sendLocationToWebView 호출됨! 웹뷰로 위치 데이터 전송! 🔥🔥🔥")
        print("📍 [LOCATION] 전송할 데이터:")
        print("   📍 위도: \(location.coordinate.latitude)")
        print("   📍 경도: \(location.coordinate.longitude)")
        print("   📍 정확도: \(location.horizontalAccuracy)")
        print("   📍 속도: \(location.speed)")
        print("   📍 고도: \(location.altitude)")
        print("   📍 타임스탬프: \(location.timestamp)")
        
        let timestampMs = Int(location.timestamp.timeIntervalSince1970 * 1000)
        let resultScript = """
            console.log('🔥🔥🔥 [LocationService] 위치 업데이트 스크립트 실행 시작! 🔥🔥🔥');
            console.log('📍 [LocationService] window.onLocationUpdate 존재 여부:', typeof window.onLocationUpdate);
            console.log('📍 [LocationService] mt_idx 상태:', '\(savedMtIdx)');
            console.log('📍 [LocationService] mt_idx 길이:', '\(savedMtIdx)'.length);
            
            if (window.onLocationUpdate) {
                console.log('📍 [LocationService] 지속적 위치 업데이트 콜백 실행');
                
                const locationData = {
                    latitude: \(location.coordinate.latitude),
                    longitude: \(location.coordinate.longitude),
                    accuracy: \(location.horizontalAccuracy),
                    speed: \(location.speed),
                    altitude: \(location.altitude),
                    timestamp: \(timestampMs),
                    source: 'ios-location-service',
                    mt_idx: '\(savedMtIdx)',
                    debug: {
                        savedMtIdx: '\(savedMtIdx)',
                        hasValidMtIdx: '\(savedMtIdx)' !== '' && '\(savedMtIdx)' !== 'null',
                        platform: 'iOS'
                    }
                };
                
                console.log('📍 [LocationService] 전송할 위치 데이터:', locationData);
                
                try {
                    window.onLocationUpdate(locationData);
                    console.log('📍 [LocationService] 위치 업데이트 콜백 실행 완료');
                } catch (error) {
                    console.error('❌ [LocationService] 위치 업데이트 콜백 실행 중 오류:', error);
                }
            } else {
                console.log('⚠️ [LocationService] onLocationUpdate 함수를 찾을 수 없습니다');
                console.log('⚠️ [LocationService] window 객체 확인:', typeof window);
                
                // 강제로 onLocationUpdate 함수 등록
                console.log('🔧 [LocationService] onLocationUpdate 함수 강제 등록');
                window.onLocationUpdate = function(data) {
                    console.log('📍 [TEMP-LocationService] 임시 onLocationUpdate 함수 호출:', data);
                };
                
                // 다시 시도
                const locationData = {
                    latitude: \(location.coordinate.latitude),
                    longitude: \(location.coordinate.longitude),
                    accuracy: \(location.horizontalAccuracy),
                    speed: \(location.speed),
                    altitude: \(location.altitude),
                    timestamp: \(timestampMs),
                    source: 'ios-location-service',
                    mt_idx: '\(savedMtIdx)',
                    debug: {
                        savedMtIdx: '\(savedMtIdx)',
                        hasValidMtIdx: '\(savedMtIdx)' !== '' && '\(savedMtIdx)' !== 'null',
                        platform: 'iOS'
                    }
                };
                
                window.onLocationUpdate(locationData);
            }
        """
        
        print("📍 [LOCATION] JavaScript 스크립트 생성 완료")
        
        DispatchQueue.main.async {
            webView.evaluateJavaScript(resultScript) { result, error in
                if let error = error {
                    print("❌ [LOCATION] 위치 업데이트 웹 콜백 실행 실패: \(error)")
                } else {
                    print("✅ [LOCATION] 위치 업데이트 웹 콜백 실행 완료")
                    print("📍 [LOCATION] JavaScript 실행 결과: \(result ?? "null")")
                }
            }
        }
    }
}
