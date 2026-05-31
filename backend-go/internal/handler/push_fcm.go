package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

type PushFCMHandler struct {
	svc *service.PushFCMService
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
	res, ok := h.svc.MemberPushFCMs(id)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Code는 GET /api/v1/push-fcms/code/:code.
func (h *PushFCMHandler) Code(c *gin.Context) {
	res, ok := h.svc.CodePushFCMs(c.Param("code"))
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
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
