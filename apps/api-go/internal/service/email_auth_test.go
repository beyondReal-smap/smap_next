package service

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/cache"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// --- 가짜 Redis / 메일 / 회원 저장소 ---

type fakeEmailStore struct {
	vals    map[string]string
	ttls    map[string]time.Duration
	counts  map[string]int64
	err     error // 모든 연산이 이 에러를 반환(Redis 장애)
	setNXFn func(key string) (bool, bool)
}

func newFakeEmailStore() *fakeEmailStore {
	return &fakeEmailStore{vals: map[string]string{}, ttls: map[string]time.Duration{}, counts: map[string]int64{}}
}

func (f *fakeEmailStore) IncrWithExpire(_ context.Context, key string, ttl time.Duration) (int64, error) {
	if f.err != nil {
		return 0, f.err
	}
	f.counts[key]++
	if _, ok := f.ttls[key]; !ok {
		f.ttls[key] = ttl
	}
	return f.counts[key], nil
}
func (f *fakeEmailStore) TTL(_ context.Context, key string) (time.Duration, error) {
	if f.err != nil {
		return 0, f.err
	}
	return f.ttls[key], nil
}
func (f *fakeEmailStore) SetEX(_ context.Context, key, val string, ttl time.Duration) error {
	if f.err != nil {
		return f.err
	}
	f.vals[key], f.ttls[key] = val, ttl
	return nil
}
func (f *fakeEmailStore) SetNXEX(_ context.Context, key, val string, ttl time.Duration) (bool, error) {
	if f.err != nil {
		return false, f.err
	}
	if _, ok := f.vals[key]; ok {
		return false, nil
	}
	f.vals[key], f.ttls[key] = val, ttl
	return true, nil
}
func (f *fakeEmailStore) GetString(_ context.Context, key string) (string, bool, error) {
	if f.err != nil {
		return "", false, f.err
	}
	v, ok := f.vals[key]
	if !ok {
		// 실제 Redis에서 INCR 키도 문자열이라 GET으로 읽힌다.
		if c, has := f.counts[key]; has {
			return strconv.FormatInt(c, 10), true, nil
		}
	}
	return v, ok, nil
}
func (f *fakeEmailStore) DelKeys(_ context.Context, keys ...string) (int64, error) {
	if f.err != nil {
		return 0, f.err
	}
	var n int64
	for _, k := range keys {
		_, a := f.vals[k]
		_, b := f.counts[k]
		if a || b {
			n++
		}
		delete(f.vals, k)
		delete(f.counts, k)
		delete(f.ttls, k)
	}
	return n, nil
}

type fakeMailer struct {
	err   error
	sent  []string // 수신 주소
	codes []string
}

func (m *fakeMailer) SendVerificationCode(email, code string) error {
	if m.err != nil {
		return m.err
	}
	m.sent = append(m.sent, email)
	m.codes = append(m.codes, code)
	return nil
}

type fakeEmailMembers struct {
	rows        []model.Member // FindByEmail 결과(email 필터는 mt_email로)
	taken       map[string]int // email → 점유 중인 회원(mt_idx)
	byID        map[int]*model.Member
	resetCalls  []int
	resetErr    error
	changeErr   error
	changedTo   map[int]string
	resetHashes []string
}

func (f *fakeEmailMembers) FindByEmail(email string) ([]model.Member, error) {
	var out []model.Member
	for _, m := range f.rows {
		if m.MtEmail != nil && strings.EqualFold(strings.TrimSpace(*m.MtEmail), email) {
			out = append(out, m)
		}
	}
	return out, nil
}
func (f *fakeEmailMembers) IdentifierTaken(email string, except int) (bool, error) {
	owner, ok := f.taken[email]
	return ok && owner != except, nil
}
func (f *fakeEmailMembers) GetByID(id int) (*model.Member, error) { return f.byID[id], nil }
func (f *fakeEmailMembers) ResetPassword(idx int, hashed string) error {
	if f.resetErr != nil {
		return f.resetErr
	}
	f.resetCalls = append(f.resetCalls, idx)
	f.resetHashes = append(f.resetHashes, hashed)
	return nil
}
func (f *fakeEmailMembers) ChangeEmail(idx int, email string) error {
	if f.changeErr != nil {
		return f.changeErr
	}
	if f.changedTo == nil {
		f.changedTo = map[int]string{}
	}
	f.changedTo[idx] = email
	return nil
}

