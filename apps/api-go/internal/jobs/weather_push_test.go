package jobs

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/hibiken/asynq"

	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// --- weather 잡 전용 fake ----------------------------------------------------

// fakeRecentMemberSrc는 recentMemberLister fake다(GetRecentlyActive 캡처).
type fakeRecentMemberSrc struct {
	members  []model.Member
	err      error
	calls    int
	lastDays int
}

func (f *fakeRecentMemberSrc) GetRecentlyActive(days int) ([]model.Member, error) {
	f.calls++
	f.lastDays = days
	return f.members, f.err
}

// fakeWeatherSrc는 weatherSource fake다. lat,long으로 미리 등록한 날씨를 돌려주며,
// 등록 없으면 (nil, nil)(= no fresh weather → skip)를 반환한다.
type fakeWeatherSrc struct {
	// byMtIdx 대신 좌표 키로 매핑하면 부동소수 비교가 불안정하므로, 호출 순서대로 응답을 큐잉한다.
	// 테스트는 회원 순서를 알고 있으므로 슬라이스 인덱스로 1:1 대응시킨다.
	responses []*repository.WeatherNear
	calls     int
	err       error
}

func (f *fakeWeatherSrc) GetWeatherNear(lat, long float64, staleCutoff time.Time) (*repository.WeatherNear, error) {
	idx := f.calls
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	if idx < len(f.responses) {
		return f.responses[idx], nil
	}
	return nil, nil
}

// newWeatherTestHandlers는 weather seam이 주입된 Handlers를 만든다(DB 미사용).
func newWeatherTestHandlers(sender *fakeSender, lock locker, rsrc recentMemberLister, wsrc weatherSource, dst pushLogWriter) *Handlers {
	h := newTestHandlers(sender, lock, nil, dst)
	h.weatherMemberSrc = rsrc
	h.weatherSrc = wsrc
	return h
}

// makeWeatherMember는 좌표/언어/토큰을 가진 테스트 회원을 만든다(intptr은 다른 테스트 파일에 정의됨).
func makeWeatherMember(idx int, token string, lang *string, lat, long *float64) model.Member {
	m := model.Member{MtIdx: idx, MtLang: lang, MtLat: lat, MtLong: long}
	if token != "" {
		m.MtTokenID = &token
	}
	return m
}

func f64(v float64) *float64 { return &v }

// --- 테스트 ------------------------------------------------------------------

// TestSelectVariantIndex_PythonParity는 composer.select_variant_index와 동일한 인덱스를
// 산출하는지 검증한다(Python에서 미리 계산한 oracle 값과 1:1 대조).
func TestSelectVariantIndex_PythonParity(t *testing.T) {
	cases := []struct {
		memberID int
		date     string
		pool     int
		want     int
	}{
		{1186, "2026-06-01", 10, 6},
		{1, "2026-06-01", 10, 3},
		{0, "2026-06-01", 10, 7},
		{999999, "2026-05-31", 10, 5},
		{42, "2026-06-01", 1, 0}, // pool<=1 → 0
	}
	for _, c := range cases {
		got := selectVariantIndex("daily_weather", c.memberID, c.date, c.pool)
		if got != c.want {
			t.Errorf("selectVariantIndex(daily_weather, %d, %s, %d) = %d, want %d",
				c.memberID, c.date, c.pool, got, c.want)
		}
	}
}

// TestSelectVariantIndex_Deterministic는 같은 입력이 항상 같은 인덱스를 주는지(결정론) 검증한다.
func TestSelectVariantIndex_Deterministic(t *testing.T) {
	first := selectVariantIndex("daily_weather", 1186, "2026-06-01", 10)
	for i := 0; i < 50; i++ {
		if got := selectVariantIndex("daily_weather", 1186, "2026-06-01", 10); got != first {
			t.Fatalf("non-deterministic: iteration %d got %d, first %d", i, got, first)
		}
	}
}

