package dto

// chat 도메인 응답 DTO.
// Python `chats.py`는 response_model 없이 service의 dict를 그대로 반환하므로,
// FastAPI jsonable_encoder의 키 순서(dict 삽입 순서)와 datetime isoformat을 재현한다.
// datetime 필드는 service에서 pyISO로 변환한 문자열을 담는다(null 가능 필드는 *string).

// ChatRoomItem은 get_rooms_for_member의 방 1건 dict와 1:1 대응한다.
// 키 순서: scr_idx, sgt_idx, scr_type, scr_title, scr_udate, unread_count,
//          last_message, last_message_time, member_count, dm_target_nickname, dm_target_file1.
type ChatRoomItem struct {
	ScrIdx           int     `json:"scr_idx"`
	SgtIdx           *int    `json:"sgt_idx"`
	ScrType          string  `json:"scr_type"`
	ScrTitle         *string `json:"scr_title"`
	ScrUdate         string  `json:"scr_udate"`          // isoformat (NOT NULL)
	UnreadCount      int     `json:"unread_count"`
	LastMessage      *string `json:"last_message"`       // content[:50] (rune), 메시지 없으면 null
	LastMessageTime  *string `json:"last_message_time"`  // isoformat, 메시지 없으면 null
	MemberCount      int     `json:"member_count"`
	DmTargetNickname *string `json:"dm_target_nickname"`
	DmTargetFile1    *string `json:"dm_target_file1"`
}

// ChatRoomList는 GET /chats/rooms 응답 `{"rooms": [...], "total_unread": N}`.
type ChatRoomList struct {
	Rooms       []ChatRoomItem `json:"rooms"`
	TotalUnread int            `json:"total_unread"`
}

// ChatMessageItem은 get_messages/send_message의 메시지 1건 dict와 1:1 대응한다.
// 키 순서: scmsg_idx, scr_idx, mt_idx, mt_nickname, mt_file1, scmsg_type,
//          scmsg_content, scmsg_wdate, unread_count.
// GET /chats/rooms/{scr_idx}/messages 응답은 이 항목의 배열(JSON array).
type ChatMessageItem struct {
	ScmsgIdx     int     `json:"scmsg_idx"`
	ScrIdx       int     `json:"scr_idx"`
	MtIdx        int     `json:"mt_idx"`
	MtNickname   *string `json:"mt_nickname"`
	MtFile1      *string `json:"mt_file1"`
	ScmsgType    string  `json:"scmsg_type"`
	ScmsgContent string  `json:"scmsg_content"`
	ScmsgWdate   string  `json:"scmsg_wdate"` // isoformat
	UnreadCount  int     `json:"unread_count"`
}

// CreateDMResult는 POST /chats/rooms/dm 응답 `{"scr_idx": N, "is_new": bool}`.
type CreateDMResult struct {
	ScrIdx int  `json:"scr_idx"`
	IsNew  bool `json:"is_new"`
}
