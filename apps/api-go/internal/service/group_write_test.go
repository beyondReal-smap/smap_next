package service

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// fakeGroupWriteRepo는 groupWriteRepo 인터페이스를 메모리로 대체한다.
type fakeGroupWriteRepo struct {
	group   *model.Group       // GetByID 반환
	byCode  *model.Group       // FindByCode 반환
	active  *model.GroupDetail // FindActiveMembership 반환
	anyMem  *model.GroupDetail // FindMembershipAny 반환(Phase 2)
	visible *model.GroupDetail // FindVisibleMembership 반환(Phase 2)

	memberExists bool
	codeExists   bool

	getErr               error
	byCodeErr            error
	memberErr            error
	codeErr              error
	findActiveErr        error
	createGroupErr       error
	createGroupDetailErr error
	reactivateErr        error
	saveErr              error // Phase 2: SaveGroup
	findAnyErr           error // Phase 2: FindMembershipAny
	reactivateNewErr     error // Phase 2: ReactivateMembershipNewMember
	findVisibleErr       error // Phase 2: FindVisibleMembership
	removeErr            error // Phase 2: RemoveMembership

	createdGroup   *model.Group
	createdDetail  *model.GroupDetail
	reactivated    bool
	savedGroup     *model.Group // Phase 2: SaveGroup 기록
	reactivatedNew bool         // Phase 2
	removed        bool         // Phase 2
}

func (f *fakeGroupWriteRepo) GetByID(id int) (*model.Group, error)     { return f.group, f.getErr }
func (f *fakeGroupWriteRepo) FindByCode(c string) (*model.Group, error) { return f.byCode, f.byCodeErr }
func (f *fakeGroupWriteRepo) MemberExists(mtIdx int) (bool, error)     { return f.memberExists, f.memberErr }
func (f *fakeGroupWriteRepo) CodeExists(code string) (bool, error)     { return f.codeExists, f.codeErr }

func (f *fakeGroupWriteRepo) CreateGroup(g *model.Group) error {
	if f.createGroupErr != nil {
		return f.createGroupErr
	}
	g.SgtIdx = 1001 // autoincrement 모사
	f.createdGroup = g
	return nil
}

func (f *fakeGroupWriteRepo) FindActiveMembership(sgtIdx, mtIdx int) (*model.GroupDetail, error) {
	return f.active, f.findActiveErr
}

func (f *fakeGroupWriteRepo) CreateGroupDetail(gd *model.GroupDetail) error {
	if f.createGroupDetailErr != nil {
		return f.createGroupDetailErr
	}
	gd.SgdtIdx = 5005
	f.createdDetail = gd
	return nil
}

func (f *fakeGroupWriteRepo) ReactivateMembership(gd *model.GroupDetail, now time.Time) error {
	if f.reactivateErr != nil {
		return f.reactivateErr
	}
	f.reactivated = true
	return nil
}

// --- Phase 2 fake 메서드 ---

func (f *fakeGroupWriteRepo) SaveGroup(g *model.Group) error {
	if f.saveErr != nil {
		return f.saveErr
	}
	f.savedGroup = g
	return nil
}

func (f *fakeGroupWriteRepo) FindMembershipAny(sgtIdx, mtIdx int) (*model.GroupDetail, error) {
	return f.anyMem, f.findAnyErr
}

func (f *fakeGroupWriteRepo) ReactivateMembershipNewMember(gd *model.GroupDetail, now time.Time) error {
	if f.reactivateNewErr != nil {
		return f.reactivateNewErr
	}
	f.reactivatedNew = true
	return nil
}

func (f *fakeGroupWriteRepo) FindVisibleMembership(sgtIdx, mtIdx int) (*model.GroupDetail, error) {
	return f.visible, f.findVisibleErr
}

func (f *fakeGroupWriteRepo) RemoveMembership(gd *model.GroupDetail, now time.Time) error {
	if f.removeErr != nil {
		return f.removeErr
	}
	f.removed = true
	return nil
}

