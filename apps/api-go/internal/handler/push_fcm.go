package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/service"
)

type PushFCMHandler struct {
	svc  *service.PushFCMService
	self *SelfGuard // 본인 것만 조회·삭제(G7). 앱이 쓰지 않는 경로라 토큰이 없으면 모드와 무관하게 401.
}

// SetGuard는 본인 검사 가드를 주입한다.
func (h *PushFCMHandler) SetGuard(g *SelfGuard) { h.self = g }

// ownMessage는 push-fcms 메시지 id의 수신자가 요청자 본인인지 확인한다(토큰 필수, 남의 것은 403, 없으면 404).
func (h *PushFCMHandler) ownMessage(c *gin.Context, id int) bool {
	uid, tok := h.self.RequireToken(c)
	if !tok {
		return false
	}
	owner, found, ok := h.svc.PushFCMOwner(id)
	if !ok {
		plainServerError(c)
		return false
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Push FCM not found"})
		return false
	}
	if owner == nil || *owner != uid {
		writeForbiddenDetail(c)
		return false
	}
	return true
}

func NewPushFCM(svc *service.PushFCMService) *PushFCMHandler {
	return &PushFCMHandler{svc: svc}
}

// List는 GET /api/v1/push-fcms/ — skip(0)/limit(100), 정렬 없음.
func (h *PushFCMHandler) List(c *gin.Context) {
	errs := make([]valErr, 0)
	skip := parseIntQuery(c, &errs, "skip", 0, false, 0, false, 0)
	limit := parseIntQuery(c, &errs, "limit", 100, false, 0, false, 0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, ok := h.svc.ListPushFCMs(skip, limit)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Get은 GET /api/v1/push-fcms/:push_fcm_id. 없으면 404 "Push FCM not found".
// (/now는 Python에서 /:push_fcm_id에 가려져 422 → Go도 미등록으로 동일 재현.)
func (h *PushFCMHandler) Get(c *gin.Context) {
	idStr := c.Param("push_fcm_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "push_fcm_id", idStr)
		return
	}
	if !h.ownMessage(c, id) {
		return
	}
	res, found, ok := h.svc.GetPushFCM(id)
	if !ok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Push FCM not found"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Member는 GET /api/v1/push-fcms/member/:member_id.
func (h *PushFCMHandler) Member(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	if !h.self.SelfStrict(c, id) {
		return
	}
	res, ok := h.svc.MemberPushFCMs(id)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Code는 GET /api/v1/push-fcms/code/:code.
func (h *PushFCMHandler) Code(c *gin.Context) {
	uid, tok := h.self.RequireToken(c)
	if !tok {
		return
	}
	res, ok := h.svc.CodePushFCMs(c.Param("code"))
	if !ok {
		plainServerError(c)
		return
	}
	// 같은 코드의 메시지 중 본인 수신분만.
	own := make([]dto.PushFCMResponse, 0, len(res))
	for _, r := range res {
		if r.PftSendMtIdx != nil && *r.PftSendMtIdx == uid {
			own = append(own, r)
		}
	}
	writeJSON(c, http.StatusOK, own)
}

// Pending은 GET /api/v1/push-fcms/pending/:mt_idx — since_timestamp(optional float).
// DB 에러→500(한국어 detail), zero date→plain 500. since=0은 Python truthy로 미적용.
func (h *PushFCMHandler) Pending(c *gin.Context) {
	idStr := c.Param("mt_idx")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "mt_idx", idStr)
		return
	}
	if !h.self.SelfStrict(c, id) {
		return
	}
	var since *float64
	if v, exists := c.GetQuery("since_timestamp"); exists {
		f, perr := strconv.ParseFloat(v, 64)
		if perr != nil {
			writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": []valErr{{
				Type: "float_parsing", Loc: []string{"query", "since_timestamp"},
				Msg: "Input should be a valid number, unable to parse string as a number", Input: v,
			}}})
			return
		}
		if f != 0 { // Python `if since_timestamp:` — 0.0은 미적용
			since = &f
		}
	}
	res, ok, perr := h.svc.PendingPushFCMs(id, since)
	if perr != nil {
		writeJSON(c, http.StatusInternalServerError,
			gin.H{"detail": "보류된 메시지 조회 중 오류 발생: " + perr.Error()})
		return
	}
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}
