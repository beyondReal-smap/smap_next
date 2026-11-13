package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"math/big"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// 이메일 인증(G3): 인증번호 발송·검증, 검증 토큰 발급·소비, 이메일로 비밀번호 재설정, 이메일 등록·변경.
// FastAPI backend/app/api/v1/endpoints/email_auth.py의 정책을 따른다(Redis 키 이름도 동일해 서버 전환 중 호환).

// 이메일 인증 목적(purpose).
const (
	EmailPurposeRegister      = "register"
	EmailPurposeResetPassword = "reset_password"
	EmailPurposeChangeEmail   = "change_email"
)

const (
	emailCodeTTL        = 10 * time.Minute
	emailTokenTTL       = 15 * time.Minute
	emailMaxAttempts    = 5
	emailRateWindow     = time.Hour
	emailRatePerEmail   = 5  // 이메일당 시간당 발송 한도
	emailRatePerIP      = 20 // IP당 시간당 발송 한도
	emailTokenType      = "email_verification"
	msgEmailTokenBad    = "이메일 인증이 유효하지 않습니다."
	msgEmailTokenUsed   = "이미 사용한 인증 토큰입니다."
	msgEmailCodeExpired = "인증번호가 만료되었습니다. 다시 요청해주세요."
	msgEmailStoreDown   = "인증 서비스를 사용할 수 없습니다."
)

// EmailAuthError는 HTTP 응답으로 그대로 옮길 수 있는 서비스 에러다({"detail": Detail}).
type EmailAuthError struct {
	Status     int
	Detail     string
	RetryAfter int // 429일 때 남은 초(Retry-After 헤더)
}

func (e *EmailAuthError) Error() string { return fmt.Sprintf("%d %s", e.Status, e.Detail) }

func emailErr(status int, detail string) *EmailAuthError {
	return &EmailAuthError{Status: status, Detail: detail}
}

// emailAuthStore는 Redis 원자 연산 추상화다(구현은 *cache.Store). 모든 메서드는 에러를 숨기지 않는다.
type emailAuthStore interface {
	IncrWithExpire(ctx context.Context, key string, ttl time.Duration) (int64, error)
	TTL(ctx context.Context, key string) (time.Duration, error)
	SetEX(ctx context.Context, key, val string, ttl time.Duration) error
	SetNXEX(ctx context.Context, key, val string, ttl time.Duration) (bool, error)
	GetString(ctx context.Context, key string) (string, bool, error)
	DelKeys(ctx context.Context, keys ...string) (int64, error)
}

// emailAuthMembers는 이메일 인증이 필요로 하는 회원 접근이다(구현은 *repository.EmailAuthRepository).
type emailAuthMembers interface {
	FindByEmail(email string) ([]model.Member, error)
	IdentifierTaken(email string, exceptIdx int) (bool, error)
	GetByID(mtIdx int) (*model.Member, error)
	ResetPassword(mtIdx int, hashed string) error
	ChangeEmail(mtIdx int, email string) error
}

// verificationMailer는 인증번호 메일 발송기다(구현은 *EmailService). 설정이 없으면 ErrMailNotConfigured.
type verificationMailer interface {
	SendVerificationCode(email, code string) error
}

// EmailAuthConfig는 서비스가 쓰는 설정만 담는다.
type EmailAuthConfig struct {
	Secret     string
	Algorithm  string
	BcryptCost int
	Policy     auth.PasswordPolicy
}

// EmailAuthService는 이메일 인증 도메인 서비스다.
type EmailAuthService struct {
	store   emailAuthStore
	members emailAuthMembers
	mailer  verificationMailer
	cfg     EmailAuthConfig
	logger  *slog.Logger

	now     func() time.Time
	genCode func() (string, error)

	revoker accessRevoker // 비밀번호 재설정 시 구 access token 무효 기준(SetAccessRevoker)
}

