package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// --- fakes ---

type fakeAuthMemberRepo struct {
	byEmail  map[string]*model.Member
	byMtID   map[string]*model.Member
	byID     map[int]*model.Member
	byKakao  map[string]*model.Member
	byGoogle map[string]*model.Member
	byApple  map[string]*model.Member
	byReset  map[string]*model.Member // Phase C: mt_reset_token → member

	getErr    error
	createErr error
	updateErr error
	dupEmail  map[string][]model.Member
	pwErr     error
	pwSets    []int

	created    *model.Member
	nextIdx    int
	lastFields map[string]interface{}
}

func (f *fakeAuthMemberRepo) GetByEmail(e string) (*model.Member, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return f.byEmail[e], nil
}
func (f *fakeAuthMemberRepo) GetByMtID(id string) (*model.Member, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return f.byMtID[id], nil
}
func (f *fakeAuthMemberRepo) GetByID(idx int) (*model.Member, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return f.byID[idx], nil
}
func (f *fakeAuthMemberRepo) CreateMember(m *model.Member) (*model.Member, error) {
	if f.createErr != nil {
		return nil, f.createErr
	}
	if f.nextIdx == 0 {
		f.nextIdx = 99001
	}
	m.MtIdx = f.nextIdx
	f.created = m
	return m, nil
}
func (f *fakeAuthMemberRepo) UpdateColumns(idx int, fields map[string]interface{}) error {
	if f.updateErr != nil {
		return f.updateErr
	}
	f.lastFields = fields
	return nil
}

// Phase B 소셜 조회 stub(byKakao/byGoogle/byApple/byPhone 맵). Phase A 테스트는 미사용.
func (f *fakeAuthMemberRepo) GetByKakaoID(v string) (*model.Member, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return f.byKakao[v], nil
}
func (f *fakeAuthMemberRepo) GetByGoogleID(v string) (*model.Member, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return f.byGoogle[v], nil
}
func (f *fakeAuthMemberRepo) GetByAppleID(v string) (*model.Member, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return f.byApple[v], nil
}
func (f *fakeAuthMemberRepo) GetByPhoneOr(v string) (*model.Member, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return f.byMtID[strings.ReplaceAll(v, "-", "")], nil
}

// Phase C 비번재설정 토큰 조회 stub(byReset 맵). now는 무시(만료는 테스트에서 맵 유무로 모델링).
func (f *fakeAuthMemberRepo) GetByResetToken(token string, now time.Time) (*model.Member, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return f.byReset[token], nil
}

// G4: 이메일이 같은 활성(미차단) 회원. byEmail 맵 기준. pwSets는 SetPasswordRevokeRefresh 호출 기록.
func (f *fakeAuthMemberRepo) FindActiveByEmail(email string) ([]model.Member, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	if f.dupEmail != nil {
		return f.dupEmail[email], nil
	}
	if m := f.byEmail[email]; m != nil && !m.IsBlocked() {
		return []model.Member{*m}, nil
	}
	return nil, nil
}
func (f *fakeAuthMemberRepo) SetPasswordRevokeRefresh(idx int, hashed string) error {
	if f.pwErr != nil {
		return f.pwErr
	}
	f.pwSets = append(f.pwSets, idx)
	f.lastFields = map[string]interface{}{"mt_pwd": hashed}
	return nil
}

type fakeAuthRefreshRepo struct {
	issueRaw  string
	issueErr  error
	rotateRaw string
	rotateIdx int
	rotateOK  bool
	rotateErr error
	revokeOK  bool
	revokeErr error
	revoked   []string
}

func (f *fakeAuthRefreshRepo) Issue(mtIdx int, chainID, ua, ip string) (string, string, error) {
	if f.issueErr != nil {
		return "", "", f.issueErr
	}
	return f.issueRaw, "chain-x", nil
}
func (f *fakeAuthRefreshRepo) Rotate(rawOld, ua, ip string) (string, int, bool, error) {
	if f.rotateErr != nil {
		return "", 0, false, f.rotateErr
	}
	return f.rotateRaw, f.rotateIdx, f.rotateOK, nil
}
func (f *fakeAuthRefreshRepo) RevokeByRaw(raw string) (bool, error) {
	f.revoked = append(f.revoked, raw)
	return f.revokeOK, f.revokeErr
}