// fakeGroupChat는 groupChatWriter 인터페이스를 대체하고 호출 여부/에러를 기록한다.
type fakeGroupChat struct {
	createCalled bool
	addCalled    bool
	createErr    error
	addErr       error
}

func (f *fakeGroupChat) CreateGroupChatRoom(sgtIdx int, title *string, ids []int, now time.Time) error {
	f.createCalled = true
	return f.createErr
}

func (f *fakeGroupChat) AddMemberToGroupChat(sgtIdx, mtIdx int, now time.Time) error {
	f.addCalled = true
	return f.addErr
}

func TestCreateGroup(t *testing.T) {
	t.Run("성공: mt_idx 강제·코드 생성·show 폴백 Y·그룹장 등록·채팅방 생성", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{}
		chat := &fakeGroupChat{}
		res, err := NewGroupWrite(repo, chat).CreateGroup(7, pStr("우리모임"), pStr("메모"), nil)
		if err != nil {
			t.Fatalf("예상치 못한 에러: %v", err)
		}
		if res.MtIdx == nil || *res.MtIdx != 7 {
			t.Errorf("mt_idx=토큰값(7) 기대, got %v", res.MtIdx)
		}
		if res.SgtCode == nil || len(*res.SgtCode) != 6 || !strings.HasPrefix(*res.SgtCode, "G") {
			t.Errorf("sgt_code는 'G'+5자 기대, got %v", res.SgtCode)
		}
		if res.SgtShow == nil || *res.SgtShow != "Y" {
			t.Errorf("sgt_show 폴백 'Y' 기대, got %v", res.SgtShow)
		}
		if res.SgtTitle == nil || *res.SgtTitle != "우리모임" {
			t.Errorf("sgt_title 보존 기대, got %v", res.SgtTitle)
		}
		if res.SgtUdate != nil {
			t.Errorf("sgt_udate는 미설정(null) 기대, got %v", res.SgtUdate)
		}
		if repo.createdDetail == nil || repo.createdDetail.SgdtOwnerChk == nil || *repo.createdDetail.SgdtOwnerChk != "Y" {
			t.Errorf("그룹장 GroupDetail(owner='Y') 등록 기대")
		}
		if !chat.createCalled {
			t.Errorf("채팅방 생성 호출 기대")
		}
	})

	t.Run("show='N' 명시 시 보존", func(t *testing.T) {
		res, err := NewGroupWrite(&fakeGroupWriteRepo{}, &fakeGroupChat{}).CreateGroup(7, nil, nil, pStr("N"))
		if err != nil {
			t.Fatalf("에러: %v", err)
		}
		if res.SgtShow == nil || *res.SgtShow != "N" {
			t.Errorf("sgt_show='N' 보존 기대, got %v", res.SgtShow)
		}
	})

	t.Run("best-effort: 그룹장/채팅방 실패해도 200(에러 없음)", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{createGroupDetailErr: errors.New("detail boom")}
		chat := &fakeGroupChat{createErr: errors.New("chat boom")}
		_, err := NewGroupWrite(repo, chat).CreateGroup(7, pStr("t"), nil, nil)
		if err != nil {
			t.Errorf("그룹장/채팅 실패는 무시되어야 함(Python try/except), got %v", err)
		}
	})

	t.Run("그룹 INSERT 실패는 에러 전파(미처리 500)", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{createGroupErr: errors.New("insert boom")}
		_, err := NewGroupWrite(repo, &fakeGroupChat{}).CreateGroup(7, pStr("t"), nil, nil)
		if err == nil {
			t.Errorf("그룹 INSERT 실패는 에러 전파 기대")
		}
	})
}

