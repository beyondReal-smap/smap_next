package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// --- mock chatRepo (함수 필드 주입식) ---
type mockChatRepo struct {
	roomsFn     func(int) ([]model.ChatRoom, error)
	membFn      func(int, int) (*model.ChatMember, error)
	unreadFn    func(int, int) (int64, error)
	latestFn    func(int) (*model.ChatMessage, error)
	membersFn   func(int) ([]model.ChatMember, error)
	dmFn        func(int, int) (*model.ChatRoom, error)
	msgsFn      func(int, int, int) ([]model.ChatMessage, error)
	cUnreadFn   func(int, int) (int, error)
	createFn    func(int, int, time.Time) (int, error)
	byIDsFn     func([]int) ([]model.Member, error)
	createMsgFn func(int, int, string, time.Time) (*model.ChatMessage, error)
	updLastFn   func(int, int, int) error
	shareFn     func(int, int) (bool, error) // nil이면 항상 같은 그룹
	removed     [][2]int
	removedAll  []int
}

func (m *mockChatRepo) GetRoomsForMember(mtIdx int) ([]model.ChatRoom, error) {
	return m.roomsFn(mtIdx)
}
func (m *mockChatRepo) FindMembership(s, mt int) (*model.ChatMember, error) { return m.membFn(s, mt) }
func (m *mockChatRepo) UnreadCount(s, lr int) (int64, error)                { return m.unreadFn(s, lr) }
func (m *mockChatRepo) GetLatest(s int) (*model.ChatMessage, error)         { return m.latestFn(s) }
func (m *mockChatRepo) GetRoomMembers(s int) ([]model.ChatMember, error)    { return m.membersFn(s) }
func (m *mockChatRepo) FindDM(a, b int) (*model.ChatRoom, error)            { return m.dmFn(a, b) }
func (m *mockChatRepo) GetMessages(s, b, l int) ([]model.ChatMessage, error) {
	return m.msgsFn(s, b, l)
}
func (m *mockChatRepo) CountUnread(s, mi int) (int, error)                { return m.cUnreadFn(s, mi) }
func (m *mockChatRepo) CreateDMRoom(a, b int, t time.Time) (int, error)   { return m.createFn(a, b, t) }
func (m *mockChatRepo) GetMembersByIDs(ids []int) ([]model.Member, error) { return m.byIDsFn(ids) }
func (m *mockChatRepo) CreateMessageTx(s, mt int, c string, t time.Time) (*model.ChatMessage, error) {
	return m.createMsgFn(s, mt, c, t)
}
func (m *mockChatRepo) UpdateLastRead(s, mt, si int) error { return m.updLastFn(s, mt, si) }
func (m *mockChatRepo) ShareActiveGroup(a, b int) (bool, error) {
	if m.shareFn == nil {
		return true, nil
	}
	return m.shareFn(a, b)
}
func (m *mockChatRepo) RemoveMemberFromGroupChat(sgt, mt int) error {
	m.removed = append(m.removed, [2]int{sgt, mt})
	return nil
}
func (m *mockChatRepo) RemoveAllFromGroupChat(sgt int) error {
	m.removedAll = append(m.removedAll, sgt)
	return nil
}

func sp(s string) *string { return &s }

func TestChatRuneHead(t *testing.T) {
	long := strings.Repeat("가", 60) // 한글 60 코드포인트
	cases := []struct {
		in   string
		n    int
		want string
	}{
		{"hello", 50, "hello"},
		{"가나다라마", 3, "가나다"}, // 멀티바이트지만 코드포인트 3
		{"가나다", 50, "가나다"},
		{"", 50, ""},
		{long, 50, strings.Repeat("가", 50)},
	}
	for _, tc := range cases {
		if got := chatRuneHead(tc.in, tc.n); got != tc.want {
			t.Errorf("chatRuneHead(%q,%d)=%q want %q", tc.in, tc.n, got, tc.want)
		}
	}
}

func TestChatNicknameOr(t *testing.T) {
	name, nick, empty := sp("홍길동"), sp("길동이"), sp("")
	if got := chatNicknameOr(nick, name); got != nick {
		t.Errorf("nickname 우선 실패: %v", got)
	}
	if got := chatNicknameOr(empty, name); got != name {
		t.Errorf("빈 nickname → name 폴백 실패: %v", got)
	}
	if got := chatNicknameOr(nil, name); got != name {
		t.Errorf("nil nickname → name 폴백 실패: %v", got)
	}
	if got := chatNicknameOr(nil, nil); got != nil {
		t.Errorf("둘 다 nil → nil 기대, got %v", got)
	}
}