// TestSkyToText_Mapping은 _sky_to_text 매핑(1/3/4 + default "맑음", 2→default)을 검증한다.
func TestSkyToText_Mapping(t *testing.T) {
	cases := []struct {
		in   *int
		want string
	}{
		{intptr(1), "맑음"},
		{intptr(2), "맑음"}, // 매핑에 2 없음 → default
		{intptr(3), "구름많음"},
		{intptr(4), "흐림"},
		{intptr(0), "맑음"},
		{nil, "맑음"},
		{intptr(99), "맑음"},
	}
	for _, c := range cases {
		if got := skyToText(c.in); got != c.want {
			t.Errorf("skyToText(%v) = %q, want %q", c.in, got, c.want)
		}
	}
}

// TestBuildWeatherInfo_Fields는 get_weather_info 반환 dict 변환(temperature/weather/humidity/location)을
// 검증한다(pop '%' 제거, location 공백 join+strip 포함).
func TestBuildWeatherInfo_Fields(t *testing.T) {
	sido, gu, dong := "서울특별시", "강남구", "역삼동"
	pop := "60%"
	w := &repository.WeatherNear{
		MtWeatherSky: intptr(3),
		MtWeatherTmx: intptr(25),
		MtWeatherPop: &pop,
		MtSido:       &sido,
		MtGu:         &gu,
		MtDong:       &dong,
	}
	wi := buildWeatherInfo(w)
	if wi.Temperature != 25 {
		t.Errorf("temperature = %d, want 25", wi.Temperature)
	}
	if wi.Weather != "구름많음" {
		t.Errorf("weather = %q, want 구름많음", wi.Weather)
	}
	if wi.Humidity != "60" {
		t.Errorf("humidity = %q, want 60 (%% stripped)", wi.Humidity)
	}
	if wi.Location != "서울특별시 강남구 역삼동" {
		t.Errorf("location = %q", wi.Location)
	}

	// pop nil → "0", 위치 전부 공란 → "".
	w2 := &repository.WeatherNear{MtWeatherSky: intptr(1), MtWeatherTmx: intptr(10)}
	wi2 := buildWeatherInfo(w2)
	if wi2.Humidity != "0" {
		t.Errorf("nil pop humidity = %q, want 0", wi2.Humidity)
	}
	if wi2.Location != "" {
		t.Errorf("empty location = %q, want empty", wi2.Location)
	}
}

// TestMarshalPushJSON_NoHTMLEscape는 push_json이 한글/특수문자를 이스케이프 없이(ensure_ascii=False
// 동등) 직렬화하고 키 순서가 temperature→weather→humidity→location인지 검증한다.
func TestMarshalPushJSON_NoHTMLEscape(t *testing.T) {
	wi := weatherInfo{Temperature: 25, Weather: "맑음", Humidity: "30", Location: "서울 강남 <역삼>"}
	s, err := marshalPushJSON(wi)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}
	// HTML 이스케이프가 꺼져 있어야 한다: 켜져 있으면 '<'/'>'/'&'가 유니코드 이스케이프
	// 시퀀스(예 <)로 바뀐다. 그런 시퀀스가 없어야 한다.
	uLess := "\\u00" + "3c"  // "<" 6글자(에디터 mangling 회피 위해 분할 구성)
	uGreat := "\\u00" + "3e" // ">"
	uAmp := "\\u00" + "26"   // "&"
	for _, esc := range []string{uLess, uGreat, uAmp} {
		if strings.Contains(s, esc) {
			t.Errorf("push_json must not contain HTML-escaped %q: %s", esc, s)
		}
	}
	// raw '<역삼>'이 그대로(ensure_ascii=False 동등) 남아야 한다.
	if !strings.Contains(s, "<역삼>") {
		t.Errorf("push_json lost raw '<역삼>': %s", s)
	}
	// 키 순서 검증.
	wantPrefix := `{"temperature":25,"weather":"맑음","humidity":"30","location":`
	if !strings.HasPrefix(s, wantPrefix) {
		t.Errorf("push_json key order/prefix mismatch: %s", s)
	}
	// 유효 JSON인지 라운드트립.
	var back weatherInfo
	if err := json.Unmarshal([]byte(s), &back); err != nil {
		t.Errorf("push_json not valid JSON: %v", err)
	}
	if back != wi {
		t.Errorf("roundtrip mismatch: %+v vs %+v", back, wi)
	}
}

