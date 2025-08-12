//
//  MainView.swift
//  smap
//
//  Created by  Corp. Dmonster on 12/15/23.
//

import UIKit
import WebKit
import CoreLocation
import MessageUI
import SwiftyStoreKit
import GoogleSignIn
import KakaoSDKCommon
import KakaoSDKAuth
import KakaoSDKUser
import AuthenticationServices

class MainView: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    var popoverController: UIPopoverPresentationController?// 태블릿용 공유하기 띄우기
    
    private var eventUrl = ""
    private var invitationCode = ""
    
    @IBOutlet weak var loadingView: UIView!
    @IBOutlet weak var indi: UIActivityIndicatorView!
    
    @IBOutlet weak var web_view: WKWebView!
    
    private var webViewPageType = ""
    private var fileUploadMtIdx = ""
    
    // 광고 관련 코드 제거됨 (웹뷰 앱에서는 사용하지 않음)
    // private var interstitial: GADInterstitialAd?
    // private let interstitialID = "ca-app-pub-7432142706137657/9785898551"
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // 🚨 강제 빌드 트리거 변수 (Xcode가 파일 변경을 감지하도록)
        _ = "FORCE_BUILD_2025_08_07_USER_INFO_MAINVIEW_V1"
        
        // 🚨🚨🚨 빌드 확인용 로그 - 이 로그가 보이면 새로운 코드가 빌드된 것 🚨🚨🚨
        print("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨")
        print("🚨 [MAINVIEW-BUILD-CHECK] *** 2025.08.07 MainView 사용자 정보 처리 추가 *** 🚨")
        print("🚨 [MAINVIEW-BUILD-CHECK] 새로운 빌드가 적용되었습니다!")
        print("🚨 [MAINVIEW-BUILD-CHECK] userInfo 메시지 처리 추가됨")
        print("🚨 [MAINVIEW-BUILD-CHECK] LocationService 사용자 정보 전달 구현")
        print("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨")
        
        // 초기 로딩 상태 설정
        self.loadingView.alpha = 1 // 초기에는 로딩 화면 표시
        self.indi.startAnimating()
        
        NotificationCenter.default.addObserver(self, selector: #selector(self.getPush(_:)), name: NSNotification.Name(rawValue: "getPush"), object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(self.getDeepLink(_:)), name: NSNotification.Name(rawValue: "getDeepLink"), object: nil)
        
        if let invitation_code = UserDefaults.standard.string(forKey: "invitation_code") {
            if !invitation_code.isEmpty {
                if invitation_code != "null" {
                    self.invitationCode = invitation_code
                    UserDefaults.standard.removeObject(forKey: "invitation_code")
                }
            }
        }
        
        if let event_url = UserDefaults.standard.string(forKey: "event_url") {
            if !event_url.isEmpty {
                if event_url != "null" {
                    self.eventUrl = event_url
                    UserDefaults.standard.removeObject(forKey: "event_url")
                }
            }
        }
        
        // 🚨 중요: 다중 메시지 핸들러 등록 (강화된 호환성)
        print("📱 [MessageHandler] MainView 핸들러 등록 시작")
        self.web_view.configuration.userContentController.add(self, name: "smapIos")      // 메인 핸들러
        self.web_view.configuration.userContentController.add(self, name: "iosHandler")   // 백업 핸들러
        self.web_view.configuration.userContentController.add(self, name: "hapticHandler") // 햅틱 전용 핸들러
        self.web_view.configuration.userContentController.add(self, name: "messageHandler") // 범용 핸들러
        
        print("📱 [MessageHandler] 등록된 핸들러들:")
        print("   - smapIos (메인)")
        print("   - iosHandler (백업)")
        print("   - hapticHandler (햅틱 전용)")
        print("   - messageHandler (범용)")
        
        self.web_view.configuration.preferences.javaScriptEnabled = true
        self.web_view.configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        
        if #available(iOS 14.0, *) {
            self.web_view.configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        } else {
            self.web_view.configuration.preferences.javaScriptEnabled = true
        }
        
        // 디버깅을 위한 설정
        if #available(iOS 16.4, *) {
            self.web_view.isInspectable = true
        }
        
        // JavaScript 핸들러 상태 확인 및 햅틱 시스템 초기화 스크립트
        let errorScript = """
            (function() {
                'use strict';
                
                // 🔍 핸들러 상태 확인 함수
                function checkHandlers() {
                    console.log('🔍 [Handler Check] MainView 핸들러 상태 확인 시작');
                    const webkit = window.webkit;
                    
                    if (!webkit) {
                        console.error('❌ [Handler Check] WebKit 객체 없음');
                        return false;
                    }
                    
                    if (!webkit.messageHandlers) {
                        console.error('❌ [Handler Check] messageHandlers 객체 없음');
                        return false;
                    }
                    
                    const handlers = Object.keys(webkit.messageHandlers);
                    console.log('✅ [Handler Check] 등록된 핸들러들:', handlers);
                    
                    // 각 핸들러 테스트
                    handlers.forEach(function(handlerName) {
                        try {
                            webkit.messageHandlers[handlerName].postMessage({
                                type: 'handlerTest',
                                handler: handlerName,
                                timestamp: Date.now(),
                                url: window.location.href
                            });
                            console.log('✅ [Handler Check] ' + handlerName + ' 테스트 성공');
                        } catch (error) {
                            console.error('❌ [Handler Check] ' + handlerName + ' 테스트 실패:', error);
                        }
                    });
                    
                    // 전역 함수로 등록 (웹에서 호출 가능)
                    window.SMAP_CHECK_NATIVE_HANDLERS = function() {
                        return {
                            hasWebKit: !!webkit,
                            hasMessageHandlers: !!webkit.messageHandlers,
                            handlers: handlers,
                            totalHandlers: handlers.length,
                            timestamp: new Date().toISOString()
                        };
                    };
                    
                    return handlers.length > 0;
                }
                
                // 🎮 SMAP 햅틱 시스템 초기화
                console.log('🎮 [SMAP-JS] 햅틱 시스템 초기화 시작');
                
                // 에러 캐치
                window.addEventListener('error', function(e) {
                    console.log('JavaScript Error:', e.message, 'at', e.filename, ':', e.lineno);
                    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.smapIos) {
                        window.webkit.messageHandlers.smapIos.postMessage({
                            type: 'jsError',
                            param: e.message + ' at ' + e.filename + ':' + e.lineno
                        });
                    }
                });
                
                // 🎮 햅틱 피드백 전역 함수들
                window.smapHaptic = function(type) {
                    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.smapIos) {
                        window.webkit.messageHandlers.smapIos.postMessage({
                            type: 'haptic',
                            param: type || 'medium'
                        });
                        console.log('🎮 [SMAP-JS] 햅틱 요청: ' + (type || 'medium'));
                    } else {
                        console.warn('🎮 [SMAP-JS] smapIos 핸들러 없음');
                    }
                };
                
                // 햅틱 편의 함수들
                window.hapticLight = function() { window.smapHaptic('light'); };
                window.hapticMedium = function() { window.smapHaptic('medium'); };
                window.hapticHeavy = function() { window.smapHaptic('heavy'); };
                window.hapticSuccess = function() { window.smapHaptic('success'); };
                window.hapticWarning = function() { window.smapHaptic('warning'); };
                window.hapticError = function() { window.smapHaptic('error'); };
                window.hapticSelection = function() { window.smapHaptic('selection'); };
                
                // iOS 플래그 설정
                window.isSMAPiOS = true;
                window.SMAPVersion = '1.0';
                
                console.log('✅ [SMAP-JS] 햅틱 함수들 등록 완료');
                console.log('💡 [SMAP-JS] 사용법: hapticSuccess(), hapticLight(), hapticMedium() 등');
                
                // 즉시 핸들러 확인 실행
                checkHandlers();
                
                // 페이지 로드 완료 후 다시 확인
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', checkHandlers);
                } else {
                    setTimeout(checkHandlers, 100);
                }
                
                window.addEventListener('load', function() {
                    setTimeout(checkHandlers, 500);
                });
                
                console.log('🔍 [Handler Check] 핸들러 확인 스크립트 초기화 완료');
            })();
        """
        let userScript = WKUserScript(source: errorScript, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        self.web_view.configuration.userContentController.addUserScript(userScript)
        
        self.web_view.navigationDelegate = self
        self.web_view.uiDelegate = self
        self.web_view.allowsBackForwardNavigationGestures = false
        self.web_view.setKeyboardRequiresUserInteraction(false)
    
        WKWebsiteDataStore.default().fetchDataRecords(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), completionHandler: {
            records -> Void in
            records.forEach { WKWebsiteDataStore.default().removeData(ofTypes: $0.dataTypes, for: [$0], completionHandler: {}) }
        })
    
        let location = LocationService.sharedInstance.getLastLocation()
        var urlString = Http.shared.getWebBaseURL() + "auth?mt_token_id=%@"
    
        if location.coordinate.latitude != 0.0 && location.coordinate.longitude != 0.0 {
            urlString = "\(urlString)&mt_lat=\(location.coordinate.latitude)&mt_long=\(location.coordinate.longitude)"
        }
        
        Utils.shared.getToken { token in
            urlString = String.init(format: urlString, token)
            print("로드할 URL: \(urlString)")
            
            if !self.eventUrl.isEmpty {
                if let eventUrlResult = self.eventUrl.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
                   urlString += "&event_url=\(eventUrlResult)"
                }
                self.eventUrl = ""
            }
            
            if !self.invitationCode.isEmpty {
                urlString += "&event_url=\(self.invitationCode)"
                self.invitationCode = ""
            }
            
            guard let url = URL(string: urlString) else {
                print("유효하지 않은 URL: \(urlString)")
                DispatchQueue.main.async {
                    self.hideLoading()
                    let alert = UIAlertController(title: "오류", 
                                                message: "잘못된 서버 주소입니다.", 
                                                preferredStyle: .alert)
                    alert.addAction(UIAlertAction(title: "확인", style: .default))
                    self.present(alert, animated: true)
                }
                return
            }
            
            var request = URLRequest(url: url)
            request.setValue(Http.shared.hashKey, forHTTPHeaderField: "AUTH_SECRETKEY")
            request.timeoutInterval = 30.0 // 30초 타임아웃
            
            print("웹뷰 로딩 시작: \(url)")
            
            DispatchQueue.main.async {
                self.showLoading()
                self.web_view.load(request)
                
                // 🔥🔥🔥 [CRITICAL] LocationService에 웹뷰 참조 설정 🔥🔥🔥
                LocationService.sharedInstance.setWebView(self.web_view)
            }
        }
        
        //백그라운드 포그라운드 상태 받기
        NotificationCenter.default.addObserver(self, selector: #selector(self.appStateForeground), name: NSNotification.Name(rawValue: "appStateForeground"), object: nil)
        
        // 광고 로딩 제거됨 (웹뷰 앱에서는 사용하지 않음)
        // Task {
        //     await self.loadAds(isShow:false, errorCount:0)
        // }
        
        self.locationPermissionCheck()
        
        // 🎮 햅틱 시스템 테스트 (항상 실행 - 실제 기기 테스트용)
        // testHapticSystem()
    }
    
    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        if let popoverController = self.popoverController {
            popoverController.sourceView = self.view
            popoverController.sourceRect = CGRect(x: size.width*0.5, y: size.height*0.5, width: 0, height: 0)
            popoverController.permittedArrowDirections = []
        }
    }
    
    @objc func appStateForeground(){
        self.web_view.reload()
        
        self.locationPermissionCheck()
        
        let location = LocationService.sharedInstance.getLastLocation()
        let lat = location.coordinate.latitude
        let long = location.coordinate.longitude
        
        //print("location_refresh('\(self.webViewPageType)', '\(lat)', '\(long)');")
        
        self.web_view.evaluateJavaScript("location_refresh('\(self.webViewPageType)', '\(lat)', '\(long)');") { (any, err) -> Void in
            print(err ?? "[location_refresh] IOS >> 자바스크립트 : SUCCESS")
        }
    }
    
    @objc private func getPush(_ notification: Notification) {
        guard let event_url = notification.userInfo?["event_url"] as? String else {return}
        
        if !event_url.isEmpty {
            if event_url != "null" {
                UserDefaults.standard.removeObject(forKey: "event_url")
                let url = URL(string: event_url)
                self.web_view.load(URLRequest(url: url!))
            }
        }
    }
    
    @objc private func getDeepLink(_ notification: Notification) {
        guard let invitation_code = notification.userInfo?["invitation_code"] as? String else { return }
        if !invitation_code.isEmpty {
            if invitation_code != "null" {
                UserDefaults.standard.removeObject(forKey: "invitation_code")
                self.web_view.evaluateJavaScript("invite_code_insert('\(invitation_code)');") { (any, err) -> Void in
                    print(err ?? "[invite_code_insert] IOS >> 자바스크립트 : SUCCESS")
                }
            }
        }
    }
    
    // 웹뷰 앱에서는 네이티브 광고를 사용하지 않음
    private func showAd() {
        print("웹뷰 앱에서는 웹기반 광고를 사용합니다.")
    }
    
    private func loadAds(isShow: Bool, errorCount: Int) async {
        // 광고 관련 코드 비활성화
        print("광고 기능이 비활성화되었습니다.")
        return
    }
    
    private func locationPermissionCheck() {
        print("locationPermissionCheck 호출됨")
        
        // 현재 위치 권한 상태를 정확히 확인
        let currentStatus = LocationService.sharedInstance.locationAuthStatus
        print("현재 위치 권한 상태: \(currentStatus?.rawValue ?? -1)")
        
        if currentStatus == .authorizedWhenInUse {
            print("✅ 위치 권한이 '앱 사용 중'으로 허용되어 있음 (기본적으로 충분함)")
        } else if currentStatus == .authorizedAlways {
            print("✅ 위치 권한이 '항상 허용'으로 설정되어 있음")
        } else if currentStatus != .authorizedAlways {
            print("⚠️ 위치 권한이 '항상 허용'으로 설정되지 않음 (현재: \(currentStatus?.rawValue ?? -1))")
            let mt_idx = Utils.shared.getMtIdx()
            if !mt_idx.isEmpty {
                print("mt_idx가 비어있지 않음: \(mt_idx)")

                let title = NSLocalizedString("LOCATION_PERMISSION_TITLE", comment: "")
                let message = NSLocalizedString("LOCATION_PERMISSION_MESSAGE", comment: "")

                let alert = UIAlertController(title: title,
                                            message: message, preferredStyle: .alert)
                let confirm = UIAlertAction(title: NSLocalizedString("LOCATION_PERMISSION_SETTINGS_BUTTON", comment: ""), style: .default) { action in
                    guard let url = URL(string: UIApplication.openSettingsURLString) else { 
                        print("설정 URL을 생성할 수 없음")
                        return 
                    }

                    if UIApplication.shared.canOpenURL(url) {
                        print("설정 URL을 열 수 있음")
                        UIApplication.shared.open(url)
                    } else {
                        print("설정 URL을 열 수 없음")
                    }
                }
                let cancel = UIAlertAction(title: NSLocalizedString("LOCATION_PERMISSION_CANCEL_BUTTON", comment: ""), style: .cancel)
                
                alert.addAction(confirm)
                alert.addAction(cancel)
                
                present(alert, animated: true)
                print("위치 권한 설정 알림 표시됨")
            } else {
                print("mt_idx가 비어있음")
            }
        }
        
        // Always 권한 또는 WhenInUse 권한이 있으면 정상으로 간주
        if currentStatus == .authorizedAlways || currentStatus == .authorizedWhenInUse {
            print("✅ 위치 권한이 적절히 설정되어 있음")
        }
    }
    
    // YPImagePicker 관련 코드 비활성화 (웹뷰 앱에서는 사용하지 않음)
    private func openPhoto(isCamera: Bool) {
        print("사진 선택 기능이 비활성화되었습니다. 웹뷰에서 파일 선택을 사용하세요.")
        
        // 웹뷰에서 파일 업로드는 HTML input[type="file"]을 통해 처리됩니다.
        // 네이티브 이미지 피커는 더 이상 사용하지 않습니다.
        /*
        var config = YPImagePickerConfiguration()
        
        config.library.mediaType = .photo
        config.library.defaultMultipleSelection = false
        config.library.maxNumberOfItems = 1

        if isCamera {
            config.screens = [.photo]
            config.startOnScreen = .photo
        } else {
            config.screens = [.library]
            config.startOnScreen = .library
        }
        
        // cropping style 을 square or not 으로 지정.
        config.library.isSquareByDefault = false

        // 필터 단계 스킵.
        config.showsPhotoFilters = false

        // crop overlay 의 default 색상.
        config.colors.cropOverlayColor = .gray.withAlphaComponent(0.8)
        // 327 * 540 비율로 crop 희망.
        config.showsCrop = .rectangle(ratio: 0.6)

        // 이전에 선택한 이미지가 pre-selected 되도록 함.
        //config.library.preselectedItems = selectedImage

        // 새 이미지를 사진 라이브러리에 저장하지 않음.
        // 👉 저장하지 않으면 selectedImage 에 담긴 이미지가 사진 라이브러리에서 찾을 수가 없어서 가장 앞에 이미지를 선택함.
        config.shouldSaveNewPicturesToAlbum = false

        let imagePicker = YPImagePicker(configuration: config)
        imagePicker.imagePickerDelegate = self

        //imagePicker.didFinishPicking(completion: YPImagePicker.DidFinishPickingCompletion)
        //public typealias DidFinishPickingCompletion = (_ items: [YPMediaItem], _ cancelled: Bool) -> Void
        imagePicker.didFinishPicking { [weak self] items, cancelled in
            guard let self = self else { return }

            if cancelled {
                imagePicker.dismiss(animated: true)
                return
            }

            //selectedImage = items
            if let photo = items.singlePhoto {
                //backgroundImage = photo.image - 이미지 가져오기
                self.fileUpload(image: photo.image)
            }
            imagePicker.dismiss(animated: true)
        }

        imagePicker.modalPresentationStyle = .overFullScreen
        present(imagePicker, animated: true, completion: nil)
        */
    }
    
    private func fileUpload(image: UIImage){
        if let photoData = image.jpegData(compressionQuality: 1.0) {
            var dic = Dictionary<String, Any>()
            dic["mt_idx"] = self.fileUploadMtIdx
            
            UIView.animate(withDuration: 1.0) {
                self.loadingView.alpha = 1
            }
            
            Api.shared.fileUpload(dic: dic, photoName: "mt_file1", photo: photoData) { response, error in
                
                self.loadingView.alpha = 0
                
                if let error = error {
                    print("can not fetch data", error)
                    return
                }
                
                if let response = response {
                    if response.success == "true" {
                        self.web_view.evaluateJavaScript("f_member_file_upload_done();") { (any, err) -> Void in
                            print(err ?? "[f_member_file_upload_done] IOS >> 자바스크립트 : SUCCESS")
                        }
                    } else {
                        Utils.shared.showSnackBar(view: self.view, message: response.message ?? "")
                    }
                } else {
                    Utils.shared.showSnackBar(view: self.view, message: "Network Error")
                }
            }
        } else {
            Utils.shared.showSnackBar(view: self.view, message: NSLocalizedString("IMAGE_LOAD_FAIL_MESSAGE", comment: ""))
        }
    }
    
    private func urlClipBoard(url: String){
        UIPasteboard.general.string = url
        Utils.shared.showSnackBar(view: self.view, message: NSLocalizedString("CLIPBOARD_COPIED_MESSAGE", comment: ""))
    }
    
    private func urlOpenSms(url: String) {
        DispatchQueue.main.async {
            let controller = MFMessageComposeViewController()
            controller.body = url
            controller.messageComposeDelegate = self
            self.present(controller, animated: true, completion: nil)
        }
    }
    
    private func openUrlBlank(url: String) {
        if let _url = URL(string: url) {
            UIApplication.shared.open(_url, options: [:])
        }
    }
    
    private func showLoading() {
        DispatchQueue.main.async {
            self.loadingView.alpha = 1
        }
    }
    
    private func hideLoading() {
        DispatchQueue.main.async {
            self.loadingView.alpha = 0
        }
    }
    
    // MARK: - 햅틱 피드백 메서드들
    
    /// 가벼운 햅틱 피드백 (버튼 탭, 가벼운 상호작용)
    private func triggerLightHaptic() {
        let impactFeedback = UIImpactFeedbackGenerator(style: .light)
        impactFeedback.impactOccurred()
    }
    
    /// 중간 햅틱 피드백 (중간 정도의 상호작용)
    private func triggerMediumHaptic() {
        let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
        impactFeedback.impactOccurred()
    }
    
    /// 강한 햅틱 피드백 (중요한 액션, 경고)
    private func triggerHeavyHaptic() {
        let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
        impactFeedback.impactOccurred()
    }
    
    /// 성공 햅틱 피드백
    private func triggerSuccessHaptic() {
        let notificationFeedback = UINotificationFeedbackGenerator()
        notificationFeedback.notificationOccurred(.success)
    }
    
    /// 경고 햅틱 피드백
    private func triggerWarningHaptic() {
        let notificationFeedback = UINotificationFeedbackGenerator()
        notificationFeedback.notificationOccurred(.warning)
    }
    
    /// 에러 햅틱 피드백
    private func triggerErrorHaptic() {
        let notificationFeedback = UINotificationFeedbackGenerator()
        notificationFeedback.notificationOccurred(.error)
    }
    
    /// 선택 변경 햅틱 피드백 (탭 전환, 선택 변경)
    private func triggerSelectionHaptic() {
        let selectionFeedback = UISelectionFeedbackGenerator()
        selectionFeedback.selectionChanged()
    }
    
    // MARK: - Google Sign-In 메서드들
    
    /// Google Sign-In 실행
    private func performGoogleSignIn() {
        let presentingViewController = self
        
        // 🔍 Archive 빌드 진단용 로깅
        print("🔍 [GOOGLE-DEBUG] Archive 빌드 Google Sign-In 진단 시작")
        print("🔍 [GOOGLE-DEBUG] Bundle ID: \(Bundle.main.bundleIdentifier ?? "Unknown")")
        print("🔍 [GOOGLE-DEBUG] Build Configuration: \(isDebugBuild() ? "DEBUG" : "RELEASE")")
        print("🔍 [GOOGLE-DEBUG] GIDSignIn 설정 상태: \(GIDSignIn.sharedInstance.configuration != nil ? "설정됨" : "설정 안됨")")
        
        if let config = GIDSignIn.sharedInstance.configuration {
            print("🔍 [GOOGLE-DEBUG] Client ID: \(config.clientID.prefix(12))...")
        }
        
        // 로딩 표시
        self.showLoading()
        self.triggerMediumHaptic() // 로그인 시작 햅틱
        
        GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController) { [weak self] result, error in
            DispatchQueue.main.async {
                self?.hideLoading()
                
                if let error = error {
                    // 🔍 Archive 빌드 Google Sign-In 에러 상세 진단
                    let nsError = error as NSError
                    let errorDetails = [
                        "localizedDescription": error.localizedDescription,
                        "code": "\(nsError.code)",
                        "domain": nsError.domain,
                        "buildType": self?.isDebugBuild() == true ? "DEBUG" : "RELEASE"
                    ]
                    
                    print("❌ [GOOGLE-DEBUG] Archive 빌드 Google Sign-In 에러:")
                    print("   - 설명: \(error.localizedDescription)")
                    print("   - 코드: \(nsError.code)")
                    print("   - 도메인: \(nsError.domain)")
                    print("   - 빌드 타입: \(self?.isDebugBuild() == true ? "DEBUG" : "RELEASE")")
                    print("   - 사용자 정보: \(nsError.userInfo)")
                    
                    // Google 에러 코드별 분석
                    switch nsError.code {
                    case -2: // GIDSignInErrorCodeCanceled
                        print("🔍 [GOOGLE-DEBUG] 사용자가 로그인을 취소했습니다")
                    case -3: // GIDSignInErrorCodeHasNoAuthInKeychain  
                        print("🔍 [GOOGLE-DEBUG] 키체인에 인증 정보가 없습니다")
                    case -1: // GIDSignInErrorCodeUnknown
                        print("🔍 [GOOGLE-DEBUG] 알 수 없는 오류 - Archive 빌드 설정 문제일 가능성 높음")
                    case -4: // GIDSignInErrorCodeEMM
                        print("🔍 [GOOGLE-DEBUG] Enterprise Mobility Management 문제")
                    default:
                        print("🔍 [GOOGLE-DEBUG] 기타 오류 코드: \(nsError.code)")
                    }
                    
                    self?.triggerErrorHaptic()
                    
                    // 웹뷰에 상세 오류 정보 전달
                    do {
                        let jsonData = try JSONSerialization.data(withJSONObject: errorDetails)
                        let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
                        
                        // 🚨 새로운 네이티브 구글 로그인 에러 콜백 사용
                        let newErrorCallbackScript = """
                            try {
                                console.log('❌ [NATIVE CALLBACK - MainView] iOS에서 구글 로그인 에러 콜백 호출 시작');
                                
                                // 🚨 새로운 onNativeGoogleLoginError 콜백 우선 시도
                                if (typeof window.onNativeGoogleLoginError === 'function') {
                                    console.log('❌ [NATIVE CALLBACK - MainView] onNativeGoogleLoginError 호출');
                                    window.onNativeGoogleLoginError({
                                        message: '\(error.localizedDescription)',
                                        details: \(jsonString),
                                        source: 'ios_native_mainview'
                                    });
                                    console.log('✅ [NATIVE CALLBACK - MainView] onNativeGoogleLoginError 호출 완료');
                                    
                                } else if (typeof window.googleSignInError === 'function') {
                                    // 기존 콜백도 호환성 유지
                                    window.googleSignInError(\(jsonString));
                                    console.log('Google Sign-In 에러 콜백 호출 완료 (Legacy MainView)');
                                    
                                } else {
                                    console.warn('⚠️ [NATIVE CALLBACK - MainView] 구글 로그인 에러 콜백 함수가 정의되지 않음');
                                    console.warn('   - window.onNativeGoogleLoginError: 없음');
                                    console.warn('   - window.googleSignInError: 없음');
                                }
                            } catch (error) {
                                console.error('❌ [NATIVE CALLBACK - MainView] 구글 로그인 에러 콜백 오류:', error);
                            }
                        """
                        
                        self?.web_view.evaluateJavaScript(newErrorCallbackScript) { (_, err) in
                            if let err = err {
                                print("JavaScript 호출 오류: \(err)")
                            }
                        }
                    } catch {
                        // Fallback to simple error message
                        let simpleErrorCallbackScript = """
                            try {
                                console.log('❌ [NATIVE CALLBACK - MainView] 간단한 에러 콜백 호출');
                                
                                if (typeof window.onNativeGoogleLoginError === 'function') {
                                    window.onNativeGoogleLoginError({
                                        message: '\(error.localizedDescription)',
                                        source: 'ios_native_mainview_simple'
                                    });
                                } else if (typeof window.googleSignInError === 'function') {
                                    window.googleSignInError('\(error.localizedDescription)');
                                }
                            } catch (callbackError) {
                                console.error('❌ [NATIVE CALLBACK - MainView] 간단한 에러 콜백 오류:', callbackError);
                            }
                        """
                        
                        self?.web_view.evaluateJavaScript(simpleErrorCallbackScript) { (_, err) in
                            if let err = err {
                                print("JavaScript 호출 오류: \(err)")
                            }
                        }
                    }
                    return
                }
                
                guard let result = result,
                      let profile = result.user.profile else {
                    print("Google Sign-In: 사용자 정보를 가져올 수 없습니다.")
                    self?.triggerErrorHaptic()
                    return
                }
                
                let user = result.user
                
                // 성공 햅틱
                self?.triggerSuccessHaptic()
                
                // 사용자 정보 추출
                let userInfo = [
                    "email": profile.email,
                    "name": profile.name,
                    "givenName": profile.givenName ?? "",
                    "familyName": profile.familyName ?? "",
                    "imageURL": profile.imageURL(withDimension: 200)?.absoluteString ?? ""
                ]
                
                print("Google Sign-In 성공: \(userInfo)")
                
                // ID 토큰 가져오기
                if let idToken = user.idToken?.tokenString {
                    print("ID Token: \(idToken)")
                    
                    // 웹뷰에 성공 정보 전달
                    do {
                        let jsonData = try JSONSerialization.data(withJSONObject: userInfo)
                        let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
                        
                        // 🚨 새로운 네이티브 구글 로그인 콜백 사용
                        let newCallbackScript = """
                            try {
                                console.log('🎯 [NATIVE CALLBACK - MainView] iOS에서 구글 로그인 성공 콜백 호출 시작');
                                
                                // 🚨 새로운 onNativeGoogleLoginSuccess 콜백 우선 시도
                                if (typeof window.onNativeGoogleLoginSuccess === 'function') {
                                    console.log('🎯 [NATIVE CALLBACK - MainView] onNativeGoogleLoginSuccess 호출');
                                    window.onNativeGoogleLoginSuccess({
                                        idToken: '\(idToken)',
                                        userInfo: \(jsonString),
                                        source: 'ios_native_mainview'
                                    });
                                    console.log('✅ [NATIVE CALLBACK - MainView] onNativeGoogleLoginSuccess 호출 완료');
                                    
                                } else if (typeof window.googleSignInSuccess === 'function') {
                                    // 기존 콜백도 호환성 유지
                                    window.googleSignInSuccess('\(idToken)', \(jsonString));
                                    console.log('Google Sign-In 성공 콜백 호출 완료 (Legacy MainView)');
                                    
                                } else {
                                    console.warn('⚠️ [NATIVE CALLBACK - MainView] 구글 로그인 성공 콜백 함수가 정의되지 않음');
                                    console.warn('   - window.onNativeGoogleLoginSuccess: 없음');
                                    console.warn('   - window.googleSignInSuccess: 없음');
                                }
                            } catch (error) {
                                console.error('❌ [NATIVE CALLBACK - MainView] 구글 로그인 성공 콜백 오류:', error);
                            }
                        """
                        
                        self?.web_view.evaluateJavaScript(newCallbackScript) { (_, err) in
                            if let err = err {
                                print("JavaScript 호출 오류: \(err)")
                            }
                        }
                    } catch {
                        print("JSON 직렬화 오류: \(error)")
                    }
                } else {
                    print("ID Token을 가져올 수 없습니다.")
                    self?.triggerErrorHaptic()
                }
            }
        }
    }
    
    /// Google Sign-Out 실행
    private func performGoogleSignOut() {
        GIDSignIn.sharedInstance.signOut()
        self.triggerMediumHaptic() // 로그아웃 햅틱
        
        print("Google Sign-Out 완료")
        
        // 웹뷰에 로그아웃 완료 알림
        self.web_view.evaluateJavaScript("googleSignOutSuccess();") { (_, err) in
            if let err = err {
                print("JavaScript 호출 오류: \(err)")
            }
        }
    }
    
    /// 현재 Google 로그인 상태 확인
    private func checkGoogleSignInStatus() {
        guard let user = GIDSignIn.sharedInstance.currentUser,
              let profile = user.profile else {
            // 로그인되지 않은 상태
            self.web_view.evaluateJavaScript("googleSignInStatusResult(false, null);") { (_, err) in
                if let err = err {
                    print("JavaScript 호출 오류: \(err)")
                }
            }
            return
        }
        
        // 로그인된 상태
            
            let userInfo = [
                "email": profile.email,
                "name": profile.name,
                "givenName": profile.givenName ?? "",
                "familyName": profile.familyName ?? "",
                "imageURL": profile.imageURL(withDimension: 200)?.absoluteString ?? ""
            ]
            
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: userInfo)
                let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
                
                self.web_view.evaluateJavaScript("googleSignInStatusResult(true, \(jsonString));") { (_, err) in
                    if let err = err {
                        print("JavaScript 호출 오류: \(err)")
                    }
                }
            } catch {
                print("JSON 직렬화 오류: \(error)")
            }
    }
    
    /// 카카오 로그인 실행
    private func performKakaoSignIn() {
        print("🔍 [KAKAO-DEBUG] Archive 빌드 카카오 로그인 진단 시작")
        print("🔍 [KAKAO-DEBUG] Bundle ID: \(Bundle.main.bundleIdentifier ?? "Unknown")")
        print("🔍 [KAKAO-DEBUG] Build Configuration: \(isDebugBuild() ? "DEBUG" : "RELEASE")")
        
        // 로딩 표시
        self.showLoading()
        self.triggerMediumHaptic() // 로그인 시작 햅틱
        
        // 카카오톡 설치 여부 확인
        if UserApi.isKakaoTalkLoginAvailable() {
            print("🔍 [KAKAO-DEBUG] 카카오톡 앱으로 로그인 시도")
            
            // 카카오톡 앱으로 로그인
            UserApi.shared.loginWithKakaoTalk { [weak self] (oauthToken, error) in
                self?.handleKakaoLoginResult(oauthToken: oauthToken, error: error)
            }
        } else {
            print("🔍 [KAKAO-DEBUG] 카카오톡 앱 미설치 - 카카오계정 웹 로그인")
            
            // 카카오계정 웹 로그인
            UserApi.shared.loginWithKakaoAccount { [weak self] (oauthToken, error) in
                self?.handleKakaoLoginResult(oauthToken: oauthToken, error: error)
            }
        }
    }
    
    /// 카카오 로그인 결과 처리
    private func handleKakaoLoginResult(oauthToken: OAuthToken?, error: Error?) {
        DispatchQueue.main.async {
            self.hideLoading()
            
            if let error = error {
                // 🔍 Archive 빌드 카카오 로그인 에러 상세 진단
                let nsError = error as NSError
                let errorDetails = [
                    "localizedDescription": error.localizedDescription,
                    "code": "\(nsError.code)",
                    "domain": nsError.domain,
                    "buildType": self.isDebugBuild() ? "DEBUG" : "RELEASE"
                ]
                
                print("❌ [KAKAO-DEBUG] Archive 빌드 카카오 로그인 에러:")
                print("   - 설명: \(error.localizedDescription)")
                print("   - 코드: \(nsError.code)")
                print("   - 도메인: \(nsError.domain)")
                print("   - 빌드 타입: \(self.isDebugBuild() ? "DEBUG" : "RELEASE")")
                print("   - 사용자 정보: \(nsError.userInfo)")
                
                self.triggerErrorHaptic()
                
                // 웹뷰에 상세 오류 정보 전달
                do {
                    let jsonData = try JSONSerialization.data(withJSONObject: errorDetails)
                    let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
                    
                    self.web_view.evaluateJavaScript("kakaoSignInError(\(jsonString));") { (_, err) in
                        if let err = err {
                            print("JavaScript 호출 오류: \(err)")
                        }
                    }
                } catch {
                    // Fallback to simple error message
                    self.web_view.evaluateJavaScript("kakaoSignInError('\(error.localizedDescription)');") { (_, err) in
                        if let err = err {
                            print("JavaScript 호출 오류: \(err)")
                        }
                    }
                }
                return
            }
            
            guard let token = oauthToken?.accessToken else {
                print("카카오 로그인: 액세스 토큰을 가져올 수 없습니다.")
                self.triggerErrorHaptic()
                return
            }
            
            print("🔍 [KAKAO-DEBUG] 카카오 토큰 획득 성공: \(token.prefix(20))...")
            
            // 카카오 사용자 정보 가져오기
            UserApi.shared.me { [weak self] (user, error) in
                DispatchQueue.main.async {
                    if let error = error {
                        print("❌ [KAKAO-DEBUG] 사용자 정보 가져오기 실패: \(error)")
                        self?.triggerErrorHaptic()
                        return
                    }
                    
                    guard let user = user else {
                        print("❌ [KAKAO-DEBUG] 사용자 정보가 없습니다.")
                        self?.triggerErrorHaptic()
                        return
                    }
                    
                    // 🔥 추가 동의 항목 확인 (카카오 문서 권장사항)
                    var additionalScopes = [String]()
                    
                    if let kakaoAccount = user.kakaoAccount {
                        // 프로필 정보 동의 필요 여부
                        if kakaoAccount.profileNeedsAgreement == true {
                            additionalScopes.append("profile")
                            print("🔍 [KAKAO-SCOPE] 프로필 추가 동의 필요")
                        }
                        
                        // 이메일 동의 필요 여부 (더 강력한 체크)
                        let needsEmailAgreement = kakaoAccount.emailNeedsAgreement == true || 
                                                 kakaoAccount.email == nil || 
                                                 kakaoAccount.email?.isEmpty == true
                        
                        if needsEmailAgreement {
                            additionalScopes.append("account_email")
                            print("🔍 [KAKAO-SCOPE] 이메일 추가 동의 필요 (강화된 체크)")
                            print("   - emailNeedsAgreement: \(kakaoAccount.emailNeedsAgreement ?? false)")
                            print("   - email 값: '\(kakaoAccount.email ?? "nil")'")
                        }
                        
                        // 생일 동의 필요 여부
                        if kakaoAccount.birthdayNeedsAgreement == true {
                            additionalScopes.append("birthday")
                            print("🔍 [KAKAO-SCOPE] 생일 추가 동의 필요")
                        }
                        
                        // 출생년도 동의 필요 여부
                        if kakaoAccount.birthyearNeedsAgreement == true {
                            additionalScopes.append("birthyear")
                            print("🔍 [KAKAO-SCOPE] 출생년도 추가 동의 필요")
                        }
                        
                        // 성별 동의 필요 여부
                        if kakaoAccount.genderNeedsAgreement == true {
                            additionalScopes.append("gender")
                            print("🔍 [KAKAO-SCOPE] 성별 추가 동의 필요")
                        }
                        
                        // 전화번호 동의 필요 여부
                        if kakaoAccount.phoneNumberNeedsAgreement == true {
                            additionalScopes.append("phone_number")
                            print("🔍 [KAKAO-SCOPE] 전화번호 추가 동의 필요")
                        }
                        
                        // 연령대 동의 필요 여부
                        if kakaoAccount.ageRangeNeedsAgreement == true {
                            additionalScopes.append("age_range")
                            print("🔍 [KAKAO-SCOPE] 연령대 추가 동의 필요")
                        }
                    }
                    
                    // 추가 동의가 필요한 경우 재인증 요청
                    if additionalScopes.count > 0 {
                        print("🔍 [KAKAO-SCOPE] 추가 동의 필요 항목: \(additionalScopes)")
                        print("🔍 [KAKAO-SCOPE] 추가 동의를 위해 재인증 요청")
                        
                        // 추가 동의를 위한 재로그인
                        UserApi.shared.loginWithKakaoAccount(scopes: additionalScopes) { [weak self] (_, scopeError) in
                            DispatchQueue.main.async {
                                if let scopeError = scopeError {
                                    print("❌ [KAKAO-SCOPE] 추가 동의 실패: \(scopeError)")
                                    // 추가 동의 실패해도 기본 정보로 진행
                                    self?.processKakaoUserInfo(user: user, token: token)
                                } else {
                                    print("✅ [KAKAO-SCOPE] 추가 동의 성공, 사용자 정보 재조회")
                                    
                                    // 추가 동의 후 사용자 정보 재조회
                                    UserApi.shared.me { [weak self] (updatedUser, meError) in
                                        DispatchQueue.main.async {
                                            if let meError = meError {
                                                print("❌ [KAKAO-SCOPE] 재조회 실패: \(meError)")
                                                self?.processKakaoUserInfo(user: user, token: token)
                                            } else if let updatedUser = updatedUser {
                                                print("✅ [KAKAO-SCOPE] 업데이트된 사용자 정보로 처리")
                                                self?.processKakaoUserInfo(user: updatedUser, token: token)
                                            } else {
                                                self?.processKakaoUserInfo(user: user, token: token)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        print("✅ [KAKAO-SCOPE] 추가 동의 불필요, 기본 정보로 진행")
                        self?.processKakaoUserInfo(user: user, token: token)
                    }
                }
            }
        }
    }
    
    /// 카카오 사용자 정보 처리 (공통 함수)
    private func processKakaoUserInfo(user: User, token: String) {
        // 성공 햅틱
        triggerSuccessHaptic()
        
        // 🔍 이메일 정보 상세 디버깅
        print("🔍 [KAKAO-EMAIL-DEBUG] 이메일 정보 상세 분석:")
        print("   - user.kakaoAccount?.email: '\(user.kakaoAccount?.email ?? "nil")'")
        print("   - user.kakaoAccount?.isEmailValid: \(user.kakaoAccount?.isEmailValid ?? false)")
        print("   - user.kakaoAccount?.isEmailVerified: \(user.kakaoAccount?.isEmailVerified ?? false)")
        print("   - user.kakaoAccount?.emailNeedsAgreement: \(user.kakaoAccount?.emailNeedsAgreement ?? false)")
        print("   - user.kakaoAccount 존재 여부: \(user.kakaoAccount != nil)")
        
        // 이메일이 비어있는 경우 더 상세한 분석
        let emailValue = user.kakaoAccount?.email ?? ""
        if emailValue.isEmpty {
            print("❌ [KAKAO-EMAIL-DEBUG] 이메일이 비어있음!")
            print("   - kakaoAccount 전체 정보: \(String(describing: user.kakaoAccount))")
            
            // 🔥 극한 상황 대비: 이메일이 정말로 없다면 한 번 더 강제 재인증 시도
            print("🚨 [KAKAO-EMAIL-EMERGENCY] 이메일 강제 재요청 시도")
            
            UserApi.shared.loginWithKakaoAccount(scopes: ["account_email"]) { [weak self] (_, emergencyError) in
                DispatchQueue.main.async {
                    if let emergencyError = emergencyError {
                        print("❌ [KAKAO-EMAIL-EMERGENCY] 강제 재요청 실패: \(emergencyError)")
                        // 실패해도 기존 정보로 진행
                        self?.finalizeKakaoUserInfo(user: user, token: token)
                    } else {
                        print("✅ [KAKAO-EMAIL-EMERGENCY] 강제 재요청 성공, 정보 재조회")
                        
                        UserApi.shared.me { [weak self] (finalUser, finalError) in
                            DispatchQueue.main.async {
                                if let finalError = finalError {
                                    print("❌ [KAKAO-EMAIL-EMERGENCY] 최종 조회 실패: \(finalError)")
                                    self?.finalizeKakaoUserInfo(user: user, token: token)
                                } else if let finalUser = finalUser {
                                    let finalEmail = finalUser.kakaoAccount?.email ?? ""
                                    if !finalEmail.isEmpty {
                                        print("🎉 [KAKAO-EMAIL-EMERGENCY] 최종적으로 이메일 획득 성공: '\(finalEmail)'")
                                        self?.finalizeKakaoUserInfo(user: finalUser, token: token)
                                    } else {
                                        print("😞 [KAKAO-EMAIL-EMERGENCY] 여전히 이메일 없음, 기존 정보로 진행")
                                        self?.finalizeKakaoUserInfo(user: user, token: token)
                                    }
                                } else {
                                    self?.finalizeKakaoUserInfo(user: user, token: token)
                                }
                            }
                        }
                    }
                }
            }
            return // 여기서 함수 종료, 재인증 후 finalizeKakaoUserInfo에서 계속 진행
        } else {
            print("✅ [KAKAO-EMAIL-DEBUG] 이메일 정상 수집: '\(emailValue)'")
        }
        
        // 이메일이 있는 경우 바로 진행
        finalizeKakaoUserInfo(user: user, token: token)
    }
    
    /// 카카오 사용자 정보 최종 처리
    private func finalizeKakaoUserInfo(user: User, token: String) {
        
        // 최종 이메일 상태 확인
        let finalEmail = user.kakaoAccount?.email ?? ""
        print("🔍 [KAKAO-FINAL] 최종 이메일 상태: '\(finalEmail)'")
        
        // 사용자 정보 추출 (더 많은 정보 포함)
        let userInfo: [String: Any] = [
            "id": String(user.id ?? 0),
            "email": user.kakaoAccount?.email ?? "",
            "nickname": user.kakaoAccount?.profile?.nickname ?? "",
            "profileImageUrl": user.kakaoAccount?.profile?.profileImageUrl?.absoluteString ?? "",
            "accessToken": token,
            // 🔥 추가 정보 (동의받은 경우에만 포함)
            "birthday": user.kakaoAccount?.birthday ?? "",
            "birthyear": user.kakaoAccount?.birthyear ?? "",
            "gender": user.kakaoAccount?.gender?.rawValue ?? "",
            "phoneNumber": user.kakaoAccount?.phoneNumber ?? "",
            "ageRange": user.kakaoAccount?.ageRange?.rawValue ?? "",
            "isEmailValid": user.kakaoAccount?.isEmailValid ?? false,
            "isEmailVerified": user.kakaoAccount?.isEmailVerified ?? false
        ]
        
        print("✅ [KAKAO-DEBUG] 카카오 로그인 성공 (완전한 정보): \(userInfo)")
        
        // 웹뷰에 성공 정보 전달 (신규회원/기존회원 분기 처리 포함)
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: userInfo)
            let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
            
            // 🔥 새로운 네이티브 카카오 로그인 콜백 사용 (신규회원/기존회원 분기 포함)
            let newCallbackScript = """
                try {
                    console.log('🎯 [NATIVE CALLBACK - MainView] iOS에서 카카오 로그인 성공 콜백 호출 시작');
                    
                    // 🚨 백업 로직 사용 플래그 확인
                    const useBackupLogic = localStorage.getItem('useKakaoBackupLogic') === 'true';
                    console.log('🔍 [NATIVE CALLBACK - MainView] 백업 로직 사용 플래그:', useBackupLogic);
                    
                    if (useBackupLogic) {
                        console.log('🔥 [NATIVE CALLBACK - MainView] 백업 로직 사용 - 직접 백엔드 API 호출');
                        
                        fetch('/api/kakao-auth', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                access_token: '\(token)',
                                nativeUserInfo: \(jsonString)
                            }),
                        })
                        .then(response => response.json())
                        .then(data => {
                            console.log('🔥 [NATIVE CALLBACK - MainView] 백엔드 응답:', data);
                            
                            if (data.success) {
                                // 🔥 신규회원/기존회원에 따른 분기 처리
                                if (data.isNewUser) {
                                    console.log('🔥 [NATIVE CALLBACK - MainView] 신규회원 - 회원가입 페이지로 이동');
                                    
                                    // 소셜 로그인 데이터를 sessionStorage에 저장
                                    if (data.socialLoginData) {
                                        sessionStorage.setItem('socialLoginData', JSON.stringify(data.socialLoginData));
                                        console.log('🔥 [NATIVE CALLBACK - MainView] 소셜 로그인 데이터 저장 완료');
                                    }
                                    
                                    // 회원가입 페이지로 이동
                                    window.location.href = '/register?social=kakao';
                                } else {
                                    console.log('🔥 [NATIVE CALLBACK - MainView] 기존회원 - 홈으로 이동');
                                    
                                    // 홈으로 리다이렉트
                                    window.location.href = '/home';
                                }
                            } else {
                                console.error('🔥 [NATIVE CALLBACK - MainView] 백엔드 API 실패:', data.error);
                                alert('카카오 로그인 처리 중 오류가 발생했습니다: ' + (data.error || '알 수 없는 오류'));
                            }
                        })
                        .catch(error => {
                            console.error('🔥 [NATIVE CALLBACK - MainView] 백엔드 API 호출 실패:', error);
                            alert('카카오 로그인 처리 중 오류가 발생했습니다: ' + error.message);
                        });
                        
                        return;
                    }
                    
                    // 🚨 새로운 onNativeKakaoLoginSuccess 콜백 우선 시도
                    if (typeof window.onNativeKakaoLoginSuccess === 'function') {
                        console.log('🎯 [NATIVE CALLBACK - MainView] onNativeKakaoLoginSuccess 호출');
                        window.onNativeKakaoLoginSuccess({
                            accessToken: '\(token)',
                            userInfo: \(jsonString),
                            source: 'ios_native_mainview'
                        });
                        console.log('✅ [NATIVE CALLBACK - MainView] onNativeKakaoLoginSuccess 호출 완료');
                        
                    } else if (typeof window.kakaoSignInSuccess === 'function') {
                        // 기존 콜백도 호환성 유지
                        window.kakaoSignInSuccess('\(token)', \(jsonString));
                        console.log('카카오 로그인 성공 콜백 호출 완료 (Legacy MainView)');
                        
                    } else {
                        console.warn('⚠️ [NATIVE CALLBACK - MainView] 카카오 로그인 성공 콜백 함수가 정의되지 않음');
                        console.warn('   - window.onNativeKakaoLoginSuccess: 없음');
                        console.warn('   - window.kakaoSignInSuccess: 없음');
                        
                        // 🔥 백업: 직접 백엔드 API 호출하여 신규회원/기존회원 확인
                        console.log('🔥 [NATIVE CALLBACK - MainView] 백업: 직접 백엔드 API 호출');
                        
                        fetch('/api/kakao-auth', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                access_token: '\(token)',
                                nativeUserInfo: \(jsonString)
                            }),
                        })
                        .then(response => response.json())
                        .then(data => {
                            console.log('🔥 [NATIVE CALLBACK - MainView] 백엔드 응답:', data);
                            
                            if (data.success) {
                                // 🔥 신규회원/기존회원에 따른 분기 처리
                                if (data.isNewUser) {
                                    console.log('🔥 [NATIVE CALLBACK - MainView] 신규회원 - 회원가입 페이지로 이동');
                                    
                                    // 소셜 로그인 데이터를 sessionStorage에 저장
                                    if (data.socialLoginData) {
                                        sessionStorage.setItem('socialLoginData', JSON.stringify(data.socialLoginData));
                                        console.log('🔥 [NATIVE CALLBACK - MainView] 소셜 로그인 데이터 저장 완료');
                                    }
                                    
                                    // 회원가입 페이지로 이동
                                    window.location.href = '/register?social=kakao';
                                } else {
                                    console.log('🔥 [NATIVE CALLBACK - MainView] 기존회원 - 홈으로 이동');
                                    
                                    // 홈으로 리다이렉트
                                    window.location.href = '/home';
                                }
                            } else {
                                console.error('🔥 [NATIVE CALLBACK - MainView] 백엔드 API 실패:', data.error);
                                alert('카카오 로그인 처리 중 오류가 발생했습니다: ' + (data.error || '알 수 없는 오류'));
                            }
                        })
                        .catch(error => {
                            console.error('🔥 [NATIVE CALLBACK - MainView] 백엔드 API 호출 실패:', error);
                            alert('카카오 로그인 처리 중 오류가 발생했습니다: ' + error.message);
                        });
                    }
                } catch (error) {
                    console.error('❌ [NATIVE CALLBACK - MainView] 카카오 로그인 성공 콜백 오류:', error);
                }
            """
            
            web_view.evaluateJavaScript(newCallbackScript) { (_, err) in
                if let err = err {
                    print("JavaScript 호출 오류: \(err)")
                }
            }
        } catch {
            print("JSON 직렬화 오류: \(error)")
            triggerErrorHaptic()
        }
    }
    
    /// 카카오 로그아웃 실행
    private func performKakaoSignOut() {
        UserApi.shared.logout { [weak self] (error) in
            DispatchQueue.main.async {
                self?.triggerMediumHaptic() // 로그아웃 햅틱
                
                if let error = error {
                    print("카카오 로그아웃 오류: \(error)")
                } else {
                    print("카카오 로그아웃 완료")
                }
                
                // 웹뷰에 로그아웃 완료 알림
                self?.web_view.evaluateJavaScript("kakaoSignOutSuccess();") { (_, err) in
                    if let err = err {
                        print("JavaScript 호출 오류: \(err)")
                    }
                }
            }
        }
    }
    
    /// 🔥 카카오 로그인 실행 (웹에서 호출되는 새로운 함수)
    private func performKakaoLogin() {
        print("🔥🔥🔥 [KAKAO LOGIN] performKakaoLogin() 함수 시작!! 🔥🔥🔥")
        print("🔥🔥🔥 [KAKAO LOGIN] 기존 performKakaoSignIn() 호출!! 🔥🔥🔥")
        
        // 기존 카카오 로그인 함수 호출
        self.performKakaoSignIn()
        
        print("🔥🔥🔥 [KAKAO LOGIN] performKakaoLogin() 함수 완료!! 🔥🔥🔥")
    }
    
    /// 🔍 Debug vs Release 빌드 구분
    private func isDebugBuild() -> Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }
    
    // MARK: - 👤 사용자 정보 처리 메서드 (MainView)
    
    /// 사용자 정보 처리
    private func handleUserInfo(body: [String: Any]) {
        print("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨")
        print("🚨 [USER INFO MAINVIEW] handleUserInfo 메서드 호출됨!! 🚨")
        print("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨")
        print("👤 [USER INFO MAINVIEW] 사용자 정보 처리 시작")
        print("📨 [USER INFO MAINVIEW] 받은 body: \(body)")
        
        guard let param = body["param"] as? [String: Any] else {
            print("❌ [USER INFO MAINVIEW] param 파싱 실패")
            print("❌ [USER INFO MAINVIEW] body: \(body)")
            return
        }
        
        print("✅ [USER INFO MAINVIEW] param 파싱 성공: \(param)")
        
        // mt_idx를 숫자와 문자열 모두 지원
        var mtIdx: String = ""
        if let mtIdxString = param["mt_idx"] as? String {
            mtIdx = mtIdxString
        } else if let mtIdxNumber = param["mt_idx"] as? Int {
            mtIdx = String(mtIdxNumber)
        } else if let mtIdxNumber = param["mt_idx"] as? NSNumber {
            mtIdx = mtIdxNumber.stringValue
        }
        
        guard !mtIdx.isEmpty else {
            print("❌ [USER INFO MAINVIEW] mt_idx가 없거나 비어있음")
            print("❌ [USER INFO MAINVIEW] mt_idx 원본 값: \(param["mt_idx"] ?? "nil")")
            print("❌ [USER INFO MAINVIEW] mt_idx 원본 타입: \(type(of: param["mt_idx"]))")
            return
        }
        
        // mt_id도 숫자와 문자열 모두 지원
        var mtId: String = ""
        if let mtIdString = param["mt_id"] as? String {
            mtId = mtIdString
        } else if let mtIdNumber = param["mt_id"] as? Int {
            mtId = String(mtIdNumber)
        } else if let mtIdNumber = param["mt_id"] as? NSNumber {
            mtId = mtIdNumber.stringValue
        }
        
        let mtName = param["mt_name"] as? String ?? ""
        let mtEmail = param["mt_email"] as? String ?? ""
        
        print("✅ [USER INFO MAINVIEW] 사용자 정보 파싱 성공:")
        print("   👤 mt_idx: \(mtIdx)")
        print("   👤 mt_id: \(mtId)")
        print("   👤 mt_name: \(mtName)")
        print("   👤 mt_email: \(mtEmail)")
        
        // 💾 UserDefaults에 저장
        UserDefaults.standard.set(mtIdx, forKey: "mt_idx")
        UserDefaults.standard.set(mtId, forKey: "mt_id")
        UserDefaults.standard.set(mtName, forKey: "mt_name")
        UserDefaults.standard.set(mtEmail, forKey: "mt_email")
        UserDefaults.standard.set(true, forKey: "is_logged_in")
        UserDefaults.standard.synchronize()
        
        print("💾 [USER INFO MAINVIEW] 사용자 정보 로컬 저장 완료")
        
        // 📍 LocationService에 사용자 정보 전달
        LocationService.sharedInstance.updateUserInfo(mtIdx: mtIdx, mtId: mtId, mtName: mtName)
        print("🔗 [USER INFO MAINVIEW] LocationService에 사용자 정보 전달 완료")
        
        // 🌐 웹뷰로 확인 응답 전송
        let confirmationScript = """
            console.log('✅ [iOS-USER-MAINVIEW] 사용자 정보 저장 완료:', {
                mt_idx: '\(mtIdx)',
                mt_name: '\(mtName)',
                source: 'mainview',
                timestamp: new Date().toISOString()
            });
            
            // 전역 이벤트 발생
            if (window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('ios-user-info-saved', {
                    detail: {
                        mt_idx: '\(mtIdx)',
                        mt_name: '\(mtName)',
                        source: 'mainview',
                        success: true
                    }
                }));
            }
        """
        
        DispatchQueue.main.async {
            self.web_view?.evaluateJavaScript(confirmationScript) { result, error in
                if let error = error {
                    print("❌ [USER INFO MAINVIEW] 웹뷰 확인 스크립트 실행 실패: \(error)")
                } else {
                    print("✅ [USER INFO MAINVIEW] 웹뷰에 사용자 정보 저장 완료 알림")
                }
            }
        }
        
        print("🎉 [USER INFO MAINVIEW] 사용자 정보 처리 완료!")
    }
    
    /// 사용자 로그아웃 처리
    private func handleUserLogout() {
        print("👤 [USER LOGOUT MAINVIEW] 사용자 로그아웃 처리 시작")
        
        // 💾 UserDefaults에서 사용자 정보 제거
        UserDefaults.standard.removeObject(forKey: "mt_idx")
        UserDefaults.standard.removeObject(forKey: "mt_id")
        UserDefaults.standard.removeObject(forKey: "mt_name")
        UserDefaults.standard.removeObject(forKey: "mt_email")
        UserDefaults.standard.set(false, forKey: "is_logged_in")
        UserDefaults.standard.synchronize()
        
        print("💾 [USER LOGOUT MAINVIEW] 로컬 사용자 정보 제거 완료")
        
        // 📍 LocationService에 로그아웃 알림
        LocationService.sharedInstance.clearUserInfo()
        
        // 🌐 웹뷰로 확인 응답 전송
        let confirmationScript = """
            console.log('✅ [iOS-USER-MAINVIEW] 사용자 로그아웃 처리 완료:', {
                source: 'mainview',
                timestamp: new Date().toISOString()
            });
            
            // 전역 이벤트 발생
            if (window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('ios-user-logout', {
                    detail: { 
                        source: 'mainview',
                        success: true 
                    }
                }));
            }
        """
        
        DispatchQueue.main.async {
            self.web_view?.evaluateJavaScript(confirmationScript) { result, error in
                if let error = error {
                    print("❌ [USER LOGOUT MAINVIEW] 웹뷰 로그아웃 확인 스크립트 실행 실패: \(error)")
                } else {
                    print("✅ [USER LOGOUT MAINVIEW] 웹뷰에 로그아웃 완료 알림")
                }
            }
        }
        
        print("✅ [USER LOGOUT MAINVIEW] 사용자 로그아웃 처리 완료")
    }
}


extension MainView {
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Swift.Void) {
        
        let address = navigationAction.request.url?.absoluteString
        //print("address :",address ?? String())
        
        if address == "https://ssl.pstatic.net/static/maps/mantle/notice/legal.html" {
            decisionHandler(.cancel)
            return
        } else {
            if let url = navigationAction.request.url {
                if url.scheme == "mailto" || url.scheme == "tel" || url.scheme == "sms" {
                    if UIApplication.shared.canOpenURL(url) {
                        UIApplication.shared.open(url, options: [:], completionHandler: nil)
                    }
                    decisionHandler(.cancel)
                    return
                }
                
                
            }
            
            // 카카오 SDK가 호출하는 커스텀 URL 스킴인 경우 open(_ url:) 메서드를 호출합니다.
            if let url = navigationAction.request.url , ["kakaolink"].contains(url.scheme) {

                UIApplication.shared.open(url, options: [:], completionHandler: nil)

                decisionHandler(.cancel) 
                return
            }
        }
        
        decisionHandler(.allow)
    }
    
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        
        print("createWebViewWith")
        let userContriller = WKUserContentController()
        let script = "var originalWindowClose=window.close;window.close=function(){var iframe=document.createElement('IFRAME');iframe.setAttribute('src','back://'),document.documentElement.appendChild(iframe);originalWindowClose.call(window)};"
        
        let userScript = WKUserScript.init(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        
        userContriller.addUserScript(userScript)
        
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.userContentController = userContriller
                
        let newWebView = WKWebView.init(frame: self.web_view.frame, configuration: configuration)
        
        newWebView.navigationDelegate = self
        newWebView.uiDelegate = self
        
        self.view.addSubview(newWebView)
        
        return newWebView
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("didFinish - 웹페이지 로딩 완료")
        
        // 🚨 페이지 로드 완료 후 MessageHandler 강제 재확인 및 등록
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            let handlerForceScript = """
                (function() {
                    console.log('🔄 [HANDLER-FORCE] 페이지 로드 완료 후 핸들러 강제 재확인 시작');
                    
                    // 현재 핸들러 상태 확인
                    const webkit = window.webkit;
                    const hasWebkit = !!webkit;
                    const hasMessageHandlers = !!webkit?.messageHandlers;
                    
                    console.log('🔍 [HANDLER-FORCE] 핸들러 상태:', {
                        hasWebkit: hasWebkit,
                        hasMessageHandlers: hasMessageHandlers,
                        messageHandlers: webkit?.messageHandlers ? Object.keys(webkit.messageHandlers) : [],
                        totalHandlers: webkit?.messageHandlers ? Object.keys(webkit.messageHandlers).length : 0
                    });
                    
                    if (hasWebkit && hasMessageHandlers) {
                        console.log('✅ [HANDLER-FORCE] MessageHandlers 정상 발견!');
                        
                        // 즉시 테스트 메시지 전송
                        const handlers = Object.keys(webkit.messageHandlers);
                        handlers.forEach(function(handlerName) {
                            try {
                                webkit.messageHandlers[handlerName].postMessage({
                                    type: 'pageLoadComplete',
                                    handler: handlerName,
                                    timestamp: Date.now(),
                                    url: window.location.href,
                                    test: true
                                });
                                console.log('✅ [HANDLER-FORCE] ' + handlerName + ' 테스트 메시지 전송 성공');
                            } catch (error) {
                                console.error('❌ [HANDLER-FORCE] ' + handlerName + ' 테스트 실패:', error);
                            }
                        });
                        
                        // 전역 플래그 설정
                        window.__SMAP_HANDLERS_READY__ = true;
                        window.__SMAP_HANDLERS_LIST__ = handlers;
                        
                        console.log('🔥 [HANDLER-FORCE] 전역 플래그 설정 완료:', handlers);
                        console.log('🔍 [HANDLER-FORCE] 설정된 전역 변수 확인:', {
                            __SMAP_HANDLERS_READY__: window.__SMAP_HANDLERS_READY__,
                            __SMAP_HANDLERS_LIST__: window.__SMAP_HANDLERS_LIST__,
                            핸들러개수: handlers.length
                        });
                        
                        // 즉시 구글 로그인 재시도 가능 플래그 설정
                        window.__SMAP_GOOGLE_LOGIN_READY__ = true;
                        
                    } else {
                        console.error('❌ [HANDLER-FORCE] MessageHandlers 찾지 못함!');
                        console.error('   - webkit 존재:', hasWebkit);
                        console.error('   - messageHandlers 존재:', hasMessageHandlers);
                        
                        // 재시도 (최대 5번)
                        let retryCount = 0;
                        const maxRetries = 5;
                        
                        const retryInterval = setInterval(function() {
                            retryCount++;
                            console.log('🔄 [HANDLER-FORCE] 재시도 ' + retryCount + '/' + maxRetries);
                            
                            const retryWebkit = window.webkit;
                            if (retryWebkit?.messageHandlers) {
                                console.log('✅ [HANDLER-FORCE] 재시도 성공! 핸들러 발견');
                                clearInterval(retryInterval);
                                
                                const retryHandlers = Object.keys(retryWebkit.messageHandlers);
                                window.__SMAP_HANDLERS_READY__ = true;
                                window.__SMAP_HANDLERS_LIST__ = retryHandlers;
                                window.__SMAP_GOOGLE_LOGIN_READY__ = true;
                                
                                console.log('🔥 [HANDLER-FORCE] 재시도 후 전역 플래그 설정 완료:', retryHandlers);
                                console.log('🔍 [HANDLER-FORCE] 재시도 후 전역 변수 확인:', {
                                    __SMAP_HANDLERS_READY__: window.__SMAP_HANDLERS_READY__,
                                    __SMAP_HANDLERS_LIST__: window.__SMAP_HANDLERS_LIST__,
                                    핸들러개수: retryHandlers.length
                                });
                            } else if (retryCount >= maxRetries) {
                                console.error('❌ [HANDLER-FORCE] 최대 재시도 횟수 초과 - 핸들러 등록 실패');
                                clearInterval(retryInterval);
                            }
                        }, 300);
                    }
                })();
            """
            
            self.web_view.evaluateJavaScript(handlerForceScript) { (result, error) in
                if let error = error {
                    print("❌ [HANDLER-FORCE] 스크립트 실행 실패: \(error)")
                } else {
                    print("✅ [HANDLER-FORCE] 핸들러 강제 재확인 스크립트 실행 완료")
                }
            }
        }
        
        // 로딩 인디케이터 숨김
        DispatchQueue.main.async {
            self.hideLoading()
        }
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("didFail - 웹페이지 로딩 실패: \(error.localizedDescription)")
        
        // 로딩 인디케이터 숨김
        DispatchQueue.main.async {
            self.hideLoading()
            
            // 에러 메시지 표시
            let alert = UIAlertController(title: "연결 오류", 
                                        message: "인터넷 연결을 확인해주세요.\n\(error.localizedDescription)", 
                                        preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "다시 시도", style: .default) { _ in
                // 다시 로드
                webView.reload()
                self.showLoading()
            })
            alert.addAction(UIAlertAction(title: "확인", style: .cancel))
            
            self.present(alert, animated: true)
        }
    }
    
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        print("didFailProvisionalNavigation - 초기 로딩 실패: \(error.localizedDescription)")
        
        // 로딩 인디케이터 숨김
        DispatchQueue.main.async {
            self.hideLoading()
            
            // 에러 메시지 표시
            let alert = UIAlertController(title: "연결 오류", 
                                        message: "서버에 연결할 수 없습니다.\n네트워크 상태를 확인해주세요.", 
                                        preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "다시 시도", style: .default) { _ in
                // 다시 로드
                webView.reload()
                self.showLoading()
            })
            alert.addAction(UIAlertAction(title: "확인", style: .cancel))
            
            self.present(alert, animated: true)
        }
    }
    
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        print("didStartProvisionalNavigation - 웹페이지 로딩 시작")
        
        // 로딩 인디케이터 표시
        DispatchQueue.main.async {
            self.showLoading()
        }
    }
    
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        
        print("message : ",message)
        
        let alertController = UIAlertController(title: "", message: message, preferredStyle: .alert)
        alertController.addAction(UIAlertAction(title: NSLocalizedString("ALERT_OK_BUTTON", comment: ""), style: .default, handler: { (action) in
            completionHandler()
        }))
        
        self.present(alertController, animated: true, completion: nil)
    }
    
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        
        print("message : ",message)
        
        let alertController = UIAlertController(title: "", message: message, preferredStyle: .alert)
        alertController.addAction(UIAlertAction(title: NSLocalizedString("ALERT_OK_BUTTON", comment: ""), style: .default, handler: { (action) in
            completionHandler(true)
        }))
        alertController.addAction(UIAlertAction(title: NSLocalizedString("ALERT_CANCEL_BUTTON", comment: ""), style: .default, handler: { (action) in
            completionHandler(false)
        }))
        
        self.present(alertController, animated: true, completion: nil)
    }
    
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let alertController = UIAlertController(title: "", message: prompt, preferredStyle: .alert)
        alertController.addTextField { (textField) in
            textField.text = defaultText
        }
        alertController.addAction(UIAlertAction(title: NSLocalizedString("ALERT_OK_BUTTON", comment: ""), style: .default, handler: { (action) in
            if let text = alertController.textFields?.first?.text {
                completionHandler(text)
            } else {
                completionHandler(defaultText)
            }
        }))
        
        alertController.addAction(UIAlertAction(title: NSLocalizedString("ALERT_CANCEL_BUTTON", comment: ""), style: .default, handler: { (action) in
            completionHandler(nil)
        }))
        
        self.present(alertController, animated: true, completion: nil)
    }
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        print("📨 [MessageHandler] 메시지 수신: \(message.name)")
        print("📦 [MessageHandler] 메시지 내용: \(message.body)")
        
        // 🚨 다중 핸들러 지원 (모든 핸들러 이름 처리)
        let validHandlers = ["smapIos", "iosHandler", "hapticHandler", "messageHandler"]
        
        if validHandlers.contains(message.name) {
            guard let body = message.body as? [String: Any] else { return }
            guard let type = body["type"] as? String else { return }
            
            switch type {
            case "pageLoadComplete":
                // 페이지 로드 완료 후 핸들러 테스트 메시지 처리
                guard let handlerName = body["handler"] as? String else { return }
                print("✅ [PAGE-LOAD-COMPLETE] \(handlerName) 핸들러 정상 작동 확인됨")
                break
                
            case "handlerTest":
                // 핸들러 테스트 메시지 처리
                guard let handlerName = body["handler"] as? String else { return }
                print("✅ [Handler Test] \(handlerName) 핸들러 테스트 성공")
                break
                
            case "forceHandlerTest":
                // 강제 핸들러 테스트 메시지 처리
                guard let handlerName = body["handler"] as? String else { return }
                guard let testMessage = body["message"] as? String else { return }
                print("🔍 [Force Handler Test] \(handlerName) 강제 테스트 성공: \(testMessage)")
                break
                
            case "webDebugTest":
                // 웹 디버그 테스트 메시지 처리
                guard let handlerName = body["handler"] as? String else { return }
                print("🌐 [Web Debug Test] \(handlerName) 웹 디버그 테스트 성공")
                break
                
            case "jsError":
                guard let error = body["param"] as? String else { return }
                print("JavaScript 에러 발생: \(error)")
                break
                
            case "pageType":
                guard let page = body["param"] as? String else { return }
                self.webViewPageType = page
                break
                
            case "haptic":
                print("🎮 [SMAP-HAPTIC] 햅틱 요청 수신")
                self.handleHapticRequest(body: body)
                break
                
            case "hapticFeedback":
                print("🎮 [SMAP-HAPTIC] 햅틱 피드백 요청 수신")
                self.handleHapticFeedback(body: body)
                break
                
            case "kakaoLogin":
                print("🚨🚨🚨 [KAKAO LOGIN] 카카오 로그인 요청 수신!! 🚨🚨🚨")
                print("🚨🚨🚨 [KAKAO LOGIN] MainView에서 처리 시작!! 🚨🚨🚨")
                
                // 테스트용 Heavy 햅틱 실행
                DispatchQueue.main.async {
                    let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
                    impactFeedback.impactOccurred()
                    print("🚨🚨🚨 [KAKAO LOGIN] Heavy 햅틱 실행 완료!! 🚨🚨🚨")
                }
                
                self.performKakaoLogin()
                print("🚨🚨🚨 [KAKAO LOGIN] performKakaoLogin() 호출 완료!! 🚨🚨🚨")
                break
                
            case "kakaoCallbackReady":
                print("🎯 [KAKAO CALLBACK] 웹에서 카카오 콜백 등록 상태 수신")
                if let status = body["status"] as? String,
                   let hasSuccessCallback = body["hasSuccessCallback"] as? Bool,
                   let hasErrorCallback = body["hasErrorCallback"] as? Bool {
                    print("📊 [KAKAO CALLBACK] 콜백 상태:")
                    print("   - 상태: \(status)")
                    print("   - 성공 콜백: \(hasSuccessCallback ? "등록됨" : "없음")")
                    print("   - 에러 콜백: \(hasErrorCallback ? "등록됨" : "없음")")
                    
                    // 콜백이 등록되지 않았다면 백업 로직 사용 플래그 설정 (localStorage 사용)
                    let backupFlagScript = """
                        if (!\(hasSuccessCallback)) {
                            console.log('⚠️ [KAKAO CALLBACK] 성공 콜백이 등록되지 않음 - 백업 로직 사용 예정');
                            localStorage.setItem('useKakaoBackupLogic', 'true');
                        } else {
                            console.log('✅ [KAKAO CALLBACK] 성공 콜백 정상 등록됨');
                            localStorage.setItem('useKakaoBackupLogic', 'false');
                        }
                    """
                    
                    web_view.evaluateJavaScript(backupFlagScript) { (_, err) in
                        if let err = err {
                            print("백업 플래그 설정 오류: \(err)")
                        } else {
                            print("✅ [KAKAO CALLBACK] 백업 로직 플래그 설정 완료")
                        }
                    }
                }
                break
                
            case "googleSignIn":
                self.performGoogleSignIn()
                break
            case "kakaoSignIn":
                self.performKakaoSignIn()
                break
            case "appleSignIn":
                self.performAppleSignIn()
                break
                
            case "googleSignOut":
                self.performGoogleSignOut()
                break
            case "kakaoSignOut":
                self.performKakaoSignOut()
                break
                
            case "googleSignInStatus":
                self.checkGoogleSignInStatus()
                break
                
            case "memberLogin":
                LocationService.sharedInstance.auth();
                // 로그인 성공 시 햅틱
                self.triggerSuccessHaptic()
                break
                
            case "memberLogout":
                LocationService.sharedInstance.savedMtIdx = ""
                Utils.shared.removeMtIdx()
                // 로그아웃 시 햅틱
                self.triggerMediumHaptic()
                break
            
            case "openCamera":
                guard let mt_idx = body["param"] as? String else { return }
                self.fileUploadMtIdx = mt_idx
                self.openPhoto(isCamera: true)
                // 카메라 열기 시 햅틱
                self.triggerMediumHaptic()
                break
                
            case "openAlbum":
                guard let mt_idx = body["param"] as? String else { return }
                self.fileUploadMtIdx = mt_idx
                self.openPhoto(isCamera: false)
                // 앨범 열기 시 햅틱
                self.triggerMediumHaptic()
                break
            
            case "urlClipBoard":
                guard let url = body["param"] as? String else { return }
                self.urlClipBoard(url: url)
                // 클립보드 복사 시 햅틱
                self.triggerSuccessHaptic()
                break
                
            case "urlOpenSms":
                guard let url = body["param"] as? String else { return }
                self.urlOpenSms(url: url)
                // SMS 열기 시 햅틱
                self.triggerLightHaptic()
                break
                
            case "openShare":
                guard let content = body["param"] as? String else { return }
                // 공유하기 열기 시 햅틱
                self.triggerMediumHaptic()
                DispatchQueue.main.async {
                    var objectToShare = [String]()
                    
                    objectToShare.append(content)
                   
                    let activityVC = UIActivityViewController(activityItems : objectToShare, applicationActivities: nil)
                    activityVC.popoverPresentationController?.sourceView = self.view
                    activityVC.popoverPresentationController?.sourceRect = CGRect(x: self.view.bounds.midX, y: self.view.bounds.midY, width: 0, height: 0)
                    activityVC.popoverPresentationController?.permittedArrowDirections = []
                    
                    activityVC.popoverPresentationController?.sourceView = self.view
                    self.present(activityVC, animated: true, completion: nil)
                    if let popoverController = activityVC.popoverPresentationController {
                        self.popoverController = popoverController
                        popoverController.sourceView = self.view
                        popoverController.sourceRect = CGRect(x: self.view.bounds.midX, y: self.view.bounds.midY, width: 0, height: 0)
                        popoverController.permittedArrowDirections = []
                    }
                }
                break;
                
            case "openUrlBlank":
                guard let url = body["param"] as? String else { return }
                self.openUrlBlank(url: url)
                // 외부 링크 열기 시 햅틱
                self.triggerLightHaptic()
                break
                
            case "purchase":
                guard let orderType = body["param"] as? String else { return }
                
                var productId = StoreKitManager.shared.monthProductId.first
                if orderType == "month" {
                    productId = StoreKitManager.shared.monthProductId.first
                } else if orderType == "year" {
                    productId = StoreKitManager.shared.yearProductId.first
                }
                
                if let productId = productId {
                    self.showLoading()
                    // 구매 시작 시 햅틱
                    self.triggerMediumHaptic()
                    StoreKitManager.shared.purchase(productId: productId) { purchase, errorMsg in
                        if let errorMsg = errorMsg {
                            self.hideLoading()
                            
                            // 구매 실패 시 에러 햅틱
                            self.triggerErrorHaptic()
                            DispatchQueue.main.async {
                                Utils.shared.showSnackBar(view: self.view, message: errorMsg)
                            }
                            return
                        }
                        
                        self.hideLoading()
                        
                        if let purchase = purchase {
                            //결제 정보 넘어옴
                            print("Purchase Success: \(purchase.productId) \(purchase.originalPurchaseDate) ---- \(purchase)")
                            // 구매 성공 시 성공 햅틱
                            self.triggerSuccessHaptic()
                            if let originalTransactionId = purchase.transaction.transactionIdentifier {
                                print("purchase.transaction.transactionState \(purchase.transaction.transactionState)")
                                switch purchase.transaction.transactionState {
                                case .purchased, .restored:
                                    if purchase.needsFinishTransaction {
                                        // Deliver content from server, then:
                                        SwiftyStoreKit.finishTransaction(purchase.transaction)
                                    }
                                    // Unlock content
                                case .failed, .purchasing, .deferred:
                                    break // do nothing
                                default:
                                    break
                                }
                                
                                //print("originalTransactionId \(originalTransactionId)")
                                //print("productId \(purchase.productId)")
                                self.showLoading()
                                StoreKitManager.shared.fetchReceipt { encryptedReceipt, error in
                                    if let error = error {
                                        self.hideLoading()
                                        
                                        DispatchQueue.main.async {
                                            Utils.shared.showSnackBar(view: self.view, message: error)
                                        }
                                        return
                                    }
                                    // orderid = originalTransactionId
                                    // productid = purchase.productId
                                    // token = encryptedReceipt
                                    let mt_idx = Utils.shared.getMtIdx()
                                    let token = encryptedReceipt ?? String()
                                    
                                    self.hideLoading()
                                    
                                    DispatchQueue.main.async {
                                        self.web_view.evaluateJavaScript("f_member_receipt_done_ios('\(originalTransactionId)', '\(purchase.productId)', '\(token)', '\(mt_idx)');") { (any, err) -> Void in
                                            print(err ?? "[f_member_receipt_done_ios] IOS >> 자바스크립트 : SUCCESS")
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                break
                
            case "purchaseCheck":
                StoreKitManager.shared.fetchReceipt { encryptedReceipt, error in
                    let mt_idx = Utils.shared.getMtIdx()
                    
                    if let error = error {
                        print("purchaseCheck - \(error)")
                        DispatchQueue.main.async {
                            self.web_view.evaluateJavaScript("f_member_receipt_check_ios('', '\(mt_idx)');") { (any, err) -> Void in
                                print(err ?? "[f_member_receipt_check_ios] IOS >> 자바스크립트 : SUCCESS")
                            }
                        }
                        return
                    }
                    
                    let token = encryptedReceipt ?? String()
                    DispatchQueue.main.async {
                        self.web_view.evaluateJavaScript("f_member_receipt_check_ios('\(token)', '\(mt_idx)');") { (any, err) -> Void in
                            print(err ?? "[f_member_receipt_check_ios] IOS >> 자바스크립트 : SUCCESS")
                        }
                    }
                }
                break
                    
            case "restorePurchase":
                self.showLoading()
                StoreKitManager.shared.restorePurchases { msg in
                    if msg != nil {
                        StoreKitManager.shared.fetchReceipt { encryptedReceipt, error in
                            if let error = error {
                                self.hideLoading()
                                DispatchQueue.main.async {
                                    Utils.shared.showSnackBar(view: self.view, message: error)
                                }
                                return
                            }
                            
                            self.hideLoading()
                            let mt_idx = Utils.shared.getMtIdx()
                            let token = encryptedReceipt ?? String()
                            
                            DispatchQueue.main.async {
                                self.web_view.evaluateJavaScript("f_member_receipt_restore_ios('\(token)', '\(mt_idx)');") { (any, err) -> Void in
                                    print(err ?? "[location_refresh] IOS >> 자바스크립트 : SUCCESS")
                                }
                            }
                        }
                    } else {
                        self.hideLoading()
                        DispatchQueue.main.async {
                            Utils.shared.showSnackBar(view: self.view, message: "구독 복원에 실패했습니다.")
                        }
                    }
                }
                break
            case "session_refresh":
                guard let session_refresh_event_url = body["param"] as? String else { return }
                let location = LocationService.sharedInstance.getLastLocation()
                var urlString = Http.shared.WEB_BASE_URL + "auth?mt_token_id=%@"
            
                if location.coordinate.latitude != 0.0 && location.coordinate.longitude != 0.0 {
                    urlString = "\(urlString)&mt_lat=\(location.coordinate.latitude)&mt_long=\(location.coordinate.longitude)"
                }
                
                Utils.shared.getToken { token in
                    urlString = String.init(format: urlString, token)
                    urlString += "&event_url=\(session_refresh_event_url)"
                    print("url String == \(urlString)")
                    
                    let url = URL(string: urlString)
                    var request = URLRequest(url: url!)
                    request.setValue(Http.shared.hashKey, forHTTPHeaderField: "AUTH_SECRETKEY")
                    self.web_view.load(request)
                }
                break
            case "userInfo":
                print("🚨🚨🚨 [USER INFO MAINVIEW] 사용자 정보 메시지 수신!! 🚨🚨🚨")
                print("🚨🚨🚨 [USER INFO MAINVIEW] MainView에서 처리 시작!! 🚨🚨🚨")
                self.handleUserInfo(body: body)
                break
                
            case "userLogout":
                print("👤 [USER LOGOUT MAINVIEW] 사용자 로그아웃 메시지 수신")
                self.handleUserLogout()
                break
                
            case "showAd":
                // 광고 기능 비활성화됨 (웹뷰 앱에서는 사용하지 않음)
                print("광고 기능이 비활성화되었습니다.")
                break
            default:
                break
            }
        }
    }
    
    public func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        print("webViewWebContentProcessDidTerminate")
        webView.reload()
    }
}

extension MainView: MFMessageComposeViewControllerDelegate {
    func messageComposeViewController(_ controller: MFMessageComposeViewController, didFinishWith result: MessageComposeResult) {
        controller.dismiss(animated: false)
    }
}

// YPImagePickerDelegate 비활성화 (웹뷰 앱에서는 사용하지 않음)
/*
extension MainView: YPImagePickerDelegate {
    func imagePickerHasNoItemsInLibrary(_ picker: YPImagePicker) {
        Utils.shared.showSnackBar(view: self.view, message: NSLocalizedString("IMAGE_LOAD_FAIL_MESSAGE", comment: ""))
    }

    func shouldAddToSelection(indexPath: IndexPath, numSelections: Int) -> Bool {
        // false 로 설정하면 선택해도 다음으로 갈 수 없다. 즉, 추가할 수 없음.
        return true
    }
}
*/

// GADFullScreenContentDelegate 비활성화 (웹뷰 앱에서는 광고를 사용하지 않음)
/*
extension MainView: GADFullScreenContentDelegate {
    /// Tells the delegate that the ad failed to present full screen content.
    func ad(_ ad: GADFullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        print("Ad did fail to present full screen content.")
        self.web_view.evaluateJavaScript("failAd('show');") { (any, err) -> Void in
            print(err ?? "[failAd] IOS >> 자바스크립트 : SUCCESS")
        }
    }

    /// Tells the delegate that the ad will present full screen content.
    func adWillPresentFullScreenContent(_ ad: GADFullScreenPresentingAd) {
        print("Ad will present full screen content.")
    }

    /// Tells the delegate that the ad dismissed full screen content.
    func adDidDismissFullScreenContent(_ ad: GADFullScreenPresentingAd) {
        print("Ad did dismiss full screen content.")
        // 닫힐때
        self.web_view.evaluateJavaScript("endAd();") { (any, err) -> Void in
            print(err ?? "[endAd] IOS >> 자바스크립트 : SUCCESS")
            Task {
                await self.loadAds(isShow:false, errorCount:0)
            }
        }
    }
}
*/

// MARK: - 🎮 햅틱 피드백 시스템
extension MainView {
    
    // 햅틱 요청 처리 (단순 형태)
    private func handleHapticRequest(body: [String: Any]) {
        guard let hapticType = body["param"] as? String else {
            print("⚠️ [SMAP-HAPTIC] 햅틱 타입 파라미터 없음")
            triggerMediumHaptic() // 기본값
            return
        }
        
        print("🎮 [SMAP-HAPTIC] 단순 햅틱 요청: \(hapticType)")
        executeHaptic(type: hapticType)
    }
    
    // 햅틱 피드백 처리 (JSON 형태)
    private func handleHapticFeedback(body: [String: Any]) {
        if let paramString = body["param"] as? String,
           let data = paramString.data(using: .utf8),
           let hapticData = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
            
            let feedbackType = hapticData["feedbackType"] as? String ?? "medium"
            let description = hapticData["description"] as? String ?? ""
            let component = hapticData["component"] as? String ?? ""
            
            print("🎮 [SMAP-HAPTIC] JSON 형태 - 타입: \(feedbackType), 설명: \(description), 컴포넌트: \(component)")
            executeHaptic(type: feedbackType)
            
        } else if let hapticType = body["param"] as? String {
            print("🎮 [SMAP-HAPTIC] 문자열 형태: \(hapticType)")
            executeHaptic(type: hapticType)
        } else {
            print("🎮 [SMAP-HAPTIC] 파라미터 없음 - 기본 햅틱 실행")
            executeHaptic(type: "medium")
        }
    }
    
    // 햅틱 실행
    private func executeHaptic(type: String) {
        print("🎮 [SMAP-HAPTIC] 햅틱 실행: \(type)")
        
        DispatchQueue.main.async {
            // iPhone에서만 햅틱 실행
            guard UIDevice.current.userInterfaceIdiom == .phone else {
                print("⚠️ [SMAP-HAPTIC] iPad에서는 햅틱이 제한됩니다")
                return
            }
            
            switch type.lowercased() {
            case "light", "selection":
                self.triggerLightHaptic()
            case "medium":
                self.triggerMediumHaptic()
            case "heavy", "error":
                self.triggerHeavyHaptic()
            case "success":
                self.triggerSuccessHaptic()
            case "warning":
                self.triggerWarningHaptic()
            default:
                print("⚠️ [SMAP-HAPTIC] 알 수 없는 햅틱 타입: \(type), 기본값 사용")
                self.triggerMediumHaptic()
            }
        }
    }
    
    // 🧪 햅틱 시스템 테스트 (실제 기기 테스트용)
    private func testHapticSystem() {
        print("🧪 [SMAP-HAPTIC] 햅틱 시스템 테스트 시작 (3초 후)")
        print("📱 [SMAP-HAPTIC] 디바이스 정보:")
        print("   - 모델: \(UIDevice.current.model)")
        print("   - 시스템: \(UIDevice.current.systemName) \(UIDevice.current.systemVersion)")
        print("   - 인터페이스: \(UIDevice.current.userInterfaceIdiom == .phone ? "iPhone" : "iPad")")
        print("   - 햅틱 지원: \(UIDevice.current.userInterfaceIdiom == .phone ? "YES" : "LIMITED")")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            print("🎮 [SMAP-HAPTIC] 햅틱 테스트 실행...")
            
            // iPhone 확인
            guard UIDevice.current.userInterfaceIdiom == .phone else {
                print("⚠️ [SMAP-HAPTIC] iPad에서는 햅틱이 제한됩니다")
                return
            }
            
            // 1초 간격으로 각 햅틱 테스트 (더 느린 간격으로 확실하게)
            let hapticTypes = ["light", "medium", "heavy", "success", "warning"]
            
            for (index, hapticType) in hapticTypes.enumerated() {
                DispatchQueue.main.asyncAfter(deadline: .now() + Double(index * 2 + 1)) { // 2초 간격
                    print("🧪 [SMAP-HAPTIC] \(hapticType.uppercased()) 햅틱 테스트 시작")
                    
                    // 강제로 메인 스레드에서 실행
                    DispatchQueue.main.async {
                        self.executeHapticWithDiagnostics(type: hapticType)
                        print("✅ [SMAP-HAPTIC] \(hapticType.uppercased()) 햅틱 테스트 완료")
                    }
                }
            }
            
            // 마지막에 테스트 완료 메시지
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(hapticTypes.count * 2 + 2)) {
                print("✅ [SMAP-HAPTIC] 햅틱 시스템 테스트 완료!")
                print("💡 [SMAP-HAPTIC] JavaScript에서 테스트하려면:")
                print("   window.webkit.messageHandlers.smapIos.postMessage({type: 'haptic', param: 'success'})")
                
                // JavaScript에 햅틱 글로벌 함수들 등록
                self.registerHapticFunctions()
            }
        }
    }
    
    // 햅틱 실행 + 진단 정보
    private func executeHapticWithDiagnostics(type: String) {
        print("🔍 [SMAP-HAPTIC] 햅틱 실행 시작 - 타입: \(type)")
        print("   - 현재 스레드: \(Thread.isMainThread ? "메인" : "백그라운드")")
        print("   - 디바이스 모델: \(UIDevice.current.model)")
        
        switch type.lowercased() {
        case "light":
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.prepare()
            generator.impactOccurred()
            print("   - Light 햅틱 실행됨")
        case "medium":
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.prepare()
            generator.impactOccurred()
            print("   - Medium 햅틱 실행됨")
        case "heavy":
            let generator = UIImpactFeedbackGenerator(style: .heavy)
            generator.prepare()
            generator.impactOccurred()
            print("   - Heavy 햅틱 실행됨")
        case "success":
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.success)
            print("   - Success 햅틱 실행됨")
        case "warning":
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.warning)
            print("   - Warning 햅틱 실행됨")
        case "error":
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.error)
            print("   - Error 햅틱 실행됨")
        default:
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.prepare()
            generator.impactOccurred()
            print("   - 기본 Medium 햅틱 실행됨")
        }
        
        print("🔍 [SMAP-HAPTIC] 햅틱 실행 완료 - 타입: \(type)")
    }
    
    // JavaScript 햅틱 글로벌 함수들 등록
    private func registerHapticFunctions() {
        let hapticScript = """
        console.log('🎮 [SMAP-JS] 햅틱 함수들 등록 시작');
        
        // 전역 햅틱 함수들 정의
        window.hapticLight = function() {
            console.log('🎮 [SMAP-JS] 햅틱 요청: light');
            window.webkit.messageHandlers.smapIos.postMessage({type: 'haptic', param: 'light'});
        };
        
        window.hapticMedium = function() {
            console.log('🎮 [SMAP-JS] 햅틱 요청: medium');
            window.webkit.messageHandlers.smapIos.postMessage({type: 'haptic', param: 'medium'});
        };
        
        window.hapticHeavy = function() {
            console.log('🎮 [SMAP-JS] 햅틱 요청: heavy');
            window.webkit.messageHandlers.smapIos.postMessage({type: 'haptic', param: 'heavy'});
        };
        
        window.hapticSuccess = function() {
            console.log('🎮 [SMAP-JS] 햅틱 요청: success');
            window.webkit.messageHandlers.smapIos.postMessage({type: 'haptic', param: 'success'});
        };
        
        window.hapticWarning = function() {
            console.log('🎮 [SMAP-JS] 햅틱 요청: warning');
            window.webkit.messageHandlers.smapIos.postMessage({type: 'haptic', param: 'warning'});
        };
        
        window.hapticError = function() {
            console.log('🎮 [SMAP-JS] 햅틱 요청: error');
            window.webkit.messageHandlers.smapIos.postMessage({type: 'haptic', param: 'error'});
        };
        
        console.log('🎮 [SMAP-JS] 햅틱 함수들 등록 완료');
        console.log('💡 [SMAP-JS] 사용법: hapticSuccess(), hapticError(), hapticLight() 등');
        """
        
        self.web_view.evaluateJavaScript(hapticScript) { (result, error) in
            if let error = error {
                print("❌ [SMAP-HAPTIC] JavaScript 함수 등록 실패: \(error)")
            } else {
                print("✅ [SMAP-HAPTIC] JavaScript 함수 등록 성공")
            }
        }
    }
    
    // MARK: - Apple Sign In Methods
    @available(iOS 13.0, *)
    func performAppleSignIn() {
        print("🍎 [APPLE SIGNIN] Apple 로그인 시작")
        
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        
        let authorizationController = ASAuthorizationController(authorizationRequests: [request])
        authorizationController.delegate = self
        authorizationController.presentationContextProvider = self
        authorizationController.performRequests()
    }
}