// SetAccessRevoker는 구 access token 무효 기준 기록기를 주입한다.
func (s *EmailAuthService) SetAccessRevoker(r accessRevoker) { s.revoker = r }

// NewEmailAuth는 EmailAuthService를 만든다.
func NewEmailAuth(store emailAuthStore, members emailAuthMembers, mailer verificationMailer, cfg EmailAuthConfig, logger *slog.Logger) *EmailAuthService {
	if logger == nil {
		logger = slog.Default()
	}
	return &EmailAuthService{store: store, members: members, mailer: mailer, cfg: cfg, logger: logger,
		now: time.Now, genCode: randomSixDigits}
}

// *repository.EmailAuthRepository가 emailAuthMembers를 만족함을 컴파일 시 보장한다.
var _ emailAuthMembers = (*repository.EmailAuthRepository)(nil)

// ValidEmailPurpose는 purpose가 허용값인지 반환한다.
func ValidEmailPurpose(p string) bool {
	return p == EmailPurposeRegister || p == EmailPurposeResetPassword || p == EmailPurposeChangeEmail
}

// NormalizeEmail은 trim+소문자 후 형식을 검증한다. 형식이 올바르지 않으면 ("", false).
// (pydantic EmailStr 수준: 표시 이름 없는 단일 주소, 도메인에 점 포함, 254자 이하)
func NormalizeEmail(raw string) (string, bool) {
	e := strings.ToLower(strings.TrimSpace(raw))
	if e == "" || len(e) > 254 {
		return "", false
	}
	addr, err := mail.ParseAddress(e)
	if err != nil || addr.Name != "" || addr.Address != e {
		return "", false
	}
	at := strings.LastIndexByte(e, '@')
	if at <= 0 {
		return "", false
	}
	domain := e[at+1:]
	if !strings.Contains(domain, ".") || strings.HasPrefix(domain, ".") || strings.HasSuffix(domain, ".") ||
		strings.ContainsAny(domain, "[]") {
		return "", false
	}
	return e, true
}

func randomSixDigits() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func (s *EmailAuthService) storeDown(op string, err error) *EmailAuthError {
	s.logger.Error("email_auth_store_error", slog.String("op", op), slog.String("err", err.Error()))
	return emailErr(503, msgEmailStoreDown)
}

func codeKey(email, purpose string, uid int) string {
	k := "email:code:" + purpose + ":" + sha256Hex(email)
	if purpose == EmailPurposeChangeEmail {
		k += ":" + strconv.Itoa(uid)
	}
	return k
}

// requireActiveMember는 change_email 흐름의 로그인 회원이 존재하고 활성인지 확인한다(아니면 401).
func (s *EmailAuthService) requireActiveMember(uid int) error {
	if uid <= 0 {
		return emailErr(401, "인증이 필요합니다.")
	}
	m, err := s.members.GetByID(uid)
	if err != nil {
		s.logger.Error("email_auth_member_lookup_failed", slog.String("err", err.Error()))
		return emailErr(500, "Internal Server Error")
	}
	if m == nil || m.IsBlocked() {
		return emailErr(401, "인증이 필요합니다.")
	}
	return nil
}

func (s *EmailAuthService) checkRate(ctx context.Context, key string, limit int64) error {
	n, err := s.store.IncrWithExpire(ctx, key, emailRateWindow)
	if err != nil {
		return s.storeDown("rate_incr", err)
	}
	if n <= limit {
		return nil
	}
	ttl, err := s.store.TTL(ctx, key)
	if err != nil {
		return s.storeDown("rate_ttl", err)
	}
	remaining := int(math.Ceil(ttl.Seconds()))
	if remaining < 1 {
		remaining = 1
	}
	return &EmailAuthError{Status: 429, RetryAfter: remaining,
		Detail: fmt.Sprintf("요청 횟수를 초과했습니다. %d초 후 다시 시도해주세요.", remaining)}
}