// TestHandleWeatherAlert_TargetAndSkip는 ①대상=최근 1주일 접속자(GetRecentlyActive(7)),
// ②날씨 없는 회원 skip, ③날씨 있는 회원만 발송/로그, ④push_json=weather_info JSON을 검증한다.
func TestHandleWeatherAlert_TargetAndSkip(t *testing.T) {
	ko := "ko"
	lat, long := f64(37.5), f64(127.0)
	members := []model.Member{
		makeWeatherMember(1, "tok-1", &ko, lat, long), // 날씨 있음 → 발송
		makeWeatherMember(2, "tok-2", &ko, lat, long), // 날씨 없음(nil 응답) → skip
		makeWeatherMember(3, "tok-3", &ko, nil, nil),  // 좌표 없음 → skip(쿼리 호출 안 함)
		makeWeatherMember(4, "", &ko, lat, long),      // 날씨 있음 + 빈 토큰 → 실패 로그(status 4)
	}

	sido, gu, dong := "서울특별시", "강남구", "역삼동"
	pop := "40%"
	weather1 := &repository.WeatherNear{
		MtWeatherSky: intptr(1), MtWeatherTmx: intptr(22), MtWeatherPop: &pop,
		MtSido: &sido, MtGu: &gu, MtDong: &dong,
	}
	// 응답 큐: 회원3은 좌표 없어 쿼리를 호출하지 않으므로 큐에서 건너뛴다.
	//   호출1=member1(weather1), 호출2=member2(nil), 호출3=member4(weather1 재사용)
	wsrc := &fakeWeatherSrc{responses: []*repository.WeatherNear{weather1, nil, weather1}}

	sender := &fakeSender{allSuccess: true}
	rsrc := &fakeRecentMemberSrc{members: members}
	dst := &fakePushLogDst{}
	h := newWeatherTestHandlers(sender, &fakeLocker{acquired: true}, rsrc, wsrc, dst)

	task := asynq.NewTask(TypeWeatherAlert, nil)
	if err := h.handleWeatherAlert(context.Background(), task); err != nil {
		t.Fatalf("handleWeatherAlert error: %v", err)
	}

	// ① 대상 조회 1회 + days=7.
	if rsrc.calls != 1 {
		t.Errorf("GetRecentlyActive calls = %d, want 1", rsrc.calls)
	}
	if rsrc.lastDays != 7 {
		t.Errorf("GetRecentlyActive days = %d, want 7", rsrc.lastDays)
	}

	// ② 날씨 쿼리는 좌표 있는 회원만(1,2,4 = 3회). 회원3(좌표 nil)은 호출 안 함.
	if wsrc.calls != 3 {
		t.Errorf("GetWeatherNear calls = %d, want 3 (members with coords)", wsrc.calls)
	}

	// ③ 발송 = 날씨 있고 토큰 보유(member1)뿐. member4는 토큰 없어 발송 제외.
	sent := sender.allSentMessages()
	if len(sent) != 1 {
		t.Fatalf("sent messages = %d, want 1 (member1)", len(sent))
	}

	// ④ push_log 행: member1(성공) + member4(빈 토큰 실패) = 2행. member2/3은 날씨없음/좌표없음 skip.
	if len(dst.logs) != 2 {
		t.Fatalf("push_log rows = %d, want 2", len(dst.logs))
	}
	var status2, status4 int
	for _, l := range dst.logs {
		if l.PltCondition == nil || *l.PltCondition != "일일 - 날씨알림" {
			t.Errorf("plt_condition = %v, want 일일 - 날씨알림", l.PltCondition)
		}
		if l.PltMemo == nil || *l.PltMemo != "오늘의 날씨 정보 알림" {
			t.Errorf("plt_memo = %v", l.PltMemo)
		}
		if l.PltType == nil || *l.PltType != 2 {
			t.Errorf("plt_type = %v, want 2", l.PltType)
		}
		// push_json은 빈 {}가 아니라 weather_info JSON이어야 한다.
		if l.PushJSON == nil || *l.PushJSON == "{}" {
			t.Errorf("push_json should be weather_info JSON, got %v", l.PushJSON)
		}
		if l.PushJSON != nil {
			if !strings.Contains(*l.PushJSON, `"temperature":22`) || !strings.Contains(*l.PushJSON, `"weather":"맑음"`) {
				t.Errorf("push_json content unexpected: %s", *l.PushJSON)
			}
		}
		switch {
		case l.PltStatus != nil && *l.PltStatus == 2:
			status2++
		case l.PltStatus != nil && *l.PltStatus == 4:
			status4++
		}
	}
	if status2 != 1 || status4 != 1 {
		t.Errorf("status counts success(2)=%d fail(4)=%d, want 1/1", status2, status4)
	}
}

