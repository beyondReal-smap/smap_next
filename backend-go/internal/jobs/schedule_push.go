package jobs

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/hibiken/asynq"

	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// schedule:30min(일정 시작 30분 전 알림) 잡 구현.
//
// Python 원본: run_schedule_notification(app/jobs/push_jobs.py:65).
// 잡 이름은 "30min"이지만 실제 실행 주기는 1분이고(scheduler.py IntervalTrigger minutes=1),
// 대상 조회도 "이번 1분 버킷" 기준이다. "30분"은 알림 문구상의 의미(미리 적재된 알림 예정시각이
// 일정 시작 30분 전을 가리킴)이지 실행 주기가 아니다.
//
// 흐름(Python push_jobs.py:65-114):
//  1. get_now_schedule_push: 이번 분에 알림 예정인 미발송 일정 조회.
//  2. 소유자 일괄 prefetch.
//  3. 일정별로: 소유자 검증 → 소유자 발송 + push_log → (그룹 일정이면) 멤버 fan-out 발송 + log
//     → sst_schedule_chk='Y' 마킹.
//  4. 루프 종료 후 단일 커밋.
//
// ★Go 개선(claim-then-send): Python은 "발송 후 루프 말미 일괄 마킹"이라 발송-커밋 사이 크래시나
// 분산 환경에서 중복(at-least-once)이 가능하다. Go는 소유자 검증 통과 직후 ClaimSchedule
// (조건부 UPDATE sst_schedule_chk='Y' WHERE chk='N')로 행을 원자적 선점한 뒤에만 발송한다.
// affected=1이면 이 워커가 선점(발송), 0이면 다른 워커/이전 틱이 이미 처리(skip)했음을 뜻해
// 레이스 윈도우를 제거한다. 마킹 컬럼/값과 발송 대상·메시지는 Python과 동일하다.
// (Redis 슬롯키 같은 추가 멱등은 도입하지 않는다 — DB 행 선점만으로 충분하므로 과잉 회피.)

// scheduleMessage는 schedule_start 정적 폴백 문구다(push_jobs.py:34-43 인라인 dict).
// 본문에 {title}(일정명) 플레이스홀더 1개가 있고, 시각은 "30분"으로 고정 표현된다.
var scheduleMessage = localizedMessage{
	titleKO:   "일정 시작 알림 ⏰",
	contentKO: "'{title}' 일정이 30분 후에 시작해요!",
	titleEN:   "Schedule Start Alert ⏰",
	contentEN: "Schedule '{title}' starts in 30 minutes!",
}

// schedulePltCondition / schedulePltMemo는 push_log_t에 들어가는 잡 식별 문자열이다
// (push_jobs.py:77-78).
const (
	schedulePltCondition = "1분 - 일정알림"
	schedulePltMemo      = "일정 시작 30분 전 알림"
	scheduleEventTitle   = "일정" // schedule_title fallback(sst_title or "일정")
)

// renderScheduleMessage는 정적 폴백 메시지의 {title} 플레이스홀더를 일정명으로 치환한다.
// Python render_push_message는 AI/캐시 경로가 있으나 이번 이식은 정적 폴백만이며,
// fallback_template[...].format(title=...)과 동등하게 단일 치환만 수행한다.
func renderScheduleMessage(mtLang *string, scheduleTitle string) (string, string) {
	title, content := scheduleMessage.pick(mtLang)
	return strings.ReplaceAll(title, "{title}", scheduleTitle),
		strings.ReplaceAll(content, "{title}", scheduleTitle)
}

// scheduleSource는 schedule:30min 잡이 의존하는 일정 데이터 동작(소비자 인터페이스)이다.
// *repository.ScheduleRepository가 만족하며, 테스트는 fake로 대체한다.
type scheduleSource interface {
	GetNowSchedulePush() ([]model.Schedule, error)
	ClaimSchedule(sstIdx int) (int64, error)
}

// scheduleMemberSource는 소유자 prefetch 동작(소비자 인터페이스)이다.
type scheduleMemberSource interface {
	FindByIDs(ids []int) ([]model.Member, error)
}

// scheduleGroupSource는 그룹 fan-out 대상 조회 동작(소비자 인터페이스)이다.
type scheduleGroupSource interface {
	GetGroupMembersWithRoles(sgtIdx int) ([]model.GroupRoleMember, error)
}