// SendCode는 인증번호를 발송한다. email은 NormalizeEmail 통과값, ip는 netutil.ClientIP 결과,
// uid는 change_email일 때 로그인 회원 번호(그 외 0).
//
// 순서: (change_email) 로그인 회원 확인 → 다른 회원의 이메일 사용 여부(409) → 한도(IP, 이메일) →
// register 중복(409) / reset_password 비활성이면 발송 없이 동일 성공 → 코드 생성 → 메일 발송 → 코드 저장.
// 코드는 발송이 성공한 뒤에만 저장한다(실패한 발송이 기존 유효 코드를 덮어쓰거나 지우지 않는다).
func (s *EmailAuthService) SendCode(ctx context.Context, email, purpose, ip string, uid int) error {
	if purpose == EmailPurposeChangeEmail {
		if err := s.requireActiveMember(uid); err != nil {
			return err
		}
		taken, err := s.members.IdentifierTaken(email, uid)
		if err != nil {
			s.logger.Error("email_auth_lookup_failed", slog.String("op", "taken"), slog.String("err", err.Error()))
			return emailErr(500, "Internal Server Error")
		}
		if taken {
			return emailErr(409, "이미 가입된 이메일입니다.")
		}
	}

	if err := s.checkRate(ctx, "email:rate:ip:"+sha256Hex(ip), emailRatePerIP); err != nil {
		return err
	}
	if err := s.checkRate(ctx, "email:rate:email:"+sha256Hex(email), emailRatePerEmail); err != nil {
		return err
	}

	switch purpose {
	case EmailPurposeRegister:
		taken, err := s.members.IdentifierTaken(email, 0)
		if err != nil {
			s.logger.Error("email_auth_lookup_failed", slog.String("op", "taken"), slog.String("err", err.Error()))
			return emailErr(500, "Internal Server Error")
		}
		if taken {
			return emailErr(409, "이미 가입된 이메일입니다.")
		}
	case EmailPurposeResetPassword:
		members, err := s.members.FindByEmail(email)
		if err != nil {
			s.logger.Error("email_auth_lookup_failed", slog.String("op", "find"), slog.String("err", err.Error()))
			return emailErr(500, "Internal Server Error")
		}
		if !hasActiveMember(members) {
			return nil // 가입 여부를 드러내지 않는다: 같은 성공 응답, 발송 없음
		}
	}

	code, err := s.genCode()
	if err != nil {
		s.logger.Error("email_auth_code_gen_failed", slog.String("err", err.Error()))
		return emailErr(500, "Internal Server Error")
	}
	if err := s.mailer.SendVerificationCode(email, code); err != nil {
		if errors.Is(err, ErrMailNotConfigured) {
			s.logger.Error("email_auth_mail_not_configured")
			return emailErr(503, "인증 메일 발송이 설정되지 않았습니다.")
		}
		s.logger.Error("email_auth_mail_failed", slog.String("err", err.Error()))
		return emailErr(502, "인증 메일 발송에 실패했습니다.")
	}
	key := codeKey(email, purpose, uid)
	if err := s.store.SetEX(ctx, key, code, emailCodeTTL); err != nil {
		return s.storeDown("code_set", err)
	}
	// 새 코드는 새 시도 횟수로 시작한다(이전 코드의 실패가 새 코드에 이월되지 않게).
	// 시도 횟수는 코드 하나당 5회이고 발송은 이메일당 시간당 5회로 제한되므로 추측 기회는 시간당 25회를 넘지 않는다.
	if _, err := s.store.DelKeys(ctx, key+":attempts"); err != nil {
		return s.storeDown("attempts_reset", err)
	}
	return nil
}

func hasActiveMember(members []model.Member) bool {
	for i := range members {
		if !members[i].IsBlocked() {
			return true
		}
	}
	return false
}

