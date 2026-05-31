package dto

// WeatherCurrentResponse는 Python `GET /weather/current`의 응답과 동일하다.
// 정상 응답은 {success, data}, 예외 응답은 {success, message, data} 형태이므로
// Message는 omitempty로 두어 정상 응답에서 키가 빠지도록 한다.
type WeatherCurrentResponse struct {
	Success bool               `json:"success"`
	Message string             `json:"message,omitempty"`
	Data    WeatherCurrentData `json:"data"`
}

// WeatherCurrentData는 /weather/current의 data 객체.
// 사용자/기본 응답에서는 temp_max/temp_min이 정수, 예외 응답에서는 null이므로 포인터.
type WeatherCurrentData struct {
	Sky       string `json:"sky"`
	TempMax   *int   `json:"temp_max"`
	TempMin   *int   `json:"temp_min"`
	Pop       string `json:"pop"`
	Location  string `json:"location"`
	UpdatedAt string `json:"updated_at"`
}

// WeatherMemberResponse는 Python `GET /weather/member/{member_id}`의 응답과 동일하다
// (success wrapper 없는 평탄 객체). 키 순서는 Python dict 구성 순서를 따른다.
type WeatherMemberResponse struct {
	MtIdx     int     `json:"mt_idx"`
	MtName    *string `json:"mt_name"`
	Sky       string  `json:"sky"`
	TempMax   *int    `json:"temp_max"`
	TempMin   *int    `json:"temp_min"`
	Pop       string  `json:"pop"`
	Location  string  `json:"location"`
	UpdatedAt *string `json:"updated_at"`
}
