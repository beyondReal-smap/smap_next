package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// ChatRepository는 chat 도메인(smap_chat_room_t/member_t/msg_t)의 데이터 접근을 담당한다.
// Python `app/models/chat_*.py`의 classmethod 쿼리 + chat_service 트랜잭션을 1:1 재현한다.
type ChatRepository struct{ db *gorm.DB }

func NewChat(db *gorm.DB) *ChatRepository { return &ChatRepository{db: db} }

// GetRoomsForMember는 Python ChatRoom.get_rooms_for_member와 동등하다.
// JOIN chat_member: cm.mt_idx=? AND cm.scm_show='Y' AND room.scr_show='Y', ORDER scr_udate DESC.
// 컬럼 모호성(scr_idx 양쪽)을 피하려 Select로 메인 테이블을 고정한다.
func (r *ChatRepository) GetRoomsForMember(mtIdx int) ([]model.ChatRoom, error) {
	out := make([]model.ChatRoom, 0)
	err := r.db.Model(&model.ChatRoom{}).
		Select("smap_chat_room_t.*").
		Joins("JOIN smap_chat_member_t cm ON smap_chat_room_t.scr_idx = cm.scr_idx").
		Where("cm.mt_idx = ? AND cm.scm_show = ? AND smap_chat_room_t.scr_show = ?", mtIdx, "Y", "Y").
		Order("smap_chat_room_t.scr_udate desc").
		Find(&out).Error
	return out, err
}