func TestJoinByCode(t *testing.T) {
	t.Run("코드 그룹 없음 → JoinGroupNotFound", func(t *testing.T) {
		res, err := NewGroupWrite(&fakeGroupWriteRepo{byCode: nil}, &fakeGroupChat{}).JoinByCode(7, "gabcde")
		if err != nil || res.Outcome != JoinGroupNotFound {
			t.Errorf("JoinGroupNotFound 기대, got outcome=%v err=%v", res.Outcome, err)
		}
	})

	t.Run("회원 없음 → JoinMemberNotFound", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{byCode: &model.Group{SgtIdx: 3}, memberExists: false}
		res, err := NewGroupWrite(repo, &fakeGroupChat{}).JoinByCode(7, "gabcde")
		if err != nil || res.Outcome != JoinMemberNotFound {
			t.Errorf("JoinMemberNotFound 기대, got outcome=%v err=%v", res.Outcome, err)
		}
	})

	t.Run("이미 가입(show=Y) → JoinAlready", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{
			byCode: &model.Group{SgtIdx: 3}, memberExists: true,
			active: &model.GroupDetail{SgdtIdx: 9, SgdtShow: pStr("Y")},
		}
		res, err := NewGroupWrite(repo, &fakeGroupChat{}).JoinByCode(7, "gabcde")
		if err != nil || res.Outcome != JoinAlready {
			t.Errorf("JoinAlready 기대, got outcome=%v err=%v", res.Outcome, err)
		}
	})

	t.Run("재가입(show=N) → JoinReactivated, 채팅 추가 없음", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{
			byCode: &model.Group{SgtIdx: 3}, memberExists: true,
			active: &model.GroupDetail{SgdtIdx: 9, SgdtShow: pStr("N"), SgdtOwnerChk: pStr("N"), SgdtLeaderChk: pStr("N"), SgdtWdate: pTimePtr(time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC))},
		}
		chat := &fakeGroupChat{}
		res, err := NewGroupWrite(repo, chat).JoinByCode(7, "gabcde")
		if err != nil || res.Outcome != JoinReactivated {
			t.Fatalf("JoinReactivated 기대, got outcome=%v err=%v", res.Outcome, err)
		}
		if !repo.reactivated {
			t.Errorf("ReactivateMembership 호출 기대")
		}
		if chat.addCalled {
			t.Errorf("재가입엔 채팅 멤버 추가 없음(Python 동일)")
		}
		if res.Data.SgdtIdx != 9 || res.Data.SgtIdx != 3 || res.Data.MtIdx != 7 {
			t.Errorf("data 필드 불일치: %+v", res.Data)
		}
		if res.Data.SgdtWdate != "2025-01-02T03:04:05" {
			t.Errorf("sgdt_wdate isoformat 불일치: %q", res.Data.SgdtWdate)
		}
	})

	t.Run("신규 가입 → JoinCreated(owner='N'), 채팅 추가 호출", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{byCode: &model.Group{SgtIdx: 3}, memberExists: true, active: nil}
		chat := &fakeGroupChat{}
		res, err := NewGroupWrite(repo, chat).JoinByCode(7, "gabcde")
		if err != nil || res.Outcome != JoinCreated {
			t.Fatalf("JoinCreated 기대, got outcome=%v err=%v", res.Outcome, err)
		}
		if repo.createdDetail == nil || *repo.createdDetail.SgdtOwnerChk != "N" {
			t.Errorf("신규 멤버 owner='N' 기대")
		}
		if !chat.addCalled {
			t.Errorf("채팅 멤버 추가 호출 기대")
		}
		if res.Data.SgdtIdx != 5005 || res.Data.SgtIdx != 3 || res.Data.MtIdx != 7 || res.Data.SgdtWdate == "" {
			t.Errorf("data 필드 불일치: %+v", res.Data)
		}
	})

	t.Run("신규 멤버십 INSERT 실패 → ErrCreateMembership", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{byCode: &model.Group{SgtIdx: 3}, memberExists: true, active: nil, createGroupDetailErr: errors.New("boom")}
		_, err := NewGroupWrite(repo, &fakeGroupChat{}).JoinByCode(7, "gabcde")
		if !errors.Is(err, ErrCreateMembership) {
			t.Errorf("ErrCreateMembership 기대, got %v", err)
		}
	})

	t.Run("재가입 commit 실패 → 일반 에러(ErrCreateMembership 아님)", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{
			byCode: &model.Group{SgtIdx: 3}, memberExists: true,
			active:        &model.GroupDetail{SgdtIdx: 9, SgdtShow: pStr("N")},
			reactivateErr: errors.New("commit boom"),
		}
		_, err := NewGroupWrite(repo, &fakeGroupChat{}).JoinByCode(7, "gabcde")
		if err == nil || errors.Is(err, ErrCreateMembership) {
			t.Errorf("일반 에러(미처리 500) 기대, got %v", err)
		}
	})
}

