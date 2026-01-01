//
//  AuthData.swift
//  smap
//
//  Created by  Corp. Dmonster on 3/20/24.
//

import Foundation

struct AuthData: Decodable {
    let mt_idx: Int?

    enum CodingKeys: String, CodingKey {
        case mt_idx
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        mt_idx = try? values.decode(Int?.self, forKey: .mt_idx)
    }
}