func memberWithEmail(idx int, email string) model.Member {
	e := email
	return model.Member{MtIdx: idx, MtEmail: &e}
}

type emailHarness struct {
	svc     *EmailAuthService
	store   *fakeEmailStore
	mailer  *fakeMailer
	members *fakeEmailMembers
	revoker *fakeRevoker
}

func newEmailHarness() *emailHarness {
	h := &emailHarness{store: newFakeEmailStore(), mailer: &fakeMailer{}, members: &fakeEmailMembers{
		taken: map[string]int{}, byID: map[int]*model.Member{},
	}}
	h.svc = NewEmailAuth(h.store, h.members, h.mailer, EmailAuthConfig{
		Secret: "test-secret-0123456789abcdef", Algorithm: "HS256", BcryptCost: 4,
		Policy: auth.PasswordPolicy{MinLength: 8, RequireUpper: true, RequireLower: true, RequireNumbers: true, RequireSpecial: true},
	}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	h.revoker = &fakeRevoker{}
	h.svc.SetAccessRevoker(h.revoker)
	return h
}

func (h *emailHarness) lastCode(t *testing.T) string {
	t.Helper()
	if len(h.mailer.codes) == 0 {
		t.Fatal("발송된 코드가 없음")
	}
	return h.mailer.codes[len(h.mailer.codes)-1]
}

func statusOf(t *testing.T, err error) int {
	t.Helper()
	var ee *EmailAuthError
	if !errors.As(err, &ee) {
		t.Fatalf("EmailAuthError가 아님: %v", err)
	}
	return ee.Status
}

var bg = context.Background()

const goodPw = "Abcd1234!x"

// issueVerified는 send→verify로 실제 토큰을 얻는다.
func (h *emailHarness) issueVerified(t *testing.T, email, purpose string, uid int) string {
	t.Helper()
	if err := h.svc.SendCode(bg, email, purpose, "198.51.100."+strconv.Itoa(uid+1), uid); err != nil {
		t.Fatalf("send: %v", err)
	}
	tok, err := h.svc.VerifyCode(bg, email, purpose, h.lastCode(t), uid)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	return tok
}

// --- 발송 → 검증 → 토큰 ---

func TestEmailAuthRegisterFlowIssuesTokenAndConsumesCode(t *testing.T) {
	h := newEmailHarness()
	if err := h.svc.SendCode(bg, "new@example.com", EmailPurposeRegister, "198.51.100.1", 0); err != nil {
		t.Fatal(err)
	}
	code := h.lastCode(t)
	if len(code) != 6 {
		t.Fatalf("코드는 6자리: %q", code)
	}
	key := codeKey("new@example.com", EmailPurposeRegister, 0)
	if h.store.ttls[key] != 10*time.Minute {
		t.Fatalf("코드 TTL 10분: %v", h.store.ttls[key])
	}
	tok, err := h.svc.VerifyCode(bg, "new@example.com", EmailPurposeRegister, code, 0)
	if err != nil || tok == "" {
		t.Fatalf("verify: %v", err)
	}
	if _, ok := h.store.vals[key]; ok {
		t.Fatal("검증 성공 후 코드는 폐기돼야 함")
	}
	// 같은 코드 재사용 불가
	if _, err := h.svc.VerifyCode(bg, "new@example.com", EmailPurposeRegister, code, 0); statusOf(t, err) != 400 {
		t.Fatalf("코드 재사용은 400: %v", err)
	}
	c, err := h.svc.VerifyEmailToken(tok, "new@example.com", EmailPurposeRegister)
	if err != nil {
		t.Fatalf("토큰 검증: %v", err)
	}
	if c.JTI == "" || c.UserID != 0 {
		t.Fatalf("claims: %+v", c)
	}
	if d := c.Expires.Sub(time.Now()); d < 14*time.Minute || d > 16*time.Minute {
		t.Fatalf("토큰 수명 15분: %v", d)
	}
}

func TestEmailAuthTokenIsOneTimeAndRestorable(t *testing.T) {
	h := newEmailHarness()
	tok := h.issueVerified(t, "new@example.com", EmailPurposeRegister, 0)
	c, _ := h.svc.VerifyEmailToken(tok, "new@example.com", EmailPurposeRegister)

	lease, err := h.svc.ConsumeEmailToken(bg, c)
	if err != nil {
		t.Fatal(err)
	}
	if ttl := h.store.ttls[tokenUsedKey(EmailPurposeRegister, c.JTI)]; ttl <= 0 || ttl > 15*time.Minute {
		t.Fatalf("소비 기록 TTL은 토큰 남은 수명: %v", ttl)
	}
	if _, err := h.svc.ConsumeEmailToken(bg, c); statusOf(t, err) != 400 {
		t.Fatalf("재사용은 400: %v", err)
	}
	if err := lease.Restore(bg); err != nil {
		t.Fatal(err)
	}
	if _, err := h.svc.ConsumeEmailToken(bg, c); err != nil {
		t.Fatalf("되돌린 뒤에는 다시 소비 가능: %v", err)
	}
}

func TestEmailAuthTokenPurposeMixingRejected(t *testing.T) {
	h := newEmailHarness()
	tok := h.issueVerified(t, "a@example.com", EmailPurposeRegister, 0)
	if _, err := h.svc.VerifyEmailToken(tok, "a@example.com", EmailPurposeResetPassword); statusOf(t, err) != 400 {
		t.Fatalf("register 토큰으로 reset 불가: %v", err)
	}
	if err := h.svc.ChangeEmail(bg, 7, "a@example.com", tok); statusOf(t, err) != 400 {
		t.Fatalf("register 토큰으로 change 불가: %v", err)
	}
	h.members.rows = []model.Member{memberWithEmail(7, "a@example.com")}
	if err := h.svc.ResetPasswordByEmail(bg, "a@example.com", tok, goodPw); statusOf(t, err) != 400 {
		t.Fatalf("register 토큰으로 비밀번호 재설정 불가: %v", err)
	}
	if len(h.members.resetCalls) != 0 {
		t.Fatal("재설정이 실행되면 안 됨")
	}
}

func TestEmailAuthTokenEmailMismatchTamperedAndExpired(t *testing.T) {
	h := newEmailHarness()
	tok := h.issueVerified(t, "a@example.com", EmailPurposeRegister, 0)
	if _, err := h.svc.VerifyEmailToken(tok, "b@example.com", EmailPurposeRegister); statusOf(t, err) != 400 {
		t.Fatalf("다른 이메일 거부: %v", err)
	}
	if _, err := h.svc.VerifyEmailToken(tok+"x", "a@example.com", EmailPurposeRegister); statusOf(t, err) != 400 {
		t.Fatalf("변조 거부: %v", err)
	}
	// 만료
	h.svc.now = func() time.Time { return time.Now().Add(16 * time.Minute) }
	if _, err := h.svc.VerifyEmailToken(tok, "a@example.com", EmailPurposeRegister); statusOf(t, err) != 400 {
		t.Fatalf("만료 거부: %v", err)
	}
	h.svc.now = time.Now
	// 다른 시크릿 서명
	other := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"type": "email_verification", "email": "a@example.com",
		"purpose": "register", "jti": "x", "exp": time.Now().Add(time.Minute).Unix()})
	forged, _ := other.SignedString([]byte("another-secret"))
	if _, err := h.svc.VerifyEmailToken(forged, "a@example.com", EmailPurposeRegister); statusOf(t, err) != 400 {
		t.Fatalf("다른 키 서명 거부: %v", err)
	}
	// type 없는 일반 access 토큰은 이메일 토큰으로 통용 불가
	acc, _ := auth.CreateAccessToken(1, "x", nil, h.svc.cfg.Secret, "HS256", 10)
	if _, err := h.svc.ParseEmailToken(acc, EmailPurposeRegister); statusOf(t, err) != 400 {
		t.Fatalf("access 토큰 거부: %v", err)
	}
	// exp 없는 토큰 거부
	noExp := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"type": "email_verification", "email": "a@example.com",
		"purpose": "register", "jti": "x"})
	ne, _ := noExp.SignedString([]byte(h.svc.cfg.Secret))
	if _, err := h.svc.ParseEmailToken(ne, EmailPurposeRegister); statusOf(t, err) != 400 {
		t.Fatalf("exp 없는 토큰 거부: %v", err)
	}
}

