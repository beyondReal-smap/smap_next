package service

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"log/slog"
	"math"
	mathrand "math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// G4: 가입·로그인 개편. 이메일 인증 가입, 구버전(전화번호/소셜 ID 평문) 호환 가입, 로그인 실패 한도,
// 비밀번호 변경 시 refresh 폐기 + 구 access token 무효 기준.

// AuthPolicy는 G4 정책 플래그와 한도다(전부 설정에서 온다).
type AuthPolicy struct {
	AllowLegacyPhoneRegister   bool          // ALLOW_LEGACY_PHONE_REGISTER (기본 true)
	LegacyRegisterRequireSMS   bool          // LEGACY_REGISTER_REQUIRE_SMS_VERIFIED (기본 false)
	SocialRegisterRequireToken bool          // SOCIAL_REGISTER_REQUIRE_TOKEN (기본 false)
	SocialRegisterRequireProof bool          // SOCIAL_REGISTER_REQUIRE_LOGIN_PROOF (기본 false)
	LoginFailPerAccount        int           // 계정당 실패 한도
	LoginFailPerIP             int           // IP당 실패 한도
	LoginFailWindow            time.Duration // 한도 창(고정 창)
}

// 소셜 로그인 증거(G5 로그인에서 공급자 토큰을 검증한 신규 사용자 ID)를 가입까지 15분 보관한다.
const socialProofTTL = 15 * time.Minute

// authRegisterStore는 가입 트랜잭션이다(구현은 *repository.AuthRegisterRepository).
type authRegisterStore interface {
	RegisterWithRefresh(spec repository.RegisterSpec) (*model.Member, string, error)
}

// emailTokenService는 가입 이메일 인증 토큰 처리다(구현은 *EmailAuthService).
type emailTokenService interface {
	ParseEmailToken(token, purpose string) (EmailTokenClaims, error)
	ConsumeEmailToken(ctx context.Context, c EmailTokenClaims) (*EmailTokenLease, error)
}

// securityStore는 한도·증거용 Redis 연산이다(구현은 *cache.Store).
type securityStore interface {
	IncrWithExpire(ctx context.Context, key string, ttl time.Duration) (int64, error)
	TTL(ctx context.Context, key string) (time.Duration, error)
	SetEX(ctx context.Context, key, val string, ttl time.Duration) error
	GetString(ctx context.Context, key string) (string, bool, error)
	DelKeys(ctx context.Context, keys ...string) (int64, error)
}

// accessRevoker는 회원별 "이 시각 이전 access token 무효" 기준을 기록한다(구현은 *cache.AccessRevocation).
type accessRevoker interface {
	RevokeBefore(ctx context.Context, mtIdx int) error
}

func (s *AuthService) SetRegisterStore(r authRegisterStore) { s.reg = r }
func (s *AuthService) SetEmailTokens(t emailTokenService)   { s.emailTok = t }
func (s *AuthService) SetSecurityStore(g securityStore)     { s.guard = g }
func (s *AuthService) SetAccessRevoker(r accessRevoker)     { s.revoker = r }
func (s *AuthService) SetPolicy(p AuthPolicy)               { s.policy = p }
func (s *AuthService) SetLogger(l *slog.Logger)             { s.logger = l }

func (s *AuthService) log() *slog.Logger {
	if s.logger != nil {
		return s.logger
	}
	return slog.Default()
}

// AuthRejection은 HTTP 상태와 함께 돌려주는 거부 사유다({"detail": Detail}).
type AuthRejection struct {
	Status     int
	Detail     string
	RetryAfter int // 429일 때 남은 초
}

func (e *AuthRejection) Error() string { return fmt.Sprintf("%d %s", e.Status, e.Detail) }

func reject(status int, detail string) *AuthRejection {
	return &AuthRejection{Status: status, Detail: detail}
}

// ClientMeta는 요청 메타데이터다(원본 IP는 한도 키 해시에만 쓰고 저장하지 않는다).
type ClientMeta struct {
	UserAgent string
	IPHash    string // refresh 메타데이터용
	ClientIP  string // 한도용(netutil.ClientIP)
}

// ===========================================================================
// 로그인
// ===========================================================================

const (
	msgLoginFail      = "아이디 또는 비밀번호가 올바르지 않습니다."
	msgLoginAmbiguous = "계정을 특정할 수 없습니다. 고객센터에 문의해주세요."
)

