import XCTest
import CoreMotion
@testable import smap

final class MotionManagerTests: XCTestCase {

    func testDetermineMode_stationary() {
        let activity = MockMotionActivity(stationary: true)
        let mode = MotionManager.determineMode(from: activity)
        XCTAssertEqual(mode, .stationary)
    }

    func testDetermineMode_walking() {
        let activity = MockMotionActivity(walking: true)
        let mode = MotionManager.determineMode(from: activity)
        XCTAssertEqual(mode, .walking)
    }

    func testDetermineMode_running_mapsToWalking() {
        let activity = MockMotionActivity(running: true)
        let mode = MotionManager.determineMode(from: activity)
        XCTAssertEqual(mode, .walking)
    }

    func testDetermineMode_automotive() {
        let activity = MockMotionActivity(automotive: true)
        let mode = MotionManager.determineMode(from: activity)
        XCTAssertEqual(mode, .automotive)
    }

    func testDetermineMode_cycling_mapsToWalking() {
        let activity = MockMotionActivity(cycling: true)
        let mode = MotionManager.determineMode(from: activity)
        XCTAssertEqual(mode, .walking)
    }

    func testDetermineMode_unknown_defaultsToWalking() {
        let activity = MockMotionActivity(unknown: true)
        let mode = MotionManager.determineMode(from: activity)
        XCTAssertEqual(mode, .walking)
    }
}

// MARK: - Mock

class MockMotionActivity: CMMotionActivity {
    private let _stationary: Bool
    private let _walking: Bool
    private let _running: Bool
    private let _automotive: Bool
    private let _cycling: Bool
    private let _unknown: Bool

    init(stationary: Bool = false, walking: Bool = false, running: Bool = false,
         automotive: Bool = false, cycling: Bool = false, unknown: Bool = false) {
        _stationary = stationary; _walking = walking; _running = running
        _automotive = automotive; _cycling = cycling; _unknown = unknown
        super.init()
    }
    required init?(coder: NSCoder) { fatalError() }

    override var stationary: Bool { _stationary }
    override var walking: Bool { _walking }
    override var running: Bool { _running }
    override var automotive: Bool { _automotive }
    override var cycling: Bool { _cycling }
    override var unknown: Bool { _unknown }
}