// VerifyCode는 인증번호를 확인하고 검증 토큰(15분)을 발급한다.
// 시도 횟수는 코드마다 5회까지이며 초과하면 코드를 폐기한다. 성공하면 코드는 즉시 폐기된다(일회용).
func (s *EmailAuthService) VerifyCode(ctx context.Context, email, purpose, code string, uid int) (string, error) {
	if purpose == EmailPurposeChangeEmail {
		if err := s.requireActiveMember(uid); err != nil {
			return "", err
		}
	}
	key := codeKey(email, purpose, uid)
	stored, found, err := s.store.GetString(ctx, key)
	if err != nil {
		return "", s.storeDown("code_get", err)
	}
	if !found || stored == "" {
		return "", emailErr(400, msgEmailCodeExpired)
	}
	attemptsKey := key + ":attempts"
	attempts, err := s.store.IncrWithExpire(ctx, attemptsKey, emailCodeTTL)
	if err != nil {
		return "", s.storeDown("attempts_incr", err)
	}
	if attempts > emailMaxAttempts {
		if _, err := s.store.DelKeys(ctx, key); err != nil {
			return "", s.storeDown("code_del", err)
		}
		return "", emailErr(400, msgEmailCodeExpired)
	}
	if subtle.ConstantTimeCompare([]byte(code), []byte(stored)) != 1 {
		return "", emailErr(400, "인증번호가 일치하지 않습니다.")
	}
	// 동시에 같은 코드로 두 번 성공하지 못하도록 실제로 지운 요청만 토큰을 받는다.
	n, err := s.store.DelKeys(ctx, key)
	if err != nil {
		return "", s.storeDown("code_del", err)
	}
	if n == 0 {
		return "", emailErr(400, msgEmailCodeExpired)
	}
	if _, err := s.store.DelKeys(ctx, attemptsKey); err != nil {
		s.logger.Warn("email_auth_attempts_cleanup_failed", slog.String("err", err.Error()))
	}
	token, err := s.IssueEmailToken(email, purpose, uid)
	if err != nil {
		s.logger.Error("email_auth_token_issue_failed", slog.String("err", err.Error()))
		return "", emailErr(500, "Internal Server Error")
	}
	return token, nil
}

// EmailTokenClaims는 검증된 이메일 인증 토큰의 내용이다.
type EmailTokenClaims struct {
	Email   string
	Purpose string
	JTI     string
	UserID  int // change_email 토큰의 회원 번호(sub). 그 외 0.
	Expires time.Time
}

// IssueEmailToken은 이메일 인증 토큰(서명 JWT, 15분, jti 포함)을 발급한다.
// change_email이면 uid를 sub claim으로 넣는다(FastAPI와 같은 형식).
func (s *EmailAuthService) IssueEmailToken(email, purpose string, uid int) (string, error) {
	jti, err := randomURLSafe(24)
	if err != nil {
		return "", err
	}
	now := s.now()
	claims := jwt.MapClaims{
		"type":    emailTokenType,
		"email":   email,
		"purpose": purpose,
		"jti":     jti,
		"iat":     now.Unix(),
		"exp":     now.Add(emailTokenTTL).Unix(),
	}
	if purpose == EmailPurposeChangeEmail {
		claims["sub"] = strconv.Itoa(uid)
	}
	method := jwt.GetSigningMethod(s.cfg.Algorithm)
	if method == nil {
		method = jwt.SigningMethodHS256
	}
	return jwt.NewWithClaims(method, claims).SignedString([]byte(s.cfg.Secret))
}

func randomURLSafe(n int) (string, error) {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(b), nil
}

