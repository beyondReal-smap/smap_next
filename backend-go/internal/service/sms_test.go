package service

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSendSMSSuccess(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		if got := r.FormValue("receiver"); got != "01012345678" {
			t.Errorf("receiver 하이픈 미제거: %q", got)
		}
		if r.FormValue("msg_type") != "SMS" || r.FormValue("testmode_yn") != "N" {
			t.Errorf("고정 폼필드 누락: %v", r.Form)
		}
		_, _ = w.Write([]byte(`{"result_code":"1","message":"success","msg_id":1234567}`))
	}))
	defer ts.Close()

	svc := NewSMS(SMSConfig{UserID: "u", Key: "k", Sender: "s"})
	svc.aligoURL = ts.URL
	r := svc.SendSMS("010-1234-5678", "hello", "SMAP")
	if !r.Success || r.Message != "SMS가 성공적으로 발송되었습니다." {
		t.Fatalf("성공 결과 오류: %+v", r)
	}
	if r.MsgID == nil || *r.MsgID != "1234567" {
		t.Fatalf("msg_id 변환 오류: %v", r.MsgID)
	}
}

func TestSendSMSFailureMessage(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"result_code":"0","message":"등록되지 않은 발신번호"}`))
	}))
	defer ts.Close()
	svc := NewSMS(SMSConfig{})
	svc.aligoURL = ts.URL
	r := svc.SendSMS("01000000000", "m", "SMAP")
	if r.Success || r.Message != "등록되지 않은 발신번호" {
		t.Fatalf("실패 메시지 오류: %+v", r)
	}
}

// Python `result.get('result_code') == '1'`: result_code가 숫자 1이면 문자열 "1"과 불일치 → 실패(충실).
func TestSendSMSNumericResultCodeIsFailure(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"result_code":1,"message":"numeric"}`))
	}))
	defer ts.Close()
	svc := NewSMS(SMSConfig{})
	svc.aligoURL = ts.URL
	r := svc.SendSMS("01000000000", "m", "SMAP")
	if r.Success || r.Message != "numeric" {
		t.Fatalf("숫자 result_code는 실패여야: %+v", r)
	}
}

func TestSendSMSHTMLParseFail(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`<html><body>error</body></html>`))
	}))
	defer ts.Close()
	svc := NewSMS(SMSConfig{})
	svc.aligoURL = ts.URL
	r := svc.SendSMS("01000000000", "m", "SMAP")
	if r.Success || !strings.HasPrefix(r.Message, "API 응답 파싱 실패:") {
		t.Fatalf("HTML 파싱실패 처리 오류: %+v", r)
	}
}

func TestSendSMSNoMessageKey(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"result_code":"0"}`))
	}))
	defer ts.Close()
	svc := NewSMS(SMSConfig{})
	svc.aligoURL = ts.URL
	r := svc.SendSMS("01000000000", "m", "SMAP")
	if r.Success || r.Message != "알 수 없는 오류" {
		t.Fatalf("message 키 없을 때 기본값 오류: %+v", r)
	}
}
