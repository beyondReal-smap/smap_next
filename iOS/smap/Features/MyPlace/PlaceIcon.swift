//
// PlaceIcon.swift
// smap
//
// 저장한 장소의 종류 — 목록 왼쪽 아이콘을 장소마다 다르게 보여 주려고 쓴다(2026-11-20, 전부 같은 핀이라 구분이 안 됐다).
// 사용자가 저장할 때 고른 값(slt_icon)이 있으면 그것을, 없으면(예전 장소) 이름의 낱말로 짐작한다.
// Android PlaceIcon.kt 와 같은 키·규칙.
//

import Foundation

/// rawValue 는 서버 slt_icon 에 저장하는 키 — 바꾸면 이미 저장된 장소의 아이콘이 풀리니 바꾸지 말 것.
/// case 순서가 아이콘 고르기 화면의 순서다.
enum PlaceKind: String, CaseIterable {
    case home, family, office, school, academy, hospital, cafe, restaurant, shopping, fitness, park, religion, transit, other

    /// 위에서부터 먼저 맞는 종류. 순서가 뜻을 가른다:
    /// "어린이집"은 집보다 학교, "맛집"은 집보다 식당, "할머니집"은 집보다 가족이 먼저 걸리게 한다.
    private static let rules: [(PlaceKind, [String])] = [
        (.school, ["학교", "대학", "유치원", "어린이집", "캠퍼스", "school"]),
        (.academy, ["학원", "도서관", "독서실", "스터디"]),
        (.restaurant, ["맛집", "식당", "레스토랑", "음식점"]),
        (.cafe, ["카페", "커피", "스타벅스", "cafe", "coffee"]),
        (.family, ["할머니", "할아버지", "외가", "친가", "본가", "부모님", "엄마", "아빠", "시댁", "처가"]),
        (.home, ["집", "아파트", "빌라", "자택", "home"]),
        (.office, ["회사", "사무실", "직장", "오피스", "본사", "지사", "출근", "office", "work"]),
        (.hospital, ["병원", "의원", "치과", "약국", "보건소", "hospital"]),
        (.shopping, ["마트", "시장", "편의점", "백화점", "쇼핑", "아울렛", "다이소", "코스트코"]),
        (.fitness, ["헬스", "체육관", "수영장", "필라테스", "요가", "태권도", "피트니스", "gym"]),
        (.park, ["공원", "놀이터", "운동장", "park"]),
        (.religion, ["교회", "성당", "사찰", "법당"]),
        (.transit, ["정류장", "터미널", "공항"]),
    ]

    /// 저장된 키가 있으면 그 종류, 없거나 이 앱이 모르는 키면 이름으로 짐작한다.
    init(icon: String?, name: String) {
        if let icon, let kind = PlaceKind(rawValue: icon) {
            self = kind
        } else {
            self.init(name: name)
        }
    }

    init(name: String) {
        let text = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let match = Self.rules.first(where: { _, words in words.contains { text.contains($0) } }) {
            self = match.0
        } else if text.hasSuffix("역") {
            // "역"은 한 글자라 "지역" 등에도 들어 있어 이름 끝에 올 때만(강남역·서울역)
            self = .transit
        } else {
            self = .other
        }
    }

    /// 아이콘 고르기 화면의 이름표
    var label: String {
        switch self {
        case .home: return "집"
        case .family: return "가족"
        case .office: return "회사"
        case .school: return "학교"
        case .academy: return "학원"
        case .hospital: return "병원"
        case .cafe: return "카페"
        case .restaurant: return "식당"
        case .shopping: return "마트"
        case .fitness: return "운동"
        case .park: return "공원"
        case .religion: return "종교"
        case .transit: return "교통"
        case .other: return "기타"
        }
    }

    /// SF Symbol 이름
    var systemImage: String {
        switch self {
        case .school: return "graduationcap.fill"
        case .academy: return "book.fill"
        case .restaurant: return "fork.knife"
        case .cafe: return "cup.and.saucer.fill"
        case .family: return "heart.fill"
        case .home: return "house.fill"
        case .office: return "building.2.fill"
        case .hospital: return "cross.case.fill"
        case .shopping: return "cart.fill"
        case .fitness: return "figure.run"
        case .park: return "tree.fill"
        case .religion: return "building.columns.fill"
        case .transit: return "tram.fill"
        case .other: return "mappin.and.ellipse"
        }
    }
}

extension SavedLocation {
    /// 목록·칩·상세에 보여 줄 종류 — 고른 아이콘이 먼저, 없으면 이름으로 짐작
    var kind: PlaceKind { PlaceKind(icon: slt_icon, name: name) }
}
