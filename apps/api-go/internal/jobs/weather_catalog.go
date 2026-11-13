package jobs

import "strings"

// weather_catalog.go — Python catalog.py TEMPLATE_CATALOG["daily_weather"](catalog.py:135)의
// ko/en 각 10변형을 1:1 인라인 상수로 이식한다.
//
// daily_weather는 AI 미사용(ai_message_service.EVENT_PROMPTS에 없음 → _generate_template None →
// 항상 정적 catalog 사용)이므로 Go는 정적 10변형만 포팅하면 된다.
// 플레이스홀더: {location} {weather} {temp} {humidity}(events.py daily_weather placeholders 4종 필수).

// weatherTemplate은 (title, content) 변형 1쌍이다.
type weatherTemplate struct {
	title   string
	content string
}

// weatherTemplatesKO는 catalog.py:136-147 daily_weather.ko 10변형이다(순서 보존 — variant 인덱스 일치).
var weatherTemplatesKO = []weatherTemplate{
	{"오늘의 날씨 브리핑 ☀️", "{location} 기준 {weather}, {temp}°C, 강수확률 {humidity}%예요. 외출 전 옷차림을 점검해보세요."},
	{"아침 날씨 확인하세요 🌤️", "{location} 날씨는 {weather}이고 기온은 {temp}°C예요. 강수확률은 {humidity}%입니다."},
	{"오늘 하늘 상태를 알려드려요 ☁️", "{location} 기준 {weather}, {temp}°C예요. 강수확률 {humidity}%도 함께 참고해보세요."},
	{"외출 전 날씨 체크 🌦️", "{location} 날씨는 {weather}, 기온은 {temp}°C, 강수확률은 {humidity}%예요."},
	{"오늘 날씨 흐름은 어때요 🌤️", "{location} 기준 {weather}, 기온 {temp}°C, 강수확률 {humidity}%예요. 외출 준비에 참고해보세요."},
	{"하루 시작 전 날씨 요약 ☀️", "{location}은 {weather} 상태예요. 기온은 {temp}°C, 강수확률은 {humidity}%입니다."},
	{"오늘의 하늘 정보예요 ☁️", "{location} 날씨는 {weather}, 기온은 {temp}°C예요. 강수확률은 {humidity}% 수준이에요."},
	{"지금 날씨를 확인해보세요 🌦️", "{location} 기준 {weather}예요. 기온 {temp}°C, 강수확률 {humidity}%를 참고해보세요."},
	{"외출 준비 브리핑 🌤️", "{location} 날씨는 {weather}, 기온은 {temp}°C예요. 강수확률은 {humidity}%입니다."},
	{"오늘 컨디션 체크용 날씨 ☀️", "{location} 기준 {weather}, {temp}°C, 강수확률 {humidity}%예요. 하루 계획 전에 확인해보세요."},
}

// weatherTemplatesEN는 catalog.py:148-159 daily_weather.en 10변형이다(순서 보존).
// ★en9는 title에도 {location}이 있어 title 치환이 필요하다(formatTemplate가 title/content 둘 다 치환).
var weatherTemplatesEN = []weatherTemplate{
	{"Today's Weather Brief ☀️", "Around {location}, it is {weather} at {temp}°C with a {humidity}% chance of rain. Dress accordingly before you head out."},
	{"Morning Weather Check 🌤️", "{location} is {weather} with a temperature of {temp}°C and a {humidity}% chance of rain."},
	{"Weather Update for Today ☁️", "At {location}, expect {weather}, {temp}°C, and a {humidity}% chance of rain."},
	{"Before You Go 🌦️", "{location} is showing {weather}. Temperature is {temp}°C and the chance of rain is {humidity}%."},
	{"Today's Sky at a Glance ☀️", "{location} is {weather}. The temperature is {temp}°C and the chance of rain is {humidity}%."},
	{"Start-of-Day Weather Note 🌤️", "In {location}, the weather is {weather} with {temp}°C and a {humidity}% chance of rain."},
	{"Outdoor Prep Update ☁️", "{location} has {weather} conditions. Expect {temp}°C and a {humidity}% chance of rain."},
	{"Weather Snapshot 🌦️", "For {location}, today's reading is {weather}, {temp}°C, with a {humidity}% chance of rain."},
	{"Weather Conditions for {location} ☀️", "You are looking at {weather}, {temp}°C, and a {humidity}% chance of rain around {location}."},
	{"Daily Weather Reminder 🌤️", "{location} is at {temp}°C with {weather} conditions and a {humidity}% chance of rain."},
}

// weatherTemplates는 Python get_templates(event="daily_weather", lang)(catalog.py:334)와 동등하다.
// lang이 "en"이면 en, 그 외(ko 포함)는 ko 풀을 돌려준다(get_templates의 lang 없으면 ko fallback과 동등).
func weatherTemplates(lang string) []weatherTemplate {
	if lang == "en" {
		return weatherTemplatesEN
	}
	return weatherTemplatesKO
}

// formatTemplate은 Python str.format(**safe_variables)와 동등하게 {key}를 값으로 치환한다.
// catalog 문구의 플레이스홀더는 {location}{weather}{temp}{humidity} 4종뿐이며 모두 vars에 존재한다.
// 단순 문자열 치환이므로 중첩/이스케이프({{}})는 고려하지 않는다(catalog에 그런 패턴 없음).
func formatTemplate(tmpl string, vars map[string]string) string {
	out := tmpl
	for key, val := range vars {
		out = strings.ReplaceAll(out, "{"+key+"}", val)
	}
	return out
}
