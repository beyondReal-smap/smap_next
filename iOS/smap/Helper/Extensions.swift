//
//  Extensions.swift
//  smap
//
//  Created by  Corp. Dmonster on 12/15/23.
//

import Foundation
import UIKit
import WebKit

extension UINavigationController {
    private func doAfterAnimatingTransition(animated: Bool, completion: @escaping (() -> Void)) {
        if let coordinator = transitionCoordinator, animated {
            coordinator.animate(alongsideTransition: nil, completion: { _ in
                completion()
            })
        } else {
            DispatchQueue.main.async {
                completion()
            }
        }
    }
    
    func pushViewController(viewController: UIViewController, animated: Bool, completion: @escaping (() ->     Void)) {
        pushViewController(viewController, animated: animated)
        doAfterAnimatingTransition(animated: animated, completion: completion)
    }
    
    func popViewController(animated: Bool, completion: @escaping (() -> Void)) {
        popViewController(animated: animated)
        doAfterAnimatingTransition(animated: animated, completion: completion)
    }
    
    func popToRootViewController(animated: Bool, completion: @escaping (() -> Void)) {
        popToRootViewController(animated: animated)
        doAfterAnimatingTransition(animated: animated, completion: completion)
    }
}

extension String {
    var htmlToAttributedString: NSAttributedString? {
        guard let data = data(using: .utf8) else { return nil }
        do {
            return try NSAttributedString(data: data, options: [.documentType: NSAttributedString.DocumentType.html, .characterEncoding:String.Encoding.utf8.rawValue], documentAttributes: nil)
        } catch {
            return nil
        }
    }
    var htmlToString: String {
        return htmlToAttributedString?.string ?? ""
    }
    
    func createRandomStr(length: Int) -> String {
        let str = (0 ..< length).map{ _ in self.randomElement()! }
        return String(str)
    }
    
    func substring(from: Int, to: Int) -> String {
        guard from < count, to >= 0, to - from >= 0 else {
            return ""
        }
        
        // Index 값 획득
        let startIndex = index(self.startIndex, offsetBy: from)
        let endIndex = index(self.startIndex, offsetBy: to + 1) // '+1'이 있는 이유: endIndex는 문자열의 마지막 그 다음을 가리키기 때문
        
        // 파싱
        return String(self[startIndex ..< endIndex])
    }
}

typealias OldClosureType =  @convention(c) (Any, Selector, UnsafeRawPointer, Bool, Bool, Any?) -> Void
typealias NewClosureType =  @convention(c) (Any, Selector, UnsafeRawPointer, Bool, Bool, Bool, Any?) -> Void

extension WKWebView {
    func setKeyboardRequiresUserInteraction( _ value: Bool) {
        guard
            let WKContentViewClass: AnyClass = NSClassFromString("WKContentView") else {
                print("Cannot find the WKContentView class")
                return
        }

        let olderSelector: Selector = sel_getUid("_startAssistingNode:userIsInteracting:blurPreviousNode:userObject:")
        let newSelector: Selector = sel_getUid("_startAssistingNode:userIsInteracting:blurPreviousNode:changingActivityState:userObject:")
        let newerSelector: Selector = sel_getUid("_elementDidFocus:userIsInteracting:blurPreviousNode:changingActivityState:userObject:")
        let ios13Selector: Selector = sel_getUid("_elementDidFocus:userIsInteracting:blurPreviousNode:activityStateChanges:userObject:")

        if let method = class_getInstanceMethod(WKContentViewClass, olderSelector) {

            let originalImp: IMP = method_getImplementation(method)
            let original: OldClosureType = unsafeBitCast(originalImp, to: OldClosureType.self)
            let block : @convention(block) (Any, UnsafeRawPointer, Bool, Bool, Any?) -> Void = { (me, arg0, arg1, arg2, arg3) in
                original(me, olderSelector, arg0, !value, arg2, arg3)
            }
            let imp: IMP = imp_implementationWithBlock(block)
            method_setImplementation(method, imp)
        }

        if let method = class_getInstanceMethod(WKContentViewClass, newSelector) {
            self.swizzleAutofocusMethod(method, newSelector, value)
        }

        if let method = class_getInstanceMethod(WKContentViewClass, newerSelector) {
            self.swizzleAutofocusMethod(method, newerSelector, value)
        }

        if let method = class_getInstanceMethod(WKContentViewClass, ios13Selector) {
            self.swizzleAutofocusMethod(method, ios13Selector, value)
        }
    }

    func swizzleAutofocusMethod(_ method: Method, _ selector: Selector, _ value: Bool) {
        let originalImp: IMP = method_getImplementation(method)
        let original: NewClosureType = unsafeBitCast(originalImp, to: NewClosureType.self)
        let block : @convention(block) (Any, UnsafeRawPointer, Bool, Bool, Bool, Any?) -> Void = { (me, arg0, arg1, arg2, arg3, arg4) in
            original(me, selector, arg0, !value, arg2, arg3, arg4)
        }
        let imp: IMP = imp_implementationWithBlock(block)
        method_setImplementation(method, imp)
   }
}
