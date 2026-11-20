//
//  DemoURLProtocol.swift
//  smap
//
//  스토어 스크린샷용 데모 모드(디버그 빌드 전용 — 운영 빌드에는 컴파일되지 않는다).
//
//  켜는 법: 실행 인자 `-SMAPDemo YES`
//    (xcrun simctl launch <기기> com.dmonster.smap -SMAPDemo YES)
//  켜지면 화면이 읽는 조회(GET) 몇 가지만 DemoFixtures 의 가짜 응답으로 바꾼다.
//  로그인·쓰기 요청 등 나머지는 그대로 실제 서버로 간다(가짜 알림의 읽음·삭제만 예외 — 성공으로 답한다).
//  가짜 응답은 tools/store-demo/build_fixtures.py 가 만든다(Android 와 같은 데이터).
//

#if DEBUG
import Foundation
import os

final class DemoURLProtocol: URLProtocol {
    private static let logger = Logger(subsystem: "com.dmonster.smap", category: "DemoMode")
    private static let apiPrefix = "/api/v1/"

    private struct Rule: Decodable {
        let path: String
        let fixture: String
        let fallback: String?
        let todayOnly: Bool?

        var segments: [String] { path.split(separator: "/", omittingEmptySubsequences: false).map(String.init) }
    }

    private static let rules: [Rule] = {
        do {
            return try JSONDecoder().decode([Rule].self, from: Data(DemoFixtures.manifest.utf8))
        } catch {
            fatalError("DemoFixtures.manifest 해석 실패 — build_fixtures.py 를 다시 실행: \(error)")
        }
    }()

    /// 실행 인자 `-SMAPDemo YES` 일 때만 등록한다. URLSession.shared 를 쓰는 요청이 대상이다.
    static func registerIfRequested() {
        guard UserDefaults.standard.bool(forKey: "SMAPDemo") else { return }
        URLProtocol.registerClass(DemoURLProtocol.self)
        logger.info("데모 모드 켜짐")
    }

    // MARK: - URLProtocol

    override class func canInit(with request: URLRequest) -> Bool {
        response(for: request) != nil
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url, let body = Self.response(for: request) else {
            client?.urlProtocol(self, didFailWithError: URLError(.unsupportedURL))
            return
        }
        Self.logger.debug("가짜 응답: \(url.path, privacy: .public)")
        let http = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                   headerFields: ["Content-Type": "application/json; charset=utf-8"])!
        client?.urlProtocol(self, didReceive: http, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    // MARK: - 규칙 매칭

    /// 데모 화면의 알림 목록은 가짜(plt_idx 1990000 대)라, 그 읽음·삭제 요청을 운영 서버로 보내면 404 가 나
    /// "읽음 처리에 실패했습니다" 가 뜨고, 전체 읽음·삭제는 테스트 계정의 실제 알림을 바꾼다. 알림 쓰기는 여기서 성공으로 끝낸다.
    private static let demoWriteSuccess = #"{"success":true,"message":"demo"}"#

    /// 규칙에 맞으면 응답 본문, 아니면 nil(실제 서버로 보낸다).
    private static func response(for request: URLRequest) -> String? {
        guard let url = request.url,
              let range = url.path.range(of: apiPrefix) else { return nil }
        let path = url.path[range.upperBound...].trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard (request.httpMethod ?? "GET") == "GET" else {
            return path.hasPrefix("push-logs/") ? demoWriteSuccess : nil
        }
        let segments = path.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        let dateQuery = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "date" })?.value

        for rule in rules {
            let ruleSegments = rule.segments
            guard ruleSegments.count == segments.count else { continue }
            var mid: String?
            var matched = true
            for (r, s) in zip(ruleSegments, segments) {
                if r == "*" { continue }
                if r == "{mid}" { mid = s; continue }
                if r != s { matched = false; break }
            }
            guard matched else { continue }

            let isOtherDay = (rule.todayOnly ?? false) && dateQuery != nil && dateQuery != today()
            let name = isOtherDay ? rule.fallback : rule.fixture.replacingOccurrences(of: "{mid}", with: mid ?? "")
            guard let text = name.flatMap({ DemoFixtures.files[$0] })
                    ?? rule.fallback.flatMap({ DemoFixtures.files[$0] }) else { return nil }
            return fillTokens(text)
        }
        return nil
    }

    // MARK: - 날짜 토큰(형식은 build_fixtures.py 머리말 참고)

    private static let tokenRegex = try! NSRegularExpression(pattern: #"\{\{(D|MD|DOW|WE|NOW)([+-]\d+)\}\}"#)

    private static func formatter(_ format: String) -> DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = format
        return f
    }

    private static func today() -> String { formatter("yyyy-MM-dd").string(from: Date()) }

    private static func fillTokens(_ text: String) -> String {
        let calendar = Calendar(identifier: .gregorian)
        let now = Date()
        let startOfToday = calendar.startOfDay(for: now)
        let day = formatter("yyyy-MM-dd"), md = formatter("MM.dd"), dow = formatter("EEE"),
            dateTime = formatter("yyyy-MM-dd HH:mm:ss")

        let ns = text as NSString
        var result = ""
        var last = 0
        for m in tokenRegex.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            result += ns.substring(with: NSRange(location: last, length: m.range.location - last))
            let kind = ns.substring(with: m.range(at: 1))
            let n = Int(ns.substring(with: m.range(at: 2))) ?? 0
            let date = calendar.date(byAdding: .day, value: n, to: startOfToday)!
            switch kind {
            case "D": result += day.string(from: date)
            case "MD": result += md.string(from: date)
            case "DOW": result += dow.string(from: date)
            case "WE": result += calendar.isDateInWeekend(date) ? "true" : "false"
            default: result += dateTime.string(from: calendar.date(byAdding: .minute, value: n, to: now)!) // NOW
            }
            last = m.range.location + m.range.length
        }
        result += ns.substring(from: last)
        return result
    }
}
#endif
