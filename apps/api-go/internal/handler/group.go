package handler

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/service"
)

type GroupHandler struct {
	svc  *service.GroupService
	wsvc *service.GroupWriteService
	cfg  *config.Config
}

func NewGroup(svc *service.GroupService, wsvc *service.GroupWriteService, cfg *config.Config) *GroupHandler {
	return &GroupHandler{svc: svc, wsvc: wsvc, cfg: cfg}
}

// msgStringType은 Pydantic v2 문자열 필드 타입 오류 메시지다(int/숫자를 str 필드에 넣는 등).
const msgStringType = "Input should be a valid string"

// coerceJSONString은 JSON 값이 문자열일 때만 통과시킨다(Pydantic v2 lax: int→str 미강제).
func coerceJSONString(v interface{}) (string, bool) {
	if s, ok := v.(string); ok {
		return s, true
	}
	return "", false
}

// requireUserID는 Python deps.get_required_user_id를 적용한다.
// 유효 토큰이 없으면 401 detail "인증이 필요합니다." + WWW-Authenticate: Bearer 응답 후 (0, false).
func (h *GroupHandler) requireUserID(c *gin.Context) (int, bool) {
	uid, ok := auth.ParseOptionalUserID(c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		c.Header("WWW-Authenticate", "Bearer")
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return 0, false
	}
	return uid, true
}

// Hidden은 GET /api/v1/groups/hidden — 숨김 그룹(sgt_show='N') 목록. 무인증.
func (h *GroupHandler) Hidden(c *gin.Context) {
	res, err := h.svc.HiddenGroups()
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Get은 GET /api/v1/groups/:group_id — sgt_show 무관 단건 조회. 없으면 404 "Group not found".
// path 정수 검증 실패 시 공유 pathIntErr(notice.go)로 FastAPI 동형 422를 응답한다.
func (h *GroupHandler) Get(c *gin.Context) {
	idStr := c.Param("group_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_id", idStr)
		return
	}
	res, err := h.svc.GetGroup(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	if res == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Group not found"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Public은 GET /api/v1/groups/:group_id/public. ⚠️ Python 동작 그대로 이식:
// 없으면 404 "그룹을 찾을 수 없습니다.", 숨김이면 404 "존재하지 않는 그룹입니다.",
// 활성이면 sgt_content 미매핑 AttributeError로 500(plain text).
func (h *GroupHandler) Public(c *gin.Context) {
	idStr := c.Param("group_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_id", idStr)
		return
	}
	found, shown, err := h.svc.GroupShow(id)
	if err != nil {
		plainServerError(c) // Python try/except 없음 → 미처리 500
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "그룹을 찾을 수 없습니다."})
		return
	}
	if !shown {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "존재하지 않는 그룹입니다."})
		return
	}
	plainServerError(c) // 활성 그룹 → sgt_content AttributeError → 500
}