func TestJoin(t *testing.T) {
	t.Run("그룹 없음 → JoinGroupNotFound", func(t *testing.T) {
		res, err := NewGroupWrite(&fakeGroupWriteRepo{group: nil}, &fakeGroupChat{}).Join(3, 7)
		if err != nil || res.Outcome != JoinGroupNotFound {
			t.Errorf("JoinGroupNotFound 기대, got outcome=%v err=%v", res.Outcome, err)
		}
	})

	t.Run("숨김 그룹(show!=Y) → JoinGroupHidden", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3, SgtShow: pStr("N")}}
		res, err := NewGroupWrite(repo, &fakeGroupChat{}).Join(3, 7)
		if err != nil || res.Outcome != JoinGroupHidden {
			t.Errorf("JoinGroupHidden 기대, got outcome=%v err=%v", res.Outcome, err)
		}
	})

	t.Run("회원 없음 → JoinMemberNotFound", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3, SgtShow: pStr("Y")}, memberExists: false}
		res, err := NewGroupWrite(repo, &fakeGroupChat{}).Join(3, 7)
		if err != nil || res.Outcome != JoinMemberNotFound {
			t.Errorf("JoinMemberNotFound 기대, got outcome=%v err=%v", res.Outcome, err)
		}
	})

	t.Run("신규 가입 → JoinCreated", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3, SgtShow: pStr("Y")}, memberExists: true, active: nil}
		chat := &fakeGroupChat{}
		res, err := NewGroupWrite(repo, chat).Join(3, 7)
		if err != nil || res.Outcome != JoinCreated {
			t.Fatalf("JoinCreated 기대, got outcome=%v err=%v", res.Outcome, err)
		}
		if !chat.addCalled {
			t.Errorf("채팅 멤버 추가 호출 기대")
		}
	})
}

