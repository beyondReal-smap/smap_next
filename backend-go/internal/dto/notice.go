package dto

import "time"

// PyTime은 Python(naive) datetime의 JSON 직렬화와 동일한 포맷을 강제한다.
// FastAPI/Pydantic v2는 timezone·microseconds 없는 ISO8601("2025-06-14T10:30:14")을
// 내보내는데, Go의 기본 time.Time JSON은 RFC3339(+09:00)라 다르다.
// notice_t 등 DATETIME 컬럼은 KST 벽시계 기준이며, DSN loc=Local로 읽으므로
// 벽시계 값을 그대로 포맷하면 Python과 일치한다.
type PyTime time.Time

func (t PyTime) MarshalJSON() ([]byte, error) {
	return []byte(`"` + time.Time(t).Format("2006-01-02T15:04:05") + `"`), nil
}

// NoticeResponse는 Python NoticeResponse(단건)와 키/순서 동일.
// nt_title/nt_content는 Python에서 필수(str)지만 DB는 nullable —
// 실데이터는 non-null이며, null이면 빈 문자열로 직렬화(Python은 이 경우 500).
type NoticeResponse struct {
	NtIdx     int     `json:"nt_idx"`
	NtTitle   string  `json:"nt_title"`
	NtContent string  `json:"nt_content"`
	NtFile1   *string `json:"nt_file1"`
	NtHit     int     `json:"nt_hit"`
	NtWdate   PyTime  `json:"nt_wdate"`
	NtUwdate  PyTime  `json:"nt_uwdate"`
}

// NoticeListItem은 Python NoticeListResponse(목록/검색 항목)와 동일.
// 단건과 달리 nt_file1/nt_uwdate가 없다.
type NoticeListItem struct {
	NtIdx     int    `json:"nt_idx"`
	NtTitle   string `json:"nt_title"`
	NtContent string `json:"nt_content"`
	NtHit     int    `json:"nt_hit"`
	NtWdate   PyTime `json:"nt_wdate"`
}

// NoticeListWithPagination은 Python NoticeListWithPagination와 동일.
type NoticeListWithPagination struct {
	Notices    []NoticeListItem `json:"notices"`
	Total      int              `json:"total"`
	Page       int              `json:"page"`
	Size       int              `json:"size"`
	TotalPages int              `json:"total_pages"`
}
