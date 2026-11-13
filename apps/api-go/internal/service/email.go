package service

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/smtp"
	"net/url"
	"os"
	"strings"
	"time"
)

// EmailConfig는 EmailService가 의존하는 발송 자격증명만 담는다.
type EmailConfig struct {
	Sender                 string
	Password               string
	SMTPServer             string // 비면 smtp.gmail.com
	SMTPPort               int    // 0이면 465
	NaverworksClientID     string
	NaverworksClientSecret string
	NaverworksDomain       string
}

// EmailResult는 Python email_service.send_password_reset_email 반환 dict와 동등(내부 판정용).
// forgot-password는 이 결과를 무시(로깅만)하므로 응답 byte엔 영향이 없다.
type EmailResult struct {
	Success bool
	Message string
}

// EmailService는 Python app/services/email_service.py(EmailService 싱글톤)를 이식한다.
// 비번재설정 이메일: 네이버웍스 우선 → 실패/미설정 시 Gmail SMTP(465 SSL) 폴백.
// ⚠️ 자격증명 미설정 시 발송은 실패(Python 동일). forgot가 실패를 swallow하므로 응답 무영향.
type EmailService struct {
	smtpServer string
	smtpPort   int
	sender     string
	password   string
	nwClientID string
	nwSecret   string
	nwDomain   string
	client     *http.Client

	// 테스트용 발송 seam(nil이면 실제 경로). 경로 선택 로직만 가짜로 검증하기 위함.
	nwSendFn   func(to, subject, html string) bool
	smtpSendFn func(to, subject, html, text string) error
}

// NewEmail은 설정으로 EmailService를 만든다.
func NewEmail(cfg EmailConfig) *EmailService {
	server, port := cfg.SMTPServer, cfg.SMTPPort
	if server == "" {
		server = "smtp.gmail.com"
	}
	if port == 0 {
		port = 465
	}
	return &EmailService{
		smtpServer: server,
		smtpPort:   port,
		sender:     cfg.Sender,
		password:   cfg.Password,
		nwClientID: cfg.NaverworksClientID,
		nwSecret:   cfg.NaverworksClientSecret,
		nwDomain:   cfg.NaverworksDomain,
		client:     &http.Client{Timeout: 10 * time.Second},
	}
}

const resetEmailSubject = "[SMAP] 비밀번호 재설정 링크"

// SendPasswordResetEmail은 Python send_password_reset_email을 이식한다.
func (s *EmailService) SendPasswordResetEmail(email, resetURL string) EmailResult {
	subject := resetEmailSubject
	html := buildResetEmailHTML(resetURL)
	text := buildResetEmailText(resetURL)

	// 네이버웍스 설정이 모두 있으면 우선 시도, 성공 시 반환.
	if s.nwClientID != "" && s.nwSecret != "" && s.nwDomain != "" {
		if s.deliverNaverworks(email, subject, html) {
			return EmailResult{Success: true, Message: "이메일이 성공적으로 발송되었습니다."}
		}
		// 실패 → Gmail 폴백
	}

	// 개발환경 Mock(네이버웍스 미설정/실패 시) — Python NODE_ENV=='development' 분기.
	if os.Getenv("NODE_ENV") == "development" {
		return EmailResult{Success: true, Message: "이메일이 성공적으로 발송되었습니다. (개발환경 Mock)"}
	}

	// Gmail SMTP 폴백. 자격증명 미설정 시 즉시 실패(Python은 connect 후 login 실패 — 관측 결과 동일).
	if err := s.deliverSMTP(email, subject, html, text); err != nil {
		return EmailResult{Success: false, Message: "이메일 발송에 실패했습니다: " + err.Error()}
	}
	return EmailResult{Success: true, Message: "이메일이 성공적으로 발송되었습니다."}
}

// ErrMailNotConfigured는 네이버웍스·Gmail SMTP 자격증명이 하나도 없어 메일을 보낼 수 없음을 뜻한다.
var ErrMailNotConfigured = errors.New("mail delivery not configured")

const verificationEmailSubject = "[SMAP] 이메일 인증번호"

// SendVerificationCode는 이메일 인증번호 메일을 보낸다(FastAPI send_verification_code와 같은 경로:
// 네이버웍스 우선 → 실패 시 Gmail SMTP 폴백). 비밀번호 재설정 메일과 달리 개발환경 Mock으로 성공을 위장하지 않는다:
// 설정이 없으면 ErrMailNotConfigured, 모든 경로가 실패하면 일반 에러를 반환한다.
// 인증번호·수신 주소는 에러 메시지에 넣지 않는다.
func (s *EmailService) SendVerificationCode(email, code string) error {
	nwConfigured := s.nwClientID != "" && s.nwSecret != "" && s.nwDomain != ""
	gmailConfigured := s.sender != "" && s.password != ""
	if !nwConfigured && !gmailConfigured {
		return ErrMailNotConfigured
	}
	text := fmt.Sprintf("[SMAP] 인증번호는 %s입니다. 10분 이내에 입력해주세요.", code)
	html := "<p>" + text + "</p>"
	if nwConfigured {
		if s.deliverNaverworks(email, verificationEmailSubject, html) {
			return nil
		}
		if !gmailConfigured {
			return errors.New("naverworks send failed")
		}
	}
	if err := s.deliverSMTP(email, verificationEmailSubject, html, text); err != nil {
		return fmt.Errorf("smtp send failed: %w", err)
	}
	return nil
}