func testAuthConfig() AuthConfig {
	return AuthConfig{
		Secret:       "test-secret-key-1234567890",
		Algorithm:    "HS256",
		AccessExpMin: 43200,
		BcryptCost:   4, // 테스트 속도용 최소 비용
		Policy: auth.PasswordPolicy{
			MinLength:      8,
			RequireUpper:   true,
			RequireLower:   true,
			RequireNumbers: true,
			RequireSpecial: true,
		},
	}
}

// --- 토큰 / 비밀번호 헬퍼 ---

func TestCreateAccessTokenInterop(t *testing.T) {
	cfg := testAuthConfig()
	name := "정진"
	tok, err := auth.CreateAccessToken(1186, "01012345678", &name, cfg.Secret, cfg.Algorithm, cfg.AccessExpMin)
	if err != nil {
		t.Fatalf("발급 실패: %v", err)
	}
	// 발급한 토큰을 검증 경로(ParseOptionalUserID)가 수용해야 한다(컷오버 interop 핵심).
	id, ok := auth.ParseOptionalUserID("Bearer "+tok, cfg.Secret, cfg.Algorithm)
	if !ok || id != 1186 {
		t.Fatalf("ParseOptionalUserID 실패: id=%d ok=%v", id, ok)
	}
	// claim 추출(v1 refresh 경로).
	claims, ok := auth.DecodeAccessClaims(tok, cfg.Secret, cfg.Algorithm)
	if !ok || !claims.HasMtIdx || claims.MtIdx != 1186 || claims.MtID != "01012345678" || claims.MtName == nil || *claims.MtName != "정진" {
		t.Fatalf("claim 불일치: %+v ok=%v", claims, ok)
	}
}

func TestVerifyPasswordAndPolicy(t *testing.T) {
	cfg := testAuthConfig()
	pw := "Test1234!@"
	hash, err := auth.HashPasswordWithPolicy(pw, cfg.BcryptCost, cfg.Policy)
	if err != nil {
		t.Fatalf("해싱 실패: %v", err)
	}
	if !auth.VerifyPassword(pw, hash) {
		t.Fatal("정상 비밀번호 검증 실패")
	}
	if auth.VerifyPassword("wrong", hash) {
		t.Fatal("틀린 비밀번호가 통과됨")
	}
	if auth.VerifyPassword(pw, "") {
		t.Fatal("빈 해시가 통과됨")
	}
	// $2y$ 프리픽스 정규화: $2b$ 해시를 $2y$로 바꿔도 동일하게 검증돼야 한다.
	if strings.HasPrefix(hash, "$2") {
		y := "$2y$" + hash[len("$2a$"):]
		if !auth.VerifyPassword(pw, y) {
			t.Fatal("$2y$ 정규화 검증 실패")
		}
	}
	// 정책 위반.
	if ok, _ := auth.ValidatePasswordPolicy("short", cfg.Policy); ok {
		t.Fatal("짧은 비밀번호가 통과됨")
	}
	if ok, _ := auth.ValidatePasswordPolicy("alllowercase1!", cfg.Policy); ok {
		t.Fatal("대문자 없는 비밀번호가 통과됨")
	}
	if ok, _ := auth.ValidatePasswordPolicy("NoSpecial123", cfg.Policy); ok {
		t.Fatal("특수문자 없는 비밀번호가 통과됨")
	}
	if ok, _ := auth.ValidatePasswordPolicy("Valid123!", cfg.Policy); !ok {
		t.Fatal("유효한 비밀번호가 거부됨")
	}
}

// --- LoginHome ---

func loginTestUser(t *testing.T, cfg AuthConfig) *model.Member {
	t.Helper()
	hash, err := auth.HashPassword("Test1234!@", cfg.BcryptCost)
	if err != nil {
		t.Fatalf("해싱: %v", err)
	}
	name := "정진"
	return &model.Member{MtIdx: 1186, MtID: pStr("01012345678"), MtName: &name, MtPwd: &hash, MtEmail: pStr("u@x.com")}
}