func TestUpdateGroup(t *testing.T) {
	t.Run("그룹 없음 → (nil,nil)=404", func(t *testing.T) {
		resp, err := NewGroupWrite(&fakeGroupWriteRepo{group: nil}, &fakeGroupChat{}).UpdateGroup(3, nil, nil, nil, nil, nil)
		if err != nil || resp != nil {
			t.Errorf("(nil,nil) 기대, got resp=%v err=%v", resp, err)
		}
	})

	t.Run("소프트 삭제(show='N') → SaveGroup 호출·show='N'·udate 설정", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3, SgtShow: pStr("Y"), SgtTitle: pStr("원래")}}
		resp, err := NewGroupWrite(repo, &fakeGroupChat{}).UpdateGroup(3, nil, pStr("무시될제목"), nil, nil, pStr("N"))
		if err != nil || resp == nil {
			t.Fatalf("성공 기대, got resp=%v err=%v", resp, err)
		}
		if repo.savedGroup == nil {
			t.Errorf("SaveGroup 호출 기대")
		}
		if resp.SgtShow == nil || *resp.SgtShow != "N" {
			t.Errorf("sgt_show='N' 기대, got %v", resp.SgtShow)
		}
		if resp.SgtUdate == nil {
			t.Errorf("sgt_udate 설정 기대")
		}
		// 소프트 삭제는 즉시 반환 → title 미반영(원래값 보존).
		if resp.SgtTitle == nil || *resp.SgtTitle != "원래" {
			t.Errorf("소프트 삭제 시 title 미반영 기대, got %v", resp.SgtTitle)
		}
	})

	t.Run("일반 업데이트(title/mt_idx/code) → 반영·udate 설정", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3, SgtShow: pStr("Y")}}
		resp, err := NewGroupWrite(repo, &fakeGroupChat{}).UpdateGroup(3, pInt(99), pStr("새제목"), pStr("NEWCD"), nil, nil)
		if err != nil || resp == nil {
			t.Fatalf("성공 기대, got resp=%v err=%v", resp, err)
		}
		if resp.SgtTitle == nil || *resp.SgtTitle != "새제목" {
			t.Errorf("title 반영 기대, got %v", resp.SgtTitle)
		}
		if resp.MtIdx == nil || *resp.MtIdx != 99 {
			t.Errorf("mt_idx 반영 기대, got %v", resp.MtIdx)
		}
		if resp.SgtCode == nil || *resp.SgtCode != "NEWCD" {
			t.Errorf("sgt_code 반영 기대, got %v", resp.SgtCode)
		}
		if resp.SgtUdate == nil {
			t.Errorf("변경 시 sgt_udate 설정 기대")
		}
	})

	t.Run("변경 필드 없음 → SaveGroup 미호출(commit 안 함)", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3, SgtShow: pStr("Y")}}
		resp, err := NewGroupWrite(repo, &fakeGroupChat{}).UpdateGroup(3, nil, nil, nil, nil, nil)
		if err != nil || resp == nil {
			t.Fatalf("성공 기대, got resp=%v err=%v", resp, err)
		}
		if repo.savedGroup != nil {
			t.Errorf("변경 없으면 SaveGroup 미호출 기대")
		}
		if resp.SgtUdate != nil {
			t.Errorf("변경 없으면 sgt_udate 미설정 기대")
		}
	})

	t.Run("GetByID DB 오류 → (nil,err)=prefix500", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{getErr: errors.New("db boom")}
		resp, err := NewGroupWrite(repo, &fakeGroupChat{}).UpdateGroup(3, nil, nil, nil, nil, nil)
		if err == nil || resp != nil {
			t.Errorf("(nil,err) 기대, got resp=%v err=%v", resp, err)
		}
	})
}

func TestRestoreGroup(t *testing.T) {
	t.Run("그룹 없음 → (nil,nil)=404", func(t *testing.T) {
		resp, err := NewGroupWrite(&fakeGroupWriteRepo{group: nil}, &fakeGroupChat{}).RestoreGroup(3)
		if err != nil || resp != nil {
			t.Errorf("(nil,nil) 기대, got resp=%v err=%v", resp, err)
		}
	})

	t.Run("복구 성공 → show='Y'·SaveGroup 호출", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3, SgtShow: pStr("N")}}
		resp, err := NewGroupWrite(repo, &fakeGroupChat{}).RestoreGroup(3)
		if err != nil || resp == nil {
			t.Fatalf("성공 기대, got resp=%v err=%v", resp, err)
		}
		if resp.SgtShow == nil || *resp.SgtShow != "Y" {
			t.Errorf("sgt_show='Y' 기대, got %v", resp.SgtShow)
		}
		if repo.savedGroup == nil {
			t.Errorf("SaveGroup 호출 기대")
		}
	})

	t.Run("Save 오류 → (nil,err)=plain500", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3, SgtShow: pStr("N")}, saveErr: errors.New("boom")}
		resp, err := NewGroupWrite(repo, &fakeGroupChat{}).RestoreGroup(3)
		if err == nil || resp != nil {
			t.Errorf("(nil,err) 기대, got resp=%v err=%v", resp, err)
		}
	})
}