func TestEmailAuthVerifyAttemptsOver5RevokesCode(t *testing.T) {
	h := newEmailHarness()
	_ = h.svc.SendCode(bg, "a@example.com", EmailPurposeRegister, "198.51.100.1", 0)
	good := h.lastCode(t)
	bad := "000000"
	if good == bad {
		bad = "111111"
	}
	for i := 1; i <= 5; i++ {
		_, err := h.svc.VerifyCode(bg, "a@example.com", EmailPurposeRegister, bad, 0)
		if statusOf(t, err) != 400 || !strings.Contains(err.Error(), "일치하지 않습니다") {
			t.Fatalf("시도 %d: 불일치 400 기대: %v", i, err)
		}
	}
	// 6번째는 올바른 코드여도 폐기돼 실패
	_, err := h.svc.VerifyCode(bg, "a@example.com", EmailPurposeRegister, good, 0)
	if statusOf(t, err) != 400 || !strings.Contains(err.Error(), "만료") {
		t.Fatalf("6번째 시도는 만료 처리: %v", err)
	}
	if _, ok := h.store.vals[codeKey("a@example.com", EmailPurposeRegister, 0)]; ok {
		t.Fatal("코드가 폐기돼야 함")
	}
	// 5번째 시도에 올바른 코드면 성공(경계)
	h2 := newEmailHarness()
	_ = h2.svc.SendCode(bg, "a@example.com", EmailPurposeRegister, "198.51.100.1", 0)
	for i := 0; i < 4; i++ {
		_, _ = h2.svc.VerifyCode(bg, "a@example.com", EmailPurposeRegister, "x", 0)
	}
	if _, err := h2.svc.VerifyCode(bg, "a@example.com", EmailPurposeRegister, h2.lastCode(t), 0); err != nil {
		t.Fatalf("5번째 시도 성공해야 함: %v", err)
	}
}