// loginOnly는 한도 거부 없이 Login 응답만 돌려주는 테스트 헬퍼(기본 정책: 한도 저장소 없음).
func loginOnly(svc *AuthService, in LoginInput, ua, ipHash string) dto.LoginHomeResponse {
	resp, rej := svc.Login(context.Background(), in, ClientMeta{UserAgent: ua, IPHash: ipHash, ClientIP: "198.51.100.9"})
	if rej != nil {
		panic(rej.Error())
	}
	return resp
}

func TestLoginHomeSuccess(t *testing.T) {
	cfg := testAuthConfig()
	user := loginTestUser(t, cfg)
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{"01012345678": user}}
	ref := &fakeAuthRefreshRepo{issueRaw: "refresh-raw-xyz"}
	svc := NewAuth(mem, ref, cfg)

	resp := loginOnly(svc, LoginInput{MtID: "010-1234-5678", MtPwd: "Test1234!@"}, "UA", "iphash")
	if !resp.Success || resp.Message != "로그인 성공" {
		t.Fatalf("로그인 실패: %+v", resp)
	}
	data, ok := resp.Data.(*dto.LoginHomeData)
	if !ok {
		t.Fatalf("data 타입: %T", resp.Data)
	}
	if data.RefreshToken != "refresh-raw-xyz" {
		t.Fatalf("refresh_token=%q", data.RefreshToken)
	}
	if data.ExpiresIn != 43200*60 {
		t.Fatalf("expires_in=%d", data.ExpiresIn)
	}
	// 발급된 access 토큰이 1186으로 검증돼야 한다.
	if id, ok := auth.ParseOptionalUserID("Bearer "+data.Token, cfg.Secret, cfg.Algorithm); !ok || id != 1186 {
		t.Fatalf("발급 토큰 검증 실패: id=%d ok=%v", id, ok)
	}
	// mt_ldate/mt_adate UPDATE 호출됐는지.
	if _, ok := mem.lastFields["mt_ldate"]; !ok {
		t.Fatal("mt_ldate UPDATE 누락")
	}
}

func TestLoginHomeWrongPassword(t *testing.T) {
	cfg := testAuthConfig()
	user := loginTestUser(t, cfg)
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{"01012345678": user}}
	svc := NewAuth(mem, &fakeAuthRefreshRepo{}, cfg)
	resp := loginOnly(svc, LoginInput{MtID: "01012345678", MtPwd: "WRONG"}, "", "")
	if resp.Success || resp.Message != "아이디 또는 비밀번호가 올바르지 않습니다." {
		t.Fatalf("틀린 비번 분기 오류: %+v", resp)
	}
}

func TestLoginHomeNotFound(t *testing.T) {
	cfg := testAuthConfig()
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{}}
	svc := NewAuth(mem, &fakeAuthRefreshRepo{}, cfg)
	resp := loginOnly(svc, LoginInput{MtID: "010", MtPwd: "x"}, "", "")
	if resp.Success || resp.Message != "아이디 또는 비밀번호가 올바르지 않습니다." {
		t.Fatalf("미발견 분기 오류: %+v", resp)
	}
}

func TestLoginHomeEmailBranch(t *testing.T) {
	cfg := testAuthConfig()
	user := loginTestUser(t, cfg)
	mem := &fakeAuthMemberRepo{byEmail: map[string]*model.Member{"u@x.com": user}}
	svc := NewAuth(mem, &fakeAuthRefreshRepo{issueRaw: "r"}, cfg)
	resp := loginOnly(svc, LoginInput{MtID: "u@x.com", MtPwd: "Test1234!@"}, "", "")
	if !resp.Success {
		t.Fatalf("이메일 로그인 실패: %+v", resp)
	}
}

