package service

import (
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// groupWriteRepo는 GroupWriteService가 의존하는 그룹 write 데이터 접근 인터페이스.
// GetByID/FindByCode는 기존 read 메서드 재사용(GroupRepository가 모두 구현).
type groupWriteRepo interface {
	GetByID(id int) (*model.Group, error)
	FindByCode(code string) (*model.Group, error)
	MemberExists(mtIdx int) (bool, error)
	CodeExists(code string) (bool, error)
	CreateGroup(g *model.Group) error
	FindActiveMembership(sgtIdx, mtIdx int) (*model.GroupDetail, error)
	CreateGroupDetail(gd *model.GroupDetail) error
	ReactivateMembership(gd *model.GroupDetail, now time.Time) error
	// Phase 2 (update/restore/emergency/join-new/remove)
	SaveGroup(g *model.Group) error
	FindMembershipAny(sgtIdx, mtIdx int) (*model.GroupDetail, error)
	ReactivateMembershipNewMember(gd *model.GroupDetail, now time.Time) error
	FindVisibleMembership(sgtIdx, mtIdx int) (*model.GroupDetail, error)
	RemoveMembership(gd *model.GroupDetail, now time.Time) error
}

// groupChatWriter는 그룹 생성/가입 시 채팅방 동기화(Python chat_service)를 위한 인터페이스.
// ChatRepository가 구현하며, 호출 실패는 Python try/except처럼 best-effort로 무시된다.
type groupChatWriter interface {
	CreateGroupChatRoom(sgtIdx int, title *string, memberIDs []int, now time.Time) error
	AddMemberToGroupChat(sgtIdx, mtIdx int, now time.Time) error
}

// GroupWriteService는 Python `groups.py`의 write 핸들러를 이식한다.
// (Phase 1: create_group / join_group_by_code / join_group. read는 GroupService가 담당.)
type GroupWriteService struct {
	repo groupWriteRepo
	chat groupChatWriter
}

func NewGroupWrite(repo groupWriteRepo, chat groupChatWriter) *GroupWriteService {
	return &GroupWriteService{repo: repo, chat: chat}
}

// ErrCreateMembership은 신규 멤버십 INSERT 실패를 신호한다.
// Python join 핸들러의 try/except가 rollback 후 raise HTTPException(500, "그룹 가입 중...")하는 경로다.
// 그 외 에러(조회·재가입 commit 실패)는 Python에서 try 밖이라 미처리 500(plain)으로 매핑된다.
var ErrCreateMembership = errors.New("group: create membership failed")

// JoinOutcome은 join/join-by-code의 분기 결과다. 핸들러가 엔드포인트별 메시지로 매핑한다.
type JoinOutcome int

const (
	JoinGroupNotFound JoinOutcome = iota // 그룹 없음(404)
	JoinGroupHidden                      // sgt_show!='Y'(404, join_group 전용)
	JoinMemberNotFound                   // 회원 없음(404)
	JoinAlready                          // 이미 가입(400)
	JoinReactivated                      // 재가입 성공(200)
	JoinCreated                          // 신규 가입 성공(200)
)

// JoinResult는 가입 분기 결과 + 성공 시 응답 data를 담는다.
type JoinResult struct {
	Outcome JoinOutcome
	Data    dto.GroupJoinData
}

// strPtr은 리터럴 문자열의 포인터를 만든다(GroupDetail nullable 컬럼 세팅용).
func strPtr(s string) *string { return &s }

// CreateGroup은 Python create_group(groups.py:365)을 이식한다.
// sgt_code 자동생성·mt_idx=토큰값 강제·sgt_show 폴백('Y') 후 그룹을 INSERT하고,
// 그룹장 GroupDetail + 그룹채팅방을 best-effort로 만든다(Python try/except 동일: 실패해도 200).
// title/memo/show는 GroupCreate 본문의 잔존 필드(mt_idx·sgt_code는 무시되므로 받지 않는다).
func (s *GroupWriteService) CreateGroup(userID int, title, memo, show *string) (dto.GroupResponse, error) {
	code, err := s.generateSgtCode()
	if err != nil {
		return dto.GroupResponse{}, err
	}
	// Python datetime.utcnow() → DB DATETIME은 초 단위(마이크로초 버림). refresh 후 응답되므로
	// 초 단위로 절삭해 isoformat 바이트를 맞춘다(send_message·create_dm과 동일 방침).
	now := dbUTCNow().Truncate(time.Second)
	mtIdx := userID
	// sgt_show 폴백: None/빈문자열이면 'Y'(Python `if not group_data.get('sgt_show')`).
	sgtShow := "Y"
	if show != nil && *show != "" {
		sgtShow = *show
	}
	g := &model.Group{
		MtIdx:    &mtIdx,
		SgtTitle: title,
		SgtCode:  &code,
		SgtMemo:  memo,
		SgtShow:  &sgtShow,
		SgtWdate: &now,
		// sgt_udate는 Python에서 미설정 → NULL(JSON null).
	}
	if err := s.repo.CreateGroup(g); err != nil {
		// Python: db.add+commit이 try 밖 → 미처리 500(plain). 핸들러가 plainServerError로 매핑.
		return dto.GroupResponse{}, err
	}

	// 그룹장(owner) 등록. Python try/except: 실패 시 로그만 남기고 200 유지 → 에러 의도적 무시.
	gd := &model.GroupDetail{
		SgtIdx:        &g.SgtIdx,
		MtIdx:         &mtIdx,
		SgdtOwnerChk:  strPtr("Y"),
		SgdtLeaderChk: strPtr("N"),
		SgdtDischarge: strPtr("N"),
		SgdtGroupChk:  strPtr("Y"),
		SgdtExit:      strPtr("N"),
		SgdtShow:      strPtr("Y"),
		SgdtPushChk:   strPtr("Y"),
		SgdtWdate:     &now,
		SgdtUdate:     &now,
	}
	_ = s.repo.CreateGroupDetail(gd) // best-effort(Python except 로그+계속)

	// 채팅방 자동 생성. Python try/except 동일 best-effort(member_ids=[user_id]).
	_ = s.chat.CreateGroupChatRoom(g.SgtIdx, title, []int{userID}, now)

	return toGroupResponse(g), nil
}

// JoinByCode는 Python join_group_by_code(groups.py:167, POST /join)를 이식한다.
// 코드(대문자화)로 그룹 조회 → 회원 존재 확인 → 멤버십 분기(이미가입/재가입/신규).
func (s *GroupWriteService) JoinByCode(mtIdx int, code string) (JoinResult, error) {
	group, err := s.repo.FindByCode(strings.ToUpper(code))
	if err != nil {
		return JoinResult{}, err
	}
	if group == nil {
		return JoinResult{Outcome: JoinGroupNotFound}, nil
	}
	exists, err := s.repo.MemberExists(mtIdx)
	if err != nil {
		return JoinResult{}, err
	}
	if !exists {
		return JoinResult{Outcome: JoinMemberNotFound}, nil
	}
	return s.joinCommon(group.SgtIdx, mtIdx)
}

// Join은 Python join_group(groups.py:727, POST /{group_id}/join)을 이식한다.
// group_id로 그룹 조회 → sgt_show='Y' 확인 → 회원 존재 확인 → 멤버십 분기.
// (body의 sgt_idx는 받기만 하고 미사용 — 멤버십은 path group_id 기준.)
func (s *GroupWriteService) Join(groupID, mtIdx int) (JoinResult, error) {
	group, err := s.repo.GetByID(groupID)
	if err != nil {
		return JoinResult{}, err
	}
	if group == nil {
		return JoinResult{Outcome: JoinGroupNotFound}, nil
	}
	if group.SgtShow == nil || *group.SgtShow != "Y" {
		return JoinResult{Outcome: JoinGroupHidden}, nil
	}
	exists, err := s.repo.MemberExists(mtIdx)
	if err != nil {
		return JoinResult{}, err
	}
	if !exists {
		return JoinResult{Outcome: JoinMemberNotFound}, nil
	}
	return s.joinCommon(groupID, mtIdx)
}

// joinCommon은 두 join 엔드포인트의 공통 멤버십 처리다.
// 기존 활성 멤버십(sgdt_exit='N')이 있으면 show='Y'→이미가입(400) / 'N'→재가입,
// 없으면 신규 멤버십 생성 후 채팅방 멤버 추가(best-effort). 재가입엔 채팅 추가가 없다(Python 동일).
func (s *GroupWriteService) joinCommon(groupID, mtIdx int) (JoinResult, error) {
	existing, err := s.repo.FindActiveMembership(groupID, mtIdx)
	if err != nil {
		return JoinResult{}, err
	}
	now := dbUTCNow().Truncate(time.Second)

	if existing != nil {
		if existing.SgdtShow != nil && *existing.SgdtShow == "Y" {
			return JoinResult{Outcome: JoinAlready}, nil
		}
		// 재가입(Python: try 밖 → commit 실패 시 미처리 500/plain). 채팅 추가 없음.
		if err := s.repo.ReactivateMembership(existing, now); err != nil {
			return JoinResult{}, err
		}
		return JoinResult{Outcome: JoinReactivated, Data: dto.GroupJoinData{
			SgdtIdx:       existing.SgdtIdx,
			SgtIdx:        groupID,
			MtIdx:         mtIdx,
			SgdtOwnerChk:  existing.SgdtOwnerChk,
			SgdtLeaderChk: existing.SgdtLeaderChk,
			SgdtWdate:     pyISOUtcNow(existing.SgdtWdate),
		}}, nil
	}

	// 신규 멤버십(일반 멤버: owner='N', leader='N'). Python try/except → 실패 시 ErrCreateMembership.
	gd := &model.GroupDetail{
		SgtIdx:        &groupID,
		MtIdx:         &mtIdx,
		SgdtOwnerChk:  strPtr("N"),
		SgdtLeaderChk: strPtr("N"),
		SgdtDischarge: strPtr("N"),
		SgdtGroupChk:  strPtr("Y"),
		SgdtExit:      strPtr("N"),
		SgdtShow:      strPtr("Y"),
		SgdtPushChk:   strPtr("Y"),
		SgdtWdate:     &now,
		SgdtUdate:     &now,
	}
	if err := s.repo.CreateGroupDetail(gd); err != nil {
		return JoinResult{}, fmt.Errorf("%w: %v", ErrCreateMembership, err)
	}
	// 채팅방 멤버 자동 추가(Python 내부 try/except best-effort).
	_ = s.chat.AddMemberToGroupChat(groupID, mtIdx, now)

	return JoinResult{Outcome: JoinCreated, Data: dto.GroupJoinData{
		SgdtIdx:       gd.SgdtIdx,
		SgtIdx:        groupID,
		MtIdx:         mtIdx,
		SgdtOwnerChk:  gd.SgdtOwnerChk,
		SgdtLeaderChk: gd.SgdtLeaderChk,
		SgdtWdate:     pyISOUtcNow(gd.SgdtWdate),
	}}, nil
}

// --- Phase 2: update/restore/emergency/join-new-member/remove ---

// UpdateGroup은 Python update_group(groups.py:430, PUT /{group_id})을 이식한다.
// 반환 규약: (nil, nil)=그룹 없음(404), (nil, err)=DB 오류(핸들러가 prefix 500으로 매핑), (resp, nil)=200.
// sgt_show=='N'이면 소프트 삭제(다른 필드 무시·즉시 반환), 아니면 title/memo/code/mt_idx 중
// 제공된 것만 반영(sgt_show='Y'는 일반 업데이트에서 반영되지 않음 — Python 분기 그대로).
func (s *GroupWriteService) UpdateGroup(groupID int, mtIdx *int, title, code, memo, show *string) (*dto.GroupResponse, error) {
	g, err := s.repo.GetByID(groupID)
	if err != nil {
		return nil, err // Python: GetByID가 try 안 → except Exception → prefix 500
	}
	if g == nil {
		return nil, nil // 404 "Group not found"
	}
	now := dbUTCNow().Truncate(time.Second)

	// 소프트 삭제(group.soft_delete): sgt_show='N', sgt_udate=now 후 즉시 반환.
	if show != nil && *show == "N" {
		g.SgtShow = strPtr("N")
		g.SgtUdate = &now
		if err := s.repo.SaveGroup(g); err != nil {
			return nil, err
		}
		resp := toGroupResponse(g)
		return &resp, nil
	}

	// 일반 업데이트(Python 필드 순서: sgt_title, sgt_memo, sgt_code, mt_idx). 변경 있을 때만 udate+commit.
	updated := false
	if title != nil {
		g.SgtTitle = title
		updated = true
	}
	if memo != nil {
		g.SgtMemo = memo
		updated = true
	}
	if code != nil {
		g.SgtCode = code
		updated = true
	}
	if mtIdx != nil {
		g.MtIdx = mtIdx
		updated = true
	}
	if updated {
		g.SgtUdate = &now
		if err := s.repo.SaveGroup(g); err != nil {
			return nil, err
		}
	}
	resp := toGroupResponse(g)
	return &resp, nil
}

// RestoreGroup은 Python restore_group(groups.py:509, PUT /{group_id}/restore)을 이식한다.
// try/except 없음 → DB 오류는 미처리 500(plain). 반환: (nil,nil)=404, (nil,err)=plain500, (resp,nil)=200.
func (s *GroupWriteService) RestoreGroup(groupID int) (*dto.GroupResponse, error) {
	g, err := s.repo.GetByID(groupID)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, nil
	}
	now := dbUTCNow().Truncate(time.Second)
	g.SgtShow = strPtr("Y")
	g.SgtUdate = &now
	if err := s.repo.SaveGroup(g); err != nil {
		return nil, err
	}
	resp := toGroupResponse(g)
	return &resp, nil
}

