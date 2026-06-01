package jobs

import (
	"context"
	"errors"
	"log/slog"
	"strconv"
	"time"

	"firebase.google.com/go/v4/messaging"
	"github.com/hibiken/asynq"

	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// daily:silent(03:00) 무음 푸시 잡 구현.
//
// Python 원본: run_send_silent_push_to_all_users(app/jobs/push_jobs.py:176).
// 토큰 보유 활성 회원 전체에 알림 비표시(content-available) 무음 푸시를 보내 백그라운드 앱을
// 깨우고 FCM 토큰 갱신을 유도한다. push_log_t는 기록하지 않는다(Python도 카운트 로깅만).
//
// 대상 조회(우선순위 병합):
//   (1) GetTokenExpiringSoon(now+30d): 만료 임박 회원(만료일 ASC) — 우선순위 앞.
//   (2) GetTokenList(): 토큰 보유 활성 회원 전체(만료일 무관) — 우선순위 제외분만 뒤에.
// 즉 토큰 보유 활성 회원 전체이며, 만료 임박자를 앞에 배치하는 순서만 보장한다.
//
// 토큰 무효화 보수정책(핵심): SendEach 응답에서 per-message Unregistered/SenderIDMismatch를
// 감지하면 shouldInvalidateToken 가드(24h 미경과/만료 미도래면 거부)를 통과한 경우에만 토큰을
// 비운다. 일시적 FCM 장애로 정상 토큰을 잃지 않게 하려는 의도(firebase_service.py:1608 이식).

// isUnregisteredErr / isSenderIDMismatchErr은 per-message 에러를 무효화 후보로 분류한다.
// 기본은 firebase SDK의 분류기이며, 테스트는 *internal.FirebaseError를 만들 수 없어(내부 패키지
// import 금지) 이 함수 변수를 오버라이드해 분류를 주입한다(production 동작은 SDK 기본 그대로).
var (
	isUnregisteredErr     = messaging.IsUnregistered
	isSenderIDMismatchErr = messaging.IsSenderIDMismatch
)

// silentExpiryWindow는 만료 임박 판정 창(now+30d)이다(push_jobs.py:186 timedelta(days=30)).
const silentExpiryWindow = 30 * 24 * time.Hour

// silentInvalidateMinAge는 토큰 무효화 보류 최소 경과 시간(24h)이다.
// mt_token_updated_at가 이 시간 이내면 최근 갱신 토큰으로 보고 무효화하지 않는다
// (firebase_service.py:1637).
const silentInvalidateMinAge = 24 * time.Hour

// silentInvalidateExpiryGrace는 만료까지 남은 기간이 이 일수를 초과하면 무효화를 보류하는
// 임계값(30일)이다(firebase_service.py:1646, 7일→30일로 완화됨).
const silentInvalidateExpiryGraceDays = 30

// silentMemberLister는 daily:silent 잡의 대상 조회 동작(소비자 인터페이스)이다.
// *repository.MemberRepository가 만족하며, 테스트는 fake로 대체한다.
type silentMemberLister interface {
	GetTokenExpiringSoon(threshold time.Time) ([]model.Member, error)
	GetTokenList() ([]model.Member, error)
}

// 컴파일 타임에 실 repository가 seam을 만족하는지 확인한다(시그니처 드리프트 방지).
var _ silentMemberLister = (*repository.MemberRepository)(nil)

// silentMemberSrc seam(테스트 주입). nil이면 h.db 기반 실 repository로 폴백.
// (Handlers 구조체 본체 필드는 handler.go에 있고, 여기선 resolve 헬퍼만 둔다.)
func (h *Handlers) resolveSilentMemberSrc(ctx context.Context) silentMemberLister {
	if h.silentSrc != nil {
		return h.silentSrc
	}
	return repository.NewMember(h.db.WithContext(ctx))
}

// silentTarget은 무음 발송 대상 1건이다(무효화 판정에 회원 메타가 필요해 회원 사본을 들고 있다).
type silentTarget struct {
	member   *model.Member // 무효화 가드(mt_token_updated_at/expiry) 판정용
	token    string        // mt_token_id(비어있지 않음 — 쿼리에서 보장)
	reason   string        // priority_token_refresh / scheduled_token_refresh
	priority bool          // 우선순위(만료 임박) 여부
}

// silentDataPayload는 Python send_silent_push_notification(firebase_service.py:597)의 data dict와
// 동등한 문자열 맵을 만든다. buildSilent는 Data를 그대로 통과시키므로 호출자가 채워야 한다.
func silentDataPayload(reason string, now time.Time) map[string]string {
	return map[string]string{
		"silent_push":        "true",
		"reason":             reason,
		"timestamp":          strconv.FormatInt(now.UnixMilli(), 10),
		"token_refresh":      "true",
		"background_wake":    "true",
		"force_token_update": "true",
	}
}

// handleDailySilent는 Python run_send_silent_push_to_all_users(03:00)를 이식한다.
func (h *Handlers) handleDailySilent(ctx context.Context, t *asynq.Task) error {
	return h.runDailySilent(ctx, t)
}

// runDailySilent는 daily:silent 본문이다.
//
//	(1) DailyGuard 멱등(KST 날짜) — Python엔 없던 추가 가드(중복 무음 발송 방지). Redis nil이면 통과.
//	(2) 대상 조회 + 우선순위 병합(만료 임박 앞, 나머지 뒤).
//	(3) fcm.Message{Silent:true, Data:...} 빌드 → SendEach(≤500) 실발송.
//	(4) per-message 결과 집계 + Unregistered/SenderIDMismatch는 보수정책 가드 통과 시에만 토큰 무효화.
//	    push_log_t는 기록하지 않는다(Python 동등).
func (h *Handlers) runDailySilent(ctx context.Context, t *asynq.Task) error {
	jobType := t.Type()
	now := time.Now()

	// (1) 멱등 가드(같은 날 재실행 차단, KST). Python엔 없던 운영 안전 추가.
	date := pushBuildKstDate(now)
	ok, err := DailyGuard(ctx, h.lock, "silent", date)
	if err != nil {
		h.log.Warn("silent push lock error, skipping",
			slog.String("type", jobType), slog.String("err", err.Error()))
		return nil
	}
	if !ok {
		h.log.Info("silent push skipped (already ran today)",
			slog.String("type", jobType), slog.String("date", date))
		return nil
	}

	// (2) 대상 조회 + 우선순위 병합.
	src := h.resolveSilentMemberSrc(ctx)
	priorityMembers, err := src.GetTokenExpiringSoon(now.Add(silentExpiryWindow))
	if err != nil {
		h.log.Error("silent push expiring-soon query failed",
			slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}
	allMembers, err := src.GetTokenList()
	if err != nil {
		h.log.Error("silent push token-list query failed",
			slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}

	targets := mergeSilentTargets(priorityMembers, allMembers)
	if len(targets) == 0 {
		h.log.Info("silent push: no token holders", slog.String("type", jobType))
		return nil
	}

	// (3) 무음 메시지 빌드(토큰은 쿼리에서 비어있지 않음이 보장됨).
	msgs := make([]fcm.Message, 0, len(targets))
	for i := range targets {
		msgs = append(msgs, fcm.Message{
			Token:  targets[i].token,
			Silent: true,
			Data:   silentDataPayload(targets[i].reason, now),
		})
	}

	results, sendErr := h.sendSilentBatches(ctx, jobType, msgs)

	// (4) 결과 집계 + 보수정책 토큰 무효화.
	var successCount, failCount, priorityCount, invalidated int
	for i := range targets {
		if targets[i].priority {
			priorityCount++
		}
		r := results[i]
		if r.success {
			successCount++
			continue
		}
		failCount++
		// 무효화 후보: per-message Unregistered/SenderIDMismatch만.
		if r.err == nil {
			continue
		}
		if !isUnregisteredErr(r.err) && !isSenderIDMismatchErr(r.err) {
			continue
		}
		if h.maybeInvalidateToken(ctx, jobType, &targets[i], now) {
			invalidated++
		}
	}

	h.log.Info("silent push completed",
		slog.String("type", jobType),
		slog.Int("targets", len(targets)),
		slog.Int("priority", priorityCount),
		slog.Int("success", successCount),
		slog.Int("fail", failCount),
		slog.Int("tokens_invalidated", invalidated),
		slog.Bool("send_unavailable", errors.Is(sendErr, fcm.ErrUnavailable)))
	return nil
}

// mergeSilentTargets는 Python의 우선순위 병합(push_jobs.py:194-198)을 이식한다.
// priority(만료 임박, 만료일 ASC) 먼저, all에서 priority mt_idx를 제외한 나머지를 뒤에 붙인다.
func mergeSilentTargets(priority, all []model.Member) []silentTarget {
	prioritySet := make(map[int]struct{}, len(priority))
	out := make([]silentTarget, 0, len(priority)+len(all))
	for i := range priority {
		m := &priority[i]
		prioritySet[m.MtIdx] = struct{}{}
		out = append(out, silentTarget{
			member:   m,
			token:    tokenOf(m),
			reason:   "priority_token_refresh",
			priority: true,
		})
	}
	for i := range all {
		m := &all[i]
		if _, dup := prioritySet[m.MtIdx]; dup {
			continue
		}
		out = append(out, silentTarget{
			member:   m,
			token:    tokenOf(m),
			reason:   "scheduled_token_refresh",
			priority: false,
		})
	}
	return out
}

// tokenOf는 mt_token_id를 안전하게 꺼낸다(쿼리에서 NOT NULL/!= '' 보장이나 방어적으로 처리).
func tokenOf(m *model.Member) string {
	if m.MtTokenID == nil {
		return ""
	}
	return *m.MtTokenID
}

// silentResult는 per-message 발송 결과(성공 여부 + 원본 에러)다.
type silentResult struct {
	success bool
	err     error // per-message 실패 사유(무효화 판정용). nil이면 성공 또는 사유 불명.
}

// sendSilentBatches는 msgs(인덱스 정렬)를 ≤fcmBatchSize 청크로 SendEach 발송하고,
// 각 메시지의 성공 여부 + per-message 에러를 입력과 같은 길이/순서로 돌려준다.
// SendEach 자체 에러(FCM 미초기화 등)면 해당 청크 전체를 실패로 처리하고 그 에러를 반환한다.
func (h *Handlers) sendSilentBatches(ctx context.Context, jobType string, msgs []fcm.Message) ([]silentResult, error) {
	results := make([]silentResult, len(msgs))
	var firstErr error
	for start := 0; start < len(msgs); start += fcmBatchSize {
		end := start + fcmBatchSize
		if end > len(msgs) {
			end = len(msgs)
		}

		resp, err := h.fcm.SendEach(ctx, msgs[start:end])
		if err != nil || resp == nil {
			if firstErr == nil {
				firstErr = err
			}
			level := slog.LevelWarn
			if !errors.Is(err, fcm.ErrUnavailable) {
				level = slog.LevelError
			}
			h.log.Log(ctx, level, "silent push batch send failed",
				slog.String("type", jobType),
				slog.Int("batch_start", start),
				slog.Int("batch_size", end-start),
				slog.Any("err", err))
			for j := start; j < end; j++ {
				results[j] = silentResult{success: false, err: err}
			}
			continue
		}

		for j := 0; j < end-start; j++ {
			if j < len(resp.Responses) && resp.Responses[j] != nil {
				results[start+j] = silentResult{
					success: resp.Responses[j].Success,
					err:     resp.Responses[j].Error,
				}
			}
		}
	}
	return results, firstErr
}

// maybeInvalidateToken은 Unregistered/SenderIDMismatch 토큰을 "관측만" 한다.
//
// ★Python 충실 이식: _handle_token_invalidation(firebase_service.py:1673)은 DB write가
// 전부 주석 처리되어 있어(1713~1719행) mt_token_id/updated_at/expiry_date를 절대 NULL로
// 만들지 않는다. 일시적 FCM 장애로 정상 토큰을 잃지 않으려는 의도다. 따라서 Go도 DB를
// 건드리지 않고, 무효화 후보(가드 통과)였는지 로그로만 남긴다(invalid_tokens.log 동등).
// 반환값은 "관측상 무효화 후보로 집계되었는가"이며 DB 변경은 일어나지 않는다.
func (h *Handlers) maybeInvalidateToken(_ context.Context, jobType string, tg *silentTarget, now time.Time) bool {
	if !shouldInvalidateToken(tg.member, now) {
		// 보수정책: 최근 갱신/미만료 토큰은 보류(정상 토큰 유실 방지).
		h.log.Warn("silent push: token invalidation withheld (conservative policy)",
			slog.String("type", jobType), slog.Int("mt_idx", tg.member.MtIdx))
		return false
	}
	// Python과 동등하게 DB는 변경하지 않고 관측 로그만 남긴다(토큰 보존).
	h.log.Warn("silent push: invalid token observed (not removed; Python keeps token)",
		slog.String("type", jobType), slog.Int("mt_idx", tg.member.MtIdx))
	return true
}

// shouldInvalidateToken은 Python _should_invalidate_token(firebase_service.py:1608)의 보수 가드를
// 이식한다(관측 분류용). 두 가드를 모두 통과해야 "무효화 후보"로 본다:
//   - 24h 가드: mt_token_updated_at가 24시간 이내면 후보 제외(false). 최근 갱신 토큰 보호.
//   - expiry 가드: mt_token_expiry_date가 아직 미도래이고 남은 기간이 30일 초과면 제외(false).
//
// ★중요: Python은 이 가드를 통과해도 _handle_token_invalidation에서 DB를 건드리지 않는다(write
// 전부 주석). 따라서 이 함수의 true는 "무효화 후보로 관측"을 뜻할 뿐, 실제 토큰 삭제는 일어나지
// 않는다(maybeInvalidateToken 참조). 가드 로직을 보존하는 이유는 로그상 후보를 Python과 동일
// 기준으로 분류하기 위함이다.
func shouldInvalidateToken(m *model.Member, now time.Time) bool {
	// 24h 가드: 최근 갱신 토큰은 후보 제외.
	if m.MtTokenUpdatedAt != nil && now.Sub(*m.MtTokenUpdatedAt) < silentInvalidateMinAge {
		return false
	}
	// expiry 가드: 아직 충분히 남은(>30일) 토큰은 후보 제외.
	if m.MtTokenExpiryDate != nil && now.Before(*m.MtTokenExpiryDate) {
		remainingDays := int(m.MtTokenExpiryDate.Sub(now).Hours() / 24)
		if remainingDays > silentInvalidateExpiryGraceDays {
			return false
		}
	}
	return true
}