// findRawMembership은 그룹 멤버십을 보지 않는 방 참가 행 조회(scm_show='Y'). 없으면 (nil, nil).
func (r *ChatRepository) findRawMembership(scrIdx, mtIdx int) (*model.ChatMember, error) {
	var m model.ChatMember
	err := r.db.Where("scr_idx = ? AND mt_idx = ? AND scm_show = ?", scrIdx, mtIdx, "Y").First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// findRoom은 보이는 방(scr_show='Y')을 조회한다. 없으면 (nil, nil).
func (r *ChatRepository) findRoom(scrIdx int) (*model.ChatRoom, error) {
	var room model.ChatRoom
	err := r.db.Where("scr_idx = ? AND scr_show = ?", scrIdx, "Y").First(&room).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &room, nil
}

// groupMemberCurrent는 mtIdx가 그룹 sgtIdx의 현재 멤버(공통 멤버십 조건 + 삭제되지 않은 그룹)인지 판정한다.
func (r *ChatRepository) groupMemberCurrent(sgtIdx, mtIdx int) (bool, error) {
	var rows []int
	err := r.db.Raw(
		"SELECT 1 FROM smap_group_detail_t gd JOIN member_t m ON m.mt_idx = gd.mt_idx "+
			"JOIN smap_group_t sg ON sg.sgt_idx = gd.sgt_idx "+
			"WHERE gd.sgt_idx = ? AND gd.mt_idx = ? AND "+currentMemberSQL("gd", "m")+" AND sg.sgt_show = 'Y' LIMIT 1",
		sgtIdx, mtIdx).Find(&rows).Error
	return len(rows) > 0, err
}

// ShareActiveGroup은 두 회원이 서로 다르고 함께 현재 멤버인(삭제되지 않은) 그룹이 하나라도 있는지 판정한다.
// DM 방 생성·유지의 조건이다(C-2).
func (r *ChatRepository) ShareActiveGroup(a, b int) (bool, error) {
	if a == b {
		return false, nil
	}
	var rows []int
	err := r.db.Raw(
		"SELECT 1 FROM smap_group_detail_t ga JOIN smap_group_detail_t gb ON gb.sgt_idx = ga.sgt_idx "+
			"JOIN member_t ma ON ma.mt_idx = ga.mt_idx JOIN member_t mb ON mb.mt_idx = gb.mt_idx "+
			"JOIN smap_group_t sg ON sg.sgt_idx = ga.sgt_idx "+
			"WHERE ga.mt_idx = ? AND gb.mt_idx = ? AND "+currentMemberSQL("ga", "ma")+" AND "+currentMemberSQL("gb", "mb")+
			" AND sg.sgt_show = 'Y' LIMIT 1", a, b).Find(&rows).Error
	return len(rows) > 0, err
}

// FindMembership은 방 참가 행(scm_show='Y')이 있고 현재 그룹 멤버십도 유효할 때만 돌려준다(C-1). 없으면 (nil, nil).
//   - 그룹 방: 회원이 그 그룹의 현재 멤버(나간·강퇴·숨김·삭제된 그룹 제외)여야 한다.
//   - DM 방: 참가자가 정확히 2명이고, 둘이 아직 같은 그룹의 현재 멤버여야 한다.
//
// 채팅 멤버십 비활성화(scm_show='N')가 누락돼도 읽기·전송·입장·수신이 그룹 멤버십 변동을 따르게 하는 방어선이다.
func (r *ChatRepository) FindMembership(scrIdx, mtIdx int) (*model.ChatMember, error) {
	m, err := r.findRawMembership(scrIdx, mtIdx)
	if err != nil || m == nil {
		return nil, err
	}
	room, err := r.findRoom(scrIdx)
	if err != nil || room == nil {
		return nil, err
	}
	ok, err := r.roomAllows(room, mtIdx)
	if err != nil || !ok {
		return nil, err
	}
	return m, nil
}

func (r *ChatRepository) roomAllows(room *model.ChatRoom, mtIdx int) (bool, error) {
	switch room.ScrType {
	case "group":
		if room.SgtIdx == nil {
			return false, nil
		}
		return r.groupMemberCurrent(*room.SgtIdx, mtIdx)
	case "dm":
		ids, err := r.dmParticipants(room.ScrIdx)
		if err != nil || len(ids) != 2 {
			return false, err
		}
		if ids[0] != mtIdx && ids[1] != mtIdx {
			return false, nil
		}
		return r.ShareActiveGroup(ids[0], ids[1])
	}
	return false, nil
}

func (r *ChatRepository) dmParticipants(scrIdx int) ([]int, error) {
	var ids []int
	err := r.db.Model(&model.ChatMember{}).Where("scr_idx = ? AND scm_show = ?", scrIdx, "Y").
		Distinct().Pluck("mt_idx", &ids).Error
	return ids, err
}

// UnreadCount는 방의 안 읽은 메시지 수(scmsg_idx > lastRead AND scmsg_show='Y'). get_rooms_for_member용.
func (r *ChatRepository) UnreadCount(scrIdx, lastRead int) (int64, error) {
	var n int64
	err := r.db.Model(&model.ChatMessage{}).
		Where("scr_idx = ? AND scmsg_idx > ? AND scmsg_show = ?", scrIdx, lastRead, "Y").
		Count(&n).Error
	return n, err
}

// GetLatest는 Python ChatMessage.get_latest(scmsg_show='Y' ORDER scmsg_idx DESC LIMIT 1). 없으면 (nil, nil).
func (r *ChatRepository) GetLatest(scrIdx int) (*model.ChatMessage, error) {
	var m model.ChatMessage
	err := r.db.Where("scr_idx = ? AND scmsg_show = ?", scrIdx, "Y").Order("scmsg_idx desc").First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// GetRoomMembers는 방의 유효 참가자다(scm_show='Y'). 그룹 방은 현재 그룹 멤버만, DM은 두 참가자가 아직 같은 그룹일 때만
// (아니면 빈 목록) 돌려준다 — 안 읽은 수·푸시 대상에 나간 멤버가 섞이지 않는다.
func (r *ChatRepository) GetRoomMembers(scrIdx int) ([]model.ChatMember, error) {
	out := make([]model.ChatMember, 0)
	room, err := r.findRoom(scrIdx)
	if err != nil || room == nil {
		return out, err
	}
	switch room.ScrType {
	case "group":
		if room.SgtIdx == nil {
			return out, nil
		}
		err = r.db.Raw(
			"SELECT cm.* FROM smap_chat_member_t cm JOIN smap_group_detail_t gd ON gd.mt_idx = cm.mt_idx AND gd.sgt_idx = ? "+
				"JOIN member_t m ON m.mt_idx = cm.mt_idx JOIN smap_group_t sg ON sg.sgt_idx = gd.sgt_idx "+
				"WHERE cm.scr_idx = ? AND cm.scm_show = 'Y' AND "+currentMemberSQL("gd", "m")+" AND sg.sgt_show = 'Y'",
			*room.SgtIdx, scrIdx).Scan(&out).Error
		return out, err
	case "dm":
		if err := r.db.Where("scr_idx = ? AND scm_show = ?", scrIdx, "Y").Find(&out).Error; err != nil {
			return nil, err
		}
		if len(out) != 2 {
			return make([]model.ChatMember, 0), nil
		}
		ok, err := r.ShareActiveGroup(out[0].MtIdx, out[1].MtIdx)
		if err != nil || !ok {
			return make([]model.ChatMember, 0), err
		}
		return out, nil
	}
	return out, nil
}

// FindDM은 Python ChatRoom.find_dm와 동등하다.
// 서브쿼리: chat_member(mt_idx IN (a,b) AND scm_show='Y') GROUP BY scr_idx HAVING COUNT(mt_idx)=2.
// 본쿼리: scr_idx IN (서브) AND scr_type='dm' AND scr_show='Y' LIMIT 1. 없으면 (nil, nil).
func (r *ChatRepository) FindDM(a, b int) (*model.ChatRoom, error) {
	sub := r.db.Model(&model.ChatMember{}).
		Select("scr_idx").
		Where("mt_idx IN ? AND scm_show = ?", []int{a, b}, "Y").
		Group("scr_idx").
		Having("COUNT(mt_idx) = ?", 2)
	var room model.ChatRoom
	err := r.db.Where("scr_idx IN (?) AND scr_type = ? AND scr_show = ?", sub, "dm", "Y").First(&room).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &room, nil
}

// GetMessages는 Python ChatMessage.get_messages와 동등하다.
// scmsg_show='Y' (+ beforeIdx!=0이면 scmsg_idx < beforeIdx) ORDER scmsg_idx DESC LIMIT limit,
// 그 후 reverse([::-1])하여 오름차순으로 반환한다. beforeIdx=0은 Python `if before_idx:` falsy → 필터 미적용.
func (r *ChatRepository) GetMessages(scrIdx, beforeIdx, limit int) ([]model.ChatMessage, error) {
	q := r.db.Where("scr_idx = ? AND scmsg_show = ?", scrIdx, "Y")
	if beforeIdx != 0 {
		q = q.Where("scmsg_idx < ?", beforeIdx)
	}
	out := make([]model.ChatMessage, 0)
	if err := q.Order("scmsg_idx desc").Limit(limit).Find(&out).Error; err != nil {
		return nil, err
	}
	// Python [::-1]: desc 페치 결과를 뒤집어 asc로.
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out, nil
}

// CountUnread는 메시지별 안 읽은 유효 참가자 수다(GetRoomMembers 중 scm_last_read_idx < scmsgIdx).
func (r *ChatRepository) CountUnread(scrIdx, scmsgIdx int) (int, error) {
	members, err := r.GetRoomMembers(scrIdx)
	if err != nil {
		return 0, err
	}
	n := 0
	for _, m := range members {
		if m.ScmLastReadIdx < scmsgIdx {
			n++
		}
	}
	return n, nil
}

// CreateDMRoom은 Python chat_service.create_dm_room의 신규 생성부를 트랜잭션으로 묶는다.
// (Python은 flush 후 commit으로 비트랜잭션이라 부분 실패 위험 → Go는 명시 tx로 정합성 보강.)
// room(dm, show='Y', wdate/udate=now) + member 2건(본인+상대, last_read=0, show='Y', wdate=now).
func (r *ChatRepository) CreateDMRoom(mtIdx, targetMtIdx int, now time.Time) (int, error) {
	var scrIdx int
	err := r.db.Transaction(func(tx *gorm.DB) error {
		room := model.ChatRoom{ScrType: "dm", ScrShow: "Y", ScrWdate: now, ScrUdate: now}
		if err := tx.Create(&room).Error; err != nil {
			return err
		}
		for _, id := range []int{mtIdx, targetMtIdx} {
			cm := model.ChatMember{ScrIdx: room.ScrIdx, MtIdx: id, ScmLastReadIdx: 0, ScmShow: "Y", ScmWdate: now}
			if err := tx.Create(&cm).Error; err != nil {
				return err
			}
		}
		scrIdx = room.ScrIdx
		return nil
	})
	return scrIdx, err
}

// GetMembersByIDs는 발신자/DM 상대 정보(mt_nickname/mt_name/mt_file1/mt_token_id 등)를 배치 조회한다.
// Python은 멤버마다 개별 조회(N+1)하지만, 같은 행을 IN으로 한 번에 읽어도 결과는 동일하다.
func (r *ChatRepository) GetMembersByIDs(ids []int) ([]model.Member, error) {
	out := make([]model.Member, 0)
	if len(ids) == 0 {
		return out, nil
	}
	err := r.db.Where("mt_idx IN ?", ids).Find(&out).Error
	return out, err
}

// CreateMessageTx는 Python chat_service.send_message의 쓰기 3단계를 트랜잭션으로 묶는다:
//  1. 메시지 INSERT(scmsg_type='text', scmsg_show='Y', scmsg_wdate=now)
//  2. room.scr_udate=now (Python find_by_idx(scr_show='Y') 조건이라 show='Y'일 때만)
//  3. 발신자 membership.scm_last_read_idx=새 메시지 idx
//
// Python은 flush 후 commit(비트랜잭션)이라 부분 실패 위험 → Go는 명시 tx로 정합성 보강.
func (r *ChatRepository) CreateMessageTx(scrIdx, mtIdx int, content string, now time.Time) (*model.ChatMessage, error) {
	msg := model.ChatMessage{
		ScrIdx: scrIdx, MtIdx: mtIdx, ScmsgType: "text",
		ScmsgContent: content, ScmsgShow: "Y", ScmsgWdate: now,
	}
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&msg).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.ChatRoom{}).
			Where("scr_idx = ? AND scr_show = ?", scrIdx, "Y").
			Update("scr_udate", now).Error; err != nil {
			return err
		}
		return tx.Model(&model.ChatMember{}).
			Where("scr_idx = ? AND mt_idx = ? AND scm_show = ?", scrIdx, mtIdx, "Y").
			Update("scm_last_read_idx", msg.ScmsgIdx).Error
	})
	if err != nil {
		return nil, err
	}
	return &msg, nil
}

