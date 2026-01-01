//
//  MltGpsData.swift
//  smap
//
//  Created by  Corp. Dmonster on 3/20/24.
//

import Foundation

struct MltGpsData: Codable {
    let mlt_lat: String
    let mlt_long: String
    let mlt_speed: String
    let mlt_accuacy: String
    let mlt_gps_time: String
}
