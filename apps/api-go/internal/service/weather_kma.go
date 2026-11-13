package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// --- Lambert 격자 변환(Python weather_service.latlong_to_grid 1:1 이식) ----------
//
// 기상청 동네예보 격자 변환 상수. Python(app/services/weather_service.py:11-52)과 byte-동등.
// ⚠️ XO=210/5=42.0, YO=675/5=135.0 (43/136 아님). 반올림은 int(x+1.5)(한국 좌표는 양수라
// floor(x)+1 효과).
const (
	kmaRE    = 6371.00877 // 지구 반경(km)
	kmaGrid  = 5.0        // 격자 간격(km)
	kmaSLAT1 = 30.0       // 표준 위도 1
	kmaSLAT2 = 60.0       // 표준 위도 2
	kmaOLON  = 126.0      // 기준점 경도
	kmaOLAT  = 38.0       // 기준점 위도
	kmaXO    = 210.0 / kmaGrid // 기준점 X좌표(=42.0)
	kmaYO    = 675.0 / kmaGrid // 기준점 Y좌표(=135.0)
)

// Grid는 기상청 격자 좌표(nx, ny)다.
type Grid struct {
	NX int
	NY int
}

// LatLongToGrid는 위/경도를 기상청 격자(nx, ny)로 변환한다.
// Python latlong_to_grid와 항 단위로 동일하다(float64).
func LatLongToGrid(lat, lon float64) Grid {
	degrad := math.Pi / 180.0
	re := kmaRE / kmaGrid
	slat1 := kmaSLAT1 * degrad
	slat2 := kmaSLAT2 * degrad
	olon := kmaOLON * degrad
	olat := kmaOLAT * degrad

	sn := math.Tan(math.Pi*0.25+slat2*0.5) / math.Tan(math.Pi*0.25+slat1*0.5)
	sn = math.Log(math.Cos(slat1)/math.Cos(slat2)) / math.Log(sn)
	sf := math.Tan(math.Pi*0.25 + slat1*0.5)
	sf = math.Pow(sf, sn) * math.Cos(slat1) / sn
	ro := math.Tan(math.Pi*0.25 + olat*0.5)
	ro = re * sf / math.Pow(ro, sn)

	ra := math.Tan(math.Pi*0.25 + lat*degrad*0.5)
	ra = re * sf / math.Pow(ra, sn)
	theta := lon*degrad - olon
	if theta > math.Pi {
		theta -= 2.0 * math.Pi
	}
	if theta < -math.Pi {
		theta += 2.0 * math.Pi
	}
	theta *= sn

	x := ra*math.Sin(theta) + kmaXO
	y := ro - ra*math.Cos(theta) + kmaYO
	// Python int(x+1.5): 양수 입력이라 truncate == floor.
	return Grid{NX: int(x + 1.5), NY: int(y + 1.5)}
}

// --- 기상청(KMA) 동네예보 fetch/parse -----------------------------------------

const kmaForecastURL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"

// Forecast는 한 격자/날짜의 파싱된 예보다. 값이 없으면 해당 포인터가 nil.
type Forecast struct {
	Tmx *int    // 최고기온(°C)
	Tmn *int    // 최저기온(°C)
	Sky *int    // 하늘상태 코드
	Pop *string // 강수확률(예 "60%")
}

// KMAClient는 기상청 동네예보 API 클라이언트다. HTTP client는 앱 수명주기로 공유한다
// (요청마다 생성 금지). serviceKey가 비면 FetchForecast는 즉시 nil을 반환한다.
type KMAClient struct {
	serviceKey string
	httpClient *http.Client
	log        *slog.Logger
}

// NewKMAClient는 timeout 10초 HTTP client를 가진 KMA 클라이언트를 만든다.
func NewKMAClient(serviceKey string, log *slog.Logger) *KMAClient {
	if log == nil {
		log = slog.Default()
	}
	return &KMAClient{
		serviceKey: serviceKey,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		log:        log,
	}
}