func TestGetMessages_NoMembership(t *testing.T) {
	repo := &mockChatRepo{membFn: func(s, mt int) (*model.ChatMember, error) { return nil, nil }}
	items, found, err := NewChat(repo).GetMessages(1, 2, 0, 50)
	if err != nil || found || items != nil {
		t.Errorf("membership 없음 → (nil,false,nil) 기대, got (%v,%v,%v)", items, found, err)
	}
}

func TestGetMessages_ReverseAndSender(t *testing.T) {
	wdate := time.Date(2026, 6, 1, 9, 30, 0, 0, time.UTC)
	// repo.GetMessages는 Python [::-1]로 이미 asc 정렬된 결과를 반환한다고 가정.
	repo := &mockChatRepo{
		membFn: func(s, mt int) (*model.ChatMember, error) { return &model.ChatMember{ScrIdx: s, MtIdx: mt}, nil },
		msgsFn: func(s, b, l int) ([]model.ChatMessage, error) {
			return []model.ChatMessage{
				{ScmsgIdx: 1, ScrIdx: s, MtIdx: 7, ScmsgType: "text", ScmsgContent: "first", ScmsgWdate: wdate},
				{ScmsgIdx: 2, ScrIdx: s, MtIdx: 7, ScmsgType: "text", ScmsgContent: "second", ScmsgWdate: wdate},
			}, nil
		},
		cUnreadFn: func(s, mi int) (int, error) { return 1, nil },
		byIDsFn: func(ids []int) ([]model.Member, error) {
			return []model.Member{{MtIdx: 7, MtNickname: sp("보낸이"), MtFile1: sp("p.jpg")}}, nil
		},
	}
	items, found, err := NewChat(repo).GetMessages(5, 2, 0, 50)
	if err != nil || !found || len(items) != 2 {
		t.Fatalf("기대 2건/found, got found=%v len=%d err=%v", found, len(items), err)
	}
	if items[0].ScmsgIdx != 1 || items[1].ScmsgIdx != 2 {
		t.Errorf("정렬 어긋남: %d,%d", items[0].ScmsgIdx, items[1].ScmsgIdx)
	}
	if items[0].MtNickname == nil || *items[0].MtNickname != "보낸이" {
		t.Errorf("sender nickname 매핑 실패: %v", items[0].MtNickname)
	}
	if items[0].ScmsgWdate != "2026-06-01T09:30:00" {
		t.Errorf("isoformat 불일치: %q", items[0].ScmsgWdate)
	}
	if items[0].UnreadCount != 1 {
		t.Errorf("unread 불일치: %d", items[0].UnreadCount)
	}
}

func TestGetRoomsForMember_DM(t *testing.T) {
	wdate := time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC)
	repo := &mockChatRepo{
		roomsFn: func(mt int) ([]model.ChatRoom, error) {
			return []model.ChatRoom{{ScrIdx: 10, ScrType: "dm", ScrShow: "Y", ScrUdate: wdate}}, nil
		},
		membFn: func(s, mt int) (*model.ChatMember, error) {
			return &model.ChatMember{ScrIdx: s, MtIdx: mt, ScmLastReadIdx: 5}, nil
		},
		unreadFn: func(s, lr int) (int64, error) { return 3, nil },
		latestFn: func(s int) (*model.ChatMessage, error) {
			return &model.ChatMessage{ScmsgIdx: 8, ScrIdx: s, MtIdx: 2, ScmsgContent: "안녕하세요", ScmsgWdate: wdate}, nil
		},
		membersFn: func(s int) ([]model.ChatMember, error) {
			return []model.ChatMember{{MtIdx: 1}, {MtIdx: 2}}, nil // 본인 1 + 상대 2
		},
		byIDsFn: func(ids []int) ([]model.Member, error) {
			return []model.Member{{MtIdx: 2, MtNickname: sp("친구"), MtFile1: sp("f.jpg")}}, nil
		},
	}
	res, err := NewChat(repo).GetRoomsForMember(1)
	if err != nil || len(res.Rooms) != 1 {
		t.Fatalf("기대 1방, got %d err=%v", len(res.Rooms), err)
	}
	r := res.Rooms[0]
	if res.TotalUnread != 3 || r.UnreadCount != 3 {
		t.Errorf("unread 합산 실패: total=%d room=%d", res.TotalUnread, r.UnreadCount)
	}
	if r.MemberCount != 2 {
		t.Errorf("member_count 실패: %d", r.MemberCount)
	}
	if r.DmTargetNickname == nil || *r.DmTargetNickname != "친구" {
		t.Errorf("dm_target_nickname 실패: %v", r.DmTargetNickname)
	}
	if r.LastMessage == nil || *r.LastMessage != "안녕하세요" {
		t.Errorf("last_message 실패: %v", r.LastMessage)
	}
	if r.ScrUdate != "2026-06-01T12:00:00" {
		t.Errorf("scr_udate isoformat 실패: %q", r.ScrUdate)
	}
}

