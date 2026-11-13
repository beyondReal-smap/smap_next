package service

import (
	"context"
	"errors"
	"log/slog"

	"github.com/bluemusk/smap_next_go/internal/model"
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

	for attempt := 0; attempt < applyMaxAttempts; attempt++ {
		owner, err := s.resolveOwner(ctx, &v)
		if err != nil {
			return NotifyResult{}, err
		}
		if owner == model.UnownedMtIdx {
			// 아직 어느 회원에도 연결되지 않은 거래: 버리지 않고 소유자 없는 행으로 상태를 기록한다.
			// 환불·회수는 묘비가 되어 이후 어떤 verify 도 이 거래를 계정에 연결하지 못하고, 일반 상태는 오래된 증빙의 부활을 막는다.
			err = s.recordUnowned(ctx, &v)
			if errors.Is(err, errRowClaimed) || errors.Is(err, repository.ErrDuplicateKey) || errors.Is(err, repository.ErrRetryableTx) {
				continue // 그 사이 다른 요청이 행을 만들었거나 소유자가 생겼다: 소유자를 다시 찾는다
			}
			if err != nil {
				return NotifyResult{}, s.mapDBErr(err, "notify_record_unowned")
			}
			s.logger.Info("subscription_notification_recorded_unowned", slog.String("from", from), slog.String("type", n.Type), slog.String("state", string(v.State)))
			return NotifyResult{Applied: true, Reason: "recorded_unowned"}, nil
		}
		_, err = s.apply(ctx, owner, &v, applyOptions{notified: true})
		if errors.Is(err, errRowClaimed) {
			continue
		}
		if err != nil {
			if errors.Is(err, repository.ErrMemberNotFound) {
				// 소유 회원 행이 사라졌다: 거래 상태는 소유자 없는 행으로 남겨 환불·회수가 유실되지 않게 한다.
				if rerr := s.recordUnowned(ctx, &v); rerr != nil && !errors.Is(rerr, errRowClaimed) {
					return NotifyResult{}, s.mapDBErr(rerr, "notify_record_orphan")
				}
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
		break
	}
	s.logger.Info("subscription_notification_applied", slog.String("from", from), slog.String("type", n.Type), slog.String("subtype", n.Subtype), slog.String("state", string(v.State)))
	return NotifyResult{Applied: true, Reason: "applied"}, nil
}

// resolveOwner는 알림의 거래가 연결된 회원 번호를 찾는다. 없으면 UnownedMtIdx.
// 거래 행이 이미 있으면 그 소유자(소유자 없는 행이면 UnownedMtIdx), 없으면 이전 토큰(linkedPurchaseToken)이 연결된 회원.
func (s *SubscriptionService) resolveOwner(ctx context.Context, v *store.Verified) (int, error) {
	platform := platformOf(v.Provider)
	row, err := s.repo.FindByHash(ctx, platform, storeHash(v.TransactionKey))
	if err != nil {
		return 0, s.mapDBErr(err, "notify_find")
	}
	if row != nil {
		return row.MtIdx, nil
	}
	if v.LinkedTransactionKey != "" {
		// 재가입·요금제 변경으로 새 구매 토큰이 생긴 경우: 이전 토큰이 연결된 회원에게 이어 붙인다(이전 토큰은 스토어가 알려 준 값).
		linked, err := s.repo.FindByHash(ctx, platform, storeHash(v.LinkedTransactionKey))
		if err != nil {
			return 0, s.mapDBErr(err, "notify_find_linked")
		}
		if linked != nil {
			return linked.MtIdx, nil
		}
	}
	return model.UnownedMtIdx, nil
}

// recordUnowned는 소유자 없는 거래 행을 만들거나 더 최신 상태로 갱신한다. 이미 회원이 차지한 행이면 errRowClaimed.
func (s *SubscriptionService) recordUnowned(ctx context.Context, v *store.Verified) error {
	now := s.now().UTC()
	platform := platformOf(v.Provider)
	hash := storeHash(v.TransactionKey)
	plan, err := s.resolvePlan(v)
	if err != nil {
		return err
	}
	eventAt := truncSec(v.LatestEventAt)
	if v.LatestEventAt.IsZero() {
		eventAt = truncSec(now)
	}
	expires := normalizedExpiry(v, now)
	return s.repo.WithTx(ctx, func(tx repository.SubscriptionTxOps) error {
		row, err := tx.FindByHash(platform, hash)
		if err != nil {
			return err
		}
		if row == nil {
			return tx.Insert(newRowFrom(model.UnownedMtIdx, platform, hash, plan, v, expires, eventAt, now, true))
		}
		if row.MtIdx != model.UnownedMtIdx {
			return errRowClaimed
		}
		if refreshRow(row, v, plan, expires, eventAt, now, true) {
			return tx.Save(row)
		}
		return nil
	})
}