func (s *AuthService) dummyHash() string {
	s.dummyMu.Do(func() {
		h, err := auth.HashPassword("dummy-password-for-timing", s.cfg.BcryptCost)
		if err != nil {
			s.log().Error("login_dummy_hash_failed", slog.String("err", err.Error()))
			return
		}
		s.dummyPwd = h
	})
	return s.dummyPwd
}

// burnPasswordCheck는 존재하지 않는 계정에도 같은 비용의 해시 검증을 수행해 응답 시간 차이를 줄인다(A-9).
func (s *AuthService) burnPasswordCheck(pw string) { _ = auth.VerifyPassword(pw, s.dummyHash()) }

func normalizeLoginID(raw string) string {
	id := strings.TrimSpace(raw)
	if strings.Contains(id, "@") {
		return strings.ToLower(id)
	}
	return strings.ReplaceAll(id, "-", "")
}

func loginFailKeys(id, ip string) (acct, ipKey string) {
	return "auth:login:fail:acct:" + sha256Hex(id), "auth:login:fail:ip:" + sha256Hex(ip)
}

// checkLoginBlocked는 실패 한도 초과 여부를 확인한다. Redis 오류는 로그인 가용성을 위해 통과 + 경고 로그다
// (이메일 인증 발송 한도는 보안 우선이라 503이지만, 로그인은 Redis 장애가 전체 로그인 불능이 되면 안 된다).
func (s *AuthService) checkLoginBlocked(ctx context.Context, acctKey, ipKey string) *AuthRejection {
	if s.guard == nil {
		return nil
	}
	check := func(key string, limit int) *AuthRejection {
		if limit <= 0 {
			return nil
		}
		v, found, err := s.guard.GetString(ctx, key)
		if err != nil {
			s.log().Warn("login_limit_store_unavailable_allowing", slog.String("op", "get"), slog.String("err", err.Error()))
			return nil
		}
		if !found {
			return nil
		}
		var n int
		if _, err := fmt.Sscanf(v, "%d", &n); err != nil || n < limit {
			return nil
		}
		ttl, err := s.guard.TTL(ctx, key)
		if err != nil {
			s.log().Warn("login_limit_store_unavailable_allowing", slog.String("op", "ttl"), slog.String("err", err.Error()))
			return nil
		}
		secs := int(math.Ceil(ttl.Seconds()))
		if secs < 1 {
			secs = 1
		}
		mins := (secs + 59) / 60
		return &AuthRejection{Status: http.StatusTooManyRequests, RetryAfter: secs,
			Detail: fmt.Sprintf("로그인 시도 횟수를 초과했습니다. 약 %d분 후 다시 시도해주세요.", mins)}
	}
	if r := check(acctKey, s.policy.LoginFailPerAccount); r != nil {
		return r
	}
	return check(ipKey, s.policy.LoginFailPerIP)
}

func (s *AuthService) recordLoginFailure(ctx context.Context, acctKey, ipKey string) {
	if s.guard == nil {
		return
	}
	for _, key := range []string{acctKey, ipKey} {
		if _, err := s.guard.IncrWithExpire(ctx, key, s.policy.LoginFailWindow); err != nil {
			s.log().Warn("login_limit_store_unavailable_allowing", slog.String("op", "incr"), slog.String("err", err.Error()))
			return
		}
	}
}

func (s *AuthService) clearLoginFailures(ctx context.Context, acctKey string) {
	if s.guard == nil {
		return
	}
	if _, err := s.guard.DelKeys(ctx, acctKey); err != nil {
		s.log().Warn("login_limit_store_unavailable_allowing", slog.String("op", "del"), slog.String("err", err.Error()))
	}
}