// MARK: - Apple Sign In Delegate
@available(iOS 13.0, *)
extension MainView: ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return self.view.window!
    }
    
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        print("🍎 [APPLE SIGNIN] 로그인 성공")
        
        if let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential {
            let userIdentifier = appleIDCredential.user
            let fullName = appleIDCredential.fullName
            let email = appleIDCredential.email
            let identityToken = appleIDCredential.identityToken
            let authorizationCode = appleIDCredential.authorizationCode
            
            var userName = ""
            if let givenName = fullName?.givenName, let familyName = fullName?.familyName {
                userName = "\(familyName)\(givenName)"
            } else if let givenName = fullName?.givenName {
                userName = givenName
            }
            
            var tokenString = ""
            if let token = identityToken {
                tokenString = String(data: token, encoding: .utf8) ?? ""
            }
            
            var codeString = ""
            if let code = authorizationCode {
                codeString = String(data: code, encoding: .utf8) ?? ""
            }
            
            print("🍎 [APPLE SIGNIN] userIdentifier: \(userIdentifier)")
            print("🍎 [APPLE SIGNIN] userName: \(userName)")
            print("🍎 [APPLE SIGNIN] email: \(email ?? "private")")
            
            // 웹뷰로 Apple 로그인 정보 전달
            let appleSignInData: [String: Any] = [
                "success": true,
                "userIdentifier": userIdentifier,
                "userName": userName,
                "email": email ?? "",
                "identityToken": tokenString,
                "authorizationCode": codeString
            ]
            
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: appleSignInData, options: [])
                if let jsonString = String(data: jsonData, encoding: .utf8) {
                    let script = """
                    if (window.handleAppleSignInResult) {
                        window.handleAppleSignInResult(\(jsonString));
                    } else {
                        console.log('🍎 [APPLE SIGNIN] handleAppleSignInResult 함수가 정의되지 않음');
                        console.log('🍎 [APPLE SIGNIN] 결과:', \(jsonString));
                    }
                    """
                    
                    DispatchQueue.main.async {
                        self.web_view.evaluateJavaScript(script) { (result, error) in
                            if let error = error {
                                print("❌ [APPLE SIGNIN] JavaScript 실행 실패: \(error)")
                            } else {
                                print("✅ [APPLE SIGNIN] JavaScript 실행 성공")
                            }
                        }
                    }
                }
            } catch {
                print("❌ [APPLE SIGNIN] JSON 직렬화 실패: \(error)")
            }
            
            // 성공 햅틱
            self.triggerSuccessHaptic()
        }
    }
    
    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        print("❌ [APPLE SIGNIN] 로그인 실패: \(error.localizedDescription)")
        
        // 웹뷰로 실패 정보 전달
        let appleSignInError: [String: Any] = [
            "success": false,
            "error": error.localizedDescription
        ]
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: appleSignInError, options: [])
            if let jsonString = String(data: jsonData, encoding: .utf8) {
                let script = """
                if (window.handleAppleSignInResult) {
                    window.handleAppleSignInResult(\(jsonString));
                } else {
                    console.log('🍎 [APPLE SIGNIN] handleAppleSignInResult 함수가 정의되지 않음');
                    console.log('🍎 [APPLE SIGNIN] 오류:', \(jsonString));
                }
                """
                
                DispatchQueue.main.async {
                    self.web_view.evaluateJavaScript(script) { (result, error) in
                        if let error = error {
                            print("❌ [APPLE SIGNIN] JavaScript 실행 실패: \(error)")
                        } else {
                            print("✅ [APPLE SIGNIN] JavaScript 실행 성공")
                        }
                    }
                }
            }
        } catch {
            print("❌ [APPLE SIGNIN] JSON 직렬화 실패: \(error)")
        }
        
        // 실패 햅틱
        self.triggerErrorHaptic()
    }
}