// ParseEmailToken은 서명·알고리즘·만료·type·purpose·jti를 검증한다. 이메일 일치는 확인하지 않는다
// (가입처럼 토큰에서 이메일을 꺼내 써야 하는 호출자용). 실패는 400 *EmailAuthError.
func (s *EmailAuthService) ParseEmailToken(token, purpose string) (EmailTokenClaims, error) {
	bad := emailErr(400, msgEmailTokenBad)
	if s.cfg.Secret == "" || token == "" {
		return EmailTokenClaims{}, bad
	}
	claims := jwt.MapClaims{}
	if _, err := jwt.ParseWithClaims(token, claims, func(*jwt.Token) (interface{}, error) {
		return []byte(s.cfg.Secret), nil
	}, jwt.WithValidMethods([]string{s.cfg.Algorithm}), jwt.WithExpirationRequired(), jwt.WithTimeFunc(s.now)); err != nil {
		return EmailTokenClaims{}, bad
	}
	if t, _ := claims["type"].(string); t != emailTokenType {
		return EmailTokenClaims{}, bad
	}
	if p, _ := claims["purpose"].(string); p != purpose {
		return EmailTokenClaims{}, bad
	}
	email, _ := claims["email"].(string)
	jti, _ := claims["jti"].(string)
	expF, _ := claims["exp"].(float64)
	if email == "" || jti == "" || expF <= 0 {
		return EmailTokenClaims{}, bad
	}
	out := EmailTokenClaims{Email: email, Purpose: purpose, JTI: jti, Expires: time.Unix(int64(expF), 0)}
	if sub, ok := claims["sub"].(string); ok && sub != "" {
		id, err := strconv.Atoi(sub)
		if err != nil || id <= 0 {
			return EmailTokenClaims{}, bad
		}
		out.UserID = id
	}
	return out, nil
}

// VerifyEmailToken은 ParseEmailToken에 더해 토큰의 이메일이 email과 같은지 확인한다.
func (s *EmailAuthService) VerifyEmailToken(token, email, purpose string) (EmailTokenClaims, error) {
	c, err := s.ParseEmailToken(token, purpose)
	if err != nil {
		return EmailTokenClaims{}, err
	}
	if subtle.ConstantTimeCompare([]byte(c.Email), []byte(email)) != 1 {
		return EmailTokenClaims{}, emailErr(400, msgEmailTokenBad)
	}
	return c, nil
}

// EmailTokenLease는 소비(선점)한 토큰의 되돌리기 핸들이다.
type EmailTokenLease struct {
	s   *EmailAuthService
	key string
}

func tokenUsedKey(purpose, jti string) string {
	prefix := map[string]string{EmailPurposeResetPassword: "reset", EmailPurposeChangeEmail: "change"}[purpose]
	if prefix == "" {
		prefix = purpose
	}
	return "email:" + prefix + "-used:" + sha256Hex(jti)
}

// ConsumeEmailToken은 토큰을 일회용으로 선점한다(Redis SET NX, TTL=토큰 남은 수명).
// 이미 소비됐으면 400, Redis 장애는 503. 호출자는 이후 작업이 실패하면 lease.Restore로 되돌린다.
func (s *EmailAuthService) ConsumeEmailToken(ctx context.Context, c EmailTokenClaims) (*EmailTokenLease, error) {
	remaining := c.Expires.Sub(s.now())
	if remaining <= 0 {
		return nil, emailErr(400, msgEmailTokenBad)
	}
	ttl := time.Duration(math.Ceil(remaining.Seconds())) * time.Second
	key := tokenUsedKey(c.Purpose, c.JTI)
	claimed, err := s.store.SetNXEX(ctx, key, "1", ttl)
	if err != nil {
		return nil, s.storeDown("token_consume", err)
	}
	if !claimed {
		return nil, emailErr(400, msgEmailTokenUsed)
	}
	return &EmailTokenLease{s: s, key: key}, nil
}

// Restore는 소비 표시를 지워 같은 토큰으로 다시 시도할 수 있게 한다(DB 실패 등 후속 작업 실패 시).
func (l *EmailTokenLease) Restore(ctx context.Context) error {
	if _, err := l.s.store.DelKeys(ctx, l.key); err != nil {
		l.s.logger.Error("email_auth_token_restore_failed", slog.String("err", err.Error()))
		return err
	}
	return nil
}