// EmergencyRestore는 Python emergency_restore_group(groups.py:541, POST /emergency-restore)을 이식한다.
// 사용자 1186 전용 새 그룹 생성(Python 하드코딩). ⚠️ create_group과 차이:
//   - sgt_udate를 설정(non-null) / 그룹장 GroupDetail은 try/except 없음(실패 시 plain 500, best-effort 아님)
//   - sgdt_udate 미설정(NULL) / 채팅방 생성 없음.
func (s *GroupWriteService) EmergencyRestore() (dto.GroupResponse, error) {
	code, err := s.generateSgtCode()
	if err != nil {
		return dto.GroupResponse{}, err
	}
	now := dbUTCNow().Truncate(time.Second)
	mtIdx := 1186 // Python 하드코딩(emergency_restore_group: '복구된 그룹' for mt_idx 1186)
	g := &model.Group{
		MtIdx:    &mtIdx,
		SgtTitle: strPtr("복구된 그룹"),
		SgtCode:  &code,
		SgtMemo:  strPtr("삭제된 그룹 복구용"),
		SgtShow:  strPtr("Y"),
		SgtWdate: &now,
		SgtUdate: &now,
	}
	if err := s.repo.CreateGroup(g); err != nil {
		return dto.GroupResponse{}, err // Python: try 밖 → 미처리 500(plain)
	}
	gd := &model.GroupDetail{
		SgtIdx:        &g.SgtIdx,
		MtIdx:         &mtIdx,
		SgdtOwnerChk:  strPtr("Y"),
		SgdtLeaderChk: strPtr("N"),
		SgdtDischarge: strPtr("N"),
		SgdtGroupChk:  strPtr("Y"),
		SgdtExit:      strPtr("N"),
		SgdtShow:      strPtr("Y"),
		SgdtPushChk:   strPtr("Y"),
		SgdtWdate:     &now, // ⚠️ sgdt_udate는 설정하지 않음(Python emergency는 sgdt_wdate만)
	}
	if err := s.repo.CreateGroupDetail(gd); err != nil {
		return dto.GroupResponse{}, err // ⚠️ Python try/except 없음 → 미처리 500(plain)
	}
	return toGroupResponse(g), nil
}