// Login은 POST /auth/login. 정상/실패 응답은 기존처럼 200 + success 플래그이고,
// 한도 초과(429)와 계정 특정 불가(400)만 *AuthRejection으로 돌려준다.
// 조회 순서: mt_id 정확 일치 → (이메일 형태면) mt_email 일치(활성 회원 2명 이상이면 400).
func (s *AuthService) Login(ctx context.Context, in LoginInput, meta ClientMeta) (dto.LoginHomeResponse, *AuthRejection) {
	fail := dto.LoginHomeResponse{Success: false, Message: msgLoginFail}
	serverErr := dto.LoginHomeResponse{Success: false, Message: "서버 오류가 발생했습니다."}

	id := normalizeLoginID(in.MtID)
	acctKey, ipKey := loginFailKeys(id, meta.ClientIP)
	if rej := s.checkLoginBlocked(ctx, acctKey, ipKey); rej != nil {
		return dto.LoginHomeResponse{}, rej
	}

	user, err := s.members.GetByMtID(id)
	if err != nil {
		return serverErr, nil
	}
	if user == nil && strings.Contains(id, "@") {
		rows, err := s.members.FindActiveByEmail(id)
		if err != nil {
			return serverErr, nil
		}
		if len(rows) > 1 {
			s.log().Warn("login_ambiguous_email_account")
			return dto.LoginHomeResponse{}, reject(http.StatusBadRequest, msgLoginAmbiguous)
		}
		if len(rows) == 1 {
			user = &rows[0]
		}
	}
	if user == nil {
		s.burnPasswordCheck(in.MtPwd)
		s.recordLoginFailure(ctx, acctKey, ipKey)
		return fail, nil
	}

	pwd := derefStr(user.MtPwd)
	if pwd == "" {
		s.burnPasswordCheck(in.MtPwd)
		s.recordLoginFailure(ctx, acctKey, ipKey)
		return fail, nil
	}
	if !auth.VerifyPassword(in.MtPwd, pwd) {
		s.recordLoginFailure(ctx, acctKey, ipKey)
		return fail, nil
	}
	// 탈퇴(mt_level=1)·정지(mt_status=2)·비노출(mt_show='N') 회원은 로그인 거부. NULL은 통과(기존 회원 잠금 방지).
	// 계정 존재·상태 노출을 막으려고 비밀번호 검증 뒤에, 비밀번호 오류와 같은 응답으로 거부한다.
	if user.IsBlocked() {
		s.recordLoginFailure(ctx, acctKey, ipKey)
		return fail, nil
	}
	s.clearLoginFailures(ctx, acctKey)

	accessToken, err := s.issueAccessToken(user)
	if err != nil {
		return serverErr, nil
	}
	now := dbUTCNow()
	fields := map[string]interface{}{"mt_ldate": now, "mt_adate": now}
	if in.DeviceID != "" {
		fields["mt_device_id"] = in.DeviceID
	}
	if in.DeviceModel != "" {
		fields["mt_device_model"] = in.DeviceModel
	}
	if in.OsType != "" {
		v := 0
		if strings.ToLower(in.OsType) == "ios" {
			v = 1
		}
		fields["mt_os_check"] = v
	}
	if in.OsVersion != "" {
		fields["mt_os_version"] = in.OsVersion
	}
	if in.AppVersion != "" {
		fields["mt_app_version"] = in.AppVersion
	}
	if err := s.members.UpdateColumns(user.MtIdx, fields); err != nil {
		return serverErr, nil
	}
	if fresh, ferr := s.members.GetByID(user.MtIdx); ferr == nil && fresh != nil {
		user = fresh
	} else {
		user.MtLdate, user.MtAdate = &now, &now
	}
	refreshRaw, _, err := s.refresh.Issue(user.MtIdx, "", meta.UserAgent, meta.IPHash)
	if err != nil {
		return serverErr, nil
	}
	return dto.LoginHomeResponse{
		Success: true,
		Message: "로그인 성공",
		Data: &dto.LoginHomeData{
			Token:        accessToken,
			RefreshToken: refreshRaw,
			ExpiresIn:    s.accessExpiresInSeconds(),
			User:         buildLoginUserData(user),
		},
	}, nil
}

// ===========================================================================
// 비밀번호 변경 시 토큰 회수
// ===========================================================================