// ChangeEmail은 로그인한 회원(uid)의 mt_email을 갱신한다(mt_idx·mt_id 불변).
// 토큰은 purpose=change_email, 이메일 일치, 본인(sub==uid)이어야 한다.
func (s *EmailAuthService) ChangeEmail(ctx context.Context, uid int, email, token string) error {
	if uid <= 0 {
		return emailErr(401, "인증이 필요합니다.")
	}
	claims, err := s.VerifyEmailToken(token, email, EmailPurposeChangeEmail)
	if err != nil {
		return err
	}
	if claims.UserID != uid {
		return emailErr(403, "본인의 이메일 인증 토큰이 필요합니다.")
	}
	lease, err := s.ConsumeEmailToken(ctx, claims)
	if err != nil {
		return err
	}
	if err := s.members.ChangeEmail(uid, email); err != nil {
		_ = lease.Restore(ctx) // 실패는 Restore 안에서 로그
		switch {
		case errors.Is(err, repository.ErrEmailTaken):
			return emailErr(409, "이미 가입된 이메일입니다.")
		case errors.Is(err, repository.ErrMemberInactive):
			return emailErr(401, "인증이 필요합니다.")
		}
		s.logger.Error("email_auth_change_failed", slog.String("err", err.Error()))
		return emailErr(500, "이메일 변경에 실패했습니다.")
	}
	return nil
}

// ResetPasswordByEmail은 reset_password 토큰으로 비밀번호를 재설정한다.
// 비밀번호 정책 위반 400, 활성 회원이 정확히 1명이 아니면 400. 성공하면 그 회원의 refresh token을 전부 폐기한다
// (DB 갱신과 같은 트랜잭션). DB 실패 시 토큰 소비를 되돌린다.
func (s *EmailAuthService) ResetPasswordByEmail(ctx context.Context, email, token, newPassword string) error {
	claims, err := s.VerifyEmailToken(token, email, EmailPurposeResetPassword)
	if err != nil {
		return err
	}
	if ok, errs := auth.ValidatePasswordPolicy(newPassword, s.cfg.Policy); !ok {
		return emailErr(400, strings.Join(errs, ", "))
	}
	rows, err := s.members.FindByEmail(email)
	if err != nil {
		s.logger.Error("email_auth_lookup_failed", slog.String("op", "find"), slog.String("err", err.Error()))
		return emailErr(500, "Internal Server Error")
	}
	var active []model.Member
	for i := range rows {
		if !rows[i].IsBlocked() {
			active = append(active, rows[i])
		}
	}
	if len(active) != 1 {
		return emailErr(400, "계정을 특정할 수 없습니다. 고객센터에 문의해주세요.")
	}
	hashed, err := auth.HashPassword(newPassword, s.cfg.BcryptCost)
	if err != nil {
		s.logger.Error("email_auth_hash_failed", slog.String("err", err.Error()))
		return emailErr(500, "비밀번호 재설정에 실패했습니다.")
	}
	lease, err := s.ConsumeEmailToken(ctx, claims)
	if err != nil {
		return err
	}
	// 보안 작업: 구 access token 무효 기준을 먼저 기록한다. 기록하지 못하면(Redis 장애) 재설정하지 않고 토큰을 되돌린다.
	if s.revoker == nil {
		_ = lease.Restore(ctx)
		s.logger.Error("email_auth_access_revoker_not_wired")
		return emailErr(500, "비밀번호 재설정에 실패했습니다.")
	}
	if err := s.revoker.RevokeBefore(ctx, active[0].MtIdx); err != nil {
		_ = lease.Restore(ctx)
		return s.storeDown("access_revoke_marker", err)
	}
	if err := s.members.ResetPassword(active[0].MtIdx, hashed); err != nil {
		_ = lease.Restore(ctx)
		s.logger.Error("email_auth_reset_failed", slog.String("err", err.Error()))
		return emailErr(500, "비밀번호 재설정에 실패했습니다.")
	}
	return nil
}