func TestEmergencyRestore(t *testing.T) {
	t.Run("성공: mt_idx=1186·복구된 그룹·sgt_udate 설정·owner detail(sgdt_udate nil)·채팅 없음", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{}
		chat := &fakeGroupChat{}
		res, err := NewGroupWrite(repo, chat).EmergencyRestore()
		if err != nil {
			t.Fatalf("성공 기대, got err=%v", err)
		}
		if res.MtIdx == nil || *res.MtIdx != 1186 {
			t.Errorf("mt_idx=1186 기대, got %v", res.MtIdx)
		}
		if res.SgtTitle == nil || *res.SgtTitle != "복구된 그룹" {
			t.Errorf("title='복구된 그룹' 기대, got %v", res.SgtTitle)
		}
		if res.SgtShow == nil || *res.SgtShow != "Y" {
			t.Errorf("show='Y' 기대, got %v", res.SgtShow)
		}
		if res.SgtUdate == nil {
			t.Errorf("⚠️ emergency는 sgt_udate 설정(non-null) 기대")
		}
		if repo.createdDetail == nil || repo.createdDetail.SgdtOwnerChk == nil || *repo.createdDetail.SgdtOwnerChk != "Y" {
			t.Errorf("owner detail 생성 기대")
		}
		if repo.createdDetail != nil && repo.createdDetail.SgdtUdate != nil {
			t.Errorf("⚠️ emergency detail은 sgdt_udate 미설정(nil) 기대, got %v", repo.createdDetail.SgdtUdate)
		}
		if chat.createCalled {
			t.Errorf("⚠️ emergency는 채팅방 생성 없음")
		}
	})

	t.Run("그룹 INSERT 실패 → 에러(plain500)", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{createGroupErr: errors.New("boom")}
		_, err := NewGroupWrite(repo, &fakeGroupChat{}).EmergencyRestore()
		if err == nil {
			t.Errorf("에러 전파 기대")
		}
	})

	t.Run("⚠️ owner detail 실패는 best-effort 아님 → 에러(plain500)", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{createGroupDetailErr: errors.New("boom")}
		_, err := NewGroupWrite(repo, &fakeGroupChat{}).EmergencyRestore()
		if err == nil {
			t.Errorf("emergency의 detail 실패는 에러 전파 기대(create_group과 반대)")
		}
	})
}

func TestJoinNewMember(t *testing.T) {
	t.Run("그룹 없음 → JoinGroupNotFound", func(t *testing.T) {
		res, err := NewGroupWrite(&fakeGroupWriteRepo{group: nil}, &fakeGroupChat{}).JoinNewMember(3, 7)
		if err != nil || res.Outcome != JoinGroupNotFound {
			t.Errorf("JoinGroupNotFound 기대, got %v err=%v", res.Outcome, err)
		}
	})

	t.Run("숨김 그룹 → JoinGroupHidden", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3, SgtShow: pStr("N")}}
		res, err := NewGroupWrite(repo, &fakeGroupChat{}).JoinNewMember(3, 7)
		if err != nil || res.Outcome != JoinGroupHidden {
			t.Errorf("JoinGroupHidden 기대, got %v err=%v", res.Outcome, err)
		}
	})

	t.Run("회원 없음 → JoinMemberNotFound", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3, SgtShow: pStr("Y")}, memberExists: false}
		res, err := NewGroupWrite(repo, &fakeGroupChat{}).JoinNewMember(3, 7)
		if err != nil || res.Outcome != JoinMemberNotFound {
			t.Errorf("JoinMemberNotFound 기대, got %v err=%v", res.Outcome, err)
		}
	})

	t.Run("이미 가입(show=Y,exit=N) → JoinAlready", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{
			group: &model.Group{SgtIdx: 3, SgtShow: pStr("Y")}, memberExists: true,
			anyMem: &model.GroupDetail{SgdtIdx: 9, SgdtShow: pStr("Y"), SgdtExit: pStr("N")},
		}
		res, err := NewGroupWrite(repo, &fakeGroupChat{}).JoinNewMember(3, 7)
		if err != nil || res.Outcome != JoinAlready {
			t.Errorf("JoinAlready 기대, got %v err=%v", res.Outcome, err)
		}
	})

	t.Run("멤버십 있지만 exit=Y → 재가입(JoinReactivated, 채팅 없음)", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{
			group: &model.Group{SgtIdx: 3, SgtShow: pStr("Y")}, memberExists: true,
			anyMem: &model.GroupDetail{SgdtIdx: 9, SgdtShow: pStr("Y"), SgdtExit: pStr("Y"), SgdtOwnerChk: pStr("N"), SgdtLeaderChk: pStr("N")},
		}
		chat := &fakeGroupChat{}
		res, err := NewGroupWrite(repo, chat).JoinNewMember(3, 7)
		if err != nil || res.Outcome != JoinReactivated {
			t.Fatalf("JoinReactivated 기대, got %v err=%v", res.Outcome, err)
		}
		if !repo.reactivatedNew {
			t.Errorf("ReactivateMembershipNewMember 호출 기대")
		}
		if chat.addCalled {
			t.Errorf("join_new_member 재가입엔 채팅 추가 없음")
		}
		if res.Data.SgdtIdx != 9 {
			t.Errorf("data.sgdt_idx=9 기대, got %d", res.Data.SgdtIdx)
		}
	})

	t.Run("신규 가입 → JoinCreated(채팅 추가 없음)", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3, SgtShow: pStr("Y")}, memberExists: true, anyMem: nil}
		chat := &fakeGroupChat{}
		res, err := NewGroupWrite(repo, chat).JoinNewMember(3, 7)
		if err != nil || res.Outcome != JoinCreated {
			t.Fatalf("JoinCreated 기대, got %v err=%v", res.Outcome, err)
		}
		if repo.createdDetail == nil || *repo.createdDetail.SgdtOwnerChk != "N" {
			t.Errorf("신규 멤버 owner='N' 기대")
		}
		if chat.addCalled {
			t.Errorf("⚠️ join_new_member는 채팅 동기화 없음")
		}
	})

	t.Run("신규 INSERT 실패 → ErrCreateMembership", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3, SgtShow: pStr("Y")}, memberExists: true, anyMem: nil, createGroupDetailErr: errors.New("boom")}
		_, err := NewGroupWrite(repo, &fakeGroupChat{}).JoinNewMember(3, 7)
		if !errors.Is(err, ErrCreateMembership) {
			t.Errorf("ErrCreateMembership 기대, got %v", err)
		}
	})
}

