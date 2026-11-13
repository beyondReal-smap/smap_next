package service

import (
	"errors"
	"testing"
)

// 발송 경로 선택: NAVERWORKS 설정이 없으면 API 경로를 건너뛰고 SMTP를 쓴다.
func TestEmailPathSkipsNaverworksWhenUnset(t *testing.T) {
	svc := NewEmail(EmailConfig{Sender: "a@x.test", Password: "pw"})
	nwCalled, smtpCalled := false, false
	svc.nwSendFn = func(string, string, string) bool { nwCalled = true; return true }
	svc.smtpSendFn = func(string, string, string, string) error { smtpCalled = true; return nil }
	if err := svc.SendVerificationCode("u@x.test", "123456"); err != nil {
		t.Fatal(err)
	}
	if nwCalled || !smtpCalled {
		t.Fatalf("nw=%v smtp=%v", nwCalled, smtpCalled)
	}
	smtpCalled = false
	if r := svc.SendPasswordResetEmail("u@x.test", "https://x"); !r.Success || !smtpCalled || nwCalled {
		t.Fatalf("재설정 메일도 SMTP: %+v", r)
	}
}

// NAVERWORKS가 설정되면 API 우선, 실패하면 SMTP 폴백, SMTP도 없으면 에러.
func TestEmailPathNaverworksFirstThenSMTP(t *testing.T) {
	cfg := EmailConfig{NaverworksClientID: "i", NaverworksClientSecret: "s", NaverworksDomain: "d", Sender: "a@x.test", Password: "pw"}
	svc := NewEmail(cfg)
	smtpCalled := false
	svc.nwSendFn = func(string, string, string) bool { return true }
	svc.smtpSendFn = func(string, string, string, string) error { smtpCalled = true; return nil }
	if err := svc.SendVerificationCode("u@x.test", "1"); err != nil || smtpCalled {
		t.Fatalf("API 성공 시 SMTP 미사용: %v %v", err, smtpCalled)
	}
	svc.nwSendFn = func(string, string, string) bool { return false }
	if err := svc.SendVerificationCode("u@x.test", "1"); err != nil || !smtpCalled {
		t.Fatalf("API 실패 시 SMTP 폴백: %v", err)
	}
	only := NewEmail(EmailConfig{NaverworksClientID: "i", NaverworksClientSecret: "s", NaverworksDomain: "d"})
	only.nwSendFn = func(string, string, string) bool { return false }
	if err := only.SendVerificationCode("u@x.test", "1"); err == nil || errors.Is(err, ErrMailNotConfigured) {
		t.Fatalf("API만 있고 실패하면 일반 에러: %v", err)
	}
}

func TestEmailSMTPConfigDefaultsAndOverride(t *testing.T) {
	d := NewEmail(EmailConfig{})
	if d.smtpServer != "smtp.gmail.com" || d.smtpPort != 465 {
		t.Fatalf("기본값: %s %d", d.smtpServer, d.smtpPort)
	}
	w := NewEmail(EmailConfig{SMTPServer: "smtp.worksmobile.com", SMTPPort: 465, Sender: "s@x.test"})
	if w.smtpServer != "smtp.worksmobile.com" || w.apiSenderAddress() != "s@x.test" {
		t.Fatal("override/발신 주소")
	}
	if d.apiSenderAddress() != "admin@smap.site" {
		t.Fatal("EMAIL_SENDER 비면 기존 고정 주소 유지")
	}
}