// UpdateLastRead는 Python ChatMember.update_last_read(scmsg_idx > 현재값일 때만 단조 증가).
func (r *ChatRepository) UpdateLastRead(scrIdx, mtIdx, scmsgIdx int) error {
	return r.db.Model(&model.ChatMember{}).
		Where("scr_idx = ? AND mt_idx = ? AND scm_show = ? AND scm_last_read_idx < ?", scrIdx, mtIdx, "Y", scmsgIdx).
		Update("scm_last_read_idx", scmsgIdx).Error
}

// --- 그룹채팅 write (groups write 이식 시 동반, Python chat_service) ---
// groups.py create_group/join이 chat_service.create_group_chat_room·add_member_to_group_chat을
// best-effort(try/except 무시)로 호출하므로, 데이터 접근만 ChatRepository에 둔다(ChatService 무변경).

// findGroupChatRoom은 Python ChatRoom.find_by_group(sgt_idx, scr_type='group', scr_show='Y')과 동등.
// 없으면 (nil, nil).
func (r *ChatRepository) findGroupChatRoom(sgtIdx int) (*model.ChatRoom, error) {
	var room model.ChatRoom
	err := r.db.Where("sgt_idx = ? AND scr_type = ? AND scr_show = ?", sgtIdx, "group", "Y").First(&room).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &room, nil
}