// 컴파일 타임에 실 repository가 seam을 만족하는지 확인한다(시그니처 드리프트 방지).
var (
	_ scheduleSource       = (*repository.ScheduleRepository)(nil)
	_ scheduleMemberSource = (*repository.MemberRepository)(nil)
	_ scheduleGroupSource  = (*repository.GroupMemberRepository)(nil)
)

// 데이터 접근 seam 해석(테스트 주입 → 없으면 h.db 기반 실 repository 폴백).
func (h *Handlers) resolveScheduleSrc(ctx context.Context) scheduleSource {
	if h.scheduleSrc != nil {
		return h.scheduleSrc
	}
	return repository.NewSchedule(h.db.WithContext(ctx))
}

func (h *Handlers) resolveScheduleMemberSrc(ctx context.Context) scheduleMemberSource {
	if h.scheduleMemberSrc != nil {
		return h.scheduleMemberSrc
	}
	return repository.NewMember(h.db.WithContext(ctx))
}

func (h *Handlers) resolveScheduleGroupSrc(ctx context.Context) scheduleGroupSource {
	if h.scheduleGroupSrc != nil {
		return h.scheduleGroupSrc
	}
	return repository.NewGroupMember(h.db.WithContext(ctx))
}

// scheduleTarget은 발송 1건(소유자 1 또는 그룹 멤버 N)이다. push_log 적재에 sst_idx가 필요해
// 일정 식별자를 함께 들고 있다.
type scheduleTarget struct {
	mtIdx  int
	sstIdx int
	token  string
	title  string
	body   string
}

