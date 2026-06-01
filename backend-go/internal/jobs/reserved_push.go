package jobs

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/hibiken/asynq"

	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// push:reserved(예약 푸시 발송) 잡 구현.
//
// Python 원본: run_send_reserved_push_notifications(app/jobs/push_jobs.py:23, 1분 주기).
//
// 흐름(Python push_jobs.py:30-57):
//  1. now=datetime.now() 1회 캡처.
//  2. get_reserved_pushes(plt_status=1 AND plt_sdate<=now AND plt_show='Y') 조회.
//  3. mt_idx 수집(None/0 제외, set 중복 제거) → prefetch_members 배치 조회.
//  4. 행별로: member 없으면 continue(상태 전이도 안 함) → send_push(token, title, content)
//     단건 발송 → push.plt_status=2(성공)/4(실패), push.plt_sdate=now 메모리 변경.
//  5. 루프 말미 단일 db.commit().
//
// 메시지는 이미 저장된 plt_title/plt_content를 그대로 쓴다(새 메시지/렌더링 없음, 정적).
//
// ★Go 개선(claim-then-send, plt_status=3 신규 상태): Python은 조회(=1)→발송→전이 사이에 락/행
// 선점이 전무해 멀티워커·asynq 재시도가 같은 행을 동시 조회→양쪽 발송(중복)할 수 있다. Go는
// member 검증 통과 직후 ClaimReserved(UPDATE plt_status=3 WHERE plt_idx=? AND plt_status=1)로
// 행을 원자적 선점한 뒤에만 발송한다. affected=1이면 이 워커가 선점(발송), 0이면 다른 워커/이전
// 틱/재시도가 이미 처리(skip)했음을 뜻해 레이스 윈도우를 제거한다.
//   ⚠️plt_status=3(sending)은 Python이 인지하지 못하는 신규 중간 상태다. get_reserved_pushes는
//   plt_status==1만 조회하므로 status=3 행은 Python·Go 혼재(컷오버 과도기)에도 재선택되지 않아
//   중복 안전하다. 단 status=3 도중 크래시 시 행이 3에 고착되므로, 롤백/복구 시 "UPDATE
//   push_log_t SET plt_status=1 WHERE plt_status=3" 정리 쿼리가 필요하다(repository
//   ClaimReserved 주석 및 운영 메모리에 기록).

// reservedSource는 push:reserved 잡이 의존하는 예약 푸시 데이터 동작(소비자 인터페이스)이다.
// *repository.PushLogRepository가 만족하며, 테스트는 fake로 대체한다.
type reservedSource interface {
	GetReserved(now time.Time) ([]model.PushLog, error)
	ClaimReserved(pltIdx int) (int64, error)
	MarkReservedSent(pltIdx int, status int, now time.Time) error
}

// reservedMemberSource는 발송 대상 회원 배치 prefetch 동작(소비자 인터페이스)이다.
// schedule:30min과 동일한 FindByIDs(prefetch_members 동등)를 재사용한다.
type reservedMemberSource interface {
	FindByIDs(ids []int) ([]model.Member, error)
}

// 컴파일 타임에 실 repository가 seam을 만족하는지 확인한다(시그니처 드리프트 방지).
var (
	_ reservedSource       = (*repository.PushLogRepository)(nil)
	_ reservedMemberSource = (*repository.MemberRepository)(nil)
)

// 데이터 접근 seam 해석(테스트 주입 → 없으면 h.db 기반 실 repository 폴백).
func (h *Handlers) resolveReservedSrc(ctx context.Context) reservedSource {
	if h.reservedSrc != nil {
		return h.reservedSrc
	}
	return repository.NewPushLog(h.db.WithContext(ctx))
}

func (h *Handlers) resolveReservedMemberSrc(ctx context.Context) reservedMemberSource {
	if h.reservedMemberSrc != nil {
		return h.reservedMemberSrc
	}
	return repository.NewMember(h.db.WithContext(ctx))
}