// TestHandleWeatherAlert_VariantSubstitution는 선택된 variant 문구가 변수로 치환되고
// 같은 회원·같은 날 항상 같은 문구가 나오는지(결정론) 검증한다.
func TestHandleWeatherAlert_VariantSubstitution(t *testing.T) {
	ko := "ko"
	lat, long := f64(37.5), f64(127.0)
	member := makeWeatherMember(1186, "tok", &ko, lat, long)

	sido, gu, dong := "서울특별시", "강남구", "역삼동"
	pop := "30%"
	weather := &repository.WeatherNear{
		MtWeatherSky: intptr(1), MtWeatherTmx: intptr(20), MtWeatherPop: &pop,
		MtSido: &sido, MtGu: &gu, MtDong: &dong,
	}

	run := func() string {
		wsrc := &fakeWeatherSrc{responses: []*repository.WeatherNear{weather}}
		sender := &fakeSender{allSuccess: true}
		rsrc := &fakeRecentMemberSrc{members: []model.Member{member}}
		dst := &fakePushLogDst{}
		h := newWeatherTestHandlers(sender, &fakeLocker{acquired: true}, rsrc, wsrc, dst)
		task := asynq.NewTask(TypeWeatherAlert, nil)
		if err := h.handleWeatherAlert(context.Background(), task); err != nil {
			t.Fatalf("error: %v", err)
		}
		sent := sender.allSentMessages()
		if len(sent) != 1 {
			t.Fatalf("sent = %d, want 1", len(sent))
		}
		return sent[0].Title + "||" + sent[0].Body
	}

	first := run()
	// 결정론: 여러 번 실행해도 같은 문구.
	for i := 0; i < 5; i++ {
		if got := run(); got != first {
			t.Fatalf("non-deterministic message: %q vs %q", got, first)
		}
	}

	// 치환 검증: location/temp/weather/humidity가 채워졌고 플레이스홀더 잔존 없음.
	body := strings.SplitN(first, "||", 2)[1]
	if strings.Contains(body, "{") || strings.Contains(body, "}") {
		t.Errorf("unsubstituted placeholder remains: %q", body)
	}
	for _, want := range []string{"서울특별시 강남구 역삼동", "맑음", "20", "30"} {
		if !strings.Contains(body, want) {
			t.Errorf("body missing %q: %q", want, body)
		}
	}

	// variant 인덱스가 oracle(6)과 일치하는지 추가 확인(KST date 기준이라 날짜는 런타임 의존이므로
	// 인덱스 계산만 별도로 검증). pushBuildKstDateISO(now)를 직접 써서 동일 입력으로 대조.
	today := pushBuildKstDateISO(time.Now())
	idx := selectVariantIndex("daily_weather", 1186, today, len(weatherTemplatesKO))
	wantTitle := formatTemplate(weatherTemplatesKO[idx].title, map[string]string{
		"temp": "20", "weather": "맑음", "humidity": "30", "location": "서울특별시 강남구 역삼동",
	})
	gotTitle := strings.SplitN(first, "||", 2)[0]
	if gotTitle != wantTitle {
		t.Errorf("selected variant title = %q, want %q (idx %d)", gotTitle, wantTitle, idx)
	}
}