func TestEmailAuthNewCodeResetsAttempts(t *testing.T) {
	h := newEmailHarness()
	_ = h.svc.SendCode(bg, "a@example.com", EmailPurposeRegister, "198.51.100.1", 0)
	for i := 0; i < 5; i++ {
		_, _ = h.svc.VerifyCode(bg, "a@example.com", EmailPurposeRegister, "x", 0)
	}
	_ = h.svc.SendCode(bg, "a@example.com", EmailPurposeRegister, "198.51.100.1", 0)
	if _, err := h.svc.VerifyCode(bg, "a@example.com", EmailPurposeRegister, h.lastCode(t), 0); err != nil {
		t.Fatalf("새 코드는 새 시도 횟수: %v", err)
	}
}

func TestEmailAuthExpiredCode(t *testing.T) {
	h := newEmailHarness()
	if _, err := h.svc.VerifyCode(bg, "a@example.com", EmailPurposeRegister, "123456", 0); statusOf(t, err) != 400 {
		t.Fatalf("코드 없음은 400: %v", err)
	}
}

// --- 한도 ---

func TestEmailAuthRateLimitPerEmail(t *testing.T) {
	h := newEmailHarness()
	for i := 0; i < 5; i++ {
		// IP를 바꿔 이메일 한도만 검증
		if err := h.svc.SendCode(bg, "a@example.com", EmailPurposeRegister, "198.51.100."+string(rune('1'+i)), 0); err != nil {
			t.Fatalf("%d번째 발송은 허용: %v", i+1, err)
		}
	}
	err := h.svc.SendCode(bg, "a@example.com", EmailPurposeRegister, "198.51.100.9", 0)
	var ee *EmailAuthError
	if !errors.As(err, &ee) || ee.Status != 429 || ee.RetryAfter < 1 {
		t.Fatalf("6번째는 429 + Retry-After: %v", err)
	}
	if len(h.mailer.sent) != 5 {
		t.Fatalf("한도 초과분은 발송하지 않음: %d", len(h.mailer.sent))
	}
	// 같은 정규화 주소는 같은 버킷(대소문자는 핸들러에서 정규화) — 다른 이메일은 영향 없음
	if err := h.svc.SendCode(bg, "b@example.com", EmailPurposeRegister, "198.51.100.1", 0); err != nil {
		t.Fatalf("다른 이메일은 허용: %v", err)
	}
}