// kmaBaseTime은 Python _get_kma_base_datetime의 base_time 규칙을 이식한다.
// 현재 시각(정수 hhmm) 기준 발표 시각을 결정한다. <215면 전일 "2300"이며 이 경우 base_date도
// 전일이어야 하므로 (baseDate, baseTime)을 함께 반환한다.
func kmaBaseDateTime(now time.Time) (string, string) {
	hhmm := now.Hour()*100 + now.Minute()
	switch {
	case hhmm < 215:
		return now.AddDate(0, 0, -1).Format("20060102"), "2300"
	case hhmm < 515:
		return now.Format("20060102"), "0200"
	case hhmm < 815:
		return now.Format("20060102"), "0500"
	case hhmm < 1115:
		return now.Format("20060102"), "0800"
	case hhmm < 1415:
		return now.Format("20060102"), "1100"
	case hhmm < 1715:
		return now.Format("20060102"), "1400"
	case hhmm < 2015:
		return now.Format("20060102"), "1700"
	case hhmm < 2315:
		return now.Format("20060102"), "2000"
	default:
		return now.Format("20060102"), "2300"
	}
}

// kmaResponse는 KMA JSON 응답의 최소 구조다.
type kmaResponse struct {
	Response struct {
		Header struct {
			ResultCode string `json:"resultCode"`
			ResultMsg  string `json:"resultMsg"`
		} `json:"header"`
		Body struct {
			Items struct {
				Item []kmaItem `json:"item"`
			} `json:"items"`
		} `json:"body"`
	} `json:"response"`
}

type kmaItem struct {
	BaseDate   string `json:"baseDate"`
	BaseTime   string `json:"baseTime"`
	Category   string `json:"category"`
	FcstDate   string `json:"fcstDate"`
	FcstTime   string `json:"fcstTime"`
	FcstValue  string `json:"fcstValue"`
	NX         int    `json:"nx"`
	NY         int    `json:"ny"`
}

// FetchForecast는 격자(nx,ny)의 targetDate(YYYYMMDD) 예보를 가져와 파싱한다.
// retry 3회(실패 시 1초 sleep), 전부 실패하면 (nil, err). serviceKey 미설정이면 (nil, nil).
func (c *KMAClient) FetchForecast(ctx context.Context, nx, ny int, targetDate string) (*Forecast, error) {
	if c.serviceKey == "" {
		return nil, nil
	}

	baseDate, baseTime := kmaBaseDateTime(time.Now())

	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(1 * time.Second):
			}
		}

		raw, err := c.fetchRaw(ctx, nx, ny, baseDate, baseTime)
		if err != nil {
			lastErr = err
			c.log.Warn("kma fetch attempt failed",
				slog.Int("attempt", attempt+1),
				slog.Int("nx", nx), slog.Int("ny", ny),
				slog.String("err", err.Error()))
			continue
		}

		fc, perr := parseKMAForecast(raw, targetDate)
		if perr != nil {
			lastErr = perr
			c.log.Warn("kma parse failed",
				slog.Int("nx", nx), slog.Int("ny", ny),
				slog.String("err", perr.Error()))
			continue
		}
		return fc, nil
	}
	return nil, lastErr
}

