package dto

// AdminStatsResponse는 Python `GET /admin/stats`의 응답과 동일하다.
// 정상은 {success, data}, 예외는 {success, message, data} 형태(Message omitempty).
type AdminStatsResponse struct {
	Success bool           `json:"success"`
	Message string         `json:"message,omitempty"`
	Data    AdminStatsData `json:"data"`
}

// AdminStatsData는 /admin/stats의 data 객체.
type AdminStatsData struct {
	TotalMembers     int64 `json:"total_members"`
	TotalGroups      int64 `json:"total_groups"`
	TodaySignups     int64 `json:"today_signups"`
	PendingInquiries int   `json:"pending_inquiries"`
}

// AdminGroupItem은 Python `GET /admin/groups`가 반환하는 배열의 각 항목과 동일하다.
// sgt_wdate/sgt_udate는 값이 없으면 null(*string), mt_idx도 nullable.
type AdminGroupItem struct {
	SgtIdx        int     `json:"sgt_idx"`
	SgtTitle      string  `json:"sgt_title"`
	SgtMemo       string  `json:"sgt_memo"`
	SgtCode       string  `json:"sgt_code"`
	SgtShow       string  `json:"sgt_show"`
	MtIdx         *int    `json:"mt_idx"`
	OwnerName     string  `json:"owner_name"`
	MemberCount   int64   `json:"member_count"`
	ScheduleCount int64   `json:"schedule_count"`
	LocationCount int64   `json:"location_count"`
	SgtWdate      *string `json:"sgt_wdate"`
	SgtUdate      *string `json:"sgt_udate"`
}
