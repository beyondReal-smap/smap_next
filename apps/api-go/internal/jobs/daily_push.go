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

// 컴파일 타임에 실 repository가 seam 인터페이스를 만족하는지 확인한다(시그니처 드리프트 방지).
var (
	_ memberLister  = (*repository.MemberRepository)(nil)
	_ pushLogWriter = (*repository.PushLogRepository)(nil)
)

// 일일 정적 발송 잡(daily:app_induce / daily:battery) 구현.
//
// Python 원본:
//   - run_trigger_app_execution_at_7_30pm (app/jobs/push_jobs.py:243, 19:30)
//   - run_notify_low_battery_at_9pm        (app/jobs/daily_jobs.py:27, 21:00)
//
// 두 잡은 구조가 동일하다: 활성 회원 전체(mt_level>1 AND mt_status=1)를 조회해 언어별
// 정적 메시지를 발송하고, 발송 결과를 push_log_t에 적재한다(catalog.py 미사용 — 문구는 하드코딩).
// Python은 catalog 동적 경로(AI/composer)와 무관하게 잡 함수 안에 dict를 인라인으로 들고 있다.
//
// FCM 실발송: 빈 토큰 회원을 제외한 배치를 fcm.Sender.SendEach(≤500)로 보낸다(Python의 회원별
// send_push 단건 루프를 배치로 전환 — 발송 결과는 1:1 동등). 빈 토큰 회원도 Python처럼
// "발송 실패(plt_status=4)"로 로그를 남겨 행 수를 동등하게 유지한다.

// pushBuildKstDate는 멱등 가드 키에 쓸 KST(Asia/Seoul) 기준 YYYYMMDD 문자열을 만든다.
// 잡 발송 기준일이 한국 날짜이므로 서버 TZ와 무관하게 KST로 고정한다.
func pushBuildKstDate(now time.Time) string {
	loc, err := time.LoadLocation("Asia/Seoul")
	if err != nil {
		// tzdata 부재 등 — UTC 폴백(키 일관성만 유지되면 멱등 목적엔 충분).
		loc = time.UTC
	}
	return now.In(loc).Format("20060102")
}

// localizedMessage는 언어별 (title, content) 정적 메시지 쌍이다.
type localizedMessage struct {
	titleKO, contentKO string
	titleEN, contentEN string
}

// pick은 Python normalize_lang(mt_lang) 규칙으로 언어를 골라 (title, content)를 반환한다.
// 규칙(jobs/base.py:13): (lang or "ko").strip().lower()이 "en"으로 시작하면 en, 그 외 ko.
func (m localizedMessage) pick(mtLang *string) (string, string) {
	if normalizeLang(mtLang) == "en" {
		return m.titleEN, m.contentEN
	}
	return m.titleKO, m.contentKO
}

// normalizeLang은 Python jobs/base.py normalize_lang과 동등하다.
func normalizeLang(lang *string) string {
	value := "ko"
	if lang != nil {
		value = *lang
	}
	value = trimLower(value)
	if len(value) >= 2 && value[:2] == "en" {
		return "en"
	}
	return "ko"
}

// trimLower는 앞뒤 공백 제거 + 소문자화(ASCII)다. 언어 코드 정규화 전용 경량 구현.
func trimLower(s string) string {
	// 앞뒤 공백 제거.
	start, end := 0, len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	s = s[start:end]
	b := []byte(s)
	for i := range b {
		if b[i] >= 'A' && b[i] <= 'Z' {
			b[i] += 'a' - 'A'
		}
	}
	return string(b)
}

// appInduceMessage는 앱 실행 유도(19:30) 정적 문구다(push_jobs.py:255-264).
var appInduceMessage = localizedMessage{
	titleKO:   "오늘 하루는 어떠셨나요? 🌙",
	contentKO: "오늘의 일정과 위치 기록을 확인해보세요!",
	titleEN:   "How was your day? 🌙",
	contentEN: "Check your today's schedule and location records!",
}

// batteryMessage는 배터리 부족 알림(21:00) 정적 문구다(daily_jobs.py:39-48).
var batteryMessage = localizedMessage{
	titleKO:   "배터리 부족 알림 🔋",
	contentKO: "배터리가 부족해요! 충전해주세요.",
	titleEN:   "Low Battery Alert 🔋",
	contentEN: "Your battery is low! Please charge your device.",
}

// memberLister는 일일 잡이 의존하는 회원 조회 동작(소비자 인터페이스)이다.
// *repository.MemberRepository가 만족하며, 테스트는 fake로 대체한다.
type memberLister interface {
	GetAllActive() ([]model.Member, error)
}

// pushLogWriter는 일일 잡이 의존하는 push_log 적재 동작(소비자 인터페이스)이다.
// *repository.PushLogRepository가 만족하며, 테스트는 fake로 대체한다.
type pushLogWriter interface {
	CreateBatch(logs []model.PushLog) error
}

// resolveMemberSrc는 주입된 seam이 있으면 그걸, 없으면 h.db 기반 실 repository를 돌려준다.
func (h *Handlers) resolveMemberSrc(ctx context.Context) memberLister {
	if h.memberSrc != nil {
		return h.memberSrc
	}
	return repository.NewMember(h.db.WithContext(ctx))
}