// TestHandleWeatherAlert_LocationFallback는 빈 location일 때 언어별 폴백(en→"your area",
// ko→"현재 위치")이 발송 문구에 적용되고, push_json의 location은 폴백 미적용 원본("")인지 검증한다.
func TestHandleWeatherAlert_LocationFallback(t *testing.T) {
	en := "en"
	lat, long := f64(40.0), f64(-74.0)
	member := makeWeatherMember(7, "tok-en", &en, lat, long)

	pop := "10%"
	// 위치 컬럼 전부 nil → location "".
	weather := &repository.WeatherNear{MtWeatherSky: intptr(4), MtWeatherTmx: intptr(15), MtWeatherPop: &pop}

	wsrc := &fakeWeatherSrc{responses: []*repository.WeatherNear{weather}}
	sender := &fakeSender{allSuccess: true}
	rsrc := &fakeRecentMemberSrc{members: []model.Member{member}}
	dst := &fakePushLogDst{}
	h := newWeatherTestHandlers(sender, &fakeLocker{acquired: true}, rsrc, wsrc, dst)

	task := asynq.NewTask(TypeWeatherAlert, nil)
	if err := h.handleWeatherAlert(context.Background(), task); err != nil {
		t.Fatalf("error: %v", err)
	}

	sent := sender.allSentMessages()
	if len(sent) != 1 {
		t.Fatalf("sent = %d, want 1", len(sent))
	}
	// 발송 문구(en)에는 "your area" 폴백 적용.
	if !strings.Contains(sent[0].Body, "your area") {
		t.Errorf("en empty-location body should contain 'your area': %q", sent[0].Body)
	}
	// push_json의 location은 폴백 미적용 원본 ""(weather_info 그대로).
	if len(dst.logs) != 1 {
		t.Fatalf("logs = %d, want 1", len(dst.logs))
	}
	if pj := dst.logs[0].PushJSON; pj == nil || !strings.Contains(*pj, `"location":""`) {
		t.Errorf("push_json location should be raw empty, got %v", pj)
	}
}

// TestHandleWeatherAlert_IdempotentSkip는 DailyGuard 2회차(락 미획득)에서 조회/발송/로그를
// 전혀 하지 않고 skip하는지 검증한다.
func TestHandleWeatherAlert_IdempotentSkip(t *testing.T) {
	ko := "ko"
	lat, long := f64(37.5), f64(127.0)
	rsrc := &fakeRecentMemberSrc{members: []model.Member{makeWeatherMember(1, "t", &ko, lat, long)}}
	wsrc := &fakeWeatherSrc{}
	sender := &fakeSender{allSuccess: true}
	dst := &fakePushLogDst{}
	h := newWeatherTestHandlers(sender, &fakeLocker{acquired: false}, rsrc, wsrc, dst)

	task := asynq.NewTask(TypeWeatherAlert, nil)
	if err := h.handleWeatherAlert(context.Background(), task); err != nil {
		t.Fatalf("skip path should not error: %v", err)
	}
	if rsrc.calls != 0 {
		t.Errorf("GetRecentlyActive should not be called on skip, calls=%d", rsrc.calls)
	}
	if wsrc.calls != 0 {
		t.Errorf("GetWeatherNear should not be called on skip, calls=%d", wsrc.calls)
	}
	if sender.calls != 0 {
		t.Errorf("SendEach should not be called on skip, calls=%d", sender.calls)
	}
	if dst.calls != 0 {
		t.Errorf("CreateBatch should not be called on skip, calls=%d", dst.calls)
	}
}
