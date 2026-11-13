package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
)

// orderUserID는 Python deps.get_current_user_id(수동 추출): 없으면/실패면 nil → 401 "인증이 필요합니다"(마침표·헤더 없음).
func (h *OrderHandler) orderUserID(c *gin.Context) (int, bool) {
	uid, ok := auth.ParseOptionalUserID(c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다"})
		return 0, false
	}
	return uid, true
}

// UpdateStatus는 PUT /orders/status/{order_id}?status= — 소유자 체크 없음.
// ⚠️ 성공 시에도 Python은 모델 직렬화 실패로 500 plain "Internal Server Error"(DB는 갱신됨).
func (h *OrderHandler) UpdateStatus(c *gin.Context) {
	idStr := c.Param("order_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "order_id", idStr)
		return
	}
	var errs []valErr
	status := requiredQueryInt(c, "status", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	if _, ok := h.orderUserID(c); !ok {
		return
	}
	found, dbErr := h.svc.UpdateStatus(id, status)
	if dbErr != nil {
		internalServerErrorPlain(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "주문을 찾을 수 없습니다"})
		return
	}
	// 갱신 성공 → Python 모델 직렬화 실패 재현(500 plain).
	internalServerErrorPlain(c)
}

// Cancel은 POST /orders/cancel/{order_id}?cancel_reason=&cancel_amount=&refund_info= — 소유자만.
func (h *OrderHandler) Cancel(c *gin.Context) {
	idStr := c.Param("order_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "order_id", idStr)
		return
	}
	var errs []valErr
	reason := requiredQueryString(c, "cancel_reason", &errs)
	amount, amtErr := optQueryFloat(c, "cancel_amount")
	if amtErr != nil {
		errs = append(errs, *amtErr)
	}
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	var refund *string
	if v, has := c.GetQuery("refund_info"); has {
		refund = &v
	}
	uid, ok := h.orderUserID(c)
	if !ok {
		return
	}
	switch h.svc.Cancel(id, uid, reason, amount, refund) {
	case 0: // CancelNotFound
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "주문을 찾을 수 없습니다"})
	case 1: // CancelForbidden
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "접근 권한이 없습니다"})
	case 2: // CancelAlready
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "이미 취소된 주문입니다"})
	default: // CancelDone / CancelDBErr → 500 plain(성공도 직렬화 버그로 500)
		internalServerErrorPlain(c)
	}
}

// requiredQueryString은 필수 query 문자열(Python def f(x: str)). 미제공→missing(input:null).
func requiredQueryString(c *gin.Context, key string, errs *[]valErr) string {
	v, has := c.GetQuery(key)
	if !has {
		*errs = append(*errs, valErr{Type: "missing", Loc: []string{"query", key}, Msg: msgFieldRequired, Input: nil})
		return ""
	}
	return v
}

// optQueryFloat은 옵션 query float(Python x: float = None). 미제공→nil, 비숫자→float_parsing 422.
func optQueryFloat(c *gin.Context, key string) (*float64, *valErr) {
	v, has := c.GetQuery(key)
	if !has {
		return nil, nil
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return nil, &valErr{Type: "float_parsing", Loc: []string{"query", key},
			Msg: "Input should be a valid number, unable to parse string as a number", Input: v}
	}
	return &f, nil
}