// resolvePushLogDst는 주입된 seam이 있으면 그걸, 없으면 h.db 기반 실 repository를 돌려준다.
func (h *Handlers) resolvePushLogDst(ctx context.Context) pushLogWriter {
	if h.pushLogDst != nil {
		return h.pushLogDst
	}
	return repository.NewPushLog(h.db.WithContext(ctx))
}

// fcmBatchSize는 SendEach 1회당 메시지 수 상한이다(FCM SendEach 제약 500).
const fcmBatchSize = 500

// emptyPushJSON은 Python push_log_add에 전달되는 빈 dict {}를 json.dumps한 결과와 동등하다.
const emptyPushJSON = "{}"

// handleDailyAppInduce는 Python run_trigger_app_execution_at_7_30pm(19:30)을 이식한다.
// 활성 회원 전체에 앱 실행 유도 정적 푸시를 발송하고 push_log_t에 결과를 적재한다.
func (h *Handlers) handleDailyAppInduce(ctx context.Context, t *asynq.Task) error {
	return h.runDailyStaticPush(ctx, t, dailyStaticSpec{
		job:          "app_induce",
		pltCondition: "일일 - 앱실행알림",
		pltMemo:      "저녁 7시 30분 앱 실행 알림",
		message:      appInduceMessage,
	})
}

// handleDailyBattery는 Python run_notify_low_battery_at_9pm(21:00)을 이식한다.
// ⚠️ member_t에 배터리 컬럼이 없고 Python 원본도 배터리를 조회하지 않는다(활성 회원 전체에
// 무조건 발송). 따라서 Go도 배터리 필터 없이 활성 회원 전체에 발송하는 것이 1:1 충실 이식이다.
// (작업 맥락의 '50% 이하' 조건은 커밋 17edacf의 AI/composer 동적 경로이며 이 정적 잡과 무관.)
func (h *Handlers) handleDailyBattery(ctx context.Context, t *asynq.Task) error {
	return h.runDailyStaticPush(ctx, t, dailyStaticSpec{
		job:          "battery",
		pltCondition: "일일 - 배터리알림",
		pltMemo:      "저녁 9시 배터리 부족 알림",
		message:      batteryMessage,
	})
}

// dailyStaticSpec은 두 일일 정적 잡의 잡별 상수를 묶는다(구조 동일, 값만 다름).
type dailyStaticSpec struct {
	job          string           // 멱등 키 구성용 잡 이름("app_induce"/"battery")
	pltCondition string           // push_log_t.plt_condition
	pltMemo      string           // push_log_t.plt_memo
	message      localizedMessage // 언어별 정적 문구
}