func TestLoginHomeServerError(t *testing.T) {
	cfg := testAuthConfig()
	mem := &fakeAuthMemberRepo{getErr: errStr("db down")}
	svc := NewAuth(mem, &fakeAuthRefreshRepo{}, cfg)
	resp := loginOnly(svc, LoginInput{MtID: "010", MtPwd: "x"}, "", "")
	if resp.Success || resp.Message != "서버 오류가 발생했습니다." {
		t.Fatalf("서버오류 흡수 실패: %+v", resp)
	}
}

// --- Logout ---

func TestLogout(t *testing.T) {
	cfg := testAuthConfig()
	ref := &fakeAuthRefreshRepo{revokeOK: true}
	svc := NewAuth(&fakeAuthMemberRepo{}, ref, cfg)
	resp := svc.Logout("raw1")
	if !resp.Success || resp.Message != "로그아웃되었습니다." || len(ref.revoked) != 1 {
		t.Fatalf("로그아웃(토큰O) 오류: %+v revoked=%v", resp, ref.revoked)
	}
	ref2 := &fakeAuthRefreshRepo{}
	svc2 := NewAuth(&fakeAuthMemberRepo{}, ref2, cfg)
	resp2 := svc2.Logout("")
	if !resp2.Success || len(ref2.revoked) != 0 {
		t.Fatalf("로그아웃(토큰X) 오류: revoked=%v", ref2.revoked)
	}
}

// --- Refresh v2 ---

func TestRefreshV2(t *testing.T) {
	cfg := testAuthConfig()
	user := loginTestUser(t, cfg)
	mem := &fakeAuthMemberRepo{byID: map[int]*model.Member{1186: user}}
	ref := &fakeAuthRefreshRepo{rotateRaw: "new-raw", rotateIdx: 1186, rotateOK: true}
	svc := NewAuth(mem, ref, cfg)

	out, resp := svc.RefreshV2("old-raw", "", "")
	if out != RefreshV2OK || resp == nil || resp.RefreshToken != "new-raw" || resp.Message != "토큰이 갱신되었습니다." {
		t.Fatalf("v2 성공 분기 오류: out=%d resp=%+v", out, resp)
	}

	// rotation 실패 → invalid
	ref2 := &fakeAuthRefreshRepo{rotateOK: false}
	out2, _ := NewAuth(mem, ref2, cfg).RefreshV2("bad", "", "")
	if out2 != RefreshV2Invalid {
		t.Fatalf("v2 invalid 분기 오류: %d", out2)
	}

	// rotation 성공인데 회원 없음 → user gone
	memEmpty := &fakeAuthMemberRepo{byID: map[int]*model.Member{}}
	ref3 := &fakeAuthRefreshRepo{rotateRaw: "n", rotateIdx: 777, rotateOK: true}
	out3, _ := NewAuth(memEmpty, ref3, cfg).RefreshV2("x", "", "")
	if out3 != RefreshUserGone {
		t.Fatalf("v2 user-gone 분기 오류: %d", out3)
	}
}

// --- LoginOriginal ---

func TestLoginOriginal(t *testing.T) {
	cfg := testAuthConfig()
	user := loginTestUser(t, cfg)
	user.MtLevel = pInt(2)
	mem := &fakeAuthMemberRepo{byMtID: map[string]*model.Member{"01012345678": user}}
	svc := NewAuth(mem, &fakeAuthRefreshRepo{}, cfg)

	out, resp := svc.LoginOriginal("010-1234-5678", "Test1234!@")
	if out != LoginOrigOK || resp == nil || resp.User.MtIdx != 1186 || resp.User.MtLevel != 2 {
		t.Fatalf("login-original 성공 오류: out=%d resp=%+v", out, resp)
	}
	if id, ok := auth.ParseOptionalUserID("Bearer "+resp.AccessToken, cfg.Secret, cfg.Algorithm); !ok || id != 1186 {
		t.Fatalf("토큰 검증 실패")
	}
	// 틀린 비번 → unauthorized
	out2, _ := svc.LoginOriginal("01012345678", "WRONG")
	if out2 != LoginOrigUnauthorized {
		t.Fatalf("login-original 401 분기 오류: %d", out2)
	}
}

type errStrType string

func (e errStrType) Error() string { return string(e) }
func errStr(s string) error        { return errStrType(s) }
