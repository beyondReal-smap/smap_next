//
// GoogleLogoView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

// MARK: - GoogleLogoView

struct GoogleLogoView: View {
    var body: some View {
        GeometryReader { geometry in
            let w = geometry.size.width
            let h = geometry.size.height
            let s = min(w, h) / 24.0

            // Center alignment
            let offsetX = (w - (24 * s)) / 2
            let offsetY = (h - (24 * s)) / 2

            ZStack {
                // Blue
                Path { path in
                    path.move(to: CGPoint(x: 22.56 * s, y: 12.25 * s))
                    path.addCurve(to: CGPoint(x: 22.36 * s, y: 10.0 * s), control1: CGPoint(x: 22.56 * s, y: 11.47 * s), control2: CGPoint(x: 22.49 * s, y: 10.72 * s))
                    path.addLine(to: CGPoint(x: 12.0 * s, y: 10.0 * s))
                    path.addLine(to: CGPoint(x: 12.0 * s, y: 14.26 * s))
                    path.addLine(to: CGPoint(x: 17.92 * s, y: 14.26 * s))
                    path.addCurve(to: CGPoint(x: 15.71 * s, y: 17.57 * s), control1: CGPoint(x: 17.66 * s, y: 15.63 * s), control2: CGPoint(x: 16.88 * s, y: 16.79 * s))
                    path.addLine(to: CGPoint(x: 15.71 * s, y: 20.34 * s))
                    path.addLine(to: CGPoint(x: 19.28 * s, y: 20.34 * s))
                    path.addCurve(to: CGPoint(x: 22.56 * s, y: 12.25 * s), control1: CGPoint(x: 21.36 * s, y: 18.42 * s), control2: CGPoint(x: 22.56 * s, y: 15.6 * s))
                    path.closeSubpath()
                }
                .fill(Color(red: 66/255, green: 133/255, blue: 244/255))

                // Green
                Path { path in
                    path.move(to: CGPoint(x: 12.0 * s, y: 23.0 * s))
                    path.addCurve(to: CGPoint(x: 19.28 * s, y: 20.34 * s), control1: CGPoint(x: 14.97 * s, y: 23.0 * s), control2: CGPoint(x: 17.46 * s, y: 22.02 * s))
                    path.addLine(to: CGPoint(x: 15.71 * s, y: 17.57 * s))
                    path.addCurve(to: CGPoint(x: 12.0 * s, y: 18.63 * s), control1: CGPoint(x: 14.73 * s, y: 18.23 * s), control2: CGPoint(x: 13.48 * s, y: 18.63 * s))
                    path.addCurve(to: CGPoint(x: 5.84 * s, y: 14.10 * s), control1: CGPoint(x: 9.14 * s, y: 18.63 * s), control2: CGPoint(x: 6.71 * s, y: 16.7 * s))
                    path.addLine(to: CGPoint(x: 2.18 * s, y: 14.10 * s))
                    path.addLine(to: CGPoint(x: 2.18 * s, y: 16.94 * s))
                    path.addCurve(to: CGPoint(x: 12.0 * s, y: 23.0 * s), control1: CGPoint(x: 3.99 * s, y: 20.53 * s), control2: CGPoint(x: 7.7 * s, y: 23.0 * s))
                    path.closeSubpath()
                }
                .fill(Color(red: 52/255, green: 168/255, blue: 83/255))

                // Yellow
                Path { path in
                    path.move(to: CGPoint(x: 5.84 * s, y: 14.09 * s))
                    path.addCurve(to: CGPoint(x: 5.49 * s, y: 12.0 * s), control1: CGPoint(x: 5.62 * s, y: 13.43 * s), control2: CGPoint(x: 5.49 * s, y: 12.73 * s))
                    path.addCurve(to: CGPoint(x: 5.84 * s, y: 9.91 * s), control1: CGPoint(x: 5.49 * s, y: 12.0 * s), control2: CGPoint(x: 5.62 * s, y: 10.57 * s))
                    path.addLine(to: CGPoint(x: 5.84 * s, y: 7.07 * s))
                    path.addLine(to: CGPoint(x: 2.18 * s, y: 7.07 * s))
                    path.addCurve(to: CGPoint(x: 1.0 * s, y: 12.0 * s), control1: CGPoint(x: 1.43 * s, y: 8.55 * s), control2: CGPoint(x: 1.0 * s, y: 10.22 * s))
                    path.addCurve(to: CGPoint(x: 2.18 * s, y: 16.93 * s), control1: CGPoint(x: 1.0 * s, y: 12.0 * s), control2: CGPoint(x: 1.43 * s, y: 15.45 * s))
                    path.addLine(to: CGPoint(x: 5.03 * s, y: 14.71 * s))
                    path.addLine(to: CGPoint(x: 5.84 * s, y: 14.09 * s))
                    path.closeSubpath()
                }
                .fill(Color(red: 251/255, green: 188/255, blue: 5/255))

                // Red
                Path { path in
                    path.move(to: CGPoint(x: 12.0 * s, y: 5.38 * s))
                    path.addCurve(to: CGPoint(x: 16.21 * s, y: 7.02 * s), control1: CGPoint(x: 13.62 * s, y: 5.38 * s), control2: CGPoint(x: 15.06 * s, y: 5.94 * s))
                    path.addLine(to: CGPoint(x: 19.36 * s, y: 3.87 * s))
                    path.addCurve(to: CGPoint(x: 12.0 * s, y: 1.0 * s), control1: CGPoint(x: 17.45 * s, y: 2.09 * s), control2: CGPoint(x: 14.97 * s, y: 1.0 * s))
                    path.addCurve(to: CGPoint(x: 2.18 * s, y: 7.07 * s), control1: CGPoint(x: 7.7 * s, y: 1.0 * s), control2: CGPoint(x: 3.99 * s, y: 3.47 * s))
                    path.addLine(to: CGPoint(x: 5.84 * s, y: 9.91 * s))
                    path.addCurve(to: CGPoint(x: 12.0 * s, y: 5.38 * s), control1: CGPoint(x: 6.71 * s, y: 7.31 * s), control2: CGPoint(x: 9.14 * s, y: 5.38 * s))
                    path.closeSubpath()
                }
                .fill(Color(red: 234/255, green: 67/255, blue: 53/255))
            }
            .offset(x: offsetX, y: offsetY)
        }
    }
}
