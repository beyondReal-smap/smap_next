package service

import (
	"encoding/base64"
	"io"
	"mime"
	"mime/multipart"
	"net/mail"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildVerificationMessagePerPurpose(t *testing.T) {
	cases := []struct {
		purpose, subject, title, desc string
	}{
		{EmailPurposeRegister, "[SMAP] 회원가입 인증번호", "이메일 인증번호를 확인해 주세요", "SMAP 가입을 계속하려면 아래 인증번호를 앱에 입력해 주세요."},
		{EmailPurposeResetPassword, "[SMAP] 비밀번호 재설정 인증번호", "비밀번호 재설정 인증번호예요", "비밀번호를 다시 설정하려면 아래 인증번호를 앱에 입력해 주세요."},
		{EmailPurposeChangeEmail, "[SMAP] 이메일 등록 인증번호", "이메일 등록 인증번호예요", "이 이메일을 SMAP 계정에 등록하려면 아래 인증번호를 앱에 입력해 주세요."},
	}
	const code = "482913"
	for _, c := range cases {
		m, err := buildVerificationMessage(c.purpose, code)
		if err != nil {
			t.Fatalf("%s: %v", c.purpose, err)
		}
		if m.Subject != c.subject || strings.Contains(m.Subject, code) {
			t.Errorf("%s 제목: %q", c.purpose, m.Subject)
		}
		for name, body := range map[string]string{"html": m.HTML, "text": m.Text} {
			for _, want := range []string{c.title, c.desc, "10분 동안 유효해요", "인증번호는 누구에게도 알려 주지 마세요", "직접 요청하지 않았다면 이 메일을 무시해 주세요"} {
				if !strings.Contains(body, want) {
					t.Errorf("%s/%s에 %q 없음", c.purpose, name, want)
				}
			}
			// 숫자 사이에 태그·공백이 없어야 한다(한 덩어리).
			if !strings.Contains(body, code) {
				t.Errorf("%s/%s에 인증번호가 한 덩어리로 없음", c.purpose, name)
			}
		}
		if !strings.Contains(m.HTML, ">"+code+"</td>") {
			t.Errorf("%s: 인증번호 칸이 코드만 담고 있지 않음", c.purpose)
		}
		if !strings.Contains(m.Text, "인증번호: "+code+"\n") {
			t.Errorf("%s: 텍스트 본문 인증번호 줄", c.purpose)
		}
		if !strings.Contains(m.HTML, "인증번호 "+code+" · 10분 안에 입력해 주세요") {
			t.Errorf("%s: 프리헤더 없음", c.purpose)
		}
		for _, banned := range []string{"<img", "<script", "<a ", "display:flex", "display:grid"} {
			if strings.Contains(m.HTML, banned) {
				t.Errorf("%s: 금지 요소 %q", c.purpose, banned)
			}
		}
	}
}

func TestBuildVerificationMessageUnknownPurpose(t *testing.T) {
	if _, err := buildVerificationMessage("bogus", "123456"); err == nil {
		t.Fatal("알 수 없는 purpose는 오류여야 함")
	}
	svc := NewEmail(EmailConfig{Sender: "a@x.test", Password: "pw"})
	called := false
	svc.smtpSendFn = func(string, string, string, string) error { called = true; return nil }
	err := svc.SendVerificationCode("u@x.test", "123456", "bogus")
	if err == nil || called {
		t.Fatalf("발송 없이 오류여야 함: err=%v called=%v", err, called)
	}
	if strings.Contains(err.Error(), "123456") || strings.Contains(err.Error(), "u@x.test") {
		t.Fatalf("에러에 코드·주소 노출: %v", err)
	}
}

func TestSendVerificationCodePassesRenderedMessage(t *testing.T) {
	svc := NewEmail(EmailConfig{Sender: "a@x.test", Password: "pw"})
	var subj, html, text string
	svc.smtpSendFn = func(_, s, h, tx string) error { subj, html, text = s, h, tx; return nil }
	if err := svc.SendVerificationCode("u@x.test", "654321", EmailPurposeResetPassword); err != nil {
		t.Fatal(err)
	}
	if subj != "[SMAP] 비밀번호 재설정 인증번호" || !strings.Contains(html, "654321") || !strings.Contains(text, "인증번호: 654321") {
		t.Fatalf("렌더 결과가 전달되지 않음: %q", subj)
	}
}

func TestBuildMIMEStructureAndFrom(t *testing.T) {
	m, err := buildVerificationMessage(EmailPurposeRegister, "482913")
	if err != nil {
		t.Fatal(err)
	}
	raw := buildMIME("admin@aiagnt.kr", "u@x.test", m.Subject, m.Text, m.HTML)
	msg, err := mail.ReadMessage(strings.NewReader(string(raw)))
	if err != nil {
		t.Fatal(err)
	}
	from, err := mail.ParseAddress(msg.Header.Get("From"))
	if err != nil || from.Name != "SMAP" || from.Address != "admin@aiagnt.kr" {
		t.Fatalf("From: %q %v", msg.Header.Get("From"), err)
	}
	subj, err := new(mime.WordDecoder).DecodeHeader(msg.Header.Get("Subject"))
	if err != nil || subj != "[SMAP] 회원가입 인증번호" {
		t.Fatalf("Subject: %q %v", subj, err)
	}
	mt, params, err := mime.ParseMediaType(msg.Header.Get("Content-Type"))
	if err != nil || mt != "multipart/alternative" {
		t.Fatalf("Content-Type: %q %v", mt, err)
	}
	mr := multipart.NewReader(msg.Body, params["boundary"])
	var types []string
	for {
		p, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		pt, pp, _ := mime.ParseMediaType(p.Header.Get("Content-Type"))
		types = append(types, pt)
		if !strings.EqualFold(pp["charset"], "UTF-8") {
			t.Errorf("%s charset: %q", pt, pp["charset"])
		}
		b64, _ := io.ReadAll(p)
		dec, err := base64.StdEncoding.DecodeString(strings.NewReplacer("\r", "", "\n", "").Replace(string(b64)))
		if err != nil {
			t.Fatalf("%s base64: %v", pt, err)
		}
		if !strings.Contains(string(dec), "482913") {
			t.Errorf("%s 본문에 인증번호 없음", pt)
		}
	}
	if len(types) != 2 || types[0] != "text/plain" || types[1] != "text/html" {
		t.Fatalf("파트 순서: %v", types)
	}
}

// SMTP 봉투 발신자(MAIL FROM)는 표시 이름 없이 주소만 쓴다: sendGmail은 client.Mail(s.sender)에 주소 문자열만 넘긴다.
func TestEnvelopeSenderIsBareAddress(t *testing.T) {
	src, err := os.ReadFile("email.go")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(src), "client.Mail(s.sender)") {
		t.Fatal("봉투 발신자는 s.sender(주소만)여야 함")
	}
}

// SMAP_EMAIL_PREVIEW_DIR가 설정된 경우에만 purpose별 HTML 미리보기를 파일로 저장한다(디자인 검수용).
func TestWriteEmailPreviews(t *testing.T) {
	dir := os.Getenv("SMAP_EMAIL_PREVIEW_DIR")
	if dir == "" {
		t.Skip("SMAP_EMAIL_PREVIEW_DIR 미설정")
	}
	for _, p := range []string{EmailPurposeRegister, EmailPurposeResetPassword, EmailPurposeChangeEmail} {
		m, err := buildVerificationMessage(p, "482913")
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, p+".html"), []byte(m.HTML), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}
