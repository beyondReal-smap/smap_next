//
//  StoreKitManager.swift
//  smap
//
//  Created by  Corp. Dmonster on 12/15/23.
//

import Foundation
import SwiftyStoreKit
import StoreKit

class StoreKitManager {
    static let shared = StoreKitManager()
    
    private init() {}
    
    // MARK: - Receipt Validation
    func fetchReceipt(completion: @escaping (String?, Error?) -> Void) {
        SwiftyStoreKit.fetchReceipt(forceRefresh: false) { result in
            switch result {
            case .success(let receiptData):
                let encryptedReceipt = receiptData.base64EncodedString(options: [])
                completion(encryptedReceipt, nil)
            case .error(let error):
                completion(nil, error)
            }
        }
    }
    
    // MARK: - Purchase Restoration
    func restorePurchases(completion: @escaping (String?) -> Void) {
        SwiftyStoreKit.restorePurchases { results in
            if results.restoreFailedPurchases.count > 0 {
                completion("복원 실패: \(results.restoreFailedPurchases)")
            } else if results.restoredPurchases.count > 0 {
                completion("복원 성공: \(results.restoredPurchases.count)개 제품")
            } else {
                completion("복원할 제품이 없습니다")
            }
        }
    }
    
    // MARK: - Product Purchase
    func purchaseProduct(productId: String, completion: @escaping (Bool, String?) -> Void) {
        SwiftyStoreKit.purchaseProduct(productId) { result in
            switch result {
            case .success(let purchase):
                print("Purchase Success: \(purchase.productId)")
                
                // 구매 완료 처리
                if purchase.needsFinishTransaction {
                    SwiftyStoreKit.finishTransaction(purchase.transaction)
                }
                
                completion(true, "구매 성공")
                
            case .error(let error):
                switch error.code {
                case .unknown:
                    completion(false, "알 수 없는 오류")
                case .clientInvalid:
                    completion(false, "결제 불가")
                case .paymentCancelled:
                    completion(false, "결제 취소")
                case .paymentInvalid:
                    completion(false, "결제 정보 오류")
                case .paymentNotAllowed:
                    completion(false, "결제 불허")
                case .storeProductNotAvailable:
                    completion(false, "제품 정보 없음")
                case .cloudServicePermissionDenied:
                    completion(false, "클라우드 서비스 권한 거부")
                case .cloudServiceNetworkConnectionFailed:
                    completion(false, "네트워크 연결 실패")
                case .cloudServiceRevoked:
                    completion(false, "클라우드 서비스 해지")
                default:
                    completion(false, "결제 오류: \(error.localizedDescription)")
                }
            }
        }
    }
    
    // MARK: - Product Info Retrieval
    func retrieveProductsInfo(productIds: Set<String>, completion: @escaping ([SKProduct]?, Error?) -> Void) {
        SwiftyStoreKit.retrieveProductsInfo(productIds) { result in
            if let error = result.error {
                completion(nil, error)
            } else {
                let products = Array(result.retrievedProducts)
                completion(products, nil)
            }
        }
    }
    
    // MARK: - Receipt Verification
    func verifyReceipt(completion: @escaping (Bool, String?) -> Void) {
        let appleValidator = AppleReceiptValidator(service: .production, sharedSecret: "your_shared_secret")
        SwiftyStoreKit.verifyReceipt(using: appleValidator) { result in
            switch result {
            case .success(let receipt):
                print("Receipt verification success: \(receipt)")
                completion(true, "영수증 검증 성공")
            case .error(let error):
                print("Receipt verification failed: \(error)")
                completion(false, "영수증 검증 실패: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Subscription Status
    func verifySubscription(productId: String, completion: @escaping (Bool, Date?, String?) -> Void) {
        let appleValidator = AppleReceiptValidator(service: .production, sharedSecret: "your_shared_secret")
        SwiftyStoreKit.verifyReceipt(using: appleValidator) { result in
            switch result {
            case .success(let receipt):
                let purchaseResult = SwiftyStoreKit.verifySubscription(
                    ofType: .autoRenewable,
                    productId: productId,
                    inReceipt: receipt
                )
                
                switch purchaseResult {
                case .purchased(let expiryDate, _):
                    completion(true, expiryDate, "구독 활성")
                case .expired(let expiryDate, _):
                    completion(false, expiryDate, "구독 만료")
                case .notPurchased:
                    completion(false, nil, "구독하지 않음")
                }
                
            case .error(let error):
                completion(false, nil, "검증 실패: \(error.localizedDescription)")
            }
        }
    }
} 