func TestEmailAuthRateLimitPerIP(t *testing.T) {
	h := newEmailHarness()
	for i := 0; i < 20; i++ {
		email := "u" + string(rune('a'+i)) + "@example.com"
		if err := h.svc.SendCode(bg, email, EmailPurposeRegister, "203.0.113.5", 0); err != nil {
			t.Fatalf("%d번째 허용: %v", i+1, err)
		}
	}
	if err := h.svc.SendCode(bg, "uz@example.com", EmailPurposeRegister, "203.0.113.5", 0); statusOf(t, err) != 429 {
		t.Fatalf("21번째는 429: %v", err)
	}
	if err := h.svc.SendCode(bg, "uz@example.com", EmailPurposeRegister, "203.0.113.6", 0); err != nil {
		t.Fatalf("다른 IP는 허용: %v", err)
	}
	if ttl := h.store.ttls["email:rate:ip:"+sha256Hex("203.0.113.5")]; ttl != time.Hour {
		t.Fatalf("한도 윈도 1시간: %v", ttl)
	}
}

// --- Redis 장애 ---

func TestEmailAuthRedisDownIs503(t *testing.T) {
	for _, down := range []error{cache.ErrDisabled, errors.New("connection refused")} {
		h := newEmailHarness()
		h.store.err = down
		if err := h.svc.SendCode(bg, "a@example.com", EmailPurposeRegister, "198.51.100.1", 0); statusOf(t, err) != 503 {
			t.Fatalf("send: 503 기대: %v", err)
		}
		if len(h.mailer.sent) != 0 {
			t.Fatal("한도를 확인하지 못하면 발송하지 않는다(무제한 허용 금지)")
		}
		if _, err := h.svc.VerifyCode(bg, "a@example.com", EmailPurposeRegister, "123456", 0); statusOf(t, err) != 503 {
			t.Fatalf("verify: 503 기대: %v", err)
		}
		tok, _ := h.svc.IssueEmailToken("a@example.com", EmailPurposeRegister, 0)
		c, _ := h.svc.VerifyEmailToken(tok, "a@example.com", EmailPurposeRegister)
		if _, err := h.svc.ConsumeEmailToken(bg, c); statusOf(t, err) != 503 {
			t.Fatalf("consume: 503 기대: %v", err)
		}
	}
}

// --- 메일 발송 ---

func TestEmailAuthMailNotConfiguredFailsAndStoresNoCode(t *testing.T) {
	h := newEmailHarness()
	h.mailer.err = ErrMailNotConfigured
	err := h.svc.SendCode(bg, "a@example.com", EmailPurposeRegister, "198.51.100.1", 0)
	if statusOf(t, err) != 503 {
		t.Fatalf("설정 없음은 503: %v", err)
	}
	if _, ok := h.store.vals[codeKey("a@example.com", EmailPurposeRegister, 0)]; ok {
		t.Fatal("발송 실패 시 코드를 저장하면 안 됨")
	}
}

func TestEmailAuthMailFailureIs502AndKeepsExistingCode(t *testing.T) {
	h := newEmailHarness()
	_ = h.svc.SendCode(bg, "a@example.com", EmailPurposeRegister, "198.51.100.1", 0)
	old := h.lastCode(t)
	h.mailer.err = errors.New("smtp down")
	if err := h.svc.SendCode(bg, "a@example.com", EmailPurposeRegister, "198.51.100.1", 0); statusOf(t, err) != 502 {
		t.Fatalf("발송 실패는 502: %v", err)
	}
	if got := h.store.vals[codeKey("a@example.com", EmailPurposeRegister, 0)]; got != old {
		t.Fatal("실패한 재발송이 기존 유효 코드를 바꾸면 안 됨")
	}
}

