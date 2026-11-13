package service

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// chatRepo는 ChatService가 의존하는 데이터 접근 인터페이스(테스트 시 mock 주입).
type chatRepo interface {
	GetRoomsForMember(mtIdx int) ([]model.ChatRoom, error)
	FindMembership(scrIdx, mtIdx int) (*model.ChatMember, error)
	UnreadCount(scrIdx, lastRead int) (int64, error)
	GetLatest(scrIdx int) (*model.ChatMessage, error)
	GetRoomMembers(scrIdx int) ([]model.ChatMember, error)
	FindDM(a, b int) (*model.ChatRoom, error)
	GetMessages(scrIdx, beforeIdx, limit int) ([]model.ChatMessage, error)
	CountUnread(scrIdx, scmsgIdx int) (int, error)
	CreateDMRoom(mtIdx, targetMtIdx int, now time.Time) (int, error)
	GetMembersByIDs(ids []int) ([]model.Member, error)
	CreateMessageTx(scrIdx, mtIdx int, content string, now time.Time) (*model.ChatMessage, error)
	UpdateLastRead(scrIdx, mtIdx, scmsgIdx int) error
	ShareActiveGroup(a, b int) (bool, error)
	RemoveMemberFromGroupChat(sgtIdx, mtIdx int) error
	RemoveAllFromGroupChat(sgtIdx int) error
}

// ErrChatDMNotAllowed: DM은 같은 그룹의 현재 멤버(활성 회원)끼리만 만들 수 있다(C-2).
var ErrChatDMNotAllowed = errors.New("chat: dm allowed only between active members of a shared group")

// ChatService는 Python `app/services/chat_service.py`의 read/DM 메서드를 이식한다.
// (send_message·group 채팅 메서드는 각각 Phase3 WS·groups write 범위.)
type ChatService struct {
	repo chatRepo

	// 소켓 수신 시점 멤버십 확인 캐시(짧은 TTL, 허용 결과만). 메시지 하나를 방의 모든 접속자에게 보낼 때마다
	// 접속자 수만큼 DB를 조회하지 않기 위함이다. 비활성화 함수는 캐시를 비워 즉시 반영한다.
	memTTL   time.Duration
	memMu    sync.Mutex
	memCache map[[2]int]time.Time
}

func NewChat(repo chatRepo) *ChatService { return &ChatService{repo: repo} }

// SetMembershipCacheTTL은 IsRoomMember 허용 결과 캐시 수명이다(0이면 캐시 안 함 = 매번 조회).
func (s *ChatService) SetMembershipCacheTTL(d time.Duration) { s.memTTL = d }

// IsRoomMember는 회원이 지금 그 방의 유효 참가자(방 참가 + 현재 그룹 멤버십)인지 판정한다. 소켓 메시지 수신 시점
// 확인에 쓴다. 허용 결과만 TTL 동안 캐시하므로 거부는 즉시 반영되고, 허용이 철회되는 지연은 최대 TTL이다.
func (s *ChatService) IsRoomMember(scrIdx, mtIdx int) (bool, error) {
	key := [2]int{scrIdx, mtIdx}
	if s.memTTL > 0 {
		s.memMu.Lock()
		exp, ok := s.memCache[key]
		s.memMu.Unlock()
		if ok && time.Now().Before(exp) {
			return true, nil
		}
	}
	m, err := s.repo.FindMembership(scrIdx, mtIdx)
	if err != nil {
		return false, err
	}
	if m == nil {
		return false, nil
	}
	if s.memTTL > 0 {
		s.memMu.Lock()
		if s.memCache == nil || len(s.memCache) > 50000 {
			s.memCache = make(map[[2]int]time.Time)
		}
		s.memCache[key] = time.Now().Add(s.memTTL)
		s.memMu.Unlock()
	}
	return true, nil
}

func (s *ChatService) clearMembershipCache() {
	s.memMu.Lock()
	s.memCache = nil
	s.memMu.Unlock()
}

// DeactivateChatMembership은 회원이 그룹을 탈퇴·강퇴될 때 그 그룹 채팅방 참가를 비활성화한다(C-1).
// 그룹 서비스의 탈퇴·강퇴 경로가 호출한다. 이미 접속한 소켓은 다음 메시지 수신 시점 확인에서 방에서 제외된다.
func (s *ChatService) DeactivateChatMembership(ctx context.Context, sgtIdx, mtIdx int) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := s.repo.RemoveMemberFromGroupChat(sgtIdx, mtIdx); err != nil {
		return err
	}
	s.clearMembershipCache()
	return nil
}

