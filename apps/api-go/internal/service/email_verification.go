package service

import (
	"bytes"
	_ "embed"
	"fmt"
	"html/template"
	"strings"
)

//go:embed emailtmpl/verification.html.tmpl
var verificationHTMLSource string

var verificationHTMLTmpl = template.Must(template.New("verification").Parse(verificationHTMLSource))

// verificationCopy는 purpose별 메일 제목·본문 문구다(디자인 지시서 21단계).
type verificationCopy struct {
	Subject     string // 메일 제목(인증번호를 넣지 않는다: 잠금 화면 알림 노출 방지)
	Title       string
	Description string
}

var verificationCopies = map[string]verificationCopy{
	EmailPurposeRegister: {
		Subject:     "[SMAP] 회원가입 인증번호",
		Title:       "이메일 인증번호를 확인해 주세요",
		Description: "SMAP 가입을 계속하려면 아래 인증번호를 앱에 입력해 주세요.",
	},
	EmailPurposeResetPassword: {
		Subject:     "[SMAP] 비밀번호 재설정 인증번호",
		Title:       "비밀번호 재설정 인증번호예요",
		Description: "비밀번호를 다시 설정하려면 아래 인증번호를 앱에 입력해 주세요.",
	},
	EmailPurposeChangeEmail: {
		Subject:     "[SMAP] 이메일 등록 인증번호",
		Title:       "이메일 등록 인증번호예요",
		Description: "이 이메일을 SMAP 계정에 등록하려면 아래 인증번호를 앱에 입력해 주세요.",
	},
}

// verificationMessage는 인증번호 메일의 제목·HTML·텍스트 본문이다.
type verificationMessage struct {
	Subject string
	HTML    string
	Text    string
}

// buildVerificationMessage는 purpose에 맞는 인증번호 메일을 렌더링한다.
// 알 수 없는 purpose는 기본 문구로 숨기지 않고 오류로 반환한다.
// 인증번호는 HTML·텍스트 모두 하나의 텍스트 덩어리로 넣는다(복사·키보드 자동 채우기 인식).
func buildVerificationMessage(purpose, code string) (verificationMessage, error) {
	c, ok := verificationCopies[purpose]
	if !ok {
		return verificationMessage{}, fmt.Errorf("unknown email purpose: %q", purpose)
	}
	var buf bytes.Buffer
	if err := verificationHTMLTmpl.Execute(&buf, struct {
		Subject, Title, Description, Code string
	}{c.Subject, c.Title, c.Description, code}); err != nil {
		return verificationMessage{}, fmt.Errorf("render verification email: %w", err)
	}
	var t strings.Builder
	t.WriteString("SMAP\n\n")
	t.WriteString(c.Title + "\n\n")
	t.WriteString(c.Description + "\n\n")
	t.WriteString("인증번호: " + code + "\n")
	t.WriteString("10분 동안 유효해요.\n\n")
	t.WriteString("인증번호는 누구에게도 알려 주지 마세요. SMAP은 전화나 메시지로 인증번호를 묻지 않아요.\n")
	t.WriteString("직접 요청하지 않았다면 이 메일을 무시해 주세요.\n")
	return verificationMessage{Subject: c.Subject, HTML: buf.String(), Text: t.String()}, nil
}
