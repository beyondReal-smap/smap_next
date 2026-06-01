package jobs

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"github.com/hibiken/asynq"

	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// 컴파일 타임에 실 repository가 weather seam 인터페이스를 만족하는지 확인한다(시그니처 드리프트 방지).
var (
	_ recentMemberLister = (*repository.MemberRepository)(nil)
	_ weatherSource      = (*repository.MemberRepository)(nil)
)

// 일일 날씨 알림 잡(daily:weather → Go 타입 상수 weather:alert) 구현.
//
// Python 원본: run_send_daily_weather_notifications (app/jobs/daily_jobs.py:160, 07:00).
//   (1) 대상 = Member.get_recently_active(db) — 최근 1주일 접속자(mt_level>1 AND mt_status=1
//       AND mt_ldate >= now-7d). app_induce/battery(GetAllActive)와 달리 최근접속 필터가 있다.
//   (2) 각 회원마다 get_weather_info(db, mt_lat, mt_long)로 좌표 근처(±0.1°)·24h 이내 캐시된
//       날씨를 빌려온다. 없으면 그 회원은 skip("no fresh weather data").
//   (3) 발송 메시지는 daily_weather catalog의 언어별 10변형 중 sha256(event:member:date)%len로
//       결정론 선택(같은 회원·같은 날 같은 문구). AI 미사용(EVENT_PROMPTS에 daily_weather 없음).
//   (4) push_log_t에 적재. plt_condition="일일 - 날씨알림", plt_memo="오늘의 날씨 정보 알림",
//       push_json은 빈 {}가 아니라 weather_info dict 자체(JSON)를 저장한다.
//
// 재사용: DailyGuard(멱등) / sendDailyBatches(배치 발송) / CreateBatch(push_log 일괄 INSERT)는
// daily_push.go의 헬퍼를 그대로 호출한다. variant 선택·catalog·날씨조회·push_json만 신규다.

// --- 대상/날씨 조회 seam -----------------------------------------------------

// recentMemberLister는 날씨 잡이 의존하는 "최근 접속자" 조회 동작(소비자 인터페이스)이다.
// *repository.MemberRepository가 만족하며, 테스트는 fake로 대체한다.
type recentMemberLister interface {
	GetRecentlyActive(days int) ([]model.Member, error)
}

// weatherSource는 날씨 잡이 의존하는 "좌표 근처 캐시 날씨" 조회 동작(소비자 인터페이스)이다.
// Python get_weather_info와 동등하게, 결과 없음은 (nil, nil)로 표현한다.
type weatherSource interface {
	GetWeatherNear(lat, long float64, staleCutoff time.Time) (*repository.WeatherNear, error)
}

// resolveRecentMemberSrc는 주입된 seam이 있으면 그걸, 없으면 h.db 기반 실 repository를 돌려준다.
func (h *Handlers) resolveRecentMemberSrc(ctx context.Context) recentMemberLister {
	if h.weatherMemberSrc != nil {
		return h.weatherMemberSrc
	}
	return repository.NewMember(h.db.WithContext(ctx))
}

// resolveWeatherSrc는 주입된 seam이 있으면 그걸, 없으면 h.db 기반 실 repository를 돌려준다.
func (h *Handlers) resolveWeatherSrc(ctx context.Context) weatherSource {
	if h.weatherSrc != nil {
		return h.weatherSrc
	}
	return repository.NewMember(h.db.WithContext(ctx))
}

// --- 상수: 신선도/날씨조회 파라미터 ------------------------------------------

// weatherStaleHours는 Python WEATHER_STALE_HOURS(weather_service.py:21)와 동등하다.
// mt_weather_date가 이 시간 이내여야 캐시된 날씨를 사용한다(weather_refresh 06:30이 채움).
const weatherStaleHours = 24

// weatherRecentDays는 Python get_recently_active의 기본 days(member.py:123)와 동등하다.
const weatherRecentDays = 7

// --- 날씨 정보(get_weather_info 동등 dict) -----------------------------------