// DeactivateGroupChat은 그룹이 삭제될 때 그 그룹 채팅방의 모든 참가를 비활성화한다(C-1).
func (s *ChatService) DeactivateGroupChat(ctx context.Context, sgtIdx int) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := s.repo.RemoveAllFromGroupChat(sgtIdx); err != nil {
		return err
	}
	s.clearMembershipCache()
	return nil
}

// GetRoomsForMember는 Python ChatService.get_rooms_for_member와 1:1 대응한다.
// 응답 {"rooms": [...], "total_unread": N}. 방마다 unread/latest/member_count + DM이면 상대 정보.
func (s *ChatService) GetRoomsForMember(mtIdx int) (dto.ChatRoomList, error) {
	rooms, err := s.repo.GetRoomsForMember(mtIdx)
	if err != nil {
		return dto.ChatRoomList{}, err
	}
	items := make([]dto.ChatRoomItem, 0, len(rooms))
	totalUnread := 0
	for _, room := range rooms {
		membership, err := s.repo.FindMembership(room.ScrIdx, mtIdx)
		if err != nil {
			return dto.ChatRoomList{}, err
		}
		if membership == nil {
			continue // 그룹을 나간 뒤에도 남은 참가 행: 방 목록에서 제외(C-1)
		}
		lastRead := membership.ScmLastReadIdx

		unread, err := s.repo.UnreadCount(room.ScrIdx, lastRead)
		if err != nil {
			return dto.ChatRoomList{}, err
		}
		totalUnread += int(unread)

		latest, err := s.repo.GetLatest(room.ScrIdx)
		if err != nil {
			return dto.ChatRoomList{}, err
		}

		members, err := s.repo.GetRoomMembers(room.ScrIdx)
		if err != nil {
			return dto.ChatRoomList{}, err
		}

		// DM이면 본인이 아닌 첫 멤버의 nickname(or name)/file1을 채운다(Python next(...)).
		var dmNick, dmFile1 *string
		if room.ScrType == "dm" {
			otherID, found := 0, false
			for _, m := range members {
				if m.MtIdx != mtIdx {
					otherID, found = m.MtIdx, true
					break
				}
			}
			if found {
				targets, err := s.repo.GetMembersByIDs([]int{otherID})
				if err != nil {
					return dto.ChatRoomList{}, err
				}
				if len(targets) > 0 {
					dmNick = chatNicknameOr(targets[0].MtNickname, targets[0].MtName)
					dmFile1 = targets[0].MtFile1
				}
			}
		}

		item := dto.ChatRoomItem{
			ScrIdx:           room.ScrIdx,
			SgtIdx:           room.SgtIdx,
			ScrType:          room.ScrType,
			ScrTitle:         room.ScrTitle,
			ScrUdate:         pyISO(room.ScrUdate),
			UnreadCount:      int(unread),
			MemberCount:      len(members),
			DmTargetNickname: dmNick,
			DmTargetFile1:    dmFile1,
		}
		// 메시지가 있으면 last_message(content[:50] rune)/last_message_time, 없으면 null 유지.
		if latest != nil {
			lm := chatRuneHead(latest.ScmsgContent, 50)
			item.LastMessage = &lm
			lt := pyISO(latest.ScmsgWdate)
			item.LastMessageTime = &lt
		}
		items = append(items, item)
	}
	return dto.ChatRoomList{Rooms: items, TotalUnread: totalUnread}, nil
}

// GetMessages는 Python ChatService.get_messages와 대응한다.
// 두 번째 반환값(found)이 false면 멤버십 없음 → 핸들러가 403. 메시지는 asc 정렬(repo에서 reverse).
func (s *ChatService) GetMessages(scrIdx, mtIdx, beforeIdx, limit int) ([]dto.ChatMessageItem, bool, error) {
	membership, err := s.repo.FindMembership(scrIdx, mtIdx)
	if err != nil {
		return nil, false, err
	}
	if membership == nil {
		return nil, false, nil
	}

	msgs, err := s.repo.GetMessages(scrIdx, beforeIdx, limit)
	if err != nil {
		return nil, true, err
	}
	senders, err := s.loadSenders(msgs)
	if err != nil {
		return nil, true, err
	}

	items := make([]dto.ChatMessageItem, 0, len(msgs))
	for _, msg := range msgs {
		unread, err := s.repo.CountUnread(scrIdx, msg.ScmsgIdx)
		if err != nil {
			return nil, true, err
		}
		var nick, file1 *string
		if sender, ok := senders[msg.MtIdx]; ok {
			nick = chatNicknameOr(sender.MtNickname, sender.MtName)
			file1 = sender.MtFile1
		}
		items = append(items, dto.ChatMessageItem{
			ScmsgIdx:     msg.ScmsgIdx,
			ScrIdx:       msg.ScrIdx,
			MtIdx:        msg.MtIdx,
			MtNickname:   nick,
			MtFile1:      file1,
			ScmsgType:    msg.ScmsgType,
			ScmsgContent: msg.ScmsgContent,
			ScmsgWdate:   pyISO(msg.ScmsgWdate),
			UnreadCount:  unread,
		})
	}
	return items, true, nil
}

