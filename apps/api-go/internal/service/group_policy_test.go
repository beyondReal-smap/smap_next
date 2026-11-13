package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/cache"
	"github.com/bluemusk/smap_next_go/internal/model"
)

func gdRowOf(exit, discharge, show, owner, leader string) model.GroupDetail {
	return model.GroupDetail{SgdtIdx: 9, SgdtExit: pStr(exit), SgdtDischarge: pStr(discharge), SgdtShow: pStr(show),
		SgdtOwnerChk: pStr(owner), SgdtLeaderChk: pStr(leader)}
}

func TestJoinPolicy(t *testing.T) {
	grp := &model.Group{SgtIdx: 3, SgtCode: pStr("ABCDEFGH23"), SgtShow: pStr("Y")}
	run := func(rows []model.GroupDetail, code string, require bool) (*fakeGroupWriteRepo, JoinOutcome, error) {
		repo := &fakeGroupWriteRepo{group: grp, memberExists: true, rows: rows}
		if rows == nil {
			repo.rows = []model.GroupDetail{}
		}
		res, err := NewGroupWrite(repo, &fakeGroupChat{}).Join(3, 7, code, require)
		return repo, res.Outcome, err
	}
	// 강퇴 행이 하나라도 있으면 거부(여러 행 중복 포함).
	if _, o, _ := run([]model.GroupDetail{gdRowOf("N", "Y", "Y", "N", "N")}, "", false); o != JoinKicked {
		t.Errorf("강퇴 → JoinKicked 기대: %v", o)
	}
	if _, o, _ := run([]model.GroupDetail{gdRowOf("Y", "N", "N", "N", "N"), gdRowOf("N", "Y", "Y", "N", "N")}, "", false); o != JoinKicked {
		t.Errorf("중복 행 중 강퇴 포함 → JoinKicked 기대: %v", o)
	}
	// 자진 탈퇴 → 재가입(권한 초기화 경로).
	repo, o, err := run([]model.GroupDetail{gdRowOf("Y", "N", "N", "Y", "Y")}, "", false)
	if err != nil || o != JoinReactivated || !repo.rejoined {
		t.Errorf("자진 탈퇴 재가입은 RejoinMembership: outcome=%v err=%v rejoined=%v", o, err, repo.rejoined)
	}
	// 코드: 틀리면 거부, 대소문자 무시 일치, 필수 설정 시 코드 없으면 거부.
	if _, o, _ := run(nil, "WRONGCODE2", false); o != JoinCodeMismatch {
		t.Errorf("틀린 코드 → JoinCodeMismatch 기대: %v", o)
	}
	if _, o, _ := run(nil, "abcdefgh23", false); o != JoinCreated {
		t.Errorf("대소문자 무시 일치 → 성공 기대: %v", o)
	}
	if _, o, _ := run(nil, "", true); o != JoinCodeRequired {
		t.Errorf("REQUIRE 설정에서 코드 없음 → JoinCodeRequired 기대: %v", o)
	}
	if _, o, _ := run(nil, "", false); o != JoinCreated {
		t.Errorf("기본 설정에서 코드 없음 → 성공 기대: %v", o)
	}
}

func TestRemoveMemberKindsAndOwner(t *testing.T) {
	cur := func(owner string) *model.GroupDetail {
		r := gdRowOf("N", "N", "Y", owner, "N")
		return &r
	}
	repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3}, visible: cur("N")}
	if res, err := NewGroupWrite(repo, &fakeGroupChat{}).RemoveMember(3, 7, RemovalKick); err != nil || res.Outcome != RemoveSuccess || !repo.kicked || repo.left {
		t.Errorf("강퇴는 KickMembership: %+v err=%v", res, err)
	}
	repo = &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3}, visible: cur("Y")}
	if _, err := NewGroupWrite(repo, &fakeGroupChat{}).RemoveMember(3, 7, RemovalLeave); !errors.Is(err, ErrOwnerCannotLeave) {
		t.Errorf("그룹장은 승계 없이 탈퇴 불가: %v", err)
	}
	if repo.left || repo.kicked {
		t.Error("거부됐는데 상태가 바뀜")
	}
}

