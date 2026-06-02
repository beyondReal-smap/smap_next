package service

import "log/slog"

// ResetNotifier는 forgot-password의 비번재설정 링크 발송을 SMS/이메일 서비스로 위임하는 어댑터다.
// Python forgot_password가 발송을 await하고 실패를 swallow하는 것과 동일하게, 동기 호출 후 결과를
// 로깅만 한다(응답엔 영향 없음 — AuthService.ForgotPassword는 이 반환을 사용하지 않는다).
type ResetNotifier struct {
	sms    *SMSService
	email  *EmailService
	logger *slog.Logger
}

// NewResetNotifier는 SMS/이메일 서비스를 묶어 발송 어댑터를 만든다.
func NewResetNotifier(sms *SMSService, email *EmailService, logger *slog.Logger) *ResetNotifier {
	return &ResetNotifier{sms: sms, email: email, logger: logger}
}

// SendPasswordResetSMS는 비번재설정 SMS를 발송하고 결과를 로깅한다(실패 swallow).
func (n *ResetNotifier) SendPasswordResetSMS(phone, resetURL string) {
	r := n.sms.SendPasswordResetSMS(phone, resetURL)
	if n.logger != nil {
		if r.Success {
			n.logger.Info("password reset SMS sent")
		} else {
			n.logger.Warn("password reset SMS failed", "message", r.Message)
		}
	}
}

// SendPasswordResetEmail은 비번재설정 이메일을 발송하고 결과를 로깅한다(실패 swallow).
func (n *ResetNotifier) SendPasswordResetEmail(email, resetURL string) {
	r := n.email.SendPasswordResetEmail(email, resetURL)
	if n.logger != nil {
		if r.Success {
			n.logger.Info("password reset email sent")
		} else {
			n.logger.Warn("password reset email failed", "message", r.Message)
		}
	}
}
