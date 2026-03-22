//
// NoticeModels.swift
// smap
//
// Extracted from RootCoordinatorView.swift
//

import Foundation

struct SmapNoticeListWithPagination: Codable {
    let notices: [SmapNotice]
    let total: Int
    let page: Int
    let size: Int
    let total_pages: Int
}

struct SmapNotice: Codable, Identifiable {
    var id: Int { nt_idx }
    let nt_idx: Int
    let nt_title: String
    let nt_content: String
    let nt_hit: Int
    let nt_wdate: String
}
