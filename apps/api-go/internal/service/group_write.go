package service

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"log/slog"
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
	CreateGroupDetail(gd *model.GroupDetail) error
	ReactivateMembership(gd *model.GroupDetail, now time.Time) error
	// Phase 2 (update/restore/emergency/join-new/remove)
	SaveGroup(g *model.Group) error
	FindMembershipAny(sgtIdx, mtIdx int) (*model.GroupDetail, error)
	ReactivateMembershipNewMember(gd *model.GroupDetail, now time.Time) error
	FindVisibleMembership(sgtIdx, mtIdx int) (*model.GroupDetail, error)
	RemoveMembership(gd *model.GroupDetail, now time.Time) error
	// G7 — 권한·상태값 규약(repository/group_policy.go)
	FindMembershipRows(sgtIdx, mtIdx int) ([]model.GroupDetail, error)
	RejoinMembership(gd *model.GroupDetail, now time.Time) error
	KickMembership(sgtIdx, mtIdx int, now time.Time) error
	LeaveMembership(sgtIdx, mtIdx int, now time.Time) error
	FindCurrentMembership(sgtIdx, mtIdx int) (*model.GroupDetail, error)
	TransferOwnership(g *model.Group, newOwner int, now time.Time) error
	// 그룹장 판정(현재 멤버 + owner_chk 또는 생성자, repository/group_authz.go와 같은 기준) — 그룹장 탈퇴 거부에 쓴다.
	IsGroupOwner(sgtIdx, mtIdx int) (bool, error)
}

// groupChatWriter는 그룹 생성/가입/탈퇴/삭제 시 채팅방 동기화를 위한 인터페이스.
// Create/Add는 ChatRepository, Deactivate*는 ChatService(캐시 무효화 포함)가 맡고 GroupChatSync가 둘을 묶는다.
// 생성/가입의 호출 실패는 Python try/except처럼 best-effort, 비활성화(탈퇴·강퇴·삭제) 실패는 ERROR 로그로 표면화한다.
type groupChatWriter interface {
	CreateGroupChatRoom(sgtIdx int, title *string, memberIDs []int, now time.Time) error
	AddMemberToGroupChat(sgtIdx, mtIdx int, now time.Time) error
	// DeactivateChatMembership는 탈퇴·강퇴된 회원의 그룹 채팅 참가를 끈다(C-1).
	DeactivateChatMembership(ctx context.Context, sgtIdx, mtIdx int) error
	// DeactivateGroupChat는 삭제된 그룹 채팅방의 모든 참가를 끈다(C-1).
	DeactivateGroupChat(ctx context.Context, sgtIdx int) error
}

// chatSyncTimeout은 그룹 변경 직후 채팅 동기화 호출 한 건의 최대 대기 시간이다.
const chatSyncTimeout = 5 * time.Second