// fetchRaw는 단일 HTTP GET 요청을 보내고 바디 바이트를 반환한다.
func (c *KMAClient) fetchRaw(ctx context.Context, nx, ny int, baseDate, baseTime string) ([]byte, error) {
	params := url.Values{}
	params.Set("serviceKey", c.serviceKey) // 평문 디코드 키(net/url이 인코딩)
	params.Set("numOfRows", "1000")
	params.Set("pageNo", "1")
	params.Set("dataType", "JSON")
	params.Set("base_date", baseDate)
	params.Set("base_time", baseTime)
	params.Set("nx", strconv.Itoa(nx))
	params.Set("ny", strconv.Itoa(ny))

	reqURL := kmaForecastURL + "?" + params.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("kma http status %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

// numericCategories는 정수 처리 대상 카테고리(Python _NUMERIC_CATEGORIES).
var numericCategories = map[string]bool{
	"TMX": true, "TMN": true, "SKY": true, "POP": true, "TMP": true,
}

// parseKMAForecast는 KMA JSON을 파싱해 targetDate의 예보를 만든다.
// Python parse_kma_forecast(55-146)의 로직을 이식한다:
//   - header.resultCode == "00" 확인
//   - TMX/TMN/SKY/POP는 targetDate 일치 항목의 첫 값, TMP는 fallback용
//   - tmx/tmn 없으면 tmp_today → next_date_tmx/tmn fallback
//   - 둘 다 없으면 (nil, nil) → 호출자 failed_grids 처리
//   - setdefault: tmx↔tmn 상호보완, sky 1, pop "0%". SKY=int, POP="<v>%"
func parseKMAForecast(raw []byte, targetDate string) (*Forecast, error) {
	var resp kmaResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("kma json unmarshal: %w", err)
	}
	if resp.Response.Header.ResultCode != "00" {
		return nil, fmt.Errorf("kma resultCode=%s (%s)",
			resp.Response.Header.ResultCode, resp.Response.Header.ResultMsg)
	}

	items := resp.Response.Body.Items.Item
	if len(items) == 0 {
		return nil, nil
	}

	var tmx, tmn, sky *int
	var pop *string
	var tmpToday *int          // targetDate의 TMP(시간별 기온) 첫 값 — tmx/tmn fallback
	var nextTmx, nextTmn *int  // targetDate 불일치(다음 날 등) TMX/TMN fallback

	for _, it := range items {
		cat := it.Category
		if !numericCategories[cat] {
			continue
		}
		valStr := it.FcstValue
		if valStr == "" {
			continue
		}
		f, err := strconv.ParseFloat(valStr, 64)
		if err != nil {
			continue
		}
		if f <= -900 {
			continue
		}

		match := it.FcstDate == targetDate

		switch cat {
		case "TMX":
			iv, ok := validTemp(f)
			if !ok {
				continue
			}
			if match {
				if tmx == nil {
					v := iv
					tmx = &v
				}
			} else if nextTmx == nil {
				v := iv
				nextTmx = &v
			}
		case "TMN":
			iv, ok := validTemp(f)
			if !ok {
				continue
			}
			if match {
				if tmn == nil {
					v := iv
					tmn = &v
				}
			} else if nextTmn == nil {
				v := iv
				nextTmn = &v
			}
		case "TMP":
			iv, ok := validTemp(f)
			if !ok {
				continue
			}
			if match && tmpToday == nil {
				v := iv
				tmpToday = &v
			}
		case "SKY":
			if match && sky == nil {
				v := int(f)
				sky = &v
			}
		case "POP":
			if match && pop == nil {
				s := strconv.Itoa(int(f)) + "%"
				pop = &s
			}
		}
	}

	// tmx fallback: tmp_today → next_date_tmx.
	if tmx == nil {
		if tmpToday != nil {
			v := *tmpToday
			tmx = &v
		} else if nextTmx != nil {
			v := *nextTmx
			tmx = &v
		}
	}
	// tmn fallback: tmp_today → next_date_tmn.
	if tmn == nil {
		if tmpToday != nil {
			v := *tmpToday
			tmn = &v
		} else if nextTmn != nil {
			v := *nextTmn
			tmn = &v
		}
	}

	// 둘 다 없으면 예보 무효.
	if tmx == nil && tmn == nil {
		return nil, nil
	}

	// setdefault: tmx↔tmn 상호보완.
	if tmx == nil && tmn != nil {
		v := *tmn
		tmx = &v
	}
	if tmn == nil && tmx != nil {
		v := *tmx
		tmn = &v
	}
	// sky 기본 1, pop 기본 "0%".
	if sky == nil {
		v := 1
		sky = &v
	}
	if pop == nil {
		s := "0%"
		pop = &s
	}

	return &Forecast{Tmx: tmx, Tmn: tmn, Sky: sky, Pop: pop}, nil
}

// validTemp는 Python _valid_temp(int(float(val)) 후 -80~60만 유효)와 동등하다.
func validTemp(f float64) (int, bool) {
	iv := int(f)
	if iv < -80 || iv > 60 {
		return 0, false
	}
	return iv, true
}
