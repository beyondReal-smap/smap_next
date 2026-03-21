import Foundation

enum AppConfiguration {
    // MARK: - API URLs

    static let apiBaseURL: String = {
        guard let url = Bundle.main.infoDictionary?["API_BASE_URL"] as? String, !url.isEmpty else {
            return "https://api3.smap.site/api/"
        }
        return url
    }()

    static let webBaseURL: String = {
        guard let url = Bundle.main.infoDictionary?["WEB_BASE_URL"] as? String, !url.isEmpty else {
            return "https://nextstep.smap.site/"
        }
        return url
    }()

    static let fileAPIURL: String = {
        guard let url = Bundle.main.infoDictionary?["FILE_API_URL"] as? String, !url.isEmpty else {
            return "https://nextstep.smap.site/api/"
        }
        return url
    }()

    static let imageBaseURL: String = {
        guard let url = Bundle.main.infoDictionary?["IMAGE_BASE_URL"] as? String, !url.isEmpty else {
            return "https://api3.smap.site"
        }
        return url
    }()

    // MARK: - API Keys

    static let kakaoAPIKey: String = {
        Bundle.main.infoDictionary?["KAKAO_API_KEY"] as? String ?? ""
    }()

    static let authSecretKey: String = {
        Bundle.main.infoDictionary?["AUTH_SECRET_KEY"] as? String ?? ""
    }()

    // MARK: - API v1 Base URL (Services에서 사용)

    static let apiV1BaseURL: String = {
        let base = apiBaseURL.hasSuffix("/") ? String(apiBaseURL.dropLast()) : apiBaseURL
        return "\(base)/v1"
    }()
}