// JoinNewMember는 Python join_new_member_to_group(groups.py:849, POST /{group_id}/join-new-member)을 이식한다.
// ⚠️ join_group(joinCommon)과의 차이:
//   - 기존 멤버십 조회에 sgdt_exit 필터 없음(FindMembershipAny)
//   - 이미 가입 판정 = sgdt_show=='Y' AND sgdt_exit=='N'(join_group은 show만)
//   - 재가입 시 sgdt_discharge도 'N'으로 리셋 / 채팅방 동기화 없음(전 분기 chat coupling 없음)
//   - 신규 가입 성공 메시지가 다름(핸들러에서 매핑).
func (s *GroupWriteService) JoinNewMember(groupID, mtIdx int) (JoinResult, error) {
	group, err := s.repo.GetByID(groupID)
	if err != nil {
		return JoinResult{}, err
	}
	if group == nil {
		return JoinResult{Outcome: JoinGroupNotFound}, nil
	}
	if group.SgtShow == nil || *group.SgtShow != "Y" {
		return JoinResult{Outcome: JoinGroupHidden}, nil
	}
	exists, err := s.repo.MemberExists(mtIdx)
	if err != nil {
		return JoinResult{}, err
	}
	if !exists {
		return JoinResult{Outcome: JoinMemberNotFound}, nil
	}
	existing, err := s.repo.FindMembershipAny(groupID, mtIdx)
	if err != nil {
		return JoinResult{}, err
	}
	now := dbUTCNow().Truncate(time.Second)

	if existing != nil {
		if existing.SgdtShow != nil && *existing.SgdtShow == "Y" &&
			existing.SgdtExit != nil && *existing.SgdtExit == "N" {
			return JoinResult{Outcome: JoinAlready}, nil
		}
		// 재가입(Python: try 밖 commit → 실패 시 미처리 500/plain). discharge도 리셋.
		if err := s.repo.ReactivateMembershipNewMember(existing, now); err != nil {
			return JoinResult{}, err
		}
		return JoinResult{Outcome: JoinReactivated, Data: dto.GroupJoinData{
			SgdtIdx:       existing.SgdtIdx,
			SgtIdx:        groupID,
			MtIdx:         mtIdx,
			SgdtOwnerChk:  existing.SgdtOwnerChk,
			SgdtLeaderChk: existing.SgdtLeaderChk,
			SgdtWdate:     pyISOUtcNow(existing.SgdtWdate),
		}}, nil
	}

	// 신규 멤버십(일반 멤버). 채팅 추가 없음. Python try/except → 실패 시 ErrCreateMembership(JSON 500).
	gd := &model.GroupDetail{
		SgtIdx:        &groupID,
		MtIdx:         &mtIdx,
		SgdtOwnerChk:  strPtr("N"),
		SgdtLeaderChk: strPtr("N"),
		SgdtDischarge: strPtr("N"),
		SgdtGroupChk:  strPtr("Y"),
		SgdtExit:      strPtr("N"),
		SgdtShow:      strPtr("Y"),
		SgdtPushChk:   strPtr("Y"),
		SgdtWdate:     &now,
		SgdtUdate:     &now,
	}
	if err := s.repo.CreateGroupDetail(gd); err != nil {
		return JoinResult{}, fmt.Errorf("%w: %v", ErrCreateMembership, err)
	}
	return JoinResult{Outcome: JoinCreated, Data: dto.GroupJoinData{
		SgdtIdx:       gd.SgdtIdx,
		SgtIdx:        groupID,
		MtIdx:         mtIdx,
		SgdtOwnerChk:  gd.SgdtOwnerChk,
		SgdtLeaderChk: gd.SgdtLeaderChk,
		SgdtWdate:     pyISOUtcNow(gd.SgdtWdate),
	}}, nil
}