func TestOwnerTransferValidation(t *testing.T) {
	repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3, SgtShow: pStr("Y")}}
	if _, err := NewGroupWrite(repo, &fakeGroupChat{}).UpdateGroup(3, pInt(99), nil, nil, nil, nil); !errors.Is(err, ErrNewOwnerNotMember) {
		t.Errorf("현재 멤버가 아닌 사람에게 위임 불가: %v", err)
	}
	if repo.savedGroup != nil || repo.transferred != 0 {
		t.Error("검증 실패인데 변경이 시작됨")
	}
	if _, err := NewGroupWrite(&fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3, SgtShow: pStr("Y")}}, &fakeGroupChat{}).UpdateGroup(3, nil, nil, pStr("G123"), nil, nil); !errors.Is(err, ErrInvalidGroupCode) {
		t.Errorf("짧은 코드 거부: %v", err)
	}
}

func TestNewGroupCode(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 500; i++ {
		c, err := newGroupCode()
		if err != nil || !validGroupCodeFormat(c) || len(c) < 10 {
			t.Fatalf("형식 오류: %q %v", c, err)
		}
		if seen[c] {
			t.Fatalf("중복 코드: %q", c)
		}
		seen[c] = true
	}
}

type countStore struct {
	n   map[string]int64
	err error
}

func (c *countStore) IncrWithExpire(_ context.Context, k string, _ time.Duration) (int64, error) {
	if c.err != nil {
		return 0, c.err
	}
	c.n[k]++
	return c.n[k], nil
}
func (c *countStore) TTL(context.Context, string) (time.Duration, error) {
	return 10 * time.Second, nil
}

func (c *countStore) SetEX(context.Context, string, string, time.Duration) error { return nil }
func (c *countStore) GetString(context.Context, string) (string, bool, error) {
	return "", false, nil
}
func (c *countStore) DelKeys(context.Context, ...string) (int64, error) { return 0, nil }

func TestGroupCodeGuard(t *testing.T) {
	st := &countStore{n: map[string]int64{}}
	g := NewGroupCodeGuard(st, 2, 3, time.Hour, slog.Default())
	for i := 0; i < 2; i++ {
		if rj := g.Check(context.Background(), 1, "1.1.1.1"); rj != nil {
			t.Fatalf("한도 이내인데 거부: %+v", rj)
		}
	}
	if rj := g.Check(context.Background(), 1, "1.1.1.1"); rj == nil || rj.Status != 429 {
		t.Errorf("회원 한도 초과는 429: %+v", rj)
	}
	st.err = cache.ErrDisabled
	if rj := NewGroupCodeGuard(st, 2, 3, time.Hour, slog.Default()).Check(context.Background(), 2, "2.2.2.2"); rj == nil || rj.Status != 503 {
		t.Errorf("Redis 장애는 503: %+v", rj)
	}
}

// --- 채팅 비활성화 연결(보정 1): 에러 정책 = 멤버십 변경은 유지하고 ERROR 로그로 표면화 ---

func TestRemoveMemberDeactivatesChat(t *testing.T) {
	newRepo := func() *fakeGroupWriteRepo {
		r := gdRowOf("N", "N", "Y", "N", "N")
		return &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3}, visible: &r}
	}
	for _, kind := range []RemovalKind{RemovalLeave, RemovalKick} {
		repo, chat := newRepo(), &fakeGroupChat{}
		if _, err := NewGroupWrite(repo, chat).RemoveMember(3, 7, kind); err != nil {
			t.Fatal(err)
		}
		if fmt.Sprint(chat.deactMembers) != "[3:7]" {
			t.Errorf("kind=%v: DeactivateChatMembership(3,7) 기대, got %v", kind, chat.deactMembers)
		}
	}
	// 저장소 변경이 실패하면 채팅은 건드리지 않는다.
	repo, chat := newRepo(), &fakeGroupChat{}
	repo.removeErr = errors.New("boom")
	if _, err := NewGroupWrite(repo, chat).RemoveMember(3, 7, RemovalLeave); err == nil {
		t.Fatal("저장소 오류 전파 기대")
	}
	if len(chat.deactMembers) != 0 {
		t.Errorf("멤버십 변경 실패 시 채팅 비활성화 금지: %v", chat.deactMembers)
	}
	// 그룹장 거부(owner_chk, 생성자 기준 둘 다)도 채팅을 건드리지 않는다.
	repo, chat = newRepo(), &fakeGroupChat{}
	repo.isOwner = true
	if _, err := NewGroupWrite(repo, chat).RemoveMember(3, 7, RemovalLeave); !errors.Is(err, ErrOwnerCannotLeave) {
		t.Fatalf("생성자 기준 그룹장 탈퇴는 ErrOwnerCannotLeave 기대: %v", err)
	}
	if len(chat.deactMembers) != 0 {
		t.Errorf("거부 시 채팅 비활성화 금지")
	}
	// 정책: 채팅 비활성화 실패가 탈퇴를 막지 않는다(멤버십은 이미 커밋됨. 실패는 ERROR 로그).
	repo, chat = newRepo(), &fakeGroupChat{deactErr: errors.New("chat boom")}
	res, err := NewGroupWrite(repo, chat).RemoveMember(3, 7, RemovalKick)
	if err != nil || res.Outcome != RemoveSuccess || !repo.kicked {
		t.Errorf("채팅 실패에도 강퇴는 성공해야 함: res=%v err=%v kicked=%v", res.Outcome, err, repo.kicked)
	}
}

