//
//  StoreKitManager.swift
//  smap
//
//  Created by  Corp. Dmonster on 4/18/24.
//

import Foundation
import SwiftyStoreKit

enum StoreError: Error {
    case getProductDataFail
}

class StoreKitManager {
    static let shared = StoreKitManager()
    
    let monthProductId =  Set<String>(["com.dmonster.smap.sub_month"])
    let yearProductId = Set<String>(["com.dmonster.smap.sub_year"])
    
    func fetchReceipt(completion: @escaping(String?, String?) -> ()){
        SwiftyStoreKit.fetchReceipt(forceRefresh: true) { result in
            //print("resut -------- \(result)")
            switch result {
            case .success(let receiptData):
                let encryptedReceipt = receiptData.base64EncodedString(options: [])
                //print("Fetch receipt success:\n\(encryptedReceipt)")
                completion(encryptedReceipt, nil)
            case .error(let error):
                //print("Fetch receipt failed: \(error)")
                completion(nil, "Fetch receipt failed: \(error)")
            }
        }
    }
    
    func restorePurchases(completion: @escaping(String?) -> ()){
        SwiftyStoreKit.restorePurchases(atomically: true) { results in
            if results.restoreFailedPurchases.count > 0 {
                //print("Restore Failed: \(results.restoreFailedPurchases)")
                print("Restore Failed")
                completion(nil)
            }
            else if results.restoredPurchases.count > 0 {
                //print("Restore Success: \(results.restoredPurchases)")
                completion("Restore Success")
            }
            else {
                print("Nothing to Restore")
                completion(nil)
            }
        }
    }
    
    func purchase(productId: String, completion: @escaping(PurchaseDetails?, String?) -> ()) {
        //print("purchase productId -- \(productId)")
        SwiftyStoreKit.purchaseProduct(productId, quantity: 1, atomically: true) { result in
            //print("purchase -> result - \(result)")
            switch result {
            case .success(let purchase):
                completion(purchase, nil)
            case .error(let error):
                print("error \(error)")
                var errorMsg: String? = nil
                switch error.code {
                case .unknown: errorMsg = "Unknown error. Please contact support"
                case .clientInvalid: errorMsg = "Not allowed to make the payment"
                case .paymentCancelled: break
                case .paymentInvalid: errorMsg = "The purchase identifier was invalid"
                case .paymentNotAllowed: errorMsg = "The device is not allowed to make the payment"
                case .storeProductNotAvailable: errorMsg = "The product is not available in the current storefront"
                case .cloudServicePermissionDenied: errorMsg = "Access to cloud service information is not allowed"
                case .cloudServiceNetworkConnectionFailed: errorMsg = "Could not connect to the network"
                case .cloudServiceRevoked: errorMsg = "User has revoked permission to use this cloud service"
                default: errorMsg = (error as NSError).localizedDescription
                }
                completion(nil, errorMsg)
            }
        }
    }
}