func TestCreateDMRoom(t *testing.T) {
	// 기존 DM 있음 → is_new=false
	existing := &mockChatRepo{dmFn: func(a, b int) (*model.ChatRoom, error) { return &model.ChatRoom{ScrIdx: 99}, nil }}
	if res, err := NewChat(existing).CreateDMRoom(1, 2); err != nil || res.ScrIdx != 99 || res.IsNew {
		t.Errorf("기존 DM → {99,false} 기대, got %+v err=%v", res, err)
	}
	// 신규 생성 → is_new=true
	fresh := &mockChatRepo{
		dmFn:     func(a, b int) (*model.ChatRoom, error) { return nil, nil },
		createFn: func(a, b int, _ time.Time) (int, error) { return 123, nil },
	}
	if res, err := NewChat(fresh).CreateDMRoom(1, 2); err != nil || res.ScrIdx != 123 || !res.IsNew {
		t.Errorf("신규 DM → {123,true} 기대, got %+v err=%v", res, err)
	}
}

// C-2: DM은 같은 그룹의 활성 회원끼리만 만들 수 있다(없는 회원·다른 그룹 회원이면 거부, DB 쓰기 없음).
func TestCreateDMRoom_RequiresSharedActiveGroup(t *testing.T) {
	created := false
	repo := &mockChatRepo{
		shareFn:  func(a, b int) (bool, error) { return false, nil },
		dmFn:     func(a, b int) (*model.ChatRoom, error) { return nil, nil },
		createFn: func(a, b int, t time.Time) (int, error) { created = true; return 1, nil },
	}
	if _, err := NewChat(repo).CreateDMRoom(1, 2); err != ErrChatDMNotAllowed {
		t.Fatalf("ErrChatDMNotAllowed 기대: %v", err)
	}
	if created {
		t.Error("거부된 요청이 방을 만들었다")
	}
}

// C-1: 그룹 멤버십이 없어진 방은 방 목록에서 제외된다.
func TestGetRoomsForMember_SkipsRoomsWithoutValidMembership(t *testing.T) {
	repo := &mockChatRepo{
		roomsFn: func(int) ([]model.ChatRoom, error) { return []model.ChatRoom{{ScrIdx: 1, ScrType: "group"}}, nil },
		membFn:  func(s, mt int) (*model.ChatMember, error) { return nil, nil },
	}
	res, err := NewChat(repo).GetRoomsForMember(3)
	if err != nil || len(res.Rooms) != 0 {
		t.Errorf("멤버십 없는 방은 제외돼야 함: %+v err=%v", res, err)
	}
}

// 비활성화 함수는 repo를 호출하고 수신 시점 확인 캐시를 비운다(캐시된 허용이 남지 않는다).
func TestDeactivateChatMembershipClearsCache(t *testing.T) {
	member := true
	repo := &mockChatRepo{membFn: func(s, mt int) (*model.ChatMember, error) {
		if member {
			return &model.ChatMember{ScrIdx: s, MtIdx: mt}, nil
		}
		return nil, nil
	}}
	svc := NewChat(repo)
	svc.SetMembershipCacheTTL(time.Minute)
	if ok, _ := svc.IsRoomMember(1, 3); !ok {
		t.Fatal("멤버여야 함")
	}
	member = false // 그룹 멤버십 상실
	if ok, _ := svc.IsRoomMember(1, 3); !ok {
		t.Error("TTL 안에서는 캐시된 허용(최대 TTL 지연)")
	}
	if err := svc.DeactivateChatMembership(context.Background(), 10, 3); err != nil {
		t.Fatal(err)
	}
	if len(repo.removed) != 1 || repo.removed[0] != [2]int{10, 3} {
		t.Errorf("repo 비활성화 호출 불일치: %v", repo.removed)
	}
	if ok, _ := svc.IsRoomMember(1, 3); ok {
		t.Error("비활성화 직후에는 즉시 거부돼야 함")
	}
	if err := svc.DeactivateGroupChat(context.Background(), 10); err != nil || len(repo.removedAll) != 1 {
		t.Errorf("그룹 삭제 비활성화: %v %v", err, repo.removedAll)
	}
}

func TestIsRoomMemberNoCacheWhenTTLZero(t *testing.T) {
	calls := 0
	repo := &mockChatRepo{membFn: func(s, mt int) (*model.ChatMember, error) { calls++; return &model.ChatMember{}, nil }}
	svc := NewChat(repo)
	svc.IsRoomMember(1, 1)
	svc.IsRoomMember(1, 1)
	if calls != 2 {
		t.Errorf("TTL 0이면 매번 조회: %d", calls)
	}
}