// changePasswordAndRevoke는 비밀번호 갱신 + refresh 전부 폐기(한 트랜잭션) + 구 access token 무효 기준 기록을 수행한다.
// 보안 작업이므로 기준 기록이 실패하면(Redis 장애) 비밀번호를 바꾸지 않고 실패시킨다(fail-fast).
func (s *AuthService) changePasswordAndRevoke(mtIdx int, newPassword string) bool {
	hashed, err := auth.HashPassword(newPassword, s.cfg.BcryptCost)
	if err != nil {
		return false
	}
	if s.revoker == nil {
		s.log().Error("access_revoker_not_wired")
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := s.revoker.RevokeBefore(ctx, mtIdx); err != nil {
		s.log().Error("password_change_revoke_marker_failed", slog.String("err", err.Error()))
		return false
	}
	if err := s.members.SetPasswordRevokeRefresh(mtIdx, hashed); err != nil {
		s.log().Error("password_change_db_failed", slog.String("err", err.Error()))
		return false
	}
	return true
}

// ===========================================================================
// 가입
// ===========================================================================

// RegisterInput은 RegisterRequest(create_user가 사용하는 필드 + 15단계 인증 필드).
type RegisterInput struct {
	MtType     int
	MtLevel    int
	MtStatus   int
	MtID       string
	MtPwd      *string
	MtName     string
	MtNickname string
	MtEmail    *string
	MtHp       *string
	MtBirth    *string
	MtGender   *int
	MtFile1    *string
	MtAgree1   bool
	MtAgree2   bool
	MtAgree3   bool
	MtAgree4   bool
	MtAgree5   bool
	MtTokenID  *string
	MtLat      *float64
	MtLong     *float64
	MtGoogleID *string
	MtKakaoID  *string
	MtAppleID  *string

	EmailVerificationToken string
	SocialProvider         string
	SocialToken            string
}

const (
	msgNeedVerification = "본인인증이 필요합니다."
	msgSocialNeedsProof = "소셜 계정 연결은 공급자 인증이 필요합니다."
)

var socialIDPrefixes = map[string]auth.Provider{"google_": auth.ProviderGoogle, "apple_": auth.ProviderApple, "kakao_": auth.ProviderKakao}

func socialColumn(p auth.Provider) string {
	switch p {
	case auth.ProviderGoogle:
		return "mt_google_id"
	case auth.ProviderApple:
		return "mt_apple_id"
	default:
		return "mt_kakao_id"
	}
}

func (s *AuthService) identityLock(identity string) func() {
	sum := sha256Hex(identity)
	idx := int(sum[0]) % len(s.identMu)
	m := &s.identMu[idx]
	m.Lock()
	return m.Unlock
}

func proofKey(p auth.Provider, id string) string {
	return "auth:social:login-proof:" + string(p) + ":" + sha256Hex(id)
}

// recordSocialLoginProof는 공급자 토큰을 검증한 소셜 로그인에서 "신규 사용자" 판정이 난 공급자 ID를 15분 기록한다
// (구버전 앱 가입은 공급자 토큰 없이 ID만 보내므로, SOCIAL_REGISTER_REQUIRE_LOGIN_PROOF=true일 때 대조한다).
// 실패해도 로그인은 막지 않는다(기록이 없으면 그 가입이 거부될 뿐이다).
func (s *AuthService) recordSocialLoginProof(p auth.Provider, id string) {
	if s.guard == nil || id == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := s.guard.SetEX(ctx, proofKey(p, id), "1", socialProofTTL); err != nil {
		s.log().Warn("social_login_proof_store_failed", slog.String("provider", string(p)), slog.String("err", err.Error()))
	}
}

func emailAuthRejection(err error) *AuthRejection {
	var ee *EmailAuthError
	if errors.As(err, &ee) {
		return &AuthRejection{Status: ee.Status, Detail: ee.Detail, RetryAfter: ee.RetryAfter}
	}
	return reject(http.StatusInternalServerError, "사용자 생성 중 오류가 발생했습니다.")
}

// Register는 POST /auth/register.
//
//	email_verification_token(purpose=register) 있음: 토큰의 이메일을 mt_id와 mt_email로 저장(일회용 소비, 실패 시 되돌림).
//	토큰 없음: 구버전 호환 경로(ALLOW_LEGACY_PHONE_REGISTER). mt_id는 숫자 전화번호 또는 google_/kakao_/apple_ 접두 ID만 허용하고,
//	  검증되지 않은 mt_email은 저장하지 않는다.
//	social_provider/social_token 있음: 공급자 토큰을 검증하고 검증된 ID만 저장한다(본문의 mt_*_id는 무시).
//	  없고 mt_*_id만 있으면(구버전) SOCIAL_REGISTER_REQUIRE_TOKEN / ..._LOGIN_PROOF 플래그에 따른다.
//
// 권한 필드(mt_type/level/status)는 항상 서버가 정한다.
func (s *AuthService) Register(ctx context.Context, in RegisterInput, meta ClientMeta) (*dto.LoginHomeResponse, *AuthRejection) {
	serverErr := reject(http.StatusInternalServerError, "사용자 생성 중 오류가 발생했습니다.")
	if s.reg == nil {
		s.log().Error("register_store_not_wired")
		return nil, serverErr
	}

	// --- 비밀번호 ---
	pwd := ""
	if in.MtPwd != nil {
		pwd = *in.MtPwd
	}
	if pwd != "" {
		if ok, errs := auth.ValidatePasswordPolicy(pwd, s.cfg.Policy); !ok {
			return nil, reject(http.StatusBadRequest, strings.Join(errs, ", "))
		}
	}
	// --- 생년월일 ---
	if in.MtBirth != nil && *in.MtBirth != "" {
		if _, err := time.Parse("2006-01-02", *in.MtBirth); err != nil {
			return nil, reject(http.StatusBadRequest, "생년월일 형식이 올바르지 않습니다.")
		}
	}

	spec := repository.RegisterSpec{UserAgent: meta.UserAgent, IPHash: meta.IPHash}
	var (
		mtID    string
		mtEmail *string
		mtHp    string
		lease   *EmailTokenLease
		claims  EmailTokenClaims
		emailOK bool
	)

	// --- 식별자 경로 ---
	if strings.TrimSpace(in.EmailVerificationToken) != "" {
		if s.emailTok == nil {
			s.log().Error("email_token_service_not_wired")
			return nil, serverErr
		}
		if pwd == "" {
			return nil, reject(http.StatusBadRequest, "비밀번호가 필요합니다.")
		}
		c, err := s.emailTok.ParseEmailToken(in.EmailVerificationToken, EmailPurposeRegister)
		if err != nil {
			return nil, emailAuthRejection(err)
		}
		email, ok := NormalizeEmail(c.Email)
		if !ok {
			return nil, reject(http.StatusBadRequest, msgEmailTokenBad)
		}
		if in.MtEmail != nil && strings.TrimSpace(*in.MtEmail) != "" {
			if body, ok := NormalizeEmail(*in.MtEmail); !ok || subtle.ConstantTimeCompare([]byte(body), []byte(email)) != 1 {
				return nil, reject(http.StatusBadRequest, msgEmailTokenBad)
			}
		}
		claims, emailOK = c, true
		mtID, mtEmail = email, &email
		spec.ID, spec.Email = email, email
		if in.MtHp != nil && strings.TrimSpace(*in.MtHp) != "" {
			hp := cleanPhone(*in.MtHp)
			if !isAllDigits(hp) || len(hp) < 9 || len(hp) > 15 {
				return nil, reject(http.StatusBadRequest, "전화번호 형식이 올바르지 않습니다.")
			}
			mtHp = hp
		}
	} else {
		if !s.policy.AllowLegacyPhoneRegister {
			return nil, reject(http.StatusBadRequest, msgNeedVerification)
		}
		raw := cleanPhone(strings.TrimSpace(in.MtID))
		switch {
		case isAllDigits(raw):
			mtHp = raw
			spec.Phone = raw
			if s.policy.LegacyRegisterRequireSMS {
				if s.verify == nil || !s.verify.IsVerified(raw) {
					return nil, reject(http.StatusBadRequest, msgNeedVerification)
				}
			}
		case hasSocialPrefix(raw):
			// 소셜 가입: 아래 소셜 처리에서 검증/대조한다.
		default:
			// 이메일 형태나 임의 문자열 ID는 인증 없이 만들 수 없다(타인의 이메일 선점 방지).
			return nil, reject(http.StatusBadRequest, msgNeedVerification)
		}
		mtID = raw
		spec.ID = raw
		mtEmail = nil // 검증되지 않은 이메일은 저장하지 않는다(A-6)
	}

	// --- 소셜 ---
	var google, apple, kakao *string
	var proofToConsume string
	provider := strings.ToLower(strings.TrimSpace(in.SocialProvider))
	token := strings.TrimSpace(in.SocialToken)
	claimed := map[auth.Provider]string{
		auth.ProviderGoogle: derefStr(in.MtGoogleID), auth.ProviderApple: derefStr(in.MtAppleID), auth.ProviderKakao: derefStr(in.MtKakaoID),
	}
	var verifiedProvider auth.Provider
	switch {
	case provider != "":
		p, err := auth.ParseProvider(provider)
		if err != nil {
			return nil, reject(http.StatusBadRequest, "지원하지 않는 소셜 공급자입니다.")
		}
		if token == "" {
			return nil, reject(http.StatusBadRequest, msgSocialNeedsProof)
		}
		if s.socialV.Verifier == nil {
			s.log().Error("social verifier missing for register")
			return nil, reject(http.StatusServiceUnavailable, "소셜 로그인 설정이 필요합니다.")
		}
		idn, verr := s.socialV.Verifier.Verify(ctx, p, token)
		if verr != nil {
			e := newSocialVerifyError(verr)
			s.log().Warn("social register token rejected", slog.String("provider", string(p)), slog.Int("status", e.Status), slog.String("app", appIdentity(meta.UserAgent)))
			return nil, reject(e.Status, e.Detail)
		}
		s.noteIDMismatch(p, claimed[p], idn.Subject)
		verifiedProvider = p
		spec.SocialCol, spec.SocialVal = socialColumn(p), idn.Subject
		sub := idn.Subject
		google, apple, kakao = nil, nil, nil
		switch p {
		case auth.ProviderGoogle:
			google = &sub
		case auth.ProviderApple:
			apple = &sub
		default:
			kakao = &sub
		}
		if !emailOK && hasSocialPrefix(mtID) {
			mtID = string(p) + "_" + sub // 구버전 형식 ID도 검증된 값으로 고정
			spec.ID = mtID
		}
	case token != "":
		return nil, reject(http.StatusBadRequest, msgSocialNeedsProof)
	default:
		var count int
		var which auth.Provider
		for p, v := range claimed {
			if v != "" {
				count++
				which = p
			}
		}
		if count > 1 {
			return nil, reject(http.StatusBadRequest, msgSocialNeedsProof)
		}
		if count == 1 {
			id := claimed[which]
			switch {
			case s.policy.SocialRegisterRequireToken:
				return nil, reject(http.StatusBadRequest, msgSocialNeedsProof)
			case s.policy.SocialRegisterRequireProof:
				if s.guard == nil {
					return nil, reject(http.StatusServiceUnavailable, msgEmailStoreDown)
				}
				_, found, err := s.guard.GetString(ctx, proofKey(which, id))
				if err != nil {
					s.log().Error("social_proof_store_failed", slog.String("err", err.Error()))
					return nil, reject(http.StatusServiceUnavailable, msgEmailStoreDown)
				}
				if !found {
					return nil, reject(http.StatusBadRequest, msgSocialNeedsProof)
				}
				proofToConsume = proofKey(which, id)
			default:
				s.log().Warn("social register without provider token",
					slog.String("provider", string(which)), slog.String("app", appIdentity(meta.UserAgent)))
			}
			v := id
			switch which {
			case auth.ProviderGoogle:
				google = &v
			case auth.ProviderApple:
				apple = &v
			default:
				kakao = &v
			}
			spec.SocialCol, spec.SocialVal = socialColumn(which), id
		}
	}
	_ = verifiedProvider

	// --- 같은 식별자 동시 가입 직렬화 + 토큰 소비 ---
	unlock := s.identityLock(mtID)
	defer unlock()
	if emailOK {
		l, err := s.emailTok.ConsumeEmailToken(ctx, claims)
		if err != nil {
			return nil, emailAuthRejection(err)
		}
		lease = l
	}
	restore := func() {
		if lease != nil {
			_ = lease.Restore(ctx) // 실패는 Restore 안에서 로그
		}
	}

	member, err := s.buildNewMember(in, mtID, mtEmail, mtHp, pwd, google, apple, kakao)
	if err != nil {
		restore()
		s.log().Error("register_build_failed", slog.String("err", err.Error()))
		return nil, serverErr
	}
	spec.Member = member
	created, refreshRaw, err := s.reg.RegisterWithRefresh(spec)
	if err != nil {
		restore()
		var ce *repository.RegisterConflictError
		if errors.As(err, &ce) {
			switch ce.Field {
			case "email":
				return nil, reject(http.StatusConflict, "이미 가입된 이메일입니다.")
			case "phone":
				return nil, reject(http.StatusConflict, "이미 등록된 전화번호입니다.")
			case "social":
				return nil, reject(http.StatusConflict, "이미 연결된 소셜 계정입니다.")
			default:
				if emailOK {
					return nil, reject(http.StatusConflict, "이미 가입된 이메일입니다.")
				}
				return nil, reject(http.StatusConflict, "이미 등록된 전화번호입니다.")
			}
		}
		s.log().Error("register_failed", slog.String("err", err.Error()))
		return nil, serverErr
	}
	accessToken, err := s.issueAccessToken(created)
	if err != nil {
		s.log().Error("register_token_failed", slog.String("err", err.Error()))
		return nil, serverErr
	}
	// 성공 후 정리: SMS 인증 상태/소셜 증거는 일회용.
	if spec.Phone != "" && s.policy.LegacyRegisterRequireSMS && s.verify != nil {
		s.verify.ClearVerified(spec.Phone)
	}
	if proofToConsume != "" && s.guard != nil {
		if _, derr := s.guard.DelKeys(ctx, proofToConsume); derr != nil {
			s.log().Warn("social_proof_cleanup_failed", slog.String("err", derr.Error()))
		}
	}
	return &dto.LoginHomeResponse{
		Success: true,
		Message: "회원가입 성공",
		Data: &dto.RegisterData{
			Token:        accessToken,
			RefreshToken: refreshRaw,
			ExpiresIn:    s.accessExpiresInSeconds(),
			User:         buildRegisterUserData(created),
		},
	}, nil
}

func hasSocialPrefix(id string) bool {
	for p := range socialIDPrefixes {
		if strings.HasPrefix(id, p) && len(id) > len(p) {
			return true
		}
	}
	return false
}

// buildNewMember는 신규 일반 회원 행을 만든다. 권한·상태 값은 요청 본문을 무시하고 서버가 정한다
// (무인증 가입에서 mt_level=9 등을 주입해 관리자 계정을 만드는 것을 막는다).
func (s *AuthService) buildNewMember(in RegisterInput, mtID string, mtEmail *string, mtHp, pwd string, google, apple, kakao *string) (*model.Member, error) {
	var hashed *string
	if pwd != "" {
		h, err := auth.HashPassword(pwd, s.cfg.BcryptCost)
		if err != nil {
			return nil, err
		}
		hashed = &h
	}
	profileImage := ""
	if in.MtFile1 != nil {
		profileImage = *in.MtFile1
	}
	if profileImage == "" || len(profileImage) > 50 {
		profileImage = "/images/avatar" + itoaSmall(mathrand.Intn(7)+1) + ".png"
	}
	now := dbUTCNow()
	yn := func(b bool) *string {
		v := "N"
		if b {
			v = "Y"
		}
		return &v
	}
	show := "Y"
	mtType, mtLevel, mtStatus := newMemberType, newMemberLevel, newMemberStatus
	var birth *time.Time
	if in.MtBirth != nil && *in.MtBirth != "" {
		t, err := time.Parse("2006-01-02", *in.MtBirth)
		if err != nil {
			return nil, err
		}
		birth = &t
	}
	lat := 37.5642
	if in.MtLat != nil && *in.MtLat != 0 {
		lat = *in.MtLat
	}
	long := 127.0016
	if in.MtLong != nil && *in.MtLong != 0 {
		long = *in.MtLong
	}
	id := mtID
	var hp *string
	if mtHp != "" {
		h := mtHp
		hp = &h
	}
	return &model.Member{
		MtID: &id, MtPwd: hashed, MtName: &in.MtName, MtEmail: mtEmail, MtNickname: &in.MtNickname, MtHp: hp,
		MtType: &mtType, MtLevel: &mtLevel, MtStatus: &mtStatus, MtShow: &show, MtWdate: &now, MtLdate: &now,
		MtAgree1: yn(in.MtAgree1), MtAgree2: yn(in.MtAgree2), MtAgree3: yn(in.MtAgree3), MtAgree4: yn(in.MtAgree4), MtAgree5: yn(in.MtAgree5),
		MtGoogleID: google, MtKakaoID: kakao, MtAppleID: apple,
		MtBirth: birth, MtGender: in.MtGender, MtFile1: &profileImage, MtLat: &lat, MtLong: &long, MtTokenID: in.MtTokenID,
	}, nil
}