// syncChatAfterGroupChange는 그룹 상태 변경(DB 커밋) 뒤 채팅 동기화를 수행하고, 실패하면 ERROR로 표면화한다.
// 호출자(탈퇴·강퇴·삭제·재가입)는 이미 그룹 변경을 커밋한 뒤라 채팅 실패로 요청을 실패시키면 재시도가 404가 되어
// 오히려 복구가 막힌다. 놓친 비활성화는 채팅 조회·전송·소켓 수신이 그룹 현재 멤버를 직접 확인하므로 접근 권한에 영향이 없다.
func syncChatAfterGroupChange(op string, sgtIdx, mtIdx int, fn func(ctx context.Context) error) {
	ctx, cancel := context.WithTimeout(context.Background(), chatSyncTimeout)
	defer cancel()
	if err := fn(ctx); err != nil {
		slog.Error("group_chat_sync_failed", slog.String("op", op), slog.Int("sgt_idx", sgtIdx), slog.Int("mt_idx", mtIdx), slog.Any("error", err))
	}
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

// 그룹 권한(G7) 거부 사유 — 핸들러가 400으로 매핑한다.
var (
	// ErrOwnerCannotLeave: 그룹장 행은 승계 없이 제거(탈퇴·강퇴)할 수 없다. 먼저 PUT /groups/:id의 mt_idx로 그룹장을 넘겨야 한다.
	ErrOwnerCannotLeave = errors.New("group: owner cannot be removed without succession")
	// ErrNewOwnerNotMember: 그룹장 변경 대상이 그 그룹의 현재 멤버가 아니다.
	ErrNewOwnerNotMember = errors.New("group: new owner is not a current member")
	// ErrInvalidGroupCode: 소유자가 바꾸려는 초대 코드가 형식(10자 대문자/숫자)에 맞지 않는다.
	ErrInvalidGroupCode = errors.New("group: invalid invite code format")
	// ErrGroupCodeTaken: 바꾸려는 초대 코드가 이미 다른 그룹에서 쓰인다.
	ErrGroupCodeTaken = errors.New("group: invite code already in use")
)

// JoinOutcome은 join/join-by-code의 분기 결과다. 핸들러가 엔드포인트별 메시지로 매핑한다.
type JoinOutcome int

const (
	JoinGroupNotFound  JoinOutcome = iota // 그룹 없음(404)
	JoinGroupHidden                       // sgt_show!='Y'(404, join_group 전용)
	JoinMemberNotFound                    // 회원 없음(404)
	JoinAlready                           // 이미 가입(400)
	JoinReactivated                       // 재가입 성공(200)
	JoinCreated                           // 신규 가입 성공(200)
	JoinKicked                            // 강퇴 이력이 있어 재가입 거부(403)
	JoinCodeRequired                      // REQUIRE_GROUP_INVITE_CODE로 코드 없는 가입 거부(403)
	JoinCodeMismatch                      // 제출한 초대 코드가 그룹 코드와 다름(403)
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
// group_id로 그룹 조회 → sgt_show='Y' 확인 → 초대 코드 확인 → 회원 존재 확인 → 멤버십 분기.
// 초대 코드(G7): 요청에 코드가 있으면 항상 그룹 코드와 대조한다. 코드가 없으면 requireCode(REQUIRE_GROUP_INVITE_CODE)일 때만 거부 —
// 구버전 앱은 코드 조회 후 그룹 번호만으로 가입한다. (body의 sgt_idx는 받기만 하고 미사용 — 멤버십은 path group_id 기준.)
func (s *GroupWriteService) Join(groupID, mtIdx int, code string, requireCode bool) (JoinResult, error) {
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
	if code = NormalizeGroupCode(code); code != "" {
		if group.SgtCode == nil || subtle.ConstantTimeCompare([]byte(code), []byte(NormalizeGroupCode(*group.SgtCode))) != 1 {
			return JoinResult{Outcome: JoinCodeMismatch}, nil
		}
	} else if requireCode {
		return JoinResult{Outcome: JoinCodeRequired}, nil
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
// 없으면 신규 멤버십 생성 후 채팅방 멤버 추가(best-effort). 재가입은 탈퇴 때 끈 채팅 참가를 되살린다(Python엔 없던 동작 —
// 탈퇴 시 채팅을 비활성화하게 되면서 필요해졌다).
func (s *GroupWriteService) joinCommon(groupID, mtIdx int) (JoinResult, error) {
	rows, err := s.repo.FindMembershipRows(groupID, mtIdx)
	if err != nil {
		return JoinResult{}, err
	}
	// 강퇴 이력(discharge='Y')이 하나라도 있으면 재가입 거부. 자진 탈퇴(exit='Y', discharge='N')는 허용한다.
	for i := range rows {
		if rows[i].SgdtDischarge != nil && *rows[i].SgdtDischarge == "Y" {
			return JoinResult{Outcome: JoinKicked}, nil
		}
	}
	// 이미 활성 멤버십(exit='N' AND show='Y')이 있으면 이미 가입.
	for i := range rows {
		if rows[i].SgdtExit != nil && *rows[i].SgdtExit == "N" && rows[i].SgdtShow != nil && *rows[i].SgdtShow == "Y" {
			return JoinResult{Outcome: JoinAlready}, nil
		}
	}
	var existing *model.GroupDetail
	if len(rows) > 0 {
		existing = &rows[len(rows)-1] // 중복 행이 있으면 가장 최근 행을 되살린다
	}
	now := dbUTCNow().Truncate(time.Second)

	if existing != nil {
		// 재가입(Python: try 밖 → commit 실패 시 미처리 500/plain). 채팅 추가 없음.
		// 자진 탈퇴(exit='Y') 후 재가입은 나가기 전 권한(그룹장·리더)을 되살리지 않는다. 탈퇴하지 않고 숨김(show='N')만 된
		// 행은 기존대로 권한을 보존한다.
		if existing.SgdtExit != nil && *existing.SgdtExit == "Y" {
			err = s.repo.RejoinMembership(existing, now)
			n, l := "N", "N"
			existing.SgdtOwnerChk, existing.SgdtLeaderChk = &n, &l
		} else {
			err = s.repo.ReactivateMembership(existing, now)
		}
		if err != nil {
			return JoinResult{}, err
		}
		// 탈퇴·강퇴 때 끈 채팅 참가를 되살린다(AddMemberToGroupChat은 scm_show='N' 행을 복구한다).
		s.restoreChatMember(groupID, mtIdx, now)
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
		// 삭제된 그룹의 채팅방 참가를 모두 끈다(C-1). 삭제는 이미 커밋됐으므로 실패는 ERROR 로그로 표면화한다.
		syncChatAfterGroupChange("deactivate_group_chat", g.SgtIdx, 0, func(ctx context.Context) error {
			return s.chat.DeactivateGroupChat(ctx, g.SgtIdx)
		})
		resp := toGroupResponse(g)
		return &resp, nil
	}

	// 일반 업데이트(Python 필드 순서: sgt_title, sgt_memo, sgt_code, mt_idx). 변경 있을 때만 udate+commit.
	// 먼저 검증을 끝낸 뒤에 값을 바꾼다 — 거부되면 아무것도 저장하지 않는다.
	var newCode *string
	if code != nil && !(g.SgtCode != nil && NormalizeGroupCode(*g.SgtCode) == NormalizeGroupCode(*code)) {
		// 코드를 바꾸는 요청: 형식(10자 대문자/숫자)과 중복을 확인한다. 같은 값을 다시 보내는 것은 변경으로 보지 않는다.
		c := NormalizeGroupCode(*code)
		if !validGroupCodeFormat(c) {
			return nil, ErrInvalidGroupCode
		}
		taken, err := s.repo.CodeExists(c)
		if err != nil {
			return nil, err
		}
		if taken {
			return nil, ErrGroupCodeTaken
		}
		newCode = &c
	}
	transferTo := 0
	if mtIdx != nil && !(g.MtIdx != nil && *g.MtIdx == *mtIdx) {
		// 그룹장 변경: 새 그룹장은 그 그룹의 현재 멤버여야 한다. 트랜잭션으로 그룹 행과 두 멤버십 행을 함께 바꾼다.
		cur, err := s.repo.FindCurrentMembership(g.SgtIdx, *mtIdx)
		if err != nil {
			return nil, err
		}
		if cur == nil {
			return nil, ErrNewOwnerNotMember
		}
		transferTo = *mtIdx
	}
	updated := false
	if title != nil {
		g.SgtTitle = title
		updated = true
	}
	if memo != nil {
		g.SgtMemo = memo
		updated = true
	}
	if newCode != nil {
		g.SgtCode = newCode
		updated = true
	}
	if transferTo != 0 {
		if err := s.repo.TransferOwnership(g, transferTo, now); err != nil {
			return nil, err
		}
		g.MtIdx = &transferTo
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
		s.restoreChatMember(groupID, mtIdx, now)
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
// try/except 없음 → DB 오류는 미처리 500(plain). 멤버십 소프트 제거.
// G7: kind가 자진 탈퇴(RemovalLeave)면 (show='N', exit='Y'), 강퇴(RemovalKick)면 추가로 discharge='Y'를 기록한다.
// 그룹장 행은 승계 없이 제거할 수 없다(ErrOwnerCannotLeave).
// ⚠️ remove_data(body)의 sgdt_show/sgdt_exit는 무시되고 항상 'N'/'Y' 고정. ⚠️ 채팅 동기화 호출 없음.
func (s *GroupWriteService) RemoveMember(groupID, memberID int, kind RemovalKind) (RemoveMemberResult, error) {
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
	if gd.SgdtOwnerChk != nil && *gd.SgdtOwnerChk == "Y" {
		return RemoveMemberResult{}, ErrOwnerCannotLeave
	}
	// owner_chk 없이 생성자로만 그룹장인 구 데이터도 승계 없이 나갈 수 없다(그룹장 판정과 같은 기준).
	if isOwner, oerr := s.repo.IsGroupOwner(groupID, memberID); oerr != nil {
		return RemoveMemberResult{}, oerr
	} else if isOwner {
		return RemoveMemberResult{}, ErrOwnerCannotLeave
	}
	now := dbUTCNow().Truncate(time.Second)
	if kind == RemovalKick {
		err = s.repo.KickMembership(groupID, memberID, now)
	} else {
		err = s.repo.LeaveMembership(groupID, memberID, now)
	}
	if err != nil {
		return RemoveMemberResult{}, err
	}
	// 탈퇴·강퇴 직후 채팅 참가를 끈다(C-1). 멤버십 변경은 이미 커밋됐으므로 실패는 ERROR 로그로 표면화한다.
	syncChatAfterGroupChange("deactivate_chat_membership", groupID, memberID, func(ctx context.Context) error {
		return s.chat.DeactivateChatMembership(ctx, groupID, memberID)
	})
	return RemoveMemberResult{Outcome: RemoveSuccess, Data: dto.MemberRemoveData{
		SgdtIdx:   gd.SgdtIdx,
		SgdtShow:  "N",
		SgdtExit:  "Y",
		SgdtUdate: pyISO(now),
	}}, nil
}

// restoreChatMember는 재가입한 회원의 그룹 채팅 참가를 되살린다. 실패는 ERROR로 표면화하되 재가입은 유지한다.
func (s *GroupWriteService) restoreChatMember(groupID, mtIdx int, now time.Time) {
	syncChatAfterGroupChange("restore_chat_membership", groupID, mtIdx, func(context.Context) error {
		return s.chat.AddMemberToGroupChat(groupID, mtIdx, now)
	})
}

// generateSgtCode는 새 그룹의 초대 코드를 만든다. G7: Python 알고리즘("G"+MD5 5자)을 버리고 CSPRNG 10자
// (service/group_code.go). 중복(sgt_show 무관)이면 재시도한다. 기존 그룹의 코드는 바꾸지 않는다.
func (s *GroupWriteService) generateSgtCode() (string, error) {
	for {
		uid, err := newGroupCode()
		if err != nil {
			return "", err
		}
		exists, err := s.repo.CodeExists(uid)
		if err != nil {
			return "", err
		}
		if !exists {
			return uid, nil
		}
	}
}
