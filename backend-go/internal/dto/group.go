package dto

// GroupResponse는 Python GroupResponse(GroupBase 상속)와 키/순서·타입이 동일하다.
// Pydantic v2 직렬화 순서는 부모(GroupBase) 필드 먼저, 그 다음 자식(GroupResponse) 필드다
// (실측: mt_idx, sgt_title, sgt_code, sgt_memo, sgt_show, sgt_idx, sgt_wdate, sgt_udate).
// sgt_show는 str-enum이라 "Y"/"N" 문자열로 직렬화되고, nullable 필드는 None ↔ null.
// sgt_wdate/sgt_udate는 naive datetime이므로 PyTime 포맷("2006-01-02T15:04:05")을 쓴다.
type GroupResponse struct {
	MtIdx    *int    `json:"mt_idx"`
	SgtTitle *string `json:"sgt_title"`
	SgtCode  *string `json:"sgt_code"`
	SgtMemo  *string `json:"sgt_memo"`
	SgtShow  *string `json:"sgt_show"`
	SgtIdx   int     `json:"sgt_idx"`
	SgtWdate *PyTime `json:"sgt_wdate"`
	SgtUdate *PyTime `json:"sgt_udate"`
}

// CurrentUserGroupSummary는 Python get_current_user_group_summary의 반환 dict와
// 키/순서가 동일하다: {"group_count": n, "total_members": n}. 정수(0 폴백).
type CurrentUserGroupSummary struct {
	GroupCount   int64 `json:"group_count"`
	TotalMembers int64 `json:"total_members"`
}

// CurrentUserGroupItem은 get_current_user_groups(groups.py:104)가 반환하는 List[dict]의 한 항목이다.
// 키 순서(12키): sgt_idx, mt_idx, sgt_title, sgt_code, sgt_memo, sgt_show, sgt_wdate,
// sgt_udate, member_count, is_owner, is_leader, join_date.
//   - sgt_title = group.sgt_title or f"그룹 {sgt_idx}" (null/빈문자열 폴백) → string(폴백되므로 non-null).
//   - sgt_code/sgt_memo = `or ""`(null→빈문자열), sgt_show = `or "Y"`.
//   - mt_idx(그룹 소유자)는 폴백 없음(DB null이면 그대로 null) → *int.
//   - sgt_wdate/sgt_udate/join_date = isoformat() if 값 else utcnow().isoformat() → 항상 문자열(string).
//   - is_owner/is_leader = group_detail.sgdt_*_chk == 'Y' → bool.
type CurrentUserGroupItem struct {
	SgtIdx      int    `json:"sgt_idx"`
	MtIdx       *int   `json:"mt_idx"`
	SgtTitle    string `json:"sgt_title"`
	SgtCode     string `json:"sgt_code"`
	SgtMemo     string `json:"sgt_memo"`
	SgtShow     string `json:"sgt_show"`
	SgtWdate    string `json:"sgt_wdate"`
	SgtUdate    string `json:"sgt_udate"`
	MemberCount int64  `json:"member_count"`
	IsOwner     bool   `json:"is_owner"`
	IsLeader    bool   `json:"is_leader"`
	JoinDate    string `json:"join_date"`
}

// GroupStatsResponse는 get_group_stats(groups.py:587, 활성 라우트)의 반환 dict와 키/순서가 동일하다.
// ⚠️ 멤버 유무에 따라 키 수가 다르다:
//   - 멤버 없음(early-return): 6키 — stats_period 없음(omitempty로 생략).
//   - 멤버 있음: 7키 — group_id, group_title, member_count, weekly_schedules, total_locations,
//     stats_period, member_stats.
//
// member_count = len(member_stats)(멤버조회 실패분 제외), weekly_schedules = Σ멤버주간일정,
// total_locations = Σ멤버전체위치수(member_locations). group_title은 group.sgt_title 원본(폴백 없음, nullable).
// ⚠️ stats_period.start_date/end_date = datetime.now()/now()-7d.isoformat()라 호출시각마다 달라
// 본질적으로 byte-동등 불가다(스키마·집계 로직만 Python과 일치).
type GroupStatsResponse struct {
	GroupID         int               `json:"group_id"`
	GroupTitle      *string           `json:"group_title"`
	MemberCount     int               `json:"member_count"`
	WeeklySchedules int64             `json:"weekly_schedules"`
	TotalLocations  int64             `json:"total_locations"`
	StatsPeriod     *StatsPeriod      `json:"stats_period,omitempty"`
	MemberStats     []GroupMemberStat `json:"member_stats"`
}

// StatsPeriod는 stats_period dict이다. 키 순서: start_date, end_date, days.
// start_date/end_date는 datetime.now() 기준 isoformat() 문자열(비결정), days는 항상 7.
type StatsPeriod struct {
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
	Days      int    `json:"days"`
}

// GroupMemberStat은 member_stats 배열의 한 항목이다.
// 키 순서(8키): mt_idx, mt_name, mt_nickname, weekly_schedules, total_locations,
// weekly_locations, is_owner, is_leader.
//   - mt_name = member.mt_name or f"멤버 {id}" → string(폴백되므로 non-null).
//   - mt_nickname = member.mt_nickname or member.mt_name or f"멤버 {id}" → string.
//   - total_locations = 전체 위치수(slt_show='Y', 기간필터 없음), weekly_locations = 주간 위치수.
//   - is_owner/is_leader = any(group_members 중 mt_idx 일치 행의 sgdt_*_chk=='Y') → bool.
type GroupMemberStat struct {
	MtIdx           int    `json:"mt_idx"`
	MtName          string `json:"mt_name"`
	MtNickname      string `json:"mt_nickname"`
	WeeklySchedules int64  `json:"weekly_schedules"`
	TotalLocations  int64  `json:"total_locations"`
	WeeklyLocations int64  `json:"weekly_locations"`
	IsOwner         bool   `json:"is_owner"`
	IsLeader        bool   `json:"is_leader"`
}