// handleSchedule30Min은 Python run_schedule_notification(push_jobs.py:65)을 이식한다.
func (h *Handlers) handleSchedule30Min(ctx context.Context, t *asynq.Task) error {
	jobType := t.Type()

	// (1) 대상 일정 조회(이번 1분 버킷, 미발송).
	scheduleSrc := h.resolveScheduleSrc(ctx)
	schedules, err := scheduleSrc.GetNowSchedulePush()
	if err != nil {
		// 외부(DB) 장애 — 에러를 올려 asynq가 재시도하도록 한다.
		h.log.Error("schedule push query failed",
			slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}
	if len(schedules) == 0 {
		// Python도 빈 결과면 즉시 return(로그 없음). 운영 가시성을 위해 디버그성 정보만 남긴다.
		h.log.Info("schedule push: no due schedules", slog.String("type", jobType))
		return nil
	}

	// (2) 소유자 일괄 prefetch(Python prefetch_members). mt_idx 있는 일정의 소유자만.
	ownerIDSet := make(map[int]struct{})
	for i := range schedules {
		if schedules[i].MtIdx != nil {
			ownerIDSet[*schedules[i].MtIdx] = struct{}{}
		}
	}
	ownerIDs := make([]int, 0, len(ownerIDSet))
	for id := range ownerIDSet {
		ownerIDs = append(ownerIDs, id)
	}
	owners, err := h.resolveScheduleMemberSrc(ctx).FindByIDs(ownerIDs)
	if err != nil {
		h.log.Error("schedule push owner prefetch failed",
			slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}
	ownerMap := make(map[int]*model.Member, len(owners))
	for i := range owners {
		ownerMap[owners[i].MtIdx] = &owners[i]
	}

	groupSrc := h.resolveScheduleGroupSrc(ctx)

	// (3) 일정별 발송 대상 수집(claim 선점 통과한 일정만).
	var targets []scheduleTarget
	var claimedSchedules, skippedNoOwner, skippedClaimLost, groupSchedules int

	for i := range schedules {
		s := &schedules[i]

		// 소유자 검증(Python: owner 없거나 토큰 없으면 continue — 마킹도 안 함).
		if s.MtIdx == nil {
			skippedNoOwner++
			continue
		}
		owner := ownerMap[*s.MtIdx]
		if owner == nil || owner.MtTokenID == nil || *owner.MtTokenID == "" {
			skippedNoOwner++
			continue
		}

		// ★claim-then-send: 소유자 검증 통과 후 원자적 선점. affected=1만 발송.
		// (Python의 "발송 후 일괄 마킹"을 발송 전 행 선점으로 대체 — 레이스 윈도우 제거.)
		affected, cErr := scheduleSrc.ClaimSchedule(s.SstIdx)
		if cErr != nil {
			// 선점 UPDATE 실패는 DB 장애 — 에러를 올려 재시도(아직 발송 전이라 중복 위험 없음).
			h.log.Error("schedule push claim failed",
				slog.String("type", jobType), slog.Int("sst_idx", s.SstIdx),
				slog.String("err", cErr.Error()))
			return cErr
		}
		if affected == 0 {
			// 다른 워커/이전 틱이 이미 선점 — 중복 발송 방지로 skip.
			skippedClaimLost++
			continue
		}
		claimedSchedules++

		scheduleTitle := scheduleEventTitle
		if s.SstTitle != nil && *s.SstTitle != "" {
			scheduleTitle = *s.SstTitle
		}

		// 소유자 발송 대상.
		oTitle, oBody := renderScheduleMessage(owner.MtLang, scheduleTitle)
		targets = append(targets, scheduleTarget{
			mtIdx:  owner.MtIdx,
			sstIdx: s.SstIdx,
			token:  *owner.MtTokenID,
			title:  oTitle,
			body:   oBody,
		})

		// 그룹 일정이면 멤버 fan-out(Python: sgt_idx is not None일 때만).
		if s.SgtIdx == nil {
			continue
		}
		groupSchedules++
		roles, gErr := groupSrc.GetGroupMembersWithRoles(*s.SgtIdx)
		if gErr != nil {
			// 그룹 조회 실패: Python get_group_members_with_roles는 예외 시 빈 dict를 반환해
			// 소유자에게만 보내고 계속 진행한다. 동등하게 fan-out만 건너뛰고 진행한다.
			h.log.Warn("schedule push group query failed (owner-only fallback)",
				slog.String("type", jobType), slog.Int("sgt_idx", *s.SgtIdx),
				slog.String("err", gErr.Error()))
			continue
		}

		for _, fm := range fanoutGroupMembers(roles, owner.MtIdx) {
			mTitle, mBody := renderScheduleMessage(fm.MtLang, scheduleTitle)
			targets = append(targets, scheduleTarget{
				mtIdx:  fm.MtIdx,
				sstIdx: s.SstIdx,
				token:  *fm.MtTokenID,
				title:  mTitle,
				body:   mBody,
			})
		}
	}

	if len(targets) == 0 {
		h.log.Info("schedule push: no send targets",
			slog.String("type", jobType),
			slog.Int("schedules", len(schedules)),
			slog.Int("skipped_no_owner", skippedNoOwner),
			slog.Int("skipped_claim_lost", skippedClaimLost))
		return nil
	}

	// (4) FCM 배치 발송(≤500). 일정명이 수신자마다 달라 메시지가 1건씩 다르므로 SendEach 사용.
	results := h.sendScheduleBatches(ctx, jobType, targets)

	// (5) 발송 결과별 push_log_t 적재(소유자/그룹 멤버 각 1행, sst_idx 채움).
	now := time.Now()
	logs := make([]model.PushLog, 0, len(targets))
	var successCount, failCount int
	for i := range targets {
		success := results[i]
		if success {
			successCount++
		} else {
			failCount++
		}
		logs = append(logs, buildSchedulePushLog(&targets[i], now, success))
	}

	if err := h.resolvePushLogDst(ctx).CreateBatch(logs); err != nil {
		// 로그 적재 실패는 발송 자체와 별개 — 에러를 올려 재시도한다. 단 일정은 이미 claim으로
		// chk='Y' 선점됐으므로 재시도 시 GetNowSchedulePush가 재선택하지 않아 중복 발송은 막힌다.
		h.log.Error("schedule push log insert failed",
			slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}

	h.log.Info("schedule push completed",
		slog.String("type", jobType),
		slog.Int("schedules", len(schedules)),
		slog.Int("claimed", claimedSchedules),
		slog.Int("group_schedules", groupSchedules),
		slog.Int("targets", len(targets)),
		slog.Int("sent_success", successCount),
		slog.Int("sent_fail", failCount),
		slog.Int("skipped_no_owner", skippedNoOwner),
		slog.Int("skipped_claim_lost", skippedClaimLost))
	return nil
}

// fanoutGroupMembers는 Python push_jobs.py:75-76의 대상 산정을 이식한다.
// 대상 = [owner_role, leader_role] + members 합치되, 다음 둘을 모두 만족하는 행만:
//   - 일정 소유자와 mt_idx가 다름(str 비교로 중복 제외 → 정수 비교로 동등)
//   - mt_token_id 보유(NULL/빈 문자열 제외)
//
// 역할 분류는 Python GroupDetail.get_group_members_with_roles와 동일: owner_chk='Y'→owner,
// 아니고 leader_chk='Y'→leader, 나머지→members. owner/leader가 여럿이면 마지막 행만 채택
// (Python 단일 대입과 동등). 반환 순서는 owner, leader, 그다음 members(쿼리 순서)다.
func fanoutGroupMembers(roles []model.GroupRoleMember, ownerMtIdx int) []model.GroupRoleMember {
	var owner, leader *model.GroupRoleMember
	var members []model.GroupRoleMember
	for i := range roles {
		r := &roles[i]
		switch {
		case r.SgdtOwnerChk != nil && *r.SgdtOwnerChk == "Y":
			owner = r
		case r.SgdtLeaderChk != nil && *r.SgdtLeaderChk == "Y":
			leader = r
		default:
			members = append(members, *r)
		}
	}

	ordered := make([]model.GroupRoleMember, 0, len(roles))
	if owner != nil {
		ordered = append(ordered, *owner)
	}
	if leader != nil {
		ordered = append(ordered, *leader)
	}
	ordered = append(ordered, members...)

	out := make([]model.GroupRoleMember, 0, len(ordered))
	for _, m := range ordered {
		if m.MtIdx == ownerMtIdx { // 일정 소유자 본인 중복 제외(Python str 비교 동등)
			continue
		}
		if m.MtTokenID == nil || *m.MtTokenID == "" {
			continue
		}
		out = append(out, m)
	}
	return out
}

// sendScheduleBatches는 targets(인덱스 정렬)를 ≤fcmBatchSize 청크로 SendEach 발송하고,
// 각 메시지의 성공 여부를 targets와 같은 길이/순서의 []bool로 돌려준다.
// SendEach 자체 에러(FCM 미초기화 등)면 해당 청크 전체를 실패로 처리한다(fail-soft).
func (h *Handlers) sendScheduleBatches(ctx context.Context, jobType string, targets []scheduleTarget) []bool {
	results := make([]bool, len(targets))
	for start := 0; start < len(targets); start += fcmBatchSize {
		end := start + fcmBatchSize
		if end > len(targets) {
			end = len(targets)
		}

		msgs := make([]fcm.Message, 0, end-start)
		for i := start; i < end; i++ {
			msgs = append(msgs, fcm.Message{
				Token:         targets[i].token,
				Title:         targets[i].title,
				Body:          targets[i].body,
				TimeSensitive: true,
				Silent:        false,
			})
		}

		resp, err := h.fcm.SendEach(ctx, msgs)
		if err != nil || resp == nil {
			level := slog.LevelWarn
			if !errors.Is(err, fcm.ErrUnavailable) {
				level = slog.LevelError
			}
			h.log.Log(ctx, level, "schedule push batch send failed",
				slog.String("type", jobType),
				slog.Int("batch_start", start),
				slog.Int("batch_size", end-start),
				slog.Any("err", err))
			continue // results는 false 기본값 유지.
		}

		for j := 0; j < end-start; j++ {
			if j < len(resp.Responses) && resp.Responses[j] != nil {
				results[start+j] = resp.Responses[j].Success
			}
		}
	}
	return results
}

// buildSchedulePushLog는 Python push_log_add(push_service.py:143)의 컬럼 매핑을 구성한다.
// daily 잡(buildPushLog)과 동일하되 sst_idx를 일정 식별자로 채우고, plt_condition/plt_memo가
// 일정 잡 전용 문자열이다.
//   - plt_type=2(고정), sst_idx=일정, plt_read_chk='N', plt_show='Y'
//   - plt_status: 발송 성공 2 / 실패 4
//   - plt_sdate=plt_wdate=now, plt_rdate=NULL, push_json="{}"
func buildSchedulePushLog(tg *scheduleTarget, now time.Time, success bool) model.PushLog {
	pltType := 2
	status := 4
	if success {
		status = 2
	}
	idx := tg.mtIdx
	sst := tg.sstIdx
	cond := schedulePltCondition
	memo := schedulePltMemo
	ttl := tg.title
	cnt := tg.body
	readChk := "N"
	show := "Y"
	pj := emptyPushJSON
	sdate := now
	wdate := now
	return model.PushLog{
		PltType:      &pltType,
		MtIdx:        &idx,
		SstIdx:       &sst,
		PltCondition: &cond,
		PltMemo:      &memo,
		PltTitle:     &ttl,
		PltContent:   &cnt,
		PltSdate:     &sdate,
		PltStatus:    &status,
		PltReadChk:   &readChk,
		PltShow:      &show,
		PushJSON:     &pj,
		PltWdate:     &wdate,
		PltRdate:     nil,
	}
}
