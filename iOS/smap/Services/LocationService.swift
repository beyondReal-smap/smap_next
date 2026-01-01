import Foundation
import Combine

struct KakaoPlace: Codable, Identifiable {
    var id: String { id_api }
    let id_api: String
    let place_name: String
    let address_name: String
    let road_address_name: String
    let x: String // Longitude
    let y: String // Latitude
    
    enum CodingKeys: String, CodingKey {
        case id_api = "id"
        case place_name
        case address_name
        case road_address_name
        case x
        case y
    }
}

struct KakaoPlaceResponse: Codable {
    let documents: [KakaoPlace]
}

class KakaoLocationSearchService: ObservableObject {
    static let shared = KakaoLocationSearchService()
    private let apiKey = "7fbf60571daf54ca5bee8373a1f31d2d" // From Next.js
    
    private init() {}
    
    func searchLocation(query: String) async throws -> [KakaoPlace] {
        guard let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://dapi.kakao.com/v2/local/search/keyword.json?query=\(encodedQuery)") else {
            throw customError(message: "Invalid URL")
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("KakaoAK \(apiKey)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw customError(message: "API Request Failed")
        }
        
        let result = try JSONDecoder().decode(KakaoPlaceResponse.self, from: data)
        return result.documents
    }
    
    private func customError(message: String) -> Error {
        return NSError(domain: "LocationService", code: 0, userInfo: [NSLocalizedDescriptionKey: message])
    }
}
