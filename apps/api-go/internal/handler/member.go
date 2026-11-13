package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/service"
)

type MemberHandler struct {
	revocable // 비밀번호 변경 이전 토큰 무효 기준(SetRevocation)
	svc       *service.MemberService
	cfg       *config.Config
	// guard: 회원/그룹 멤버 조회의 위치·연락처 보호(nil이면 500, fail-closed).
	guard *LocationGuard
}

// SetGuard는 위치 인가 가드를 주입한다.
func (h *MemberHandler) SetGuard(g *LocationGuard) { h.guard = g }

func NewMember(svc *service.MemberService, cfg *config.Config) *MemberHandler {
	return &MemberHandler{svc: svc, cfg: cfg}
}

// CheckPhone은 GET /api/v1/members/check/phone/:phone — 무인증.
func (h *MemberHandler) CheckPhone(c *gin.Context) {
	res, err := h.svc.CheckPhone(c.Param("phone"))
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// CheckEmail은 GET /api/v1/members/check/email/:email — 무인증.
func (h *MemberHandler) CheckEmail(c *gin.Context) {
	res, err := h.svc.CheckEmail(c.Param("email"))
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// CheckNickname은 GET /api/v1/members/check/nickname/:nickname — 무인증.
func (h *MemberHandler) CheckNickname(c *gin.Context) {
	res, err := h.svc.CheckNickname(c.Param("nickname"))
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// List는 GET /api/v1/members/ — skip(default 0)/limit(default 10000)/id(optional).
// Python `if id:`처럼 id가 0/None이면 목록, 양수면 단건(없으면 빈 목록). 쿼리 검증 순서: skip→limit→id.
func (h *MemberHandler) List(c *gin.Context) {
	errs := make([]valErr, 0)
	skip := parseIntQuery(c, &errs, "skip", 0, false, 0, false, 0)
	limit := parseIntQuery(c, &errs, "limit", 10000, false, 0, false, 0)
	var idVal *int
	if s, ok := c.GetQuery("id"); ok {
		n, ok2 := coerceInt(s)
		if !ok2 {
			errs = append(errs, qErr("int_parsing", "id", msgIntParse, s))
		} else {
			idVal = &n
		}
	}
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}

	if idVal != nil && *idVal != 0 {
		if !h.guard.ViewMember(c, *idVal) {
			return
		}
		res, err := h.svc.MemberForList(h.guard.Viewer(c), *idVal)
		if err != nil {
			writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
			return
		}
		writeJSON(c, http.StatusOK, res)
		return
	}

	// 전체 회원 덤프: 토큰이 있는 요청에는 열지 않는다(앱 미사용, 관리자는 /users·/admin 사용).
	if !h.guard.NoBulkDump(c) {
		return
	}
	res, err := h.svc.ListMembers(h.guard.Viewer(c), skip, limit)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Get은 GET /api/v1/members/:member_id — MemberResponse. 없으면 404 "Member not found".
func (h *MemberHandler) Get(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	if !h.guard.ViewMember(c, id) {
		return
	}
	res, err := h.svc.GetMemberDetail(h.guard.Viewer(c), id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	if res == nil {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Member not found"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Me는 GET /api/v1/members/me (Python get_user_profile). Header 수동 파싱.
// ⚠️ 미인증/미발견/오류 전부 HTTP 200 + result:N로 흡수(401 절대 안 냄).
// 성공 응답 키 순서: result, data, message, success.
func (h *MemberHandler) Me(c *gin.Context) {
	uid, ok := auth.ParseOptionalUserIDChecked(h.revocation, nil, c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		writeJSON(c, http.StatusOK, dto.ProfileMeFail{
			Result:  "N",
			Message: "인증이 필요합니다.",
			Success: false,
		})
		return
	}
	data, found, err := h.svc.MyProfile(uid)
	if err != nil {
		// Python except Exception → 200 + 서버 오류 메시지(흡수).
		writeJSON(c, http.StatusOK, dto.ProfileMeFail{
			Result:  "N",
			Message: "서버 오류가 발생했습니다.",
			Success: false,
		})
		return
	}
	if !found {
		writeJSON(c, http.StatusOK, dto.ProfileMeFail{
			Result:  "N",
			Message: "사용자를 찾을 수 없습니다.",
			Success: false,
		})
		return
	}
	writeJSON(c, http.StatusOK, dto.ProfileMeResponse{
		Result:  "Y",
		Data:    *data,
		Message: "프로필 조회가 성공했습니다.",
		Success: true,
	})
}

// Consent는 GET /api/v1/members/consent/:member_id (Python get_consent_info).
// 미인증 401 "인증이 필요합니다."(마침표), 타인 403 "본인의 동의 정보만 조회할 수 있습니다.",
// 미발견 404 "사용자를 찾을 수 없습니다.", YNEnum 검증 실패/오류 500 "서버 오류가 발생했습니다.".
func (h *MemberHandler) Consent(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	uid, ok := auth.ParseOptionalUserIDChecked(h.revocation, nil, c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return
	}
	if uid != id {
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "본인의 동의 정보만 조회할 수 있습니다."})
		return
	}
	info, found, valid, err := h.svc.ConsentInfo(id)
	if err != nil {
		// Python except Exception → 500 detail "서버 오류가 발생했습니다.".
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "서버 오류가 발생했습니다."})
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "사용자를 찾을 수 없습니다."})
		return
	}
	if !valid {
		// ConsentInfo(YNEnum) 검증 실패 → ConsentResponse 생성 예외 → 500.
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "서버 오류가 발생했습니다."})
		return
	}
	writeJSON(c, http.StatusOK, dto.ConsentResponse{
		Success: true,
		Message: "동의 정보 조회 성공",
		Data:    info,
	})
}

// Group은 GET /api/v1/members/group/:group_id — 그룹 멤버 목록(Member+GroupDetail).
func (h *MemberHandler) Group(c *gin.Context) {
	idStr := c.Param("group_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_id", idStr)
		return
	}
	if !h.guard.ViewGroup(c, id) {
		return
	}
	res, err := h.svc.GroupMembers(h.guard.Viewer(c), id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}