// 실제 EmailService는 설정이 없으면 외부 호출 없이 ErrMailNotConfigured를 반환한다.
func TestEmailServiceSendVerificationCodeNotConfigured(t *testing.T) {
	svc := NewEmail(EmailConfig{})
	if err := svc.SendVerificationCode("a@example.com", "123456"); !errors.Is(err, ErrMailNotConfigured) {
		t.Fatalf("ErrMailNotConfigured 기대: %v", err)
	}
	// NODE_ENV=development여도 성공을 위장하지 않는다.
	t.Setenv("NODE_ENV", "development")
	if err := svc.SendVerificationCode("a@example.com", "123456"); !errors.Is(err, ErrMailNotConfigured) {
		t.Fatalf("개발환경에서도 실패해야 함: %v", err)
	}
}

// --- purpose별 정책 ---

func TestEmailAuthRegisterTakenIs409(t *testing.T) {
	h := newEmailHarness()
	h.members.taken["used@example.com"] = 3
	err := h.svc.SendCode(bg, "used@example.com", EmailPurposeRegister, "198.51.100.1", 0)
	if statusOf(t, err) != 409 || len(h.mailer.sent) != 0 {
		t.Fatalf("이미 쓰는 이메일은 409, 발송 없음: %v", err)
	}
}

func TestEmailAuthResetPasswordSameResponseRegardlessOfMembership(t *testing.T) {
	h := newEmailHarness()
	h.members.rows = []model.Member{memberWithEmail(5, "member@example.com")}
	errKnown := h.svc.SendCode(bg, "member@example.com", EmailPurposeResetPassword, "198.51.100.1", 0)
	errUnknown := h.svc.SendCode(bg, "nobody@example.com", EmailPurposeResetPassword, "198.51.100.1", 0)
	if errKnown != nil || errUnknown != nil {
		t.Fatalf("둘 다 동일한 성공: %v / %v", errKnown, errUnknown)
	}
	if len(h.mailer.sent) != 1 || h.mailer.sent[0] != "member@example.com" {
		t.Fatalf("실제 발송은 가입 회원에게만: %v", h.mailer.sent)
	}
	// 비활성(정지) 회원도 발송하지 않지만 응답은 같다
	blocked := memberWithEmail(6, "blocked@example.com")
	st := 2
	blocked.MtStatus = &st
	h.members.rows = append(h.members.rows, blocked)
	if err := h.svc.SendCode(bg, "blocked@example.com", EmailPurposeResetPassword, "198.51.100.1", 0); err != nil || len(h.mailer.sent) != 1 {
		t.Fatalf("정지 회원: 성공 응답, 발송 없음: %v %v", err, h.mailer.sent)
	}
	// 미가입이어도 한도는 동일하게 소비된다(존재 여부로 한도 동작이 갈리지 않음)
	if h.store.counts["email:rate:email:"+sha256Hex("nobody@example.com")] != 1 {
		t.Fatal("미가입 주소도 한도를 소비해야 함")
	}
}

func TestEmailAuthChangeEmailRequiresActiveMemberAndFree(t *testing.T) {
	h := newEmailHarness()
	h.members.byID[9] = &model.Member{MtIdx: 9}
	if err := h.svc.SendCode(bg, "new@example.com", EmailPurposeChangeEmail, "198.51.100.1", 0); statusOf(t, err) != 401 {
		t.Fatalf("로그인 없으면 401: %v", err)
	}
	if err := h.svc.SendCode(bg, "new@example.com", EmailPurposeChangeEmail, "198.51.100.1", 404); statusOf(t, err) != 401 {
		t.Fatalf("없는 회원 401: %v", err)
	}
	h.members.taken["taken@example.com"] = 3
	if err := h.svc.SendCode(bg, "taken@example.com", EmailPurposeChangeEmail, "198.51.100.1", 9); statusOf(t, err) != 409 {
		t.Fatalf("타 회원 사용 중이면 409: %v", err)
	}
	// 내가 이미 쓰는 이메일은 허용(다른 회원이 아님)
	h.members.taken["mine@example.com"] = 9
	if err := h.svc.SendCode(bg, "mine@example.com", EmailPurposeChangeEmail, "198.51.100.1", 9); err != nil {
		t.Fatalf("본인 이메일은 허용: %v", err)
	}
	// 코드는 회원별 키 — 다른 회원은 검증 불가
	h.members.byID[10] = &model.Member{MtIdx: 10}
	if _, err := h.svc.VerifyCode(bg, "mine@example.com", EmailPurposeChangeEmail, h.lastCode(t), 10); statusOf(t, err) != 400 {
		t.Fatalf("다른 회원의 코드 검증 불가: %v", err)
	}
}

