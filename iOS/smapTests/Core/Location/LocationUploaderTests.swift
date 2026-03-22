import XCTest
@testable import smap

final class LocationUploaderTests: XCTestCase {

    var uploader: LocationUploader!

    override func setUp() {
        super.setUp()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        let client = APIClient(session: URLSession(configuration: config))
        uploader = LocationUploader(apiClient: client, mtIdx: "42")
    }

    override func tearDown() {
        uploader.stopBatching()
        uploader.stopHeartbeat()
        MockURLProtocol.requestHandler = nil
        super.tearDown()
    }

    func testEnqueue_addsToQueue() {
        let loc = LocationData(lat: 37.5, lng: 127.0, accuracy: 10, speed: 0,
                               altitude: 50, timestamp: "2026-03-22 12:00:00", battery: 80, steps: 100)
        uploader.enqueue(loc)
        XCTAssertEqual(uploader.pendingCount, 1)
    }

    func testEnqueue_evictsOldest_whenOverMax() {
        for i in 0..<105 {
            let loc = LocationData(lat: Double(i), lng: 0, accuracy: 10, speed: 0,
                                   altitude: 0, timestamp: "", battery: 0, steps: 0)
            uploader.enqueue(loc)
        }
        XCTAssertEqual(uploader.pendingCount, 100) // max 100
    }

    func testFlush_sendsAllPending() async {
        var requestCount = 0
        MockURLProtocol.requestHandler = { request in
            requestCount += 1
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data())
        }

        let loc = LocationData(lat: 37.5, lng: 127.0, accuracy: 10, speed: 0,
                               altitude: 50, timestamp: "2026-03-22 12:00:00", battery: 80, steps: 100)
        uploader.enqueue(loc)
        uploader.enqueue(loc)

        await uploader.flush()
        XCTAssertEqual(uploader.pendingCount, 0)
        XCTAssertGreaterThan(requestCount, 0)
    }

    func testFlush_keepsOnFailure() async {
        MockURLProtocol.requestHandler = { request in
            return (HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!, Data())
        }

        let loc = LocationData(lat: 37.5, lng: 127.0, accuracy: 10, speed: 0,
                               altitude: 50, timestamp: "", battery: 0, steps: 0)
        uploader.enqueue(loc)

        await uploader.flush()
        XCTAssertEqual(uploader.pendingCount, 1) // still there
    }
}
