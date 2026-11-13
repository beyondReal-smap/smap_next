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

// FindMembership은 Python ChatMember.find_membership(scr_idx+mt_idx+scm_show='Y'). 없으면 (nil, nil).
func (r *ChatRepository) FindMembership(scrIdx, mtIdx int) (*model.ChatMember, error) {
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

// GetRoomMembers는 Python ChatMember.get_room_members(scr_idx+scm_show='Y').
func (r *ChatRepository) GetRoomMembers(scrIdx int) ([]model.ChatMember, error) {
	out := make([]model.ChatMember, 0)
	err := r.db.Where("scr_idx = ? AND scm_show = ?", scrIdx, "Y").Find(&out).Error
	return out, err
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

// CountUnread는 Python ChatMember.count_unread와 동등하다(메시지별 안 읽은 멤버 수).
// total(scm_show='Y') - read(scm_show='Y' AND scm_last_read_idx >= scmsg_idx).
func (r *ChatRepository) CountUnread(scrIdx, scmsgIdx int) (int, error) {
	var total, read int64
	if err := r.db.Model(&model.ChatMember{}).
		Where("scr_idx = ? AND scm_show = ?", scrIdx, "Y").Count(&total).Error; err != nil {
		return 0, err
	}
	if err := r.db.Model(&model.ChatMember{}).
		Where("scr_idx = ? AND scm_show = ? AND scm_last_read_idx >= ?", scrIdx, "Y", scmsgIdx).
		Count(&read).Error; err != nil {
		return 0, err
	}
	return int(total - read), nil
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

// AddMemberToGroupChat은 Python chat_service.add_member_to_group_chat와 1:1 대응한다(멱등 포함).
// 그룹 방 없으면 no-op, 이미 멤버(scm_show='Y')면 no-op, 아니면 ChatMember 1건을 INSERT한다.
func (r *ChatRepository) AddMemberToGroupChat(sgtIdx, mtIdx int, now time.Time) error {
	room, err := r.findGroupChatRoom(sgtIdx)
	if err != nil {
		return err
	}
	if room == nil {
		return nil
	}
	existing, err := r.FindMembership(room.ScrIdx, mtIdx)
	if err != nil {
		return err
	}
	if existing != nil {
		return nil
	}
	cm := model.ChatMember{ScrIdx: room.ScrIdx, MtIdx: mtIdx, ScmLastReadIdx: 0, ScmShow: "Y", ScmWdate: now}
	return r.db.Create(&cm).Error
}

// RemoveMemberFromGroupChat은 Python chat_service.remove_member_from_group_chat와 1:1 대응한다.
// ⚠️ groups.py에 호출처가 없는 정의(remove_member_from_group은 이 메서드를 호출하지 않음) —
// 완전성을 위해 이식하되 어떤 라우트/서비스에서도 호출되지 않는다(의도된 dead code).
// 그룹 방 없으면 no-op, 멤버십 있으면 scm_show='N'으로 소프트 숨김(Python: scm_show=N + commit).
func (r *ChatRepository) RemoveMemberFromGroupChat(sgtIdx, mtIdx int) error {
	room, err := r.findGroupChatRoom(sgtIdx)
	if err != nil {
		return err
	}
	if room == nil {
		return nil
	}
	membership, err := r.FindMembership(room.ScrIdx, mtIdx)
	if err != nil {
		return err
	}
	if membership == nil {
		return nil
	}
	return r.db.Model(&model.ChatMember{}).
		Where("scm_idx = ?", membership.ScmIdx).
		Update("scm_show", "N").Error
}