func TestDeleteGroupDeactivatesChat(t *testing.T) {
	grp := func() *model.Group { return &model.Group{SgtIdx: 3, SgtShow: pStr("Y")} }
	repo, chat := &fakeGroupWriteRepo{group: grp()}, &fakeGroupChat{}
	if _, err := NewGroupWrite(repo, chat).UpdateGroup(3, nil, nil, nil, nil, pStr("N")); err != nil {
		t.Fatal(err)
	}
	if fmt.Sprint(chat.deactGroups) != "[3]" {
		t.Errorf("삭제 시 DeactivateGroupChat(3) 기대, got %v", chat.deactGroups)
	}
	// 일반 수정·복구는 호출하지 않는다.
	chat = &fakeGroupChat{}
	if _, err := NewGroupWrite(&fakeGroupWriteRepo{group: grp()}, chat).UpdateGroup(3, nil, pStr("t"), nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	if len(chat.deactGroups) != 0 {
		t.Errorf("일반 수정은 채팅을 건드리면 안 됨")
	}
	// 삭제 저장 실패 → 채팅 미호출. 채팅 실패 → 삭제는 성공.
	chat = &fakeGroupChat{}
	if _, err := NewGroupWrite(&fakeGroupWriteRepo{group: grp(), saveErr: errors.New("boom")}, chat).UpdateGroup(3, nil, nil, nil, nil, pStr("N")); err == nil {
		t.Fatal("저장 오류 전파 기대")
	}
	if len(chat.deactGroups) != 0 {
		t.Errorf("삭제 실패 시 채팅 비활성화 금지")
	}
	resp, err := NewGroupWrite(&fakeGroupWriteRepo{group: grp()}, &fakeGroupChat{deactErr: errors.New("chat boom")}).UpdateGroup(3, nil, nil, nil, nil, pStr("N"))
	if err != nil || resp == nil || resp.SgtShow == nil || *resp.SgtShow != "N" {
		t.Errorf("채팅 실패에도 삭제는 성공해야 함: resp=%v err=%v", resp, err)
	}
}

func TestRejoinRestoresChat(t *testing.T) {
	grp := &model.Group{SgtIdx: 3, SgtCode: pStr("ABCDEFGH23"), SgtShow: pStr("Y")}
	run := func(rows []model.GroupDetail) *fakeGroupChat {
		chat := &fakeGroupChat{}
		if _, err := NewGroupWrite(&fakeGroupWriteRepo{group: grp, memberExists: true, rows: rows}, chat).Join(3, 7, "", false); err != nil {
			t.Fatal(err)
		}
		return chat
	}
	if c := run([]model.GroupDetail{gdRowOf("Y", "N", "N", "N", "N")}); !c.addCalled {
		t.Errorf("자진 탈퇴 후 재가입은 AddMemberToGroupChat으로 채팅을 되살려야 함")
	}
	// 강퇴 이력은 거부되어 채팅을 되살리지 않는다.
	chat := &fakeGroupChat{}
	res, _ := NewGroupWrite(&fakeGroupWriteRepo{group: grp, memberExists: true, rows: []model.GroupDetail{gdRowOf("N", "Y", "Y", "N", "N")}}, chat).Join(3, 7, "", false)
	if res.Outcome != JoinKicked || chat.addCalled {
		t.Errorf("강퇴자는 거부·채팅 미복구 기대: %v add=%v", res.Outcome, chat.addCalled)
	}
	// 채팅 복구 실패도 재가입을 막지 않는다.
	chat = &fakeGroupChat{addErr: errors.New("chat boom")}
	res, err := NewGroupWrite(&fakeGroupWriteRepo{group: grp, memberExists: true, rows: []model.GroupDetail{gdRowOf("Y", "N", "N", "N", "N")}}, chat).Join(3, 7, "", false)
	if err != nil || res.Outcome != JoinReactivated {
		t.Errorf("채팅 실패에도 재가입 성공 기대: %v %v", res.Outcome, err)
	}
}
