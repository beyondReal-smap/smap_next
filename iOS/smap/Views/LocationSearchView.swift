import SwiftUI

// MARK: - Kakao Place Models
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

// MARK: - Kakao Address Models (for Reverse Geocoding)
struct KakaoAddressResponse: Codable {
    let documents: [KakaoAddressDocument]
}

struct KakaoAddressDocument: Codable {
    let address: KakaoAddress?
    let road_address: KakaoRoadAddress?
}

struct KakaoAddress: Codable {
    let address_name: String
}

struct KakaoRoadAddress: Codable {
    let address_name: String
}

// MARK: - Kakao Location Search Service
class KakaoLocationSearchService: ObservableObject {
    static let shared = KakaoLocationSearchService()
    private var apiKey: String { AppConfiguration.kakaoAPIKey }
    
    private init() {}
    
    func searchLocation(query: String) async throws -> [KakaoPlace] {
        guard let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://dapi.kakao.com/v2/local/search/keyword.json?query=\(encodedQuery)") else {
            throw NSError(domain: "KakaoLocationSearchService", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("KakaoAK \(apiKey)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw NSError(domain: "KakaoLocationSearchService", code: 0, userInfo: [NSLocalizedDescriptionKey: "API Request Failed"])
        }
        
        let result = try JSONDecoder().decode(KakaoPlaceResponse.self, from: data)
        return result.documents
    }
    
    func reverseGeocode(latitude: Double, longitude: Double) async throws -> String? {
        let urlString = "https://dapi.kakao.com/v2/local/geo/coord2address.json?x=\(longitude)&y=\(latitude)"
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "KakaoLocationSearchService", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("KakaoAK \(apiKey)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            return nil
        }
        
        let result = try JSONDecoder().decode(KakaoAddressResponse.self, from: data)
        if let doc = result.documents.first {
            // Prefer road address if available
            return doc.road_address?.address_name ?? doc.address?.address_name
        }
        return nil
    }
}

// MARK: - Location Search View
struct LocationSearchView: View {
    @Environment(\.presentationMode) var presentationMode
    @State private var query: String = ""
    @State private var places: [KakaoPlace] = []
    @State private var isLoading: Bool = false
    @State private var errorMessage: String?
    @State private var hasSearched: Bool = false // Track if search was performed
    
    
    
    var onSelect: (KakaoPlace) -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            // Modern Search Bar
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .font(.suite(size: 16, weight: .bold))
                            .foregroundColor(SMAPTheme.Color.primary)
                        
                        TextField("지번, 도로명, 건물명 검색", text: $query, onCommit: performSearch)
                            .font(.suite(size: 15))
                            .foregroundColor(.primary)
                            .disableAutocorrection(true)
                        
                        if !query.isEmpty {
                            Button(action: { query = ""; places = []; hasSearched = false }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.gray.opacity(0.5))
                            }
                            .accessibilityLabel("검색어 지우기")
                        }
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 52) // 고정 높이
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(14)
                    
                    Button(action: performSearch) {
                        Text("검색")
                            .font(.suite(size: 15, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                            .background(query.isEmpty ? Color.gray.opacity(0.3) : SMAPTheme.Color.primary)
                            .cornerRadius(14)
                    }
                    .disabled(query.isEmpty)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
                .background(Color.white)
                
                Divider().opacity(0.5)
            }
            
            // Content Area
            ZStack {
                Color(UIColor.systemGroupedBackground).ignoresSafeArea()
                
                if isLoading {
                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.2)
                        Text("장소를 찾는 중...").font(.suite(size: 14)).foregroundColor(.secondary)
                    }
                } else if let errorMessage = errorMessage {
                    emptyStateView(icon: "exclamationmark.triangle.fill", title: "오류 발생", message: errorMessage)
                } else if places.isEmpty {
                    if !hasSearched {
                        emptyStateView(icon: "map.fill", title: "어디를 찾으시나요?", message: "지번, 도로명 혹은 건물명을 입력하여\n원하는 장소를 검색해 보세요.")
                    } else {
                        emptyStateView(icon: "magnifyingglass", title: "검색 결과 없음", message: "'\(query)'에 대한 검색 결과가 없습니다.\n다른 검색어를 입력해 보세요.")
                    }
                } else {
                    List {
                        Section {
                            ForEach(places) { place in
                                Button(action: {
                                    onSelect(place)
                                    presentationMode.wrappedValue.dismiss()
                                }) {
                                    HStack(spacing: 16) {
                                        ZStack {
                                            Circle()
                                                .fill(SMAPTheme.Color.primary.opacity(0.1))
                                                .frame(width: 40, height: 40)
                                            Image(systemName: "mappin.and.ellipse")
                                                .font(.suite(size: 18))
                                                .foregroundColor(SMAPTheme.Color.primary)
                                        }
                                        
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(place.place_name)
                                                .font(.suite(size: 16, weight: .bold))
                                                .foregroundColor(.primary)
                                            
                                            Text(place.road_address_name.isEmpty ? place.address_name : place.road_address_name)
                                                .font(.suite(size: 13))
                                                .foregroundColor(.secondary)
                                                .lineLimit(2)
                                        }
                                        
                                        Spacer()
                                        
                                        Image(systemName: "chevron.right")
                                            .font(.suite(size: 12, weight: .bold))
                                            .foregroundColor(.gray.opacity(0.3))
                                    }
                                    .padding(.vertical, 8)
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                        } header: {
                            Text("검색 결과 \(places.count)건")
                                .font(.suite(size: 12, weight: .semibold))
                                .foregroundColor(.secondary)
                                .textCase(nil)
                        }
                    }
                    .listStyle(InsetGroupedListStyle())
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("장소 검색")
                    .font(.suite(size: 17, weight: .bold))
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }
    
    private func emptyStateView(icon: String, title: String, message: String) -> some View {
        VStack(spacing: 20) {
            ZStack {
                Circle()
                    .fill(Color.white)
                    .frame(width: 100, height: 100)
                    .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
                
                Image(systemName: icon)
                    .font(.suite(size: 40))
                    .foregroundColor(SMAPTheme.Color.primary.opacity(0.6))
            }
            
            VStack(spacing: 8) {
                Text(title)
                    .font(.suite(size: 18, weight: .bold))
                
                Text(message)
                    .font(.suite(size: 14))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
            }
        }
        .padding(40)
    }
    
    private func performSearch() {
        guard !query.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                let results = try await KakaoLocationSearchService.shared.searchLocation(query: query)
                DispatchQueue.main.async {
                    self.places = results
                    self.isLoading = false
                    self.hasSearched = true
                }
            } catch {
                DispatchQueue.main.async {
                    self.errorMessage = "검색 중 오류가 발생했습니다."
                    self.isLoading = false
                    print(error)
                }
            }
        }
    }
}