func TestEmailAuthChangeEmailSuccessAndOtherMembersTokenRejected(t *testing.T) {
	h := newEmailHarness()
	h.members.byID[9] = &model.Member{MtIdx: 9}
	h.members.byID[10] = &model.Member{MtIdx: 10}
	tok := h.issueVerified(t, "new@example.com", EmailPurposeChangeEmail, 9)

	// 다른 회원(10)이 9의 토큰으로 변경 시도 → 403, 토큰은 소비되지 않음
	if err := h.svc.ChangeEmail(bg, 10, "new@example.com", tok); statusOf(t, err) != 403 {
		t.Fatalf("타 회원 토큰 403: %v", err)
	}
	if len(h.members.changedTo) != 0 {
		t.Fatal("변경되면 안 됨")
	}
	if err := h.svc.ChangeEmail(bg, 9, "new@example.com", tok); err != nil {
		t.Fatalf("본인 변경 성공: %v", err)
	}
	if h.members.changedTo[9] != "new@example.com" || len(h.members.changedTo) != 1 {
		t.Fatalf("mt_email만 갱신: %v", h.members.changedTo)
	}
	if err := h.svc.ChangeEmail(bg, 9, "new@example.com", tok); statusOf(t, err) != 400 {
		t.Fatalf("토큰 재사용 400: %v", err)
	}
}

func TestEmailAuthChangeEmailConflictRestoresToken(t *testing.T) {
	h := newEmailHarness()
	h.members.byID[9] = &model.Member{MtIdx: 9}
	tok := h.issueVerified(t, "new@example.com", EmailPurposeChangeEmail, 9)
	h.members.changeErr = repository.ErrEmailTaken // 발송 후 다른 회원이 선점
	if err := h.svc.ChangeEmail(bg, 9, "new@example.com", tok); statusOf(t, err) != 409 {
		t.Fatalf("409 기대: %v", err)
	}
	h.members.changeErr = errors.New("db down")
	if err := h.svc.ChangeEmail(bg, 9, "new@example.com", tok); statusOf(t, err) != 500 {
		t.Fatalf("DB 오류 500: %v", err)
	}
	h.members.changeErr = nil
	if err := h.svc.ChangeEmail(bg, 9, "new@example.com", tok); err != nil {
		t.Fatalf("실패 시 토큰이 되돌려져 재시도 가능해야 함: %v", err)
	}
}

func TestEmailAuthChangeEmailInactiveMember401(t *testing.T) {
	h := newEmailHarness()
	h.members.byID[9] = &model.Member{MtIdx: 9}
	tok := h.issueVerified(t, "new@example.com", EmailPurposeChangeEmail, 9)
	h.members.changeErr = repository.ErrMemberInactive
	if err := h.svc.ChangeEmail(bg, 9, "new@example.com", tok); statusOf(t, err) != 401 {
		t.Fatalf("401 기대: %v", err)
	}
}

// --- reset-password-by-email ---

func TestEmailAuthResetPasswordByEmailSuccessRevokesViaRepo(t *testing.T) {
	h := newEmailHarness()
	h.members.rows = []model.Member{memberWithEmail(5, "member@example.com")}
	tok := h.issueVerified(t, "member@example.com", EmailPurposeResetPassword, 0)

	if err := h.svc.ResetPasswordByEmail(bg, "member@example.com", tok, "weak"); statusOf(t, err) != 400 {
		t.Fatalf("정책 위반 400: %v", err)
	}
	// 정책 위반은 토큰을 소비하지 않는다
	if err := h.svc.ResetPasswordByEmail(bg, "member@example.com", tok, goodPw); err != nil {
		t.Fatalf("성공: %v", err)
	}
	// ResetPassword(해시 갱신 + refresh 전체 폐기를 한 트랜잭션)가 해당 회원에 대해 호출됨
	if len(h.members.resetCalls) != 1 || h.members.resetCalls[0] != 5 {
		t.Fatalf("재설정 호출: %v", h.members.resetCalls)
	}
	if !auth.VerifyPassword(goodPw, h.members.resetHashes[0]) {
		t.Fatal("저장되는 값은 새 비밀번호의 bcrypt 해시여야 함")
	}
	if err := h.svc.ResetPasswordByEmail(bg, "member@example.com", tok, goodPw); statusOf(t, err) != 400 {
		t.Fatalf("토큰 재사용 400: %v", err)
	}
}