// CreateGroupChatRoom은 Python chat_service.create_group_chat_room와 1:1 대응한다(멱등 포함).
// find_by_group으로 기존 그룹 방이 있으면 no-op, 없으면 room('group',show='Y') + member N건을 tx로 생성한다
// (Python flush+commit 비트랜잭션 → Go 명시 tx로 정합성 보강, CreateDMRoom과 동일 방침).
func (r *ChatRepository) CreateGroupChatRoom(sgtIdx int, title *string, memberIDs []int, now time.Time) error {
	existing, err := r.findGroupChatRoom(sgtIdx)
	if err != nil {
		return err
	}
	if existing != nil {
		return nil
	}
	return r.db.Transaction(func(tx *gorm.DB) error {
		room := model.ChatRoom{SgtIdx: &sgtIdx, ScrType: "group", ScrTitle: title, ScrShow: "Y", ScrWdate: now, ScrUdate: now}
		if err := tx.Create(&room).Error; err != nil {
			return err
		}
		for _, id := range memberIDs {
			cm := model.ChatMember{ScrIdx: room.ScrIdx, MtIdx: id, ScmLastReadIdx: 0, ScmShow: "Y", ScmWdate: now}
			if err := tx.Create(&cm).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// AddMemberToGroupChat은 그룹 채팅방에 회원을 넣는다(멱등). 그룹 방 없으면 no-op, 이미 활성 참가자면 no-op,
// 이전에 비활성화된 행(scm_show='N')이 있으면 되살리고 마지막 읽은 위치를 최신 메시지로 맞춘다(재가입 시 이전 대화를
// 안 읽은 메시지로 쌓지 않는다), 없으면 INSERT한다. (scr_idx, mt_idx)는 UNIQUE라 행을 재사용한다.
func (r *ChatRepository) AddMemberToGroupChat(sgtIdx, mtIdx int, now time.Time) error {
	room, err := r.findGroupChatRoom(sgtIdx)
	if err != nil {
		return err
	}
	if room == nil {
		return nil
	}
	var existing model.ChatMember
	err = r.db.Where("scr_idx = ? AND mt_idx = ?", room.ScrIdx, mtIdx).First(&existing).Error
	if err == nil {
		if existing.ScmShow == "Y" {
			return nil
		}
		latest, lerr := r.GetLatest(room.ScrIdx)
		if lerr != nil {
			return lerr
		}
		fields := map[string]interface{}{"scm_show": "Y"}
		if latest != nil {
			fields["scm_last_read_idx"] = latest.ScmsgIdx
		}
		return r.db.Model(&model.ChatMember{}).Where("scm_idx = ?", existing.ScmIdx).Updates(fields).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	cm := model.ChatMember{ScrIdx: room.ScrIdx, MtIdx: mtIdx, ScmLastReadIdx: 0, ScmShow: "Y", ScmWdate: now}
	return r.db.Create(&cm).Error
}

// RemoveMemberFromGroupChat은 그룹 sgtIdx의 그룹 채팅방에서 회원 mtIdx의 참가를 비활성화한다(scm_show='N').
// 탈퇴·강퇴 시 호출한다(C-1). 방·행이 없으면 no-op(영향 행 0). 그룹 멤버십을 보지 않고 직접 UPDATE한다
// (이미 그룹에서 빠진 뒤에도 비활성화가 동작해야 하므로 FindMembership을 거치지 않는다).
func (r *ChatRepository) RemoveMemberFromGroupChat(sgtIdx, mtIdx int) error {
	return r.db.Exec(
		"UPDATE smap_chat_member_t SET scm_show = 'N' WHERE mt_idx = ? AND scm_show = 'Y' AND scr_idx IN "+
			"(SELECT scr_idx FROM smap_chat_room_t WHERE sgt_idx = ? AND scr_type = 'group')",
		mtIdx, sgtIdx).Error
}

// RemoveAllFromGroupChat은 그룹 삭제 시 그 그룹 채팅방의 모든 참가를 비활성화한다(C-1).
func (r *ChatRepository) RemoveAllFromGroupChat(sgtIdx int) error {
	return r.db.Exec(
		"UPDATE smap_chat_member_t SET scm_show = 'N' WHERE scm_show = 'Y' AND scr_idx IN "+
			"(SELECT scr_idx FROM smap_chat_room_t WHERE sgt_idx = ? AND scr_type = 'group')",
		sgtIdx).Error
}
