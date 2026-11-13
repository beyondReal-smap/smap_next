package service

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// 18단계 C-1: /members/verify-password 실패 횟수 제한(로그인과 같은 한도 설정, 계정 기준 키).

type pwRepo struct {
	fakeMemberWriteRepo
	user *model.Member
}

func (r *pwRepo) GetByIdxActive(int) (*model.Member, error) { return r.user, nil }

func newPwSvc(t *testing.T, store *fakeEmailStore, limit int) (*MemberWriteService, *bytes.Buffer) {
	t.Helper()
	repo := &pwRepo{user: &model.Member{MtIdx: 7, MtPwd: mustHash(t, "Correct1!pw")}}
	svc := NewMemberWrite(repo, 4, auth.PasswordPolicy{})
	logs := &bytes.Buffer{}
	logger := slog.New(slog.NewJSONHandler(logs, nil))
	svc.SetPasswordGuard(NewPasswordAttemptGuard(store, limit, 15*time.Minute, logger))
	return svc, logs
}

func TestCheckPasswordLocksAfterLimitWithRemainingTime(t *testing.T) {
	store := newFakeEmailStore()
	svc, _ := newPwSvc(t, store, 3)
	ctx := context.Background()
	for i := 0; i < 3; i++ {
		if ok, rej := svc.CheckPassword(ctx, 7, "wrong"); ok || rej != nil {
			t.Fatalf("한도 전 실패 %d회차는 일반 실패여야 함: ok=%v rej=%v", i+1, ok, rej)
		}
	}
	// 한도 도달 후에는 올바른 비밀번호여도 비교하지 않고 429.
	ok, rej := svc.CheckPassword(ctx, 7, "Correct1!pw")
	if ok || rej == nil || rej.Status != http.StatusTooManyRequests {
		t.Fatalf("한도 초과는 429여야 함: ok=%v rej=%+v", ok, rej)
	}
	if rej.RetryAfter != 900 || !strings.Contains(rej.Detail, "15분 후") {
		t.Errorf("남은 시간 문구/Retry-After: %+v", rej)
	}
	// 다른 계정은 영향 없음(계정 기준 키).
	if _, rej := svc.CheckPassword(ctx, 8, "wrong"); rej != nil {
		t.Errorf("다른 계정은 잠기지 않아야 함: %+v", rej)
	}
}

func TestCheckPasswordSuccessClearsCounterAndKeyIsSeparateFromLogin(t *testing.T) {
	store := newFakeEmailStore()
	svc, _ := newPwSvc(t, store, 3)
	ctx := context.Background()
	svc.CheckPassword(ctx, 7, "wrong")
	svc.CheckPassword(ctx, 7, "wrong")
	if ok, rej := svc.CheckPassword(ctx, 7, "Correct1!pw"); !ok || rej != nil {
		t.Fatalf("한도 내 성공: ok=%v rej=%v", ok, rej)
	}
	if _, left := store.counts[passwordFailKey(7)]; left {
		t.Error("성공 시 카운터가 삭제돼야 함")
	}
	// 성공으로 초기화됐으므로 다시 2번 실패해도 잠기지 않는다.
	svc.CheckPassword(ctx, 7, "wrong")
	svc.CheckPassword(ctx, 7, "wrong")
	if _, rej := svc.CheckPassword(ctx, 7, "wrong"); rej != nil {
		t.Errorf("카운터가 초기화됐어야 함: %+v", rej)
	}
	for k := range store.counts {
		if strings.HasPrefix(k, "auth:login:fail:") {
			t.Errorf("로그인 카운터 키를 건드리면 안 됨: %s", k)
		}
	}
	if window := store.ttls[passwordFailKey(7)]; window != 15*time.Minute {
		t.Errorf("로그인과 같은 창(LOGIN_FAIL_WINDOW_SECONDS) 사용: %v", window)
	}
}

func TestCheckPasswordRedisDownAllowsWithWarning(t *testing.T) {
	store := newFakeEmailStore()
	store.err = errors.New("redis down")
	svc, logs := newPwSvc(t, store, 1)
	ctx := context.Background()
	// 장애 중에도 비밀번호 비교는 정상 동작(허용 + 경고 로그): 성공/실패 모두 429 없이 결과를 돌려준다.
	if ok, rej := svc.CheckPassword(ctx, 7, "Correct1!pw"); !ok || rej != nil {
		t.Errorf("Redis 장애 시 성공은 통과: ok=%v rej=%v", ok, rej)
	}
	if ok, rej := svc.CheckPassword(ctx, 7, "wrong"); ok || rej != nil {
		t.Errorf("Redis 장애 시 실패는 일반 실패: ok=%v rej=%v", ok, rej)
	}
	if !strings.Contains(logs.String(), "login_limit_store_unavailable_allowing") {
		t.Errorf("경고 로그가 없음: %s", logs.String())
	}
	if strings.Contains(logs.String(), "Correct1!pw") || strings.Contains(logs.String(), "wrong") {
		t.Error("로그에 비밀번호가 들어가면 안 됨")
	}
}

func TestCheckPasswordWithoutGuardBehavesAsBefore(t *testing.T) {
	repo := &pwRepo{user: &model.Member{MtIdx: 7, MtPwd: mustHash(t, "Correct1!pw")}}
	svc := NewMemberWrite(repo, 4, auth.PasswordPolicy{})
	for i := 0; i < 50; i++ {
		if _, rej := svc.CheckPassword(context.Background(), 7, "wrong"); rej != nil {
			t.Fatal("가드 미주입이면 제한 없음")
		}
	}
	if ok, _ := svc.CheckPassword(context.Background(), 7, "Correct1!pw"); !ok {
		t.Error("성공 동작 유지")
	}
}