// CreateDMRoom은 Python ChatService.create_dm_room와 대응한다.
// 기존 DM 있으면 {scr_idx, is_new:false}, 없으면 생성 후 {scr_idx, is_new:true}.
func (s *ChatService) CreateDMRoom(mtIdx, targetMtIdx int) (dto.CreateDMResult, error) {
	// DM은 같은 그룹의 현재 멤버(활성 회원)끼리만. 없는 번호·정지 회원·다른 그룹 회원이면 거부한다(C-2).
	shared, err := s.repo.ShareActiveGroup(mtIdx, targetMtIdx)
	if err != nil {
		return dto.CreateDMResult{}, err
	}
	if !shared {
		return dto.CreateDMResult{}, ErrChatDMNotAllowed
	}
	existing, err := s.repo.FindDM(mtIdx, targetMtIdx)
	if err != nil {
		return dto.CreateDMResult{}, err
	}
	if existing != nil {
		return dto.CreateDMResult{ScrIdx: existing.ScrIdx, IsNew: false}, nil
	}
	// Python datetime.utcnow()(naive UTC). DB datetime은 마이크로초를 버린다.
	// ⚠️ DSN loc=Local에서 드라이버가 +9h 변환하므로 dbUTCNow()로 UTC 벽시계 저장(타임존 교정).
	now := dbUTCNow()
	scrIdx, err := s.repo.CreateDMRoom(mtIdx, targetMtIdx, now)
	if err != nil {
		return dto.CreateDMResult{}, err
	}
	return dto.CreateDMResult{ScrIdx: scrIdx, IsNew: true}, nil
}

// loadSenders는 메시지 발신자(mt_idx)들을 중복 제거해 배치 조회한 맵을 만든다.
func (s *ChatService) loadSenders(msgs []model.ChatMessage) (map[int]model.Member, error) {
	ids := make([]int, 0)
	seen := make(map[int]bool)
	for _, m := range msgs {
		if !seen[m.MtIdx] {
			seen[m.MtIdx] = true
			ids = append(ids, m.MtIdx)
		}
	}
	mems, err := s.repo.GetMembersByIDs(ids)
	if err != nil {
		return nil, err
	}
	out := make(map[int]model.Member, len(mems))
	for _, m := range mems {
		out[m.MtIdx] = m
	}
	return out, nil
}

// chatNicknameOr는 Python `mt_nickname or mt_name`: nickname이 None/빈문자열이면 name으로 폴백.
func chatNicknameOr(nickname, name *string) *string {
	if nickname != nil && *nickname != "" {
		return nickname
	}
	return name
}

