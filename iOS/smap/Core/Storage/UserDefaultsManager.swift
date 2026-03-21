import Foundation

/// 타입-safe UserDefaults 관리
final class UserDefaultsManager {

    static let shared = UserDefaultsManager()

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    private enum Key: String {
        case mtIdx = "mt_idx"
        case mtId = "mt_id"
        case mtName = "mt_name"
        case mtEmail = "mt_email"
        case isLoggedIn = "is_logged_in"
        case fcmToken = "fcm_token"
        case apnsToken = "last_apns_token"
        case lastFCMUpdate = "last_updated_fcm_token"
        case userData = "smap_user_data"
        case loginTime = "smap_login_time"
        case storageMigrated = "smap_storage_migrated_v2"
    }

    var mtIdx: String? {
        get { defaults.string(forKey: Key.mtIdx.rawValue) }
        set { defaults.set(newValue, forKey: Key.mtIdx.rawValue) }
    }

    var mtId: String? {
        get { defaults.string(forKey: Key.mtId.rawValue) }
        set { defaults.set(newValue, forKey: Key.mtId.rawValue) }
    }

    var mtName: String? {
        get { defaults.string(forKey: Key.mtName.rawValue) }
        set { defaults.set(newValue, forKey: Key.mtName.rawValue) }
    }

    var mtEmail: String? {
        get { defaults.string(forKey: Key.mtEmail.rawValue) }
        set { defaults.set(newValue, forKey: Key.mtEmail.rawValue) }
    }

    var isLoggedIn: Bool {
        get { defaults.bool(forKey: Key.isLoggedIn.rawValue) }
        set { defaults.set(newValue, forKey: Key.isLoggedIn.rawValue) }
    }

    var fcmToken: String? {
        get { defaults.string(forKey: Key.fcmToken.rawValue) }
        set { defaults.set(newValue, forKey: Key.fcmToken.rawValue) }
    }

    var apnsToken: String? {
        get { defaults.string(forKey: Key.apnsToken.rawValue) }
        set { defaults.set(newValue, forKey: Key.apnsToken.rawValue) }
    }

    var lastFCMUpdate: String? {
        get { defaults.string(forKey: Key.lastFCMUpdate.rawValue) }
        set { defaults.set(newValue, forKey: Key.lastFCMUpdate.rawValue) }
    }

    func saveUserData(_ user: SMAPUser) {
        if let encoded = try? JSONEncoder().encode(user) {
            defaults.set(encoded, forKey: Key.userData.rawValue)
            defaults.set(Date().timeIntervalSince1970, forKey: Key.loginTime.rawValue)
        }
    }

    func getUserData() -> SMAPUser? {
        guard let data = defaults.data(forKey: Key.userData.rawValue) else { return nil }
        return try? JSONDecoder().decode(SMAPUser.self, from: data)
    }

    var isStorageMigrated: Bool {
        get { defaults.bool(forKey: Key.storageMigrated.rawValue) }
        set { defaults.set(newValue, forKey: Key.storageMigrated.rawValue) }
    }

    func clearAll() {
        let keys: [Key] = [.mtIdx, .mtId, .mtName, .mtEmail, .isLoggedIn,
                           .fcmToken, .apnsToken, .lastFCMUpdate,
                           .userData, .loginTime]
        keys.forEach { defaults.removeObject(forKey: $0.rawValue) }
    }
}