func TestRemoveMember(t *testing.T) {
	t.Run("그룹 없음 → RemoveGroupNotFound", func(t *testing.T) {
		res, err := NewGroupWrite(&fakeGroupWriteRepo{group: nil}, &fakeGroupChat{}).RemoveMember(3, 7)
		if err != nil || res.Outcome != RemoveGroupNotFound {
			t.Errorf("RemoveGroupNotFound 기대, got %v err=%v", res.Outcome, err)
		}
	})

	t.Run("멤버십 없음 → RemoveMemberNotFound", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3}, visible: nil}
		res, err := NewGroupWrite(repo, &fakeGroupChat{}).RemoveMember(3, 7)
		if err != nil || res.Outcome != RemoveMemberNotFound {
			t.Errorf("RemoveMemberNotFound 기대, got %v err=%v", res.Outcome, err)
		}
	})

	t.Run("탈퇴 성공 → show='N',exit='Y',sgdt_udate 채움", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3}, visible: &model.GroupDetail{SgdtIdx: 42, SgdtShow: pStr("Y"), SgdtExit: pStr("N")}}
		res, err := NewGroupWrite(repo, &fakeGroupChat{}).RemoveMember(3, 7)
		if err != nil || res.Outcome != RemoveSuccess {
			t.Fatalf("RemoveSuccess 기대, got %v err=%v", res.Outcome, err)
		}
		if !repo.removed {
			t.Errorf("RemoveMembership 호출 기대")
		}
		if res.Data.SgdtIdx != 42 || res.Data.SgdtShow != "N" || res.Data.SgdtExit != "Y" || res.Data.SgdtUdate == "" {
			t.Errorf("data 불일치: %+v", res.Data)
		}
	})

	t.Run("Remove 오류 → (zero,err)=plain500", func(t *testing.T) {
		repo := &fakeGroupWriteRepo{group: &model.Group{SgtIdx: 3}, visible: &model.GroupDetail{SgdtIdx: 42}, removeErr: errors.New("boom")}
		_, err := NewGroupWrite(repo, &fakeGroupChat{}).RemoveMember(3, 7)
		if err == nil {
			t.Errorf("에러 전파 기대")
		}
	})
}
