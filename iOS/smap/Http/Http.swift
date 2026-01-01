//
//  Http.swift
//  smap
//
//  Created by  Corp. Dmonster on 3/20/24.
//

import Foundation

class Http {
    static let shared = Http()
    
//    let WEB_BASE_URL = "https://app.smap.site/"
//    let BASE_URL = "https://smap.api.dmonster.kr/api/"//api url
//    let FILE_API_URL = "https://app.smap.site/api/"
    
    // MARK: - 🌐 URL 설정 (개발/프로덕션 환경 구분)
    var WEB_BASE_URL: String {
        #if DEBUG    
            return "https://nextstep.smap.site/"
        #else
            return "https://nextstep.smap.site/"
        #endif
    }
    
    let BASE_URL = "https://api3.smap.site/api/"//api url (HTTPS 고정)
    let FILE_API_URL = "https://nextstep.smap.site/api/"
    
    let authUrl = "auth/"
    
    let memberLocationUrl = "v1/logs/member-location-logs"
    
    // MARK: - 🔔 FCM 토큰 업데이트 API (강제 업데이트용)
    let memberFcmTokenUrl = "v1/member-fcm-token/register"
    
    let fileUploadUrl = "member_file_upload.php"
    
    let hashKey = "518cbe9ed50bf7e72913eb6b5a5e5fc6a8b99d56200ebda3a5bb365dbdccbdf6"
    
    // MARK: - 🔧 개발자용 URL 변경 함수 (런타임에서 변경 가능)
    private var customWEB_BASE_URL: String? = nil
    
    func getWebBaseURL() -> String {
        if let custom = customWEB_BASE_URL {
            print("🔧 [SMAP-HTTP] 커스텀 WEB_BASE_URL 사용: \(custom)")
            return custom
        }
        
        let url = WEB_BASE_URL
        print("🌐 [SMAP-HTTP] 기본 WEB_BASE_URL 사용: \(url)")
        return url
    }
    
    // 🔧 런타임에서 WEB_BASE_URL 변경 (개발용)
    func setCustomWebBaseURL(_ urlString: String) {
        customWEB_BASE_URL = urlString
        print("🔧 [SMAP-HTTP] WEB_BASE_URL 변경됨: \(urlString)")
    }
    
    func resetWebBaseURL() {
        customWEB_BASE_URL = nil
        print("🔧 [SMAP-HTTP] WEB_BASE_URL 기본값으로 복원: \(WEB_BASE_URL)")
    }
}