func (s *EmailService) deliverNaverworks(to, subject, html string) bool {
	if s.nwSendFn != nil {
		return s.nwSendFn(to, subject, html)
	}
	return s.sendNaverworks(to, subject, html)
}

func (s *EmailService) deliverSMTP(to, subject, html, text string) error {
	if s.smtpSendFn != nil {
		return s.smtpSendFn(to, subject, html, text)
	}
	return s.sendGmail(to, subject, html, text)
}

// sendNaverworks는 네이버웍스 메일 API로 발송한다(토큰 획득 → 메일 전송). 성공 여부만 반환.
func (s *EmailService) sendNaverworks(toEmail, subject, htmlContent string) bool {
	token, err := s.naverworksToken()
	if err != nil || token == "" {
		return false
	}
	mailURL := fmt.Sprintf("https://www.worksapis.com/v1.0/domains/%s/mail", s.nwDomain)
	payload := map[string]interface{}{
		"senderAddress": s.apiSenderAddress(),
		"senderName":    "SMAP",
		"title":         subject,
		"body":          htmlContent,
		"recipients": []map[string]string{
			{"address": toEmail, "name": strings.SplitN(toEmail, "@", 2)[0]},
		},
	}
	b, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, mailURL, bytes.NewReader(b))
	if err != nil {
		return false
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// apiSenderAddress는 API 경로 발신 주소다: EMAIL_SENDER가 있으면 그것, 비면 기존 고정값.
func (s *EmailService) apiSenderAddress() string {
	if s.sender != "" {
		return s.sender
	}
	return "admin@smap.site"
}

// naverworksToken은 OAuth2 client_credentials로 액세스 토큰을 획득한다.
func (s *EmailService) naverworksToken() (string, error) {
	form := url.Values{}
	form.Set("grant_type", "client_credentials")
	form.Set("client_id", s.nwClientID)
	form.Set("client_secret", s.nwSecret)
	form.Set("scope", "mail mail.read")
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost,
		"https://auth.worksmobile.com/oauth2/v2.0/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token http %d", resp.StatusCode)
	}
	var out struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	return out.AccessToken, nil
}

// sendGmail은 SMTP(EMAIL_SMTP_SERVER/PORT; 기본 Gmail 465)로 MIME(text+html) 메일을 보낸다.
// 포트 465는 암묵적 TLS(tls.Dial 후 smtp.NewClient), 그 외 포트는 평문 접속 후 STARTTLS.
// 자격증명이 비면 즉시 실패(불필요한 외부 연결 회피 — 관측상 Python의 login 실패와 동일 결과).
func (s *EmailService) sendGmail(to, subject, htmlContent, textContent string) error {
	if s.sender == "" || s.password == "" {
		return fmt.Errorf("Gmail SMTP 자격증명 미설정")
	}
	addr := fmt.Sprintf("%s:%d", s.smtpServer, s.smtpPort)
	var client *smtp.Client
	if s.smtpPort == 465 {
		conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: s.smtpServer})
		if err != nil {
			return err
		}
		client, err = smtp.NewClient(conn, s.smtpServer)
		if err != nil {
			_ = conn.Close()
			return err
		}
	} else {
		var err error
		client, err = smtp.Dial(addr)
		if err != nil {
			return err
		}
		if err := client.StartTLS(&tls.Config{ServerName: s.smtpServer}); err != nil {
			_ = client.Close()
			return err
		}
	}
	defer client.Close()
	if err := client.Auth(smtp.PlainAuth("", s.sender, s.password, s.smtpServer)); err != nil {
		return err
	}
	if err := client.Mail(s.sender); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(buildMIME(s.sender, to, subject, textContent, htmlContent)); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return client.Quit()
}

