//
// ActivityIndicator.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import SwiftUI

/// iOS 13 호환 ProgressView 래퍼
struct ActivityIndicator: UIViewRepresentable {
    var isAnimating: Bool = true
    var style: UIActivityIndicatorView.Style = .large
    var color: UIColor = .white

    func makeUIView(context: Context) -> UIActivityIndicatorView {
        let indicator = UIActivityIndicatorView(style: style)
        indicator.color = color
        return indicator
    }

    func updateUIView(_ uiView: UIActivityIndicatorView, context: Context) {
        if isAnimating {
            uiView.startAnimating()
        } else {
            uiView.stopAnimating()
        }
    }
}