// runDailyStaticPush는 두 일일 정적 잡의 공통 본문이다.
//
//	(1) DailyGuard 멱등(KST 날짜) — 이미 실행했으면 skip(Redis nil이면 통과).
//	(2) 활성 회원 전체 조회(GetAllActive = mt_level>1 AND mt_status=1).
//	(3) 토큰 보유 회원만 FCM 메시지 빌드 → SendEach(≤500 배치) 실발송.
//	(4) 발송 결과별 push_log_t INSERT(성공 plt_status=2 / 실패 4). 빈 토큰 회원도 실패로 로그.
func (h *Handlers) runDailyStaticPush(ctx context.Context, t *asynq.Task, spec dailyStaticSpec) error {
	jobType := t.Type()

	// (1) 멱등 가드. 같은 날 재실행 차단(KST 기준). 락 인프라 없으면 통과.
	date := pushBuildKstDate(time.Now())
	ok, err := DailyGuard(ctx, h.lock, spec.job, date)
	if err != nil {
		// Redis 통신 실패 — 락 상태 불명. fail-safe로 skip(에러를 삼키지 않고 로그 + nil로 재시도 회피).
		h.log.Warn("daily push lock error, skipping",
			slog.String("type", jobType), slog.String("err", err.Error()))
		return nil
	}
	if !ok {
		h.log.Info("daily push skipped (already ran today)",
			slog.String("type", jobType), slog.String("date", date))
		return nil
	}

	// (2) 활성 회원 전체 조회.
	members, err := h.resolveMemberSrc(ctx).GetAllActive()
	if err != nil {
		// 외부(DB) 장애 — 에러를 올려 asynq가 재시도하도록 한다.
		h.log.Error("daily push member query failed",
			slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}
	if len(members) == 0 {
		h.log.Info("daily push: no active members", slog.String("type", jobType))
		return nil
	}

	now := time.Now()
	pushJSON := emptyPushJSON

	// (3) 토큰 보유 회원만 메시지 빌드. 빈 토큰 회원은 별도로 실패 로그를 만든다(Python 동등).
	var withToken []dailyPushTarget // SendEach 대상(토큰 있음)
	var tokens []string             // withToken과 인덱스 정렬
	var logs []model.PushLog        // 적재할 push_log_t 행
	var noTokenFail int             // 빈 토큰 실패 수(메트릭)

	for i := range members {
		m := &members[i]
		title, body := spec.message.pick(m.MtLang)

		if m.MtTokenID == nil || *m.MtTokenID == "" {
			// Python send_push: 토큰 없으면 result=False → plt_status=4. 행은 그대로 남긴다.
			noTokenFail++
			logs = append(logs, buildPushLog(m.MtIdx, spec, title, body, now, pushJSON, false))
			continue
		}
		withToken = append(withToken, dailyPushTarget{mtIdx: m.MtIdx, title: title, body: body})
		tokens = append(tokens, *m.MtTokenID)
	}

	// (3) FCM 배치 실발송(≤500). 발송 성공/실패를 인덱스 정렬로 회수.
	results := h.sendDailyBatches(ctx, jobType, withToken, tokens)

	// (4) 발송 결과별 push_log_t 행 생성.
	var successCount, failCount int
	for i, p := range withToken {
		success := results[i]
		if success {
			successCount++
		} else {
			failCount++
		}
		logs = append(logs, buildPushLog(p.mtIdx, spec, p.title, p.body, now, pushJSON, success))
	}

	// push_log_t 일괄 INSERT.
	if err := h.resolvePushLogDst(ctx).CreateBatch(logs); err != nil {
		// 로그 적재 실패는 발송 자체와 별개 — 에러를 올려 재시도하면 멱등 가드로 중복 발송은 막힌다
		// (락 보유 중이므로 같은 인스턴스 재시도는 skip, 락 만료 후 재시도 시에만 재발송 위험).
		h.log.Error("daily push log insert failed",
			slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}

	h.log.Info("daily push completed",
		slog.String("type", jobType),
		slog.Int("members", len(members)),
		slog.Int("sent_success", successCount),
		slog.Int("sent_fail", failCount),
		slog.Int("no_token", noTokenFail),
		slog.Int("logs_written", len(logs)))
	return nil
}

// dailyPushTarget은 토큰 보유 발송 대상 1건이다(SendEach 메시지 빌드 + push_log 적재용).
type dailyPushTarget struct {
	mtIdx int
	title string
	body  string
}

// sendDailyBatches는 withToken/tokens(인덱스 정렬)를 ≤fcmBatchSize 청크로 SendEach 발송하고,
// 각 메시지의 성공 여부를 withToken과 같은 길이/순서의 []bool로 돌려준다.
// FCM 비활성(ErrUnavailable) 또는 SendEach 자체 에러면 해당 청크 전체를 실패로 처리한다
// (fail-soft: 잡은 계속 진행하되, 결과는 실패로 정확히 기록).
func (h *Handlers) sendDailyBatches(ctx context.Context, jobType string, withToken []dailyPushTarget, tokens []string) []bool {
	results := make([]bool, len(withToken))
	for start := 0; start < len(withToken); start += fcmBatchSize {
		end := start + fcmBatchSize
		if end > len(withToken) {
			end = len(withToken)
		}

		msgs := make([]fcm.Message, 0, end-start)
		for i := start; i < end; i++ {
			msgs = append(msgs, fcm.Message{
				Token:         tokens[i],
				Title:         withToken[i].title,
				Body:          withToken[i].body,
				TimeSensitive: true,
				Silent:        false,
			})
		}

		resp, err := h.fcm.SendEach(ctx, msgs)
		if err != nil || resp == nil {
			// FCM 미초기화(ErrUnavailable) 또는 전송 호출 실패 — 청크 전체 실패로 기록.
			level := slog.LevelWarn
			if !errors.Is(err, fcm.ErrUnavailable) {
				level = slog.LevelError
			}
			h.log.Log(ctx, level, "daily push batch send failed",
				slog.String("type", jobType),
				slog.Int("batch_start", start),
				slog.Int("batch_size", end-start),
				slog.Any("err", err))
			// results는 false 기본값 유지.
			continue
		}

		// per-message 성공 여부 회수(BatchResponse.Responses는 입력 순서와 정렬).
		for j := 0; j < end-start; j++ {
			if j < len(resp.Responses) && resp.Responses[j] != nil {
				results[start+j] = resp.Responses[j].Success
			}
		}
	}
	return results
}

// buildPushLog는 Python push_service.push_log_add(push_service.py:143)의 컬럼 매핑을 그대로 구성한다.
//   - plt_type=2(고정), sst_idx=NULL(두 잡 모두 None), plt_read_chk='N', plt_show='Y'
//   - plt_status: 발송 성공 2 / 실패 4
//   - plt_sdate=plt_wdate=now, plt_rdate=NULL, push_json="{}"(빈 dict json.dumps)
func buildPushLog(mtIdx int, spec dailyStaticSpec, title, body string, now time.Time, pushJSON string, success bool) model.PushLog {
	pltType := 2
	status := 4
	if success {
		status = 2
	}
	idx := mtIdx
	cond := spec.pltCondition
	memo := spec.pltMemo
	ttl := title
	cnt := body
	readChk := "N"
	show := "Y"
	pj := pushJSON
	sdate := now
	wdate := now
	return model.PushLog{
		PltType:      &pltType,
		MtIdx:        &idx,
		SstIdx:       nil,
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
