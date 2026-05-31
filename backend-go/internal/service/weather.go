package service

import (
	"strconv"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// memberGetter는 WeatherService가 필요로 하는 회원 조회 동작(소비자 인터페이스).
// *repository.MemberRepository가 이를 만족하며, 테스트에서는 fake로 대체한다.
type memberGetter interface {
	GetByID(mtIdx int) (*model.Member, error)
}

// WeatherService는 Python `app/api/v1/endpoints/weather.py`의 GET 엔드포인트 로직을
// 이식한다. 외부 KMA API 호출은 엔드포인트가 아니라 배치 잡(Phase 3) 영역이며,
// 여기서는 member_t의 기존 날씨 컬럼을 그대로 노출한다.
type WeatherService struct {
	repo memberGetter
}

func NewWeather(repo memberGetter) *WeatherService {
	return &WeatherService{repo: repo}
}

// nonEmpty는 Python의 truthy 문자열 검사(None/"" 이 아님)와 동등하다.
func nonEmpty(s *string) bool { return s != nil && *s != "" }

// isoLocalDateTime은 Python datetime.isoformat()(naive, 마이크로초 0이면 생략)과 동등하다.
// member_t의 DATETIME은 초 단위 정밀도이므로 마이크로초 없이 포맷한다.
func isoLocalDateTime(t time.Time) string { return t.Format("2006-01-02T15:04:05") }

// utcNowISO는 Python datetime.utcnow().isoformat()과 동등(마이크로초 포함).
// 임시/예외 응답의 updated_at은 현재 시각이라 동등성 비교 대상에서 제외된다.
func utcNowISO() string { return time.Now().UTC().Format("2006-01-02T15:04:05.000000") }

// GetCurrent는 Python `GET /weather/current`와 동등하다.
// hasUser면 토큰의 mt_idx로 회원을 찾아 날씨 컬럼이 채워져 있으면 그 값을, 아니면
// 임시 기본 데이터를 반환한다. repo 에러는 호출자(핸들러)가 success:false로 변환한다.
func (s *WeatherService) GetCurrent(userID int, hasUser bool) (dto.WeatherCurrentResponse, error) {
	if hasUser {
		member, err := s.repo.GetByID(userID)
		if err != nil {
			return dto.WeatherCurrentResponse{}, err
		}
		if member != nil && member.MtWeatherSky != nil && member.MtWeatherTmx != nil {
			tmx := *member.MtWeatherTmx
			// temp_min = mt_weather_tmn or (tmx - 5)  — tmn이 falsy(nil/0)면 tmx-5.
			tmin := tmx - 5
			if member.MtWeatherTmn != nil && *member.MtWeatherTmn != 0 {
				tmin = *member.MtWeatherTmn
			}
			// pop = mt_weather_pop or "20"
			pop := "20"
			if nonEmpty(member.MtWeatherPop) {
				pop = *member.MtWeatherPop
			}
			// location = f"{sido} {gu}" if sido and gu else "현재 위치"
			location := "현재 위치"
			if nonEmpty(member.MtSido) && nonEmpty(member.MtGu) {
				location = *member.MtSido + " " + *member.MtGu
			}
			// updated_at = mt_weather_date.isoformat() if date else utcnow().isoformat()
			updatedAt := utcNowISO()
			if member.MtWeatherDate != nil {
				updatedAt = isoLocalDateTime(*member.MtWeatherDate)
			}
			return dto.WeatherCurrentResponse{
				Success: true,
				Data: dto.WeatherCurrentData{
					Sky:       strconv.Itoa(*member.MtWeatherSky),
					TempMax:   &tmx,
					TempMin:   &tmin,
					Pop:       pop,
					Location:  location,
					UpdatedAt: updatedAt,
				},
			}, nil
		}
	}
	return s.defaultCurrent(), nil
}

// defaultCurrent는 Python의 임시(default) 날씨 응답과 동일하다.
func (s *WeatherService) defaultCurrent() dto.WeatherCurrentResponse {
	tmax := 25
	tmin := 18
	return dto.WeatherCurrentResponse{
		Success: true,
		Data: dto.WeatherCurrentData{
			Sky:       "8",
			TempMax:   &tmax,
			TempMin:   &tmin,
			Pop:       "20",
			Location:  "현재 위치",
			UpdatedAt: utcNowISO(),
		},
	}
}

// CurrentError는 Python의 except 분기 응답(success:false)과 동일하다.
func (s *WeatherService) CurrentError() dto.WeatherCurrentResponse {
	return dto.WeatherCurrentResponse{
		Success: false,
		Message: "날씨 정보를 가져올 수 없습니다.",
		Data: dto.WeatherCurrentData{
			Sky:       "default",
			TempMax:   nil,
			TempMin:   nil,
			Pop:       "0",
			Location:  "정보 없음",
			UpdatedAt: utcNowISO(),
		},
	}
}

// GetMember는 Python `GET /weather/member/{member_id}`와 동등하다.
// 반환 (resp, found, err): found=false면 404, err!=nil이면 500.
func (s *WeatherService) GetMember(memberID int) (*dto.WeatherMemberResponse, bool, error) {
	member, err := s.repo.GetByID(memberID)
	if err != nil {
		return nil, false, err
	}
	if member == nil {
		return nil, false, nil
	}
	// sky = str(sky) if sky is not None else "default"
	sky := "default"
	if member.MtWeatherSky != nil {
		sky = strconv.Itoa(*member.MtWeatherSky)
	}
	// pop = mt_weather_pop or "0"
	pop := "0"
	if nonEmpty(member.MtWeatherPop) {
		pop = *member.MtWeatherPop
	}
	// location = f"{sido} {gu}" if sido and gu else "정보 없음"
	location := "정보 없음"
	if nonEmpty(member.MtSido) && nonEmpty(member.MtGu) {
		location = *member.MtSido + " " + *member.MtGu
	}
	// updated_at = mt_weather_date.isoformat() if date else None
	var updatedAt *string
	if member.MtWeatherDate != nil {
		v := isoLocalDateTime(*member.MtWeatherDate)
		updatedAt = &v
	}
	return &dto.WeatherMemberResponse{
		MtIdx:     member.MtIdx,
		MtName:    member.MtName,
		Sky:       sky,
		TempMax:   member.MtWeatherTmx,
		TempMin:   member.MtWeatherTmn,
		Pop:       pop,
		Location:  location,
		UpdatedAt: updatedAt,
	}, true, nil
}