// List는 GET /api/v1/groups/ — skip(default 0)/limit(default 10000)/show_hidden(default false).
// Python get_groups는 skip/limit에 ge/le 제약이 없으므로 범위 검증도 하지 않는다.
func (h *GroupHandler) List(c *gin.Context) {
	errs := make([]valErr, 0)
	skip := parseIntQuery(c, &errs, "skip", 0, false, 0, false, 0)
	limit := parseIntQuery(c, &errs, "limit", 10000, false, 0, false, 0)
	showHidden := parseBoolQuery(c, &errs, "show_hidden", false)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.svc.ListGroups(skip, limit, showHidden)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Member는 GET /api/v1/groups/member/:member_id — 멤버가 속한 그룹 목록.
func (h *GroupHandler) Member(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	res, err := h.svc.MemberGroups(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// ByCode는 GET /api/v1/groups/code/:code — 코드로 단건 조회. 없으면 404 "Group not found".
func (h *GroupHandler) ByCode(c *gin.Context) {
	code := c.Param("code")
	res, err := h.svc.GroupByCode(code)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	if res == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Group not found"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// CurrentUserSummary는 GET /api/v1/groups/current-user/summary (Python get_current_user_group_summary).
// get_required_user_id: 미인증 시 401 detail "인증이 필요합니다."(마침표 포함). 무파라미터.
func (h *GroupHandler) CurrentUserSummary(c *gin.Context) {
	uid, ok := auth.ParseOptionalUserID(c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return
	}
	res, err := h.svc.CurrentUserGroupSummary(uid)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// CurrentUser는 GET /api/v1/groups/current-user (Python get_current_user_groups).
// get_required_user_id: 미인증 시 401 "인증이 필요합니다."(마침표). List[dict] 반환.
func (h *GroupHandler) CurrentUser(c *gin.Context) {
	uid, ok := auth.ParseOptionalUserID(c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return
	}
	res, err := h.svc.CurrentUserGroups(uid)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Stats는 GET /api/v1/groups/:group_id/stats (Python get_group_stats, groups.py:587 활성 라우트). 무인증.
// Python은 핸들러 전체가 try로 감싸였으나 `except HTTPException: raise` 가드가 있어(groups.py:720)
// 그룹 미발견 시 raise HTTPException(404, "Group not found")가 그대로 404로 재전파된다(500 재포장 아님).
// DB 등 일반 예외만 `except Exception`이 잡아 500 detail "그룹 통계 조회 중 오류가 발생했습니다: <str(e)>".
// 7일 창은 datetime.now() 기준이라 시각 의존(비결정적).
func (h *GroupHandler) Stats(c *gin.Context) {
	idStr := c.Param("group_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_id", idStr)
		return
	}
	// 그룹 존재 확인(sgt_show 무관 단건). 미발견 → 404 "Group not found"(except HTTPException:raise).
	grp, err := h.svc.GetGroup(id)
	if err != nil {
		// DB 오류 → except Exception → 500(Python 메시지 형식: 접두 "그룹 통계 조회 중...").
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "그룹 통계 조회 중 오류가 발생했습니다: Internal Server Error"})
		return
	}
	if grp == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Group not found"})
		return
	}
	end := time.Now()
	start := end.Add(-7 * 24 * time.Hour)
	res, err := h.svc.GroupStats(id, grp.SgtTitle, start, end)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "그룹 통계 조회 중 오류가 발생했습니다: Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// --- write 핸들러 (Phase 1: create/join 3종, 모두 get_required_user_id 인증 필수) ---

// Create는 POST /api/v1/groups/ (Python create_group). 검증 순서: 인증 401 → body 422.
// body GroupCreate(전 필드 optional): mt_idx/sgt_code는 서버가 강제하므로 무시(타입 검증만), sgt_show 폴백 'Y'.
// 그룹 INSERT 실패는 Python try 밖이라 미처리 500(plain), 그룹장/채팅방은 best-effort(실패해도 200).
func (h *GroupHandler) Create(c *gin.Context) {
	uid, ok := h.requireUserID(c)
	if !ok {
		return
	}
	title, memo, show, errs := parseGroupCreateBody(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.wsvc.CreateGroup(uid, title, memo, show)
	if err != nil {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// JoinByCode는 POST /api/v1/groups/join (Python join_group_by_code). 검증: 인증 401 → body 422.
func (h *GroupHandler) JoinByCode(c *gin.Context) {
	if _, ok := h.requireUserID(c); !ok {
		return
	}
	mtIdx, code, errs := parseJoinByCodeBody(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.wsvc.JoinByCode(mtIdx, code)
	if err != nil {
		h.writeJoinError(c, err)
		return
	}
	h.writeJoinResult(c, res, joinMessages{
		groupNotFound:  "유효하지 않은 초대 코드입니다.",
		memberNotFound: "사용자를 찾을 수 없습니다.",
		already:        "이미 이 그룹에 가입되어 있습니다.",
		reactivated:    "그룹에 성공적으로 재가입되었습니다.",
		created:        "그룹에 성공적으로 가입되었습니다.",
	})
}

// Join은 POST /api/v1/groups/:group_id/join (Python join_group).
// 검증 순서: 인증 401(sub-dependency가 먼저 풀려 short-circuit) → 통과 후 path·body 검증 오류를
// 한 422 배열로 수집(FastAPI는 모든 요청부의 오류를 모음; loc 순서는 path 먼저, body 뒤).
// body sgt_idx는 받기만 하고(필수 검증) 가입 로직엔 미사용.
func (h *GroupHandler) Join(c *gin.Context) {
	if _, ok := h.requireUserID(c); !ok {
		return
	}
	var errs []valErr
	idStr := c.Param("group_id")
	groupID, perr := strconv.Atoi(idStr)
	if perr != nil {
		errs = append(errs, valErr{Type: "int_parsing", Loc: []string{"path", "group_id"}, Msg: msgIntParse, Input: idStr})
	}
	mtIdx, _, berrs := parseJoinBody(c) // sgt_idx는 검증만(필수), 가입 로직 미사용
	errs = append(errs, berrs...)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.wsvc.Join(groupID, mtIdx)
	if err != nil {
		h.writeJoinError(c, err)
		return
	}
	h.writeJoinResult(c, res, joinMessages{
		groupNotFound:  "그룹을 찾을 수 없습니다.",
		groupHidden:    "존재하지 않는 그룹입니다.",
		memberNotFound: "사용자를 찾을 수 없습니다.",
		already:        "이미 그룹에 가입되어 있습니다.",
		reactivated:    "그룹에 성공적으로 재가입되었습니다.",
		created:        "그룹에 성공적으로 가입되었습니다.",
	})
}

// joinMessages는 세 join 엔드포인트의 분기별 메시지(엔드포인트마다 문구가 다름).
// 성공 메시지(reactivated/created)도 엔드포인트별로 다르므로 포함한다
// (join_new_member의 created는 "새 회원이 그룹에..."로 다름).
type joinMessages struct {
	groupNotFound  string
	groupHidden    string // join-by-code엔 미사용(find_by_code가 sgt_show 필터)
	memberNotFound string
	already        string
	reactivated    string
	created        string
}

// writeJoinResult는 JoinResult를 HTTP 응답으로 매핑한다(메시지는 joinMessages로 주입).
func (h *GroupHandler) writeJoinResult(c *gin.Context, res service.JoinResult, m joinMessages) {
	switch res.Outcome {
	case service.JoinGroupNotFound:
		writeJSON(c, http.StatusNotFound, gin.H{"detail": m.groupNotFound})
	case service.JoinGroupHidden:
		writeJSON(c, http.StatusNotFound, gin.H{"detail": m.groupHidden})
	case service.JoinMemberNotFound:
		writeJSON(c, http.StatusNotFound, gin.H{"detail": m.memberNotFound})
	case service.JoinAlready:
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": m.already})
	case service.JoinReactivated:
		writeJSON(c, http.StatusOK, dto.GroupJoinResponse{
			Success: true, Message: m.reactivated, Data: res.Data})
	case service.JoinCreated:
		writeJSON(c, http.StatusOK, dto.GroupJoinResponse{
			Success: true, Message: m.created, Data: res.Data})
	}
}

// writeJoinError는 가입 중 에러를 Python의 두 500 경로로 구분 매핑한다.
//   - ErrCreateMembership(신규 멤버십 INSERT 실패): JSON 500 "그룹 가입 중 오류가 발생했습니다."
//   - 그 외(조회·재가입 commit 실패): Python try 밖 → 미처리 500(plain).
func (h *GroupHandler) writeJoinError(c *gin.Context, err error) {
	if errors.Is(err, service.ErrCreateMembership) {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "그룹 가입 중 오류가 발생했습니다."})
		return
	}
	plainServerError(c)
}

// --- Phase 2 핸들러(전부 무인증): update/restore/emergency-restore/join-new-member/remove ---

// Update는 PUT /api/v1/groups/:group_id (Python update_group). 무인증.
// FastAPI는 인증 의존성이 없어 path(group_id)+body(GroupUpdate) 검증 오류를 한 422로 수집(번들링).
// sgt_show='N'이면 소프트 삭제. DB 오류는 prefix 500("그룹 업데이트 중 오류가 발생했습니다: {err}").
func (h *GroupHandler) Update(c *gin.Context) {
	var errs []valErr
	idStr := c.Param("group_id")
	groupID, perr := strconv.Atoi(idStr)
	if perr != nil {
		errs = append(errs, valErr{Type: "int_parsing", Loc: []string{"path", "group_id"}, Msg: msgIntParse, Input: idStr})
	}
	mtIdx, title, code, memo, show, berrs := parseGroupUpdateBody(c)
	errs = append(errs, berrs...)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, err := h.wsvc.UpdateGroup(groupID, mtIdx, title, code, memo, show)
	if err != nil {
		// Python except Exception → 500 detail에 str(e) 포함. ⚠️GORM 에러 텍스트는 SQLAlchemy와 달라
		// 이 경로(DB 장애)는 본질적으로 byte-동등 불가(상태코드·prefix만 일치).
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "그룹 업데이트 중 오류가 발생했습니다: " + err.Error()})
		return
	}
	if resp == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Group not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Restore는 PUT /api/v1/groups/:group_id/restore (Python restore_group). 무인증, body 없음.
// try/except 없음 → DB 오류는 plain 500. path(int)만 검증.
func (h *GroupHandler) Restore(c *gin.Context) {
	idStr := c.Param("group_id")
	groupID, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_id", idStr)
		return
	}
	resp, serr := h.wsvc.RestoreGroup(groupID)
	if serr != nil {
		plainServerError(c)
		return
	}
	if resp == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Group not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// EmergencyRestore는 POST /api/v1/groups/emergency-restore (Python emergency_restore_group).
// 무인증, path·body 없음. 사용자 1186용 새 그룹을 생성(try/except 없음 → 실패 시 plain 500).
func (h *GroupHandler) EmergencyRestore(c *gin.Context) {
	resp, err := h.wsvc.EmergencyRestore()
	if err != nil {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// JoinNewMember는 POST /api/v1/groups/:group_id/join-new-member (Python join_new_member_to_group). 무인증.
// path(group_id)+body(GroupJoinRequest) 번들 검증 후 가입 분기. 채팅 동기화 없음, created 메시지가 다름.
func (h *GroupHandler) JoinNewMember(c *gin.Context) {
	var errs []valErr
	idStr := c.Param("group_id")
	groupID, perr := strconv.Atoi(idStr)
	if perr != nil {
		errs = append(errs, valErr{Type: "int_parsing", Loc: []string{"path", "group_id"}, Msg: msgIntParse, Input: idStr})
	}
	mtIdx, _, berrs := parseJoinBody(c) // GroupJoinRequest{mt_idx,sgt_idx}; sgt_idx는 검증만
	errs = append(errs, berrs...)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.wsvc.JoinNewMember(groupID, mtIdx)
	if err != nil {
		h.writeJoinError(c, err)
		return
	}
	h.writeJoinResult(c, res, joinMessages{
		groupNotFound:  "그룹을 찾을 수 없습니다.",
		groupHidden:    "존재하지 않는 그룹입니다.",
		memberNotFound: "사용자를 찾을 수 없습니다.",
		already:        "이미 그룹에 가입되어 있습니다.",
		reactivated:    "그룹에 성공적으로 재가입되었습니다.",
		created:        "새 회원이 그룹에 성공적으로 가입되었습니다.",
	})
}

// RemoveMember는 PUT /api/v1/groups/:group_id/members/:member_id/remove (Python remove_member_from_group).
// 무인증. path(group_id, member_id)+body(MemberRemoveRequest) 번들 검증. body 값은 무시(항상 N/Y 탈퇴).
// try/except 없음 → DB 오류는 plain 500.
func (h *GroupHandler) RemoveMember(c *gin.Context) {
	var errs []valErr
	gidStr := c.Param("group_id")
	groupID, gerr := strconv.Atoi(gidStr)
	if gerr != nil {
		errs = append(errs, valErr{Type: "int_parsing", Loc: []string{"path", "group_id"}, Msg: msgIntParse, Input: gidStr})
	}
	midStr := c.Param("member_id")
	memberID, merr := strconv.Atoi(midStr)
	if merr != nil {
		errs = append(errs, valErr{Type: "int_parsing", Loc: []string{"path", "member_id"}, Msg: msgIntParse, Input: midStr})
	}
	errs = append(errs, parseMemberRemoveBody(c)...) // sgdt_show/sgdt_exit: 타입 검증만(값 미사용)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, err := h.wsvc.RemoveMember(groupID, memberID)
	if err != nil {
		plainServerError(c)
		return
	}
	switch res.Outcome {
	case service.RemoveGroupNotFound:
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "그룹을 찾을 수 없습니다."})
	case service.RemoveMemberNotFound:
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "멤버를 그룹에서 찾을 수 없습니다."})
	case service.RemoveSuccess:
		writeJSON(c, http.StatusOK, dto.MemberRemoveResponse{
			Success: true, Message: "멤버가 그룹에서 탈퇴되었습니다.", Data: res.Data})
	}
}

// parseGroupCreateBody는 GroupCreate(전 필드 optional)를 파싱한다. mt_idx/sgt_code는 무시되지만
// FastAPI는 핸들러 전에 타입을 검증하므로, 제공된 값의 타입 오류는 422로 재현한다.
// 반환은 로직에 쓰이는 (sgt_title, sgt_memo, sgt_show)뿐(전부 미제공이면 nil).
func parseGroupCreateBody(c *gin.Context) (title, memo, show *string, errs []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{} // 본문 없음/빈 dict → 전 필드 optional이라 통과
	}
	// FastAPI(Pydantic) 필드 선언 순서: mt_idx, sgt_title, sgt_code, sgt_memo, sgt_show.
	if raw, ok := body["mt_idx"]; ok && raw != nil {
		if _, okv := coerceJSONInt(raw); !okv {
			errs = append(errs, valErr{Type: "int_parsing", Loc: []string{"body", "mt_idx"}, Msg: msgIntParse, Input: raw})
		}
	}
	title = optStringField(body, "sgt_title", &errs)
	_ = optStringField(body, "sgt_code", &errs) // sgt_code: 타입 검증만(서버가 generate로 덮어씀)
	memo = optStringField(body, "sgt_memo", &errs)
	if raw, ok := body["sgt_show"]; ok && raw != nil {
		if s, okv := coerceJSONString(raw); okv && (s == "Y" || s == "N") {
			show = &s
		} else {
			// ShowEnum: 'Y'/'N' 외 값(타입 불일치 포함)은 enum 오류.
			e := valErr{Type: "enum", Loc: []string{"body", "sgt_show"}, Msg: "Input should be 'Y' or 'N'", Input: raw}
			e.Ctx = map[string]any{"expected": "'Y' or 'N'"}
			errs = append(errs, e)
		}
	}
	return title, memo, show, errs
}

// optStringField는 optional 문자열 필드를 파싱한다. 미제공/null이면 nil, 문자열이면 그 값,
// 그 외 타입이면 string_type 422를 errs에 추가한다.
func optStringField(body map[string]interface{}, key string, errs *[]valErr) *string {
	raw, ok := body[key]
	if !ok || raw == nil {
		return nil
	}
	if s, okv := coerceJSONString(raw); okv {
		return &s
	}
	*errs = append(*errs, valErr{Type: "string_type", Loc: []string{"body", key}, Msg: msgStringType, Input: raw})
	return nil
}

// parseJoinByCodeBody는 GroupJoinByCodeRequest{mt_idx:int, sgt_code:str}(둘 다 필수)를 파싱한다.
func parseJoinByCodeBody(c *gin.Context) (mtIdx int, code string, errs []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	if raw, ok := body["mt_idx"]; !ok {
		errs = append(errs, valErr{Type: "missing", Loc: []string{"body", "mt_idx"}, Msg: msgFieldRequired, Input: body})
	} else if n, okv := coerceJSONInt(raw); okv {
		mtIdx = n
	} else {
		errs = append(errs, valErr{Type: "int_parsing", Loc: []string{"body", "mt_idx"}, Msg: msgIntParse, Input: raw})
	}
	if raw, ok := body["sgt_code"]; !ok {
		errs = append(errs, valErr{Type: "missing", Loc: []string{"body", "sgt_code"}, Msg: msgFieldRequired, Input: body})
	} else if s, okv := coerceJSONString(raw); okv {
		code = s
	} else {
		errs = append(errs, valErr{Type: "string_type", Loc: []string{"body", "sgt_code"}, Msg: msgStringType, Input: raw})
	}
	return mtIdx, code, errs
}

// parseJoinBody는 GroupJoinRequest{mt_idx:int, sgt_idx:int}(둘 다 필수)를 파싱한다.
// sgt_idx는 필수 검증만 하고 가입 로직엔 쓰지 않는다(path group_id 사용).
func parseJoinBody(c *gin.Context) (mtIdx, sgtIdx int, errs []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	if raw, ok := body["mt_idx"]; !ok {
		errs = append(errs, valErr{Type: "missing", Loc: []string{"body", "mt_idx"}, Msg: msgFieldRequired, Input: body})
	} else if n, okv := coerceJSONInt(raw); okv {
		mtIdx = n
	} else {
		errs = append(errs, valErr{Type: "int_parsing", Loc: []string{"body", "mt_idx"}, Msg: msgIntParse, Input: raw})
	}
	if raw, ok := body["sgt_idx"]; !ok {
		errs = append(errs, valErr{Type: "missing", Loc: []string{"body", "sgt_idx"}, Msg: msgFieldRequired, Input: body})
	} else if n, okv := coerceJSONInt(raw); okv {
		sgtIdx = n
	} else {
		errs = append(errs, valErr{Type: "int_parsing", Loc: []string{"body", "sgt_idx"}, Msg: msgIntParse, Input: raw})
	}
	return mtIdx, sgtIdx, errs
}

// parseGroupUpdateBody는 GroupUpdate(전 필드 optional)를 파싱한다. update_group은 create와 달리
// mt_idx/sgt_code도 실제 반영하므로 값을 반환한다. Pydantic 필드 순서: mt_idx, sgt_title, sgt_code, sgt_memo, sgt_show.
func parseGroupUpdateBody(c *gin.Context) (mtIdx *int, title, code, memo, show *string, errs []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	if raw, ok := body["mt_idx"]; ok && raw != nil {
		if n, okv := coerceJSONInt(raw); okv {
			mtIdx = &n
		} else {
			errs = append(errs, valErr{Type: "int_parsing", Loc: []string{"body", "mt_idx"}, Msg: msgIntParse, Input: raw})
		}
	}
	title = optStringField(body, "sgt_title", &errs)
	code = optStringField(body, "sgt_code", &errs)
	memo = optStringField(body, "sgt_memo", &errs)
	if raw, ok := body["sgt_show"]; ok && raw != nil {
		if s, okv := coerceJSONString(raw); okv && (s == "Y" || s == "N") {
			show = &s
		} else {
			e := valErr{Type: "enum", Loc: []string{"body", "sgt_show"}, Msg: "Input should be 'Y' or 'N'", Input: raw}
			e.Ctx = map[string]any{"expected": "'Y' or 'N'"}
			errs = append(errs, e)
		}
	}
	return mtIdx, title, code, memo, show, errs
}

// parseMemberRemoveBody는 MemberRemoveRequest{sgdt_show:str='N', sgdt_exit:str='Y'}를 파싱한다.
// 둘 다 기본값 있는 비-Optional str → 미제공은 valid(기본값), null/비문자열은 string_type 422.
// 값은 로직에서 무시되지만(항상 N/Y 탈퇴) 타입 오류는 재현한다. Pydantic 필드 순서: sgdt_show, sgdt_exit.
func parseMemberRemoveBody(c *gin.Context) (errs []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	for _, key := range []string{"sgdt_show", "sgdt_exit"} {
		raw, ok := body[key]
		if !ok {
			continue // 미제공 → 기본값 사용(오류 아님)
		}
		if _, okv := coerceJSONString(raw); !okv {
			// null 포함 비문자열 → 비-Optional str 타입 오류(default는 '미제공'일 때만 적용).
			errs = append(errs, valErr{Type: "string_type", Loc: []string{"body", key}, Msg: msgStringType, Input: raw})
		}
	}
	return errs
}
