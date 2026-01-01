//
//  IntroView.swift
//  smap
//
//  Created by  Corp. Dmonster on 12/15/23.
//

import UIKit
import SwiftUI

class IntroView: UIViewController {
    
    private var splashHostingController: UIHostingController<SplashView>?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        // 🔒 로그인 전 권한 요청 전부 차단: Intro에서는 아무 권한도 요청하지 않음
        print("🔒 [INTRO] 로그인 전 권한 요청 차단 - 인증 상태 확인 중...")
        
        // 스플래시 뷰 표시
        showSplashView()
        
        // 인증 상태 확인 후 네비게이션
        self.checkAuthAndNavigate()
    }
    
    private func showSplashView() {
        // SwiftUI SplashView를 임베드
        let splashView = SplashView()
        let hostingController = UIHostingController(rootView: splashView)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        
        addChild(hostingController)
        view.addSubview(hostingController.view)
        
        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        
        hostingController.didMove(toParent: self)
        splashHostingController = hostingController
    }
    
    private func checkAuthAndNavigate() {
        // 스플래시 화면 최소 2초 표시
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            
            // 로그인 상태 확인
            let isLoggedIn = AuthService.shared.isLoggedIn
            print("🔍 [INTRO] 로그인 상태: \(isLoggedIn)")
            
            let ad = UIApplication.shared.delegate as! AppDelegate
            
            if isLoggedIn {
                // 로그인됨 - 기존 MainView로 이동
                print("✅ [INTRO] 로그인 상태 확인 - MainView로 이동")
                IntroView.navigateToMainView(appDelegate: ad)
            } else {
                // 로그인 안됨 - 네이티브 LoginView로 이동
                print("🔐 [INTRO] 로그아웃 상태 - LoginView로 이동")
                IntroView.navigateToLoginView(appDelegate: ad)
            }
        }
    }
    
    /// 네이티브 HomeView로 이동 (SwiftUI) - static으로 변경
    static func navigateToMainView(appDelegate: AppDelegate) {
        // SwiftUI MainTabView 생성
        let mainTabView = MainTabView()
        let hostingController = UIHostingController(rootView: mainTabView)
        hostingController.modalPresentationStyle = UIModalPresentationStyle.fullScreen
        
        UIView.transition(with: appDelegate.window!,
                          duration: 0.3,
                          options: .transitionCrossDissolve,
                          animations: {
            appDelegate.window?.rootViewController = hostingController
        }, completion: nil)
    }
    
    /// 네이티브 LoginView로 이동 (SwiftUI) - static으로 변경
    static func navigateToLoginView(appDelegate: AppDelegate, prefilledPhone: String? = nil) {
        // SwiftUI LoginView 생성
        let loginView = LoginView(
            prefilledPhone: prefilledPhone,
            onLoginSuccess: {
                // 로그인 성공 - MainView로 이동
                print("✅ [INTRO] 로그인 성공 - MainView로 이동")
                DispatchQueue.main.async {
                    IntroView.navigateToMainView(appDelegate: appDelegate)
                }
            },
            onNavigateToRegister: { socialData in
                // 네이티브 회원가입 페이지로 이동
                print("📝 [INTRO] 네이티브 회원가입 페이지로 이동")
                IntroView.navigateToRegisterView(appDelegate: appDelegate, socialData: socialData)
            }
        )
        
        // SwiftUI View를 UIHostingController로 래핑
        let hostingController = UIHostingController(rootView: loginView)
        hostingController.modalPresentationStyle = UIModalPresentationStyle.fullScreen
        
        UIView.transition(with: appDelegate.window!,
                          duration: 0.3,
                          options: .transitionCrossDissolve,
                          animations: {
            appDelegate.window?.rootViewController = hostingController
        }, completion: nil)
    }
    
    /// 네이티브 RegisterView로 이동 (SwiftUI) - static 메서드
    static func navigateToRegisterView(appDelegate: AppDelegate, socialData: [String: Any]?) {
        // NativeRegisterView 생성
        let registerView = NativeRegisterView(
            onComplete: {
                // 회원가입 완료
                print("✅ [INTRO] 회원가입 완료")
                
                // 토큰 저장 여부 확인 후 메인으로 이동
                if AuthService.shared.isLoggedIn {
                     print("✅ [INTRO] 자동 로그인 성공 - MainView로 이동")
                     DispatchQueue.main.async {
                         IntroView.navigateToMainView(appDelegate: appDelegate)
                     }
                } else {
                     print("ℹ️ [INTRO] 로그인 필요 - LoginView로 이동")
                     DispatchQueue.main.async {
                         IntroView.navigateToLoginView(appDelegate: appDelegate)
                     }
                }
            },
            socialData: socialData,
            onExistingUser: { phone in
                // 기존 가입자 발견 - 로그인 페이지로 이동 (전화번호 자동 입력)
                print("⚠️ [INTRO] 기존 가입자 발견 - LoginView로 이동 (전화번호: \(phone))")
                DispatchQueue.main.async {
                    IntroView.navigateToLoginView(appDelegate: appDelegate, prefilledPhone: phone)
                }
            }
        )
        
        let hostingController = UIHostingController(rootView: registerView)
        hostingController.modalPresentationStyle = UIModalPresentationStyle.fullScreen
        
        UIView.transition(with: appDelegate.window!,
                          duration: 0.3,
                          options: .transitionCrossDissolve,
                          animations: {
            appDelegate.window?.rootViewController = hostingController
        }, completion: nil)
    }
}