// weatherInfo는 Python get_weather_info가 돌려주는 dict와 1:1 대응한다(키 순서/타입 포함).
//   - Temperature: mt_weather_tmx(최고기온 int). 가공 없음. JSON 키 "temperature".
//   - Weather:     _sky_to_text(mt_weather_sky) 한글 텍스트. JSON 키 "weather".
//   - Humidity:    str(mt_weather_pop or "0").rstrip("%") — 강수확률 문자열. JSON 키 "humidity".
//   - Location:    "{sido} {gu} {dong}".strip() — 공란이면 "". JSON 키 "location".
//
// ★push_json으로 저장될 때 Python json.dumps(ensure_ascii=False)와 동등해야 하므로
// 키 순서를 temperature→weather→humidity→location으로 고정한다(struct 필드 순서가 곧 키 순서).
type weatherInfo struct {
	Temperature int    `json:"temperature"`
	Weather     string `json:"weather"`
	Humidity    string `json:"humidity"`
	Location    string `json:"location"`
}

// skyToText는 Python _sky_to_text(weather_service.py:263)와 동등하다.
//
//	{1:"맑음", 3:"구름많음", 4:"흐림}, default "맑음"(sky가 nil/0이거나 매핑에 없으면 "맑음").
//
// 매핑에 2가 없어 2도 "맑음"으로 떨어진다(Python과 동일).
func skyToText(sky *int) string {
	v := 0
	if sky != nil {
		v = *sky
	}
	switch v {
	case 1:
		return "맑음"
	case 3:
		return "구름많음"
	case 4:
		return "흐림"
	default:
		return "맑음"
	}
}

// buildWeatherInfo는 repository.WeatherNear 행을 Python get_weather_info의 반환 dict로 변환한다.
// temperature는 tmx(없으면 0 — 단 GetWeatherNear는 tmx NOT NULL 조건이라 정상 경로에선 항상 존재).
func buildWeatherInfo(w *repository.WeatherNear) weatherInfo {
	temp := 0
	if w.MtWeatherTmx != nil {
		temp = *w.MtWeatherTmx
	}
	// humidity = str(pop or "0").rstrip("%"): pop이 nil/빈문자면 "0", 그 외 끝의 '%' 제거.
	pop := "0"
	if w.MtWeatherPop != nil && *w.MtWeatherPop != "" {
		pop = *w.MtWeatherPop
	}
	pop = strings.TrimRight(pop, "%")
	// location = "{sido} {gu} {dong}".strip(): 공백 join 후 양끝 공백 제거.
	location := strings.TrimSpace(deref(w.MtSido) + " " + deref(w.MtGu) + " " + deref(w.MtDong))
	return weatherInfo{
		Temperature: temp,
		Weather:     skyToText(w.MtWeatherSky),
		Humidity:    pop,
		Location:    location,
	}
}

// deref는 *string을 ""(nil) 또는 그 값으로 풀어낸다.
func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// marshalPushJSON은 weather_info를 Python json.dumps(ensure_ascii=False)와 동등하게 직렬화한다.
// Go json.Marshal은 기본적으로 <,>,&를 < 등으로 이스케이프하므로 SetEscapeHTML(false)로 끈다
// (Python ensure_ascii=False는 한글을 그대로 두고 HTML 이스케이프도 하지 않는다).
func marshalPushJSON(w weatherInfo) (string, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(w); err != nil {
		return "", err
	}
	// json.Encoder.Encode는 끝에 개행을 붙이므로 제거한다(json.dumps는 개행 없음).
	return strings.TrimRight(buf.String(), "\n"), nil
}

// --- variant 결정론 선택(composer.select_variant_index 이식) ------------------

// selectVariantIndex는 Python composer.select_variant_index(composer.py:11)와 1:1 동등하다.
//
//	seed = "{event_type}:{member_id or 0}:{target_date.isoformat()}"
//	idx  = int(sha256(seed).hexdigest()[:8], 16) % pool_size
//
// hex 앞 8자 == digest 앞 4바이트를 big-endian uint32로 읽은 값과 동일하다.
// poolSize<=1이면 0(Python과 동일). member_id가 0이면 "0"으로 들어간다(Python `member_id or 0`).
func selectVariantIndex(eventType string, memberID int, targetDate string, poolSize int) int {
	if poolSize <= 1 {
		return 0
	}
	seed := eventType + ":" + itoa(memberID) + ":" + targetDate
	sum := sha256.Sum256([]byte(seed))
	return int(binary.BigEndian.Uint32(sum[:4]) % uint32(poolSize))
}