// chatRuneHead는 Python 문자열 슬라이스 s[:n](유니코드 코드포인트 기준, 바이트 아님).
func chatRuneHead(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

// --- WebSocket(실시간) 메서드 ---

// PushTarget은 오프라인 멤버 푸시 대상(토큰 + 회원 idx)이다.
type PushTarget struct {
	Token    string
	MemberID int
}

// SendMessage는 Python chat_service.send_message와 대응한다.
// membership 없으면 (nil,false,nil)→호출자가 "메시지 전송에 실패했습니다." 에러 emit.
// 성공 시 broadcast/푸시에 쓸 메시지 dict(unread=멤버수-1)를 반환한다.
func (s *ChatService) SendMessage(scrIdx, mtIdx int, content string) (*dto.ChatMessageItem, bool, error) {
	membership, err := s.repo.FindMembership(scrIdx, mtIdx)
	if err != nil {
		return nil, false, err
	}
	if membership == nil {
		return nil, false, nil
	}

	// Python datetime.utcnow() 후 db.refresh(msg) → DB datetime은 마이크로초를 버린다.
	// Truncate(Second)로 동일하게 초 단위 값을 만들어 isoformat을 일치시킨다.
	// ⚠️ DSN loc=Local에서 드라이버가 +9h 변환하므로 dbUTCNow()로 UTC 벽시계 저장(타임존 교정).
	now := dbUTCNow().Truncate(time.Second)
	msg, err := s.repo.CreateMessageTx(scrIdx, mtIdx, content, now)
	if err != nil {
		return nil, true, err
	}

	members, err := s.repo.GetRoomMembers(scrIdx)
	if err != nil {
		return nil, true, err
	}
	unread := len(members) - 1

	var nick, file1 *string
	senders, err := s.repo.GetMembersByIDs([]int{mtIdx})
	if err != nil {
		return nil, true, err
	}
	if len(senders) > 0 {
		nick = chatNicknameOr(senders[0].MtNickname, senders[0].MtName)
		file1 = senders[0].MtFile1
	}

	item := dto.ChatMessageItem{
		ScmsgIdx:     msg.ScmsgIdx,
		ScrIdx:       scrIdx,
		MtIdx:        mtIdx,
		MtNickname:   nick,
		MtFile1:      file1,
		ScmsgType:    "text",
		ScmsgContent: content,
		ScmsgWdate:   pyISO(msg.ScmsgWdate),
		UnreadCount:  unread,
	}
	return &item, true, nil
}

// JoinRoom은 Python chat_ws.join_room의 검증부와 대응한다.
// membership 없으면 (false,nil)→호출자가 error emit. 있으면 최신 메시지로 last_read 갱신 후 (true,nil).
func (s *ChatService) JoinRoom(scrIdx, mtIdx int) (bool, error) {
	m, err := s.repo.FindMembership(scrIdx, mtIdx)
	if err != nil {
		return false, err
	}
	if m == nil {
		return false, nil
	}
	latest, err := s.repo.GetLatest(scrIdx)
	if err != nil {
		return true, err
	}
	if latest != nil {
		if err := s.repo.UpdateLastRead(scrIdx, mtIdx, latest.ScmsgIdx); err != nil {
			return true, err
		}
	}
	return true, nil
}

// ReadUpdate는 Python chat_ws.read_update와 대응한다.
// membership 없으면 (0,false,nil)→조용히 무시. 있으면 last_read 갱신 후 count_unread 반환.
func (s *ChatService) ReadUpdate(scrIdx, mtIdx, scmsgIdx int) (int, bool, error) {
	m, err := s.repo.FindMembership(scrIdx, mtIdx)
	if err != nil {
		return 0, false, err
	}
	if m == nil {
		return 0, false, nil
	}
	if err := s.repo.UpdateLastRead(scrIdx, mtIdx, scmsgIdx); err != nil {
		return 0, true, err
	}
	unread, err := s.repo.CountUnread(scrIdx, scmsgIdx)
	if err != nil {
		return 0, true, err
	}
	return unread, true, nil
}

// BuildOfflinePush는 Python chat_ws._send_push_to_offline의 대상 선정을 재현한다.
// onlineMtIdx(현재 방을 보고 있는 회원)는 호출자(Hub.OnlineInRoom)가 전달한다.
// 발신자/온라인 멤버를 제외하고 mt_token_id 보유자만 대상에 포함한다.
// senderName = nickname or name or "알 수 없음"(Python 동일 폴백).
func (s *ChatService) BuildOfflinePush(scrIdx, senderMtIdx int, onlineMtIdx map[int]bool) (string, []PushTarget, error) {
	members, err := s.repo.GetRoomMembers(scrIdx)
	if err != nil {
		return "", nil, err
	}

	senderName := "알 수 없음"
	if senders, err := s.repo.GetMembersByIDs([]int{senderMtIdx}); err != nil {
		return "", nil, err
	} else if len(senders) > 0 {
		s0 := senders[0]
		if s0.MtNickname != nil && *s0.MtNickname != "" {
			senderName = *s0.MtNickname
		} else if s0.MtName != nil && *s0.MtName != "" {
			senderName = *s0.MtName
		}
	}

	ids := make([]int, 0, len(members))
	for _, m := range members {
		if m.MtIdx == senderMtIdx || onlineMtIdx[m.MtIdx] {
			continue
		}
		ids = append(ids, m.MtIdx)
	}
	targetMembers, err := s.repo.GetMembersByIDs(ids)
	if err != nil {
		return senderName, nil, err
	}
	targets := make([]PushTarget, 0, len(targetMembers))
	for _, m := range targetMembers {
		if m.MtTokenID != nil && *m.MtTokenID != "" {
			targets = append(targets, PushTarget{Token: *m.MtTokenID, MemberID: m.MtIdx})
		}
	}
	return senderName, targets, nil
}
