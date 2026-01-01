//
//  BaseResult.swift
//  smap
//
//  Created by  Corp. Dmonster on 12/15/23.
//

import Foundation

struct BaseResult<T: Decodable>: Decodable {
    let message: String?
    let success: String?
    let title: String?
    let data: T?
    
    enum CodingKeys: String, CodingKey {
        case message, success, title, data
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        message = try? values.decode(String?.self, forKey: .message)
        success = try? values.decode(String?.self, forKey: .success)
        title = try? values.decode(String?.self, forKey: .title)
        data = try? values.decode(T?.self, forKey: .data)
    }
}
