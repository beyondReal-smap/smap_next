package service

import (
	"strings"
	"testing"
)

type fakeSMSSender struct {
	result   SMSResult
	lastMsg  string
	lastSubj string
	called   bool
}

func (f *fakeSMSSender) SendSMS(phone, message, subject string) SMSResult {
	f.called = true
	f.lastMsg = message
	f.lastSubj = subject
	return f.result
}

type fakeSMSStore struct {
	rateOK  bool
	codes   map[string]string
	stored  map[string]string
	marked  []string
	deleted []string
}

func newFakeSMSStore(rateOK bool) *fakeSMSStore {
	return &fakeSMSStore{rateOK: rateOK, codes: map[string]string{}, stored: map[string]string{}}
}
func (f *fakeSMSStore) CheckRateLimit(p string) bool { return f.rateOK }
func (f *fakeSMSStore) StoreCode(p, c string)        { f.stored[p] = c }
func (f *fakeSMSStore) GetCode(p string) (string, bool) {
	c, ok := f.codes[p]
	return c, ok && c != ""
}
func (f *fakeSMSStore) DeleteCode(p string)   { f.deleted = append(f.deleted, p) }
func (f *fakeSMSStore) MarkVerified(p string) { f.marked = append(f.marked, p) }

func TestSendVerificationCodeSuccess(t *testing.T) {
	sender := &fakeSMSSender{result: SMSResult{Success: true}}
	store := newFakeSMSStore(true)
	r := NewSMSVerify(sender, store).SendVerificationCode("010-1111-2222")
	if !r.Success || r.Error != nil {
		t.Fatalf("성공 오류: %+v", r)
	}
	code, ok := store.stored["01011112222"]
	if !ok || len(code) != 6 {
		t.Fatalf("코드 저장(6자리) 오류: %q", code)
	}
	if !strings.Contains(sender.lastMsg, code) || sender.lastSubj != "SMAP 인증번호" {
		t.Fatalf("발송 메시지/제목 오류: msg=%q subj=%q", sender.lastMsg, sender.lastSubj)
	}
}

func TestSendVerificationCodeRateLimited(t *testing.T) {
	sender := &fakeSMSSender{result: SMSResult{Success: true}}
	store := newFakeSMSStore(false) // 레이트리밋 초과
	r := NewSMSVerify(sender, store).SendVerificationCode("01011112222")
	if r.Success || r.Error == nil || *r.Error != "너무 많은 요청입니다. 잠시 후 다시 시도해주세요." {
		t.Fatalf("레이트리밋 오류: %+v", r)
	}
	if sender.called {
		t.Fatalf("레이트리밋 시 SMS 발송하면 안 됨")
	}
}

func TestSendVerificationCodeSendFail(t *testing.T) {
	sender := &fakeSMSSender{result: SMSResult{Success: false, Message: "발신번호 오류"}}
	store := newFakeSMSStore(true)
	r := NewSMSVerify(sender, store).SendVerificationCode("01011112222")
	if r.Success || r.Error == nil || *r.Error != "발신번호 오류" {
		t.Fatalf("발송 실패 메시지 전달 오류: %+v", r)
	}
	if len(store.stored) != 0 {
		t.Fatalf("발송 실패 시 코드 저장하면 안 됨: %v", store.stored)
	}
}

func TestVerifyCodeNoCode(t *testing.T) {
	store := newFakeSMSStore(true)
	r := NewSMSVerify(&fakeSMSSender{}, store).VerifyCode("01011112222", "123456")
	if r.Success || *r.Error != "인증번호를 먼저 요청해주세요." {
		t.Fatalf("코드없음 오류: %+v", r)
	}
}

func TestVerifyCodeMismatch(t *testing.T) {
	store := newFakeSMSStore(true)
	store.codes["01011112222"] = "654321"
	r := NewSMSVerify(&fakeSMSSender{}, store).VerifyCode("01011112222", "123456")
	if r.Success || *r.Error != "인증번호가 일치하지 않습니다." {
		t.Fatalf("불일치 오류: %+v", r)
	}
}

func TestVerifyCodeMatch(t *testing.T) {
	store := newFakeSMSStore(true)
	store.codes["01011112222"] = "654321"
	r := NewSMSVerify(&fakeSMSSender{}, store).VerifyCode("010-1111-2222", "654321")
	if !r.Success || r.Error != nil {
		t.Fatalf("일치 성공 오류: %+v", r)
	}
	if len(store.deleted) != 1 || len(store.marked) != 1 {
		t.Fatalf("성공 후 코드삭제+인증마킹 누락: del=%v mark=%v", store.deleted, store.marked)
	}
}
