//
// FloatingBackgroundView.swift
// smap
//
// Extracted from LoginView.swift
//

import SwiftUI

// MARK: - FloatingBackgroundView

struct FloatingBackgroundView: View {
    var body: some View {
        ZStack {
            // 1. Top-left big
            FloatingCircle(
                size: 96, // w-24 * 4
                opacity: 0.2,
                blur: 24, // blur-xl
                initialX: 40, initialY: 80,
                moveX: 30, moveY: -40,
                duration: 10
            )

            // 2. Bottom-right big
            FloatingCircle(
                size: 160, // w-40 * 4
                opacity: 0.15,
                blur: 24,
                initialX: UIScreen.main.bounds.width - 64, initialY: UIScreen.main.bounds.height - 128,
                moveX: -40, moveY: 50,
                duration: 15,
                delay: 3
            )

            // 3. Center-ish
            FloatingCircle(
                size: 80, // w-20 * 4
                opacity: 0.18,
                blur: 16, // blur-lg
                initialX: UIScreen.main.bounds.width / 3, initialY: UIScreen.main.bounds.height / 2,
                moveX: 25, moveY: -30,
                duration: 12,
                delay: 6
            )

            // 4. Top-right small
            FloatingCircle(
                size: 64, // w-16 * 4
                opacity: 0.12,
                blur: 12, // blur-md
                initialX: UIScreen.main.bounds.width * 0.75, initialY: UIScreen.main.bounds.height * 0.25,
                moveX: -20, moveY: 35,
                duration: 8,
                delay: 1
            )

            // 5. Bottom-left
            FloatingCircle(
                size: 112, // w-28 * 4
                opacity: 0.1,
                blur: 16,
                initialX: UIScreen.main.bounds.width * 0.33, initialY: UIScreen.main.bounds.height * 0.75,
                moveX: 35, moveY: -25,
                duration: 18,
                delay: 4
            )
        }
        .ignoresSafeArea()
    }
}

struct FloatingCircle: View {
    let size: CGFloat
    let opacity: Double
    let blur: CGFloat
    let initialX: CGFloat
    let initialY: CGFloat
    let moveX: CGFloat
    let moveY: CGFloat
    let duration: Double
    var delay: Double = 0

    @State private var animate = false

    var body: some View {
        Circle()
            .fill(Color.white.opacity(opacity))
            .frame(width: size, height: size)
            .blur(radius: blur)
            .position(x: initialX, y: initialY)
            .offset(x: animate ? moveX : 0, y: animate ? moveY : 0)
            .scaleEffect(animate ? 1.2 : 1.0)
            .onAppear {
                withAnimation(Animation.easeInOut(duration: duration).repeatForever(autoreverses: true).delay(delay)) {
                    animate.toggle()
                }
            }
    }
}
