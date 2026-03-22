//
//  HomeModels.swift
//  smap
//
//  Home tab related models (GroupStats, etc.)
//  Note: SmapGroup, SmapGroupMember, SmapSchedule are in LoginModels.swift
//

import Foundation

// MARK: - Group Statistics Models

struct GroupStats: Codable {
    let group_id: Int
    let group_title: String
    let member_count: Int
    let weekly_schedules: Int
    let total_locations: Int
    let stats_period: StatsPeriod
    let member_stats: [GroupMemberStats]
}

struct StatsPeriod: Codable {
    let start_date: String
    let end_date: String
    let days: Int
}

struct GroupMemberStats: Codable {
    let mt_idx: Int
    let mt_name: String
    let mt_nickname: String
    let weekly_schedules: Int
    let total_locations: Int
    let weekly_locations: Int
    let is_owner: Bool
    let is_leader: Bool
}