// buildMIME은 multipart/alternative(text+html) MIME 메시지를 만든다(Python MIMEMultipart 등가).
func buildMIME(from, to, subject, text, html string) []byte {
	boundary := "smapmixed0000boundary"
	var b strings.Builder
	fmt.Fprintf(&b, "From: %s\r\n", from)
	fmt.Fprintf(&b, "To: %s\r\n", to)
	fmt.Fprintf(&b, "Subject: %s\r\n", subject)
	b.WriteString("MIME-Version: 1.0\r\n")
	fmt.Fprintf(&b, "Content-Type: multipart/alternative; boundary=%s\r\n\r\n", boundary)
	fmt.Fprintf(&b, "--%s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n", boundary, text)
	fmt.Fprintf(&b, "--%s\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s\r\n", boundary, html)
	fmt.Fprintf(&b, "--%s--\r\n", boundary)
	return []byte(b.String())
}

// buildResetEmailHTML은 Python의 비번재설정 HTML 본문을 이식한다(reset_url 3곳 치환).
func buildResetEmailHTML(resetURL string) string {
	return strings.ReplaceAll(resetEmailHTMLTemplate, "{{RESET_URL}}", resetURL)
}

// buildResetEmailText는 Python의 텍스트 본문을 이식한다.
func buildResetEmailText(resetURL string) string {
	return strings.ReplaceAll(resetEmailTextTemplate, "{{RESET_URL}}", resetURL)
}

const resetEmailTextTemplate = `
🚀 SMAP 비밀번호 재설정

안녕하세요! 👋

비밀번호 재설정을 요청하셨습니다. 아래 링크를 클릭하여 새로운 비밀번호를 설정해주세요.

🔐 비밀번호 재설정 링크:
{{RESET_URL}}

⚠️ 주의사항:
• 이 링크는 10분 동안만 유효합니다
• 본인이 요청하지 않았다면 이 이메일을 무시하세요
• 보안을 위해 비밀번호 재설정 후에는 이 링크가 무효화됩니다
• 링크를 다른 사람과 공유하지 마세요

감사합니다.
SMAP 팀

---
이 이메일은 SMAP 시스템에서 자동으로 발송되었습니다.
`

const resetEmailHTMLTemplate = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMAP 비밀번호 재설정</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 40px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
            letter-spacing: -0.5px;
        }
        .header .subtitle {
            margin-top: 8px;
            opacity: 0.9;
            font-size: 16px;
        }
        .content {
            padding: 40px;
        }
        .greeting {
            font-size: 18px;
            color: #555;
            margin-bottom: 20px;
        }
        .description {
            font-size: 16px;
            color: #666;
            margin-bottom: 30px;
            line-height: 1.7;
        }
        .button-container {
            text-align: center;
            margin: 40px 0;
        }
        .reset-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .reset-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        .warning-section {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 30px 0;
            border-radius: 8px;
        }
        .warning-title {
            font-weight: 600;
            color: #856404;
            margin-bottom: 10px;
            font-size: 16px;
        }
        .warning-list {
            margin: 0;
            padding-left: 20px;
            color: #856404;
        }
        .warning-list li {
            margin-bottom: 8px;
            line-height: 1.5;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 30px 40px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        .footer-text {
            color: #6c757d;
            font-size: 14px;
            margin: 0;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: white;
            margin-bottom: 10px;
        }
        .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, #e9ecef, transparent);
            margin: 30px 0;
        }
        @media only screen and (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 8px;
            }
            .header, .content, .footer {
                padding: 20px;
            }
            .header h1 {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🚀 SMAP</div>
            <h1>비밀번호 재설정</h1>
            <div class="subtitle">안전한 계정 관리를 위한 링크</div>
        </div>

        <div class="content">
            <div class="greeting">안녕하세요! 👋</div>

            <div class="description">
                비밀번호 재설정을 요청하셨습니다. 아래 버튼을 클릭하여 새로운 비밀번호를 설정해주세요.
            </div>

            <div class="button-container">
                <a href="{{RESET_URL}}" class="reset-button">
                    🔐 비밀번호 재설정
                </a>
            </div>

            <div class="divider"></div>

            <div class="warning-section">
                <div class="warning-title">⚠️ 주의사항</div>
                <ul class="warning-list">
                    <li>이 링크는 <strong>10분 동안만</strong> 유효합니다</li>
                    <li>본인이 요청하지 않았다면 이 이메일을 무시하세요</li>
                    <li>보안을 위해 비밀번호 재설정 후에는 이 링크가 무효화됩니다</li>
                    <li>링크를 다른 사람과 공유하지 마세요</li>
    </ul>
            </div>

            <div style="text-align: center; margin-top: 30px; color: #6c757d; font-size: 14px;">
                링크가 작동하지 않는다면 아래 주소를 브라우저에 복사하세요:<br>
                <a href="{{RESET_URL}}" style="color: #667eea; word-break: break-all;">{{RESET_URL}}</a>
            </div>
        </div>

        <div class="footer">
            <p class="footer-text">
                이 이메일은 SMAP 시스템에서 자동으로 발송되었습니다.<br>
                문의사항이 있으시면 고객센터로 연락해주세요.
            </p>
        </div>
    </div>
</body>
</html>`