// itoa는 의존성 없이 int를 10진 문자열로 변환한다(음수 미발생 — mt_idx는 양수/0).
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

// --- 핸들러 본문 -------------------------------------------------------------

// handleWeatherAlert는 Python run_send_daily_weather_notifications(daily_jobs.py:160, 07:00)을 이식한다.
func (h *Handlers) handleWeatherAlert(ctx context.Context, t *asynq.Task) error {
	jobType := t.Type()

	// (1) 멱등 가드(KST 날짜). 같은 날 재실행 차단. 락 인프라 없으면 통과.
	date := pushBuildKstDate(time.Now())
	ok, err := DailyGuard(ctx, h.lock, "weather:alert", date)
	if err != nil {
		h.log.Warn("weather alert lock error, skipping",
			slog.String("type", jobType), slog.String("err", err.Error()))
		return nil
	}
	if !ok {
		h.log.Info("weather alert skipped (already ran today)",
			slog.String("type", jobType), slog.String("date", date))
		return nil
	}

	// (2) 대상 = 최근 1주일 접속자(get_recently_active).
	members, err := h.resolveRecentMemberSrc(ctx).GetRecentlyActive(weatherRecentDays)
	if err != nil {
		h.log.Error("weather alert member query failed",
			slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}
	if len(members) == 0 {
		h.log.Info("weather alert: no recently active members", slog.String("type", jobType))
		return nil
	}

	weatherSrc := h.resolveWeatherSrc(ctx)
	staleCutoff := time.Now().Add(-weatherStaleHours * time.Hour)
	now := time.Now()

	// variant 선택 기준일: KST date(스케줄 07:00 KST). composer는 target_date.isoformat()="YYYY-MM-DD".
	variantDate := pushBuildKstDateISO(time.Now())

	// (3) 회원별 날씨조회 → 있으면 variant 메시지 빌드, 없으면 skip.
	var withToken []dailyPushTarget // 토큰 보유 발송 대상
	var tokens []string             // withToken과 인덱스 정렬
	type pendingLog struct {
		mtIdx    int
		title    string
		body     string
		pushJSON string
	}
	// 빈 토큰 회원도 Python처럼 발송 실패(plt_status=4) 로그를 남긴다(행 수 동등).
	var noTokenLogs []pendingLog
	// withToken과 인덱스 정렬되는 per-member push_json/title/body 보관(로그 생성용).
	var sentMeta []pendingLog

	var skippedNoWeather int

	for i := range members {
		m := &members[i]

		// 좌표 없으면 get_weather_info가 None → skip(Python weather_service.py:220).
		if m.MtLat == nil || m.MtLong == nil {
			skippedNoWeather++
			continue
		}
		near, qerr := weatherSrc.GetWeatherNear(*m.MtLat, *m.MtLong, staleCutoff)
		if qerr != nil {
			// Python get_weather_info는 쿼리 예외를 None으로 흡수하고 skip한다(weather_service.py:258).
			// 동등하게 이 회원만 skip(잡 전체는 계속). 단 에러는 로그로 남긴다.
			h.log.Warn("weather alert: weather query error, skipping member",
				slog.Int("mt_idx", m.MtIdx), slog.String("err", qerr.Error()))
			skippedNoWeather++
			continue
		}
		if near == nil {
			// no fresh weather data → skip(Python daily_jobs.py:191).
			skippedNoWeather++
			continue
		}

		wi := buildWeatherInfo(near)

		// location 빈문자열 폴백(daily_jobs.py:176): en→"your area", ko→"현재 위치".
		isEnglish := normalizeLang(m.MtLang) == "en"
		location := wi.Location
		if location == "" {
			if isEnglish {
				location = "your area"
			} else {
				location = "현재 위치"
			}
		}

		// variant 선택(언어별 10변형). lang으로 catalog 풀 선택 후 sha256으로 인덱스 결정.
		lang := normalizeLang(m.MtLang)
		pool := weatherTemplates(lang)
		idx := selectVariantIndex("daily_weather", m.MtIdx, variantDate, len(pool))
		tmpl := pool[idx]

		// 치환 변수: temp는 int를 문자열화, humidity/weather는 문자열, location은 폴백 적용값.
		// Python composer는 모든 변수를 str()로 안전화한다(composer.py:38).
		vars := map[string]string{
			"temp":     itoa(wi.Temperature),
			"weather":  wi.Weather,
			"humidity": wi.Humidity,
			"location": location,
		}
		title := formatTemplate(tmpl.title, vars)
		body := formatTemplate(tmpl.content, vars)

		// push_json = weather_info dict 자체(빈 {} 아님). location은 폴백 미적용 원본값을 저장한다
		// (Python push_json=weather_info는 get_weather_info의 location을 그대로 가지며, 폴백은
		// variables 쪽에만 적용된다 — daily_jobs.py:176/188).
		pushJSON, merr := marshalPushJSON(wi)
		if merr != nil {
			// 직렬화 실패는 사실상 발생하지 않으나, fail-safe로 빈 객체로 폴백하고 로그를 남긴다.
			h.log.Warn("weather alert: push_json marshal failed",
				slog.Int("mt_idx", m.MtIdx), slog.String("err", merr.Error()))
			pushJSON = emptyPushJSON
		}

		if m.MtTokenID == nil || *m.MtTokenID == "" {
			// 토큰 없음 → 발송 실패(plt_status=4). 행은 남긴다(Python 동등).
			noTokenLogs = append(noTokenLogs, pendingLog{mtIdx: m.MtIdx, title: title, body: body, pushJSON: pushJSON})
			continue
		}
		withToken = append(withToken, dailyPushTarget{mtIdx: m.MtIdx, title: title, body: body})
		tokens = append(tokens, *m.MtTokenID)
		sentMeta = append(sentMeta, pendingLog{mtIdx: m.MtIdx, title: title, body: body, pushJSON: pushJSON})
	}

	// (4) FCM 배치 발송(≤500). 결과를 인덱스 정렬로 회수.
	results := h.sendDailyBatches(ctx, jobType, withToken, tokens)

	// (5) push_log_t 행 생성: 빈 토큰(실패) + 발송 결과별.
	var logs []model.PushLog
	for _, p := range noTokenLogs {
		logs = append(logs, buildWeatherPushLog(p.mtIdx, p.title, p.body, now, p.pushJSON, false))
	}
	var successCount, failCount int
	for i, meta := range sentMeta {
		success := results[i]
		if success {
			successCount++
		} else {
			failCount++
		}
		logs = append(logs, buildWeatherPushLog(meta.mtIdx, meta.title, meta.body, now, meta.pushJSON, success))
	}

	if len(logs) > 0 {
		if err := h.resolvePushLogDst(ctx).CreateBatch(logs); err != nil {
			h.log.Error("weather alert log insert failed",
				slog.String("type", jobType), slog.String("err", err.Error()))
			return err
		}
	}

	h.log.Info("weather alert completed",
		slog.String("type", jobType),
		slog.Int("recent_members", len(members)),
		slog.Int("skipped_no_weather", skippedNoWeather),
		slog.Int("sent_success", successCount),
		slog.Int("sent_fail", failCount),
		slog.Int("no_token", len(noTokenLogs)),
		slog.Int("logs_written", len(logs)))
	return nil
}

// pushBuildKstDateISO는 KST 기준 날짜를 ISO(YYYY-MM-DD) 문자열로 만든다.
// composer.select_variant_index의 seed에 들어가는 target_date.isoformat()과 동등하다.
func pushBuildKstDateISO(now time.Time) string {
	loc, err := time.LoadLocation("Asia/Seoul")
	if err != nil {
		loc = time.UTC
	}
	return now.In(loc).Format("2006-01-02")
}

// buildWeatherPushLog는 날씨 잡 전용 push_log_t 행을 구성한다.
// daily_push.go buildPushLog와 컬럼 매핑은 같으나 plt_condition/plt_memo가 고정 상수이고
// push_json이 회원마다 다른 weather_info JSON이라 별도 빌더로 분리한다.
//   - plt_condition="일일 - 날씨알림", plt_memo="오늘의 날씨 정보 알림"(daily_jobs.py:166-167)
//   - plt_type=2, sst_idx=NULL, read_chk='N', show='Y', status 성공2/실패4.
func buildWeatherPushLog(mtIdx int, title, body string, now time.Time, pushJSON string, success bool) model.PushLog {
	pltType := 2
	status := 4
	if success {
		status = 2
	}
	idx := mtIdx
	cond := "일일 - 날씨알림"
	memo := "오늘의 날씨 정보 알림"
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
