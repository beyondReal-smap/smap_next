package service

import (
	"context"
	"errors"
	"log/slog"

	"github.com/bluemusk/smap_next_go/internal/repository"
	"github.com/bluemusk/smap_next_go/internal/subscription/store"
)

// NotifyResult는 스토어 알림 처리 결과다. Applied=false 는 반영할 것이 없어 200 으로만 응답한 경우다.
type NotifyResult struct {
	Applied bool
	Reason  string // applied | test | ignored | unlinked | sandbox_ignored | not_found_ignored
}

// HandleAppleNotification은 App Store Server Notifications V2 의 signedPayload 를 검증하고 반영한다.
// 서명 검증은 NotificationVerifier 가 한다. 검증 실패는 ErrSubInvalidProof(400), 스토어 일시 장애는 ErrSubStoreDown(재시도 유도).
func (s *SubscriptionService) HandleAppleNotification(ctx context.Context, signedPayload string) (NotifyResult, error) {
	if s.notifier == nil {
		return NotifyResult{}, s.mapStoreErr(store.ErrNotConfigured, "notify_apple")
	}
	n, err := s.notifier.ParseApple(ctx, signedPayload)
	return s.consume(ctx, n, err, "apple")
}

// HandleGoogleNotification은 Pub/Sub push(RTDN)를 검증하고 반영한다. 발신자 검증(OIDC)은 NotificationVerifier 가 한다.
func (s *SubscriptionService) HandleGoogleNotification(ctx context.Context, authorizationHeader string, body []byte) (NotifyResult, error) {
	if s.notifier == nil {
		return NotifyResult{}, s.mapStoreErr(store.ErrNotConfigured, "notify_google")
	}
	n, err := s.notifier.ParseGoogle(ctx, authorizationHeader, body)
	return s.consume(ctx, n, err, "google")
}

func (s *SubscriptionService) consume(ctx context.Context, n *store.Notification, perr error, from string) (NotifyResult, error) {
	if perr != nil {
		switch {
		// 우리가 처리할 수 없지만 재시도해도 소용없는 알림은 200 으로 끝낸다(스토어의 무한 재시도 방지).
		case errors.Is(perr, store.ErrSandboxNotAllowed):
			s.logger.Info("subscription_notification_ignored", slog.String("from", from), slog.String("reason", "sandbox_not_allowed"))
			return NotifyResult{Reason: "sandbox_ignored"}, nil
		case errors.Is(perr, store.ErrNotFound), errors.Is(perr, store.ErrExpired):
			s.logger.Info("subscription_notification_ignored", slog.String("from", from), slog.String("reason", "store_does_not_know_purchase"))
			return NotifyResult{Reason: "not_found_ignored"}, nil
		}
		return NotifyResult{}, s.mapStoreErr(perr, "notify_"+from)
	}
	if n == nil {
		return NotifyResult{}, ErrSubInvalidProof
	}
	if n.IsTest {
		return NotifyResult{Reason: "test"}, nil
	}
	if n.Ignore || n.TransactionKey == "" {
		return NotifyResult{Reason: "ignored"}, nil
	}
	v := n.Verified
	if v.Environment == store.EnvSandbox && !s.allowSB {
		return NotifyResult{Reason: "sandbox_ignored"}, nil
	}
	if _, err := s.resolvePlan(&v); err != nil {
		// 우리 상품이 아닌 거래: 반영하지 않고 200(스토어가 재시도하지 않게).
		s.logger.Warn("subscription_notification_unknown_product", slog.String("from", from), slog.String("type", n.Type))
		return NotifyResult{Reason: "ignored"}, nil
	}

	platform := platformOf(v.Provider)
	row, err := s.repo.FindByHash(ctx, platform, storeHash(v.TransactionKey))
	if err != nil {
		return NotifyResult{}, s.mapDBErr(err, "notify_find")
	}
	owner := 0
	if row != nil {
		owner = row.MtIdx
	} else if v.LinkedTransactionKey != "" {
		// 재가입·요금제 변경으로 새 구매 토큰이 생긴 경우: 이전 토큰이 연결된 회원에게 이어 붙인다(이전 토큰은 스토어가 알려 준 값).
		linked, err := s.repo.FindByHash(ctx, platform, storeHash(v.LinkedTransactionKey))
		if err != nil {
			return NotifyResult{}, s.mapDBErr(err, "notify_find_linked")
		}
		if linked != nil {
			owner = linked.MtIdx
		}
	}
	if owner == 0 {
		// 앱의 /subscriptions/verify 로 아직 계정에 연결되지 않은 거래: 연결 정보가 없어 반영할 수 없다. 앱이 다음 실행에 검증한다.
		s.logger.Warn("subscription_notification_unlinked", slog.String("from", from), slog.String("type", n.Type))
		return NotifyResult{Reason: "unlinked"}, nil
	}
	if _, err := s.apply(ctx, owner, &v, applyOptions{notified: true}); err != nil {
		if errors.Is(err, repository.ErrMemberNotFound) {
			s.logger.Warn("subscription_notification_member_missing", slog.String("from", from))
			return NotifyResult{Reason: "unlinked"}, nil
		}
		if errors.Is(err, ErrSubOwnedByOther) {
			// 알림의 거래와 연결 거래가 서로 다른 회원 소유: 스토어가 재시도해도 결과가 같으므로 반영하지 않고 200(운영 확인용 경고).
			s.logger.Warn("subscription_notification_owner_conflict", slog.String("from", from), slog.String("type", n.Type))
			return NotifyResult{Reason: "ignored"}, nil
		}
		return NotifyResult{}, err
	}
	s.logger.Info("subscription_notification_applied", slog.String("from", from), slog.String("type", n.Type), slog.String("subtype", n.Subtype), slog.String("state", string(v.State)))
	return NotifyResult{Applied: true, Reason: "applied"}, nil
}