// handleReservedPush는 Python run_send_reserved_push_notifications(push_jobs.py:23)를 이식한다.
func (h *Handlers) handleReservedPush(ctx context.Context, t *asynq.Task) error {
	jobType := t.Type()

	// now는 잡 진입 시 1회 캡처(Python now=datetime.now()). 조회 시간창과 발송 후 전이에 동일 사용.
	now := time.Now()

	src := h.resolveReservedSrc(ctx)
	pushes, err := src.GetReserved(now)
	if err != nil {
		// 외부(DB) 장애 — 에러를 올려 asynq가 재시도하도록 한다.
		h.log.Error("reserved push query failed",
			slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}
	if len(pushes) == 0 {
		// Python도 빈 결과면 즉시 return. 운영 가시성을 위해 정보 로그만 남긴다.
		h.log.Info("reserved push: no due pushes", slog.String("type", jobType))
		return nil
	}

	// 발송 대상 회원 배치 prefetch(Python prefetch_members). mt_idx 있는 행만, set 중복 제거.
	// Python: list(set(int(push.mt_idx) for push in reserved_pushes if push.mt_idx)).
	// push.mt_idx가 None/0이면 제외(if push.mt_idx). Go도 nil/0 제외.
	idSet := make(map[int]struct{})
	for i := range pushes {
		if pushes[i].MtIdx != nil && *pushes[i].MtIdx != 0 {
			idSet[*pushes[i].MtIdx] = struct{}{}
		}
	}
	ids := make([]int, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}
	members, err := h.resolveReservedMemberSrc(ctx).FindByIDs(ids)
	if err != nil {
		h.log.Error("reserved push member prefetch failed",
			slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}
	memberMap := make(map[int]*model.Member, len(members))
	for i := range members {
		memberMap[members[i].MtIdx] = &members[i]
	}

	var sentSuccess, sentFail, skippedNoMember, skippedClaimLost int

	for i := range pushes {
		p := &pushes[i]

		// member 없으면 continue(Python if not member: continue — 상태 전이도 안 함,
		// plt_status=1 유지 → 다음 틱 재시도). mt_idx nil/0도 member 조회 실패와 동일하게 skip.
		if p.MtIdx == nil || *p.MtIdx == 0 {
			skippedNoMember++
			continue
		}
		member := memberMap[*p.MtIdx]
		if member == nil {
			skippedNoMember++
			continue
		}

		// ★claim-then-send: member 검증 통과 후 원자적 선점. affected=1만 발송.
		// (Python의 비선점 조회→발송→전이를 발송 전 행 선점으로 대체 — 레이스 윈도우 제거.)
		affected, cErr := src.ClaimReserved(p.PltIdx)
		if cErr != nil {
			// 선점 UPDATE 실패는 DB 장애 — 에러를 올려 재시도(아직 발송 전이라 중복 위험 없음).
			h.log.Error("reserved push claim failed",
				slog.String("type", jobType), slog.Int("plt_idx", p.PltIdx),
				slog.String("err", cErr.Error()))
			return cErr
		}
		if affected == 0 {
			// 다른 워커/이전 틱/재시도가 이미 선점 — 중복 발송 방지로 skip.
			skippedClaimLost++
			continue
		}

		// 단건 발송. 메시지는 저장된 plt_title/plt_content 그대로(새 렌더링 없음).
		// nullable 컬럼이라 nil은 빈 문자열로 역참조(Python은 None을 그대로 send_push에 넘기지만
		// 실제 예약 행은 적재 시 값이 채워져 있다 — 빈 값이어도 토큰 없음과 동일하게 발송 실패 처리).
		success := h.sendReserved(ctx, jobType, p, member)

		status := 4
		if success {
			status = 2
			sentSuccess++
		} else {
			sentFail++
		}

		// 발송 결과로 plt_status=2/4 + plt_sdate=now 영속화(Python 상태 전이 동등).
		// plt_rdate 등 다른 컬럼은 건드리지 않는다.
		if mErr := src.MarkReservedSent(p.PltIdx, status, now); mErr != nil {
			// 결과 영속화 실패는 DB 장애 — 에러를 올려 재시도한다. 단 행은 이미 claim으로 status=3
			// 선점됐으므로 GetReserved(=1)가 재선택하지 않아 중복 발송은 막힌다(status=3 고착 →
			// 롤백 정리 쿼리 대상).
			h.log.Error("reserved push mark sent failed",
				slog.String("type", jobType), slog.Int("plt_idx", p.PltIdx),
				slog.String("err", mErr.Error()))
			return mErr
		}
	}

	h.log.Info("reserved push completed",
		slog.String("type", jobType),
		slog.Int("pushes", len(pushes)),
		slog.Int("sent_success", sentSuccess),
		slog.Int("sent_fail", sentFail),
		slog.Int("skipped_no_member", skippedNoMember),
		slog.Int("skipped_claim_lost", skippedClaimLost))
	return nil
}

// sendReserved는 예약 푸시 1건을 단건 발송하고 성공 여부를 돌려준다(Python send_push 동등).
// 빈/nil 토큰이면 발송하지 않고 실패(false)로 본다(Python send_push: 토큰 없음→{result:False}).
// FCM 미초기화(ErrUnavailable) 등 발송 에러도 실패(false)로 처리한다(Python 예외→{result:False}).
func (h *Handlers) sendReserved(ctx context.Context, jobType string, p *model.PushLog, member *model.Member) bool {
	if member.MtTokenID == nil || *member.MtTokenID == "" {
		// Python: send_push가 토큰 없음을 {result:False, msg:"Missing token"}로 반환(가드 없음).
		return false
	}

	var title, body string
	if p.PltTitle != nil {
		title = *p.PltTitle
	}
	if p.PltContent != nil {
		body = *p.PltContent
	}

	_, err := h.fcm.Send(ctx, fcm.Message{
		Token: *member.MtTokenID,
		Title: title,
		Body:  body,
	})
	if err != nil {
		level := slog.LevelWarn
		if !errors.Is(err, fcm.ErrUnavailable) {
			level = slog.LevelError
		}
		h.log.Log(ctx, level, "reserved push send failed",
			slog.String("type", jobType), slog.Int("plt_idx", p.PltIdx),
			slog.Any("err", err))
		return false
	}
	return true
}