// RemoveMemberOutcome은 remove_member의 분기 결과다.
type RemoveMemberOutcome int

const (
	RemoveGroupNotFound  RemoveMemberOutcome = iota // 그룹 없음(404 "그룹을 찾을 수 없습니다.")
	RemoveMemberNotFound                            // 멤버십 없음(404 "멤버를 그룹에서 찾을 수 없습니다.")
	RemoveSuccess                                   // 탈퇴 성공(200)
)

// RemoveMemberResult는 멤버 탈퇴 분기 결과 + 성공 시 응답 data를 담는다.
type RemoveMemberResult struct {
	Outcome RemoveMemberOutcome
	Data    dto.MemberRemoveData
}

// RemoveMember는 Python remove_member_from_group(groups.py:994, PUT /{group_id}/members/{member_id}/remove)을 이식한다.
// try/except 없음 → DB 오류는 미처리 500(plain). 멤버십 소프트 탈퇴(show='N', exit='Y').
// ⚠️ remove_data(body)의 sgdt_show/sgdt_exit는 무시되고 항상 'N'/'Y' 고정. ⚠️ 채팅 동기화 호출 없음.
func (s *GroupWriteService) RemoveMember(groupID, memberID int) (RemoveMemberResult, error) {
	group, err := s.repo.GetByID(groupID)
	if err != nil {
		return RemoveMemberResult{}, err
	}
	if group == nil {
		return RemoveMemberResult{Outcome: RemoveGroupNotFound}, nil
	}
	gd, err := s.repo.FindVisibleMembership(groupID, memberID)
	if err != nil {
		return RemoveMemberResult{}, err
	}
	if gd == nil {
		return RemoveMemberResult{Outcome: RemoveMemberNotFound}, nil
	}
	now := dbUTCNow().Truncate(time.Second)
	if err := s.repo.RemoveMembership(gd, now); err != nil {
		return RemoveMemberResult{}, err
	}
	return RemoveMemberResult{Outcome: RemoveSuccess, Data: dto.MemberRemoveData{
		SgdtIdx:   gd.SgdtIdx,
		SgdtShow:  "N",
		SgdtExit:  "Y",
		SgdtUdate: pyISO(now),
	}}, nil
}

// generateSgtCode는 Python generate_sgt_code(groups.py:344)와 동일 알고리즘이다:
// "G" + MD5(랜덤 정수[1..999999999] 문자열).hexdigest().upper()의 첫 5자.
// 중복(sgt_show 무관)이면 재시도. 랜덤값이 호출마다 달라 코드 자체의 byte-동등은 불가(알고리즘만 일치).
func (s *GroupWriteService) generateSgtCode() (string, error) {
	for {
		n := rand.Intn(999999999) + 1 // Python random.randint(1, 999999999)
		sum := md5.Sum([]byte(strconv.Itoa(n)))
		uid := "G" + strings.ToUpper(hex.EncodeToString(sum[:]))[:5]
		exists, err := s.repo.CodeExists(uid)
		if err != nil {
			return "", err
		}
		if !exists {
			return uid, nil
		}
	}
}