func TestEmailAuthResetPasswordByEmailDBFailureRestoresToken(t *testing.T) {
	h := newEmailHarness()
	h.members.rows = []model.Member{memberWithEmail(5, "member@example.com")}
	tok := h.issueVerified(t, "member@example.com", EmailPurposeResetPassword, 0)
	h.members.resetErr = errors.New("deadlock")
	if err := h.svc.ResetPasswordByEmail(bg, "member@example.com", tok, goodPw); statusOf(t, err) != 500 {
		t.Fatalf("500 기대: %v", err)
	}
	h.members.resetErr = nil
	if err := h.svc.ResetPasswordByEmail(bg, "member@example.com", tok, goodPw); err != nil {
		t.Fatalf("DB 실패 후 같은 토큰으로 재시도 가능해야 함: %v", err)
	}
}

func TestEmailAuthResetPasswordByEmailAccountMustBeUnique(t *testing.T) {
	h := newEmailHarness()
	t0, _ := h.svc.IssueEmailToken("x@example.com", EmailPurposeResetPassword, 0)
	if err := h.svc.ResetPasswordByEmail(bg, "x@example.com", t0, goodPw); statusOf(t, err) != 400 {
		t.Fatalf("0명이면 400: %v", err)
	}
	h.members.rows = []model.Member{memberWithEmail(1, "x@example.com"), memberWithEmail(2, "X@Example.com ")}
	if err := h.svc.ResetPasswordByEmail(bg, "x@example.com", t0, goodPw); statusOf(t, err) != 400 {
		t.Fatalf("활성 2명이면 400: %v", err)
	}
	// 하나가 정지면 활성은 1명 → 진행
	st := 2
	h.members.rows[1].MtStatus = &st
	if err := h.svc.ResetPasswordByEmail(bg, "x@example.com", t0, goodPw); err != nil {
		t.Fatalf("활성 1명이면 성공: %v", err)
	}
	if len(h.members.resetCalls) != 1 || h.members.resetCalls[0] != 1 {
		t.Fatalf("활성 회원만 재설정: %v", h.members.resetCalls)
	}
	// 특정 불가로 거부된 두 번의 시도는 토큰을 소비하지 않았으므로 위 성공이 가능했다.
}

// --- 이메일 정규화 ---

func TestNormalizeEmail(t *testing.T) {
	ok := map[string]string{
		"  User@Example.COM ":  "user@example.com",
		"a.b+c@sub.example.kr": "a.b+c@sub.example.kr",
	}
	for in, want := range ok {
		if got, valid := NormalizeEmail(in); !valid || got != want {
			t.Errorf("%q → %q,%v (기대 %q)", in, got, valid, want)
		}
	}
	for _, in := range []string{"", "   ", "plain", "a@b", "@example.com", "a@@example.com", "Name <a@example.com>",
		"a b@example.com", "a@example..", "a@.example.com", "a@[127.0.0.1]", strings.Repeat("a", 250) + "@example.com"} {
		if got, valid := NormalizeEmail(in); valid {
			t.Errorf("%q는 거부돼야 함: %q", in, got)
		}
	}
}

func TestEmailAuthNormalizedEmailSharesCodeBucket(t *testing.T) {
	// 핸들러가 NormalizeEmail한 값을 넘기므로 대소문자·공백이 달라도 같은 키를 쓴다.
	a, _ := NormalizeEmail(" A@Example.com")
	b, _ := NormalizeEmail("a@example.COM ")
	if codeKey(a, EmailPurposeRegister, 0) != codeKey(b, EmailPurposeRegister, 0) {
		t.Fatal("정규화 결과가 같아야 같은 키")
	}
}
