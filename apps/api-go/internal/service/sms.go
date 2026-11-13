package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// SMSConfig는 SMSService가 의존하는 Aligo/Fixie 설정만 담는다(config 직접의존 회피).
type SMSConfig struct {
	UserID   string
	Key      string
	Sender   string
	FixieURL string // 비어있으면 프록시 미사용
}

// SMSResult는 Python sms_service.send_sms의 반환 dict와 동등하다({success, message, msg_id}).
type SMSResult struct {
	Success bool
	Message string
	MsgID   *string
}

// SMSService는 Python app/services/sms_service.py(SMSService 싱글톤)를 이식한다.
// Aligo form-data POST + 선택적 Fixie 프록시. HTTP 클라이언트는 앱 수명주기로 1회 생성한다.
type SMSService struct {
	userID, key, sender string
	aligoURL            string
	useProxy            bool
	client              *http.Client
}

// NewSMS는 설정으로 SMSService를 만든다. FixieURL이 있으면 Transport.Proxy로 프록시 경유한다.
func NewSMS(cfg SMSConfig) *SMSService {
	transport := &http.Transport{}
	useProxy := false
	if cfg.FixieURL != "" {
		if proxyURL, err := url.Parse(cfg.FixieURL); err == nil {
			transport.Proxy = http.ProxyURL(proxyURL)
			useProxy = true
		}
	}
	return &SMSService{
		userID:   cfg.UserID,
		key:      cfg.Key,
		sender:   cfg.Sender,
		aligoURL: "https://apis.aligo.in/send/",
		useProxy: useProxy,
		// Python aiohttp는 명시 타임아웃 없음(기본 5분). 요청 무한 대기 방지를 위해 10s로 둔다.
		client: &http.Client{Timeout: 10 * time.Second, Transport: transport},
	}
}

// SendSMS는 Python sms_service.send_sms와 동등하다. result_code=='1'(문자열)이면 성공.
// JSON 파싱 실패(HTML 등)→result_code='0' 취급 후 실패 분기, 네트워크 예외→오류 메시지.
func (s *SMSService) SendSMS(phoneNumber, message, subject string) SMSResult {
	clean := cleanPhone(phoneNumber)

	form := url.Values{}
	form.Set("user_id", s.userID)
	form.Set("key", s.key)
	form.Set("msg", message)
	form.Set("receiver", clean)
	form.Set("destination", "")
	form.Set("sender", s.sender)
	form.Set("rdate", "")
	form.Set("rtime", "")
	form.Set("testmode_yn", "N")
	form.Set("title", subject)
	form.Set("msg_type", "SMS")

	req, err := http.NewRequest(http.MethodPost, s.aligoURL, strings.NewReader(form.Encode()))
	if err != nil {
		return SMSResult{Success: false, Message: "SMS 발송 중 오류가 발생했습니다: " + err.Error()}
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.client.Do(req)
	if err != nil {
		return SMSResult{Success: false, Message: "SMS 발송 중 오류가 발생했습니다: " + err.Error()}
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result map[string]interface{}
	if json.Unmarshal(body, &result) != nil {
		// Python: HTML 응답 등 파싱 실패 시 result_code='0'으로 생성 → 실패 분기.
		result = map[string]interface{}{
			"result_code": "0",
			"message":     "API 응답 파싱 실패: " + truncateRunes(string(body), 100),
		}
	}

	// Python `result.get('result_code') == '1'`: 문자열 "1"만 성공(숫자 1은 불일치=실패, 충실 보존).
	if rc, _ := result["result_code"].(string); rc == "1" {
		return SMSResult{Success: true, Message: "SMS가 성공적으로 발송되었습니다.", MsgID: jsonValueToStrPtr(result["msg_id"])}
	}
	// Python `result.get('message', '알 수 없는 오류')`.
	msg, ok := result["message"].(string)
	if !ok {
		msg = "알 수 없는 오류"
	}
	return SMSResult{Success: false, Message: msg}
}

// SendPasswordResetSMS는 Python send_password_reset_sms와 동등(비번재설정 링크 SMS).
func (s *SMSService) SendPasswordResetSMS(phoneNumber, resetURL string) SMSResult {
	message := fmt.Sprintf("[SMAP] 비밀번호 재설정 링크\n%s\n1분 내에 사용해주세요.", resetURL)
	return s.SendSMS(phoneNumber, message, "SMAP 비밀번호 재설정")
}

// truncateRunes는 Python s[:n]과 동등(문자 단위 절단).
func truncateRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

// jsonValueToStrPtr는 JSON 값(string/number/nil)을 *string으로 변환한다(msg_id 패스스루용).
// nil→nil, string→그대로, number→정수형 문자열(Aligo msg_id는 정수). Python은 그대로 응답에 흘린다.
func jsonValueToStrPtr(v interface{}) *string {
	switch t := v.(type) {
	case nil:
		return nil
	case string:
		return &t
	case float64:
		s := strconv.FormatFloat(t, 'f', -1, 64)
		return &s
	default:
		s := fmt.Sprint(t)
		return &s
	}
}
