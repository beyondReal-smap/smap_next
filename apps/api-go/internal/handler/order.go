package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/service"
)

type OrderHandler struct {
	revocable // 비밀번호 변경 이전 토큰 무효 기준(SetRevocation)
	svc       *service.OrderService
	cfg       *config.Config
}

func NewOrder(svc *service.OrderService, cfg *config.Config) *OrderHandler {
	return &OrderHandler{svc: svc, cfg: cfg}
}

// Summary는 GET /api/v1/orders/summary/:member_id (Python get_order_summary).
// member_id 정수 파싱 실패 시 422. 그 다음 401(인증)→403(소유권). 404 없음.
func (h *OrderHandler) Summary(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	uid, ok := auth.ParseOptionalUserIDChecked(h.revocation, nil, c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다"})
		return
	}
	if uid != id {
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "접근 권한이 없습니다"})
		return
	}
	res, ok := h.svc.OrderSummaryInfo(id)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// MemberOrders는 GET /api/v1/orders/:member_id (Python get_orders_by_member).
// status(int, 선택)·pay_type(str, 선택)·page(ge=1, 기본 1)·size(ge=1 le=100, 기본 20) 쿼리.
func (h *OrderHandler) MemberOrders(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}

	errs := make([]valErr, 0)

	// status: Python Query(None) — 미존재면 nil(필터 없음), 존재하면 int 강제 변환.
	var status *int
	if raw, exists := c.GetQuery("status"); exists {
		v, ok := coerceInt(raw)
		if !ok {
			errs = append(errs, qErr("int_parsing", "status", msgIntParse, raw))
		} else {
			status = &v
		}
	}

	// pay_type: Python Query(None) str — 미존재/빈 문자열이면 필터 없음.
	payType := c.Query("pay_type")

	page := parseIntQuery(c, &errs, "page", 1, true, 1, false, 0)
	size := parseIntQuery(c, &errs, "size", 20, true, 1, true, 100)

	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}

	// 인증/소유권은 쿼리검증(422) 통과 후, svc 호출 앞에서 검사한다(Python 순서).
	uid, ok := auth.ParseOptionalUserIDChecked(h.revocation, nil, c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다"})
		return
	}
	if uid != id {
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "접근 권한이 없습니다"})
		return
	}

	res, ok := h.svc.MemberOrders(id, status, payType, page, size)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Detail은 GET /api/v1/orders/detail/:order_id (Python get_order_detail).
// Python 순서: 422(파싱)→401(인증)→500(DB)→404(미발견)→403(소유권)→500(zero-date 직렬화)→200.
func (h *OrderHandler) Detail(c *gin.Context) {
	idStr := c.Param("order_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "order_id", idStr)
		return
	}
	uid, ok := auth.ParseOptionalUserIDChecked(h.revocation, nil, c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다"})
		return
	}
	res, ownerID, found, serOK := h.svc.GetOrder(id)
	if !found && !serOK {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "주문을 찾을 수 없습니다"})
		return
	}
	if ownerID == nil || *ownerID != uid {
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "접근 권한이 없습니다"})
		return
	}
	if !serOK {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// ByCode는 GET /api/v1/orders/code/:order_code (Python get_order_by_code).
// order_code는 str이라 422 없음. 그 외 순서는 Detail과 동일(401→500→404→403→500→200).
func (h *OrderHandler) ByCode(c *gin.Context) {
	code := c.Param("order_code")
	uid, ok := auth.ParseOptionalUserIDChecked(h.revocation, nil, c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다"})
		return
	}
	res, ownerID, found, serOK := h.svc.GetOrderByCode(code)
	if !found && !serOK {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "주문을 찾을 수 없습니다"})
		return
	}
	if ownerID == nil || *ownerID != uid {
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "접근 권한이 없습니다"})
		return
	}
	if !serOK {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Recent는 GET /api/v1/orders/recent/:member_id (Python get_recent_orders).
// limit(ge=1 le=20, 기본 5) 쿼리. 빈 배열 허용(404 없음).
func (h *OrderHandler) Recent(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	errs := make([]valErr, 0)
	limit := parseIntQuery(c, &errs, "limit", 5, true, 1, true, 20)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	// 인증/소유권은 쿼리검증(422) 통과 후, svc 호출 앞에서 검사한다(Python 순서).
	uid, ok := auth.ParseOptionalUserIDChecked(h.revocation, nil, c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다"})
		return
	}
	if uid != id {
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "접근 권한이 없습니다"})
		return
	}
	res, ok := h.svc.RecentOrders(id, limit)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}
