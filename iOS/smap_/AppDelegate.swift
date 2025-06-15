//
//  AppDelegate.swift
//  smap
//
//  Created by  Corp. Dmonster on 12/15/23.
//

import UIKit
import FirebaseCore
import FirebaseMessaging
import IQKeyboardManagerSwift
import SwiftyStoreKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    var window: UIWindow?
    
    var title = String()
    var body = String()
    var event_url = String()

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // Firebase 설정
        FirebaseApp.configure()
        
        // Firebase Messaging 설정
        Messaging.messaging().isAutoInitEnabled = true
        Messaging.messaging().delegate = self
        
        // 푸시 알림 권한 요청
        if #available(iOS 10.0, *) {
            UNUserNotificationCenter.current().delegate = self
            
            let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
            UNUserNotificationCenter.current().requestAuthorization(
                options: authOptions,
                completionHandler: {_, _ in })
        } else {
            let settings: UIUserNotificationSettings =
                UIUserNotificationSettings(types: [.alert, .badge, .sound], categories: nil)
            application.registerUserNotificationSettings(settings)
        }
        
        application.registerForRemoteNotifications()
        
        // 키보드 매니저 설정
        IQKeyboardManager.shared.enable = true
        IQKeyboardManager.shared.enableAutoToolbar = false
        IQKeyboardManager.shared.resignOnTouchOutside = true
        
        // StoreKit 복원
        StoreKitManager.shared.fetchReceipt { encryptedReceipt, error in
            if let error = error {
                print("fetchReceipt error - \(error)")
                return
            }
            
            StoreKitManager.shared.restorePurchases { msg in
                print("restorePurchases === \(msg ?? "")")
            }
        }
        
        SwiftyStoreKit.completeTransactions(atomically: true) { purchases in
            for purchase in purchases {
                switch purchase.transaction.transactionState {
                case .purchased, .restored:
                    if purchase.needsFinishTransaction {
                        SwiftyStoreKit.finishTransaction(purchase.transaction)
                    }
                case .failed, .purchasing, .deferred:
                    break
                default:
                    break
                }
            }
        }
        
        return true
    }
    
    func applicationDidBecomeActive(_ application: UIApplication) {
        // 앱이 활성화될 때 웹뷰에 상태 변경 알림
        NotificationCenter.default.post(name: Notification.Name("appStateChange"), object: nil, userInfo: ["state": "active"])
    }

    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        // 세로방향 고정
        return UIInterfaceOrientationMask.portrait
    }
    
    // 앱이 현재 화면에서 실행되고 있을 때 푸시 알림 처리
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        print("Handle push from foreground")
        print("\(notification.request.content.userInfo)")
        
        self.title = "\(notification.request.content.userInfo["title"] ?? String())"
        self.body = "\(notification.request.content.userInfo["body"] ?? String())"
        self.event_url = "\(notification.request.content.userInfo["event_url"] ?? String())"
        
        // 웹뷰에 푸시 알림 정보 전달
        let userInfo: [AnyHashable: Any] = ["title":self.title, "body": self.body, "event_url": self.event_url]
        UserDefaults.standard.set(self.event_url, forKey: "event_url")
        NotificationCenter.default.post(name: Notification.Name("getPush"), object: nil, userInfo: userInfo)
        
        completionHandler([.alert, .sound, .badge])
    }
    
    // 백그라운드에서 푸시 알림 처리
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        print("Handle push from background or closed")
        print("\(response.notification.request.content.userInfo)")
    
        self.title = "\(response.notification.request.content.userInfo["title"] ?? String())"
        self.body = "\(response.notification.request.content.userInfo["body"] ?? String())"
        self.event_url = "\(response.notification.request.content.userInfo["event_url"] ?? String())"
        
        let userInfo: [AnyHashable: Any] = ["title":self.title, "body": self.body, "event_url": self.event_url]
        UserDefaults.standard.set(self.event_url, forKey: "event_url")
        NotificationCenter.default.post(name: Notification.Name("getPush"), object: nil, userInfo: userInfo)
        completionHandler()
    }
    
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any]) {
        print("Push notification received: \(userInfo)")
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        Messaging.messaging().appDidReceiveMessage(userInfo)
        completionHandler(UIBackgroundFetchResult.newData)
    }                                          

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().setAPNSToken(deviceToken as Data, type: .unknown)
        print("didRegisterForRemoteNotificationsWithDeviceToken -- 1", Messaging.messaging().apnsToken ?? String())
        
        guard let token = Messaging.messaging().fcmToken else { return }
        Utils.shared.setToken(token: token)
        print("token --> \(token)")
    }
    
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else {return}
        Utils.shared.setToken(token: token)
        print("Firebase registration token: \(token)")
    }
    
    func applicationDidEnterBackground(_ application: UIApplication) {
        let userInfo: [AnyHashable: Any] = ["state": "background"]
        NotificationCenter.default.post(name: Notification.Name("appStateChange"), object: nil, userInfo: userInfo)
    }
    
    func applicationWillEnterForeground(_ application: UIApplication) {
        UIApplication.shared.applicationIconBadgeNumber = 0
        
        let userInfo: [AnyHashable: Any] = ["state": "foreground"]
        NotificationCenter.default.post(name: Notification.Name("appStateChange"), object: nil, userInfo: userInfo)
        NotificationCenter.default.post(name: Notification.Name("appStateForeground"), object: nil, userInfo: nil)
    }
    
    // 딥링크 처리
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        
        // 웹뷰에서 처리할 수 있도록 딥링크 정보 전달
        let userInfo: [AnyHashable: Any] = ["deeplink_url": url.absoluteString]
        UserDefaults.standard.set(url.absoluteString, forKey: "deeplink_url")
        NotificationCenter.default.post(name: Notification.Name("getDeepLink"), object: nil, userInfo: userInfo)
        
        return true
    }
} 