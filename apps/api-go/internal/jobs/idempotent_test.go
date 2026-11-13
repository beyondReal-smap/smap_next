package jobs

import (
	"context"
	"errors"
	"testing"
	"time"
)

// fakeLocker는 TryLock 호출을 기록하는 테스트용 락이다.
type fakeLocker struct {
	acquired bool
	err      error
	lastKey  string
	lastTTL  time.Duration
	calls    int
}

func (f *fakeLocker) TryLock(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	f.calls++
	f.lastKey = key
	f.lastTTL = ttl
	return f.acquired, f.err
}

func TestTryLock_NilLocker(t *testing.T) {
	// 락 인프라가 없으면 락 없이 진행(true).
	ok, err := TryLock(context.Background(), nil, "k", time.Minute)
	if err != nil || !ok {
		t.Fatalf("nil locker should pass: ok=%v err=%v", ok, err)
	}
}

func TestTryLock_EmptyKey(t *testing.T) {
	fl := &fakeLocker{acquired: false}
	ok, err := TryLock(context.Background(), fl, "", time.Minute)
	if err != nil || !ok {
		t.Fatalf("empty key should pass without calling locker: ok=%v err=%v", ok, err)
	}
	if fl.calls != 0 {
		t.Errorf("locker should not be called for empty key, calls=%d", fl.calls)
	}
}

func TestTryLock_Acquired(t *testing.T) {
	fl := &fakeLocker{acquired: true}
	ok, err := TryLock(context.Background(), fl, "job:x", 5*time.Minute)
	if err != nil || !ok {
		t.Fatalf("want acquired: ok=%v err=%v", ok, err)
	}
	if fl.lastKey != "job:x" || fl.lastTTL != 5*time.Minute {
		t.Errorf("locker got key=%q ttl=%v", fl.lastKey, fl.lastTTL)
	}
}

func TestTryLock_Held(t *testing.T) {
	fl := &fakeLocker{acquired: false}
	ok, err := TryLock(context.Background(), fl, "job:x", time.Minute)
	if err != nil || ok {
		t.Fatalf("want not acquired: ok=%v err=%v", ok, err)
	}
}

func TestTryLock_Error(t *testing.T) {
	fl := &fakeLocker{acquired: false, err: errors.New("redis down")}
	ok, err := TryLock(context.Background(), fl, "job:x", time.Minute)
	if err == nil || ok {
		t.Fatalf("want error propagated: ok=%v err=%v", ok, err)
	}
}

func TestDailyGuard_Key(t *testing.T) {
	fl := &fakeLocker{acquired: true}
	ok, err := DailyGuard(context.Background(), fl, "weather:refresh", "20260601")
	if err != nil || !ok {
		t.Fatalf("want acquired: ok=%v err=%v", ok, err)
	}
	wantKey := "job:daily:weather:refresh:20260601"
	if fl.lastKey != wantKey {
		t.Errorf("DailyGuard key = %q, want %q", fl.lastKey, wantKey)
	}
	if fl.lastTTL != 25*time.Hour {
		t.Errorf("DailyGuard ttl = %v, want 25h", fl.lastTTL)
	}
}

func TestDailyGuard_EmptyArgs(t *testing.T) {
	fl := &fakeLocker{acquired: false}
	ok, _ := DailyGuard(context.Background(), fl, "", "20260601")
	if !ok {
		t.Error("empty job should pass")
	}
	ok, _ = DailyGuard(context.Background(), fl, "weather:refresh", "")
	if !ok {
		t.Error("empty date should pass")
	}
	if fl.calls != 0 {
		t.Errorf("locker should not be called for empty args, calls=%d", fl.calls)
	}
}
