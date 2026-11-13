package handler

import (
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/middleware"
	"github.com/bluemusk/smap_next_go/internal/netutil"
	"github.com/bluemusk/smap_next_go/internal/repository"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// 알림 본문 상한. Apple signedPayload / Pub/Sub 메시지는 수 KB 이므로 넉넉한 상한만 둔다.
const (
	maxVerifyBodyBytes = 64 << 10
	maxNotifyBodyBytes = 256 << 10
)

// 사용자에게 보이는 구독 오류 문구(계약 3.2). 스토어 응답·토큰·내부 사유는 담지 않는다.
const (
	msgSubInvalid    = "구매 정보를 확인할 수 없어요."
	msgSubExpired    = "이미 만료되었거나 취소된 구독이에요."
	msgSubSandbox    = "테스트 결제는 지원하지 않아요."
	msgSubOwned      = "이 구매는 다른 계정에 연결되어 있어요."
	msgSubStoreDown  = "스토어 확인 서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요."
	msgSubUnavail    = "구독 확인을 사용할 수 없어요. 잠시 후 다시 시도해주세요."
	msgSubBadRequest = "요청 형식이 올바르지 않아요."
)

// SubscriptionHandler는 /subscriptions/* 4개 경로다. me·verify 는 enforce 모드 인증 미들웨어 뒤(무토큰은 모드와 무관하게 401)이고,
// 두 알림 경로는 인증 미들웨어 밖이며 서명·발신자 검증(NotificationVerifier)으로 보호한다.
type SubscriptionHandler struct {
	svc *service.SubscriptionService
	// verifyGuard: verify 호출 한도(회원별+IP별). nil 이면 verify 는 503(fail-closed)이다 — 배선 누락이 무제한 호출이 되지 않게.
	verifyGuard  *service.SubscriptionVerifyGuard
	trustedIPHdr string
}

func NewSubscription(svc *service.SubscriptionService) *SubscriptionHandler {
	return &SubscriptionHandler{svc: svc}
}

// SetVerifyGuard는 verify 호출 한도와 IP 판정에 쓸 신뢰 헤더 이름(TRUSTED_CLIENT_IP_HEADER)을 주입한다.
func (h *SubscriptionHandler) SetVerifyGuard(g *service.SubscriptionVerifyGuard, trustedClientIPHeader string) {
	h.verifyGuard, h.trustedIPHdr = g, trustedClientIPHeader
}

func subUnauthorized(c *gin.Context) {
	c.Header("WWW-Authenticate", "Bearer")
	writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
}

// writeSubErr는 서비스 오류를 HTTP 응답으로 바꾼다. 알림 경로(notify=true)는 스토어 장애를 503 으로 내려 재시도를 유도한다.
func writeSubErr(c *gin.Context, err error, notify bool) {
	switch {
	case errors.Is(err, service.ErrSubBadRequest):
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": msgSubBadRequest})
	case errors.Is(err, service.ErrSubInvalidProof):
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": msgSubInvalid})
	case errors.Is(err, service.ErrSubExpired):
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": msgSubExpired})
	case errors.Is(err, service.ErrSubSandboxRejected):
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": msgSubSandbox})
	case errors.Is(err, service.ErrSubOwnedByOther):
		writeJSON(c, http.StatusConflict, gin.H{"detail": msgSubOwned})
	case errors.Is(err, service.ErrSubUnauthorized):
		c.Header("WWW-Authenticate", "Bearer")
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
	case errors.Is(err, service.ErrSubStoreDown):
		status := http.StatusBadGateway
		if notify {
			status = http.StatusServiceUnavailable
		}
		writeJSON(c, status, gin.H{"detail": msgSubStoreDown})
	case errors.Is(err, service.ErrSubNotConfigured), errors.Is(err, service.ErrSubTableMissing), errors.Is(err, service.ErrSubBusy):
		writeJSON(c, http.StatusServiceUnavailable, gin.H{"detail": msgSubUnavail})
	case errors.Is(err, repository.ErrMemberNotFound):
		subUnauthorized(c)
	default:
		slog.Error("subscription request failed", slog.String("route", c.FullPath()), slog.String("err", err.Error()))
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
	}
}

// Me는 GET /subscriptions/me — 현재 로그인한 회원의 구독 상태(계약 3.1).
func (h *SubscriptionHandler) Me(c *gin.Context) {
	uid, ok := middleware.UserID(c)
	if !ok {
		subUnauthorized(c)
		return
	}
	st, err := h.svc.Status(c.Request.Context(), uid)
	if err != nil {
		writeSubErr(c, err, false)
		return
	}
	writeJSON(c, http.StatusOK, st)
}

// Verify는 POST /subscriptions/verify — 앱이 보낸 구매 증빙을 서버가 스토어에 직접 검증해 반영한다(계약 3.2).
func (h *SubscriptionHandler) Verify(c *gin.Context) {
	uid, ok := middleware.UserID(c)
	if !ok {
		subUnauthorized(c)
		return
	}
	// 본문을 읽기 전에 한도를 먼저 센다(거부된 호출이 파싱·스토어 호출 비용을 쓰지 않게).
	if rej := h.verifyGuard.Check(c.Request.Context(), uid, netutil.ClientIP(c.Request, h.trustedIPHdr)); rej != nil {
		writeAuthRejection(c, rej)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxVerifyBodyBytes)
	var req dto.SubscriptionVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": msgSubBadRequest})
		return
	}
	st, err := h.svc.Verify(c.Request.Context(), uid, req)
	if err != nil {
		writeSubErr(c, err, false)
		return
	}
	writeJSON(c, http.StatusOK, st)
}

// AppleNotification은 POST /subscriptions/apple/notifications — App Store Server Notifications V2(공개, JWS 서명 검증).
func (h *SubscriptionHandler) AppleNotification(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxNotifyBodyBytes)
	var req dto.AppleNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.SignedPayload == "" {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": msgSubBadRequest})
		return
	}
	if _, err := h.svc.HandleAppleNotification(c.Request.Context(), req.SignedPayload); err != nil {
		writeSubErr(c, err, true)
		return
	}
	writeJSON(c, http.StatusOK, gin.H{"success": true})
}

// GoogleNotification은 POST /subscriptions/google/notifications — Pub/Sub push(공개, OIDC 발신자 검증 + Play 재조회).
func (h *SubscriptionHandler) GoogleNotification(c *gin.Context) {
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, maxNotifyBodyBytes))
	if err != nil {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": msgSubBadRequest})
		return
	}
	if _, err := h.svc.HandleGoogleNotification(c.Request.Context(), c.GetHeader("Authorization"), body); err != nil {
		writeSubErr(c, err, true)
		return
	}
	writeJSON(c, http.StatusOK, gin.H{"success": true})
}
