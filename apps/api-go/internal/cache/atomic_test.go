package cache

import (
	"context"
	"errors"
	"testing"
	"time"
)

// Redis가 없을 때 원자 연산은 조용히 성공하지 않고 ErrDisabled를 반환해야 한다(호출자가 503 처리).
func TestAtomicOpsReturnErrDisabledWithoutRedis(t *testing.T) {
	s := NewStore(nil)
	ctx := context.Background()
	if _, err := s.IncrWithExpire(ctx, "k", time.Minute); !errors.Is(err, ErrDisabled) {
		t.Errorf("IncrWithExpire: %v", err)
	}
	if _, err := s.TTL(ctx, "k"); !errors.Is(err, ErrDisabled) {
		t.Errorf("TTL: %v", err)
	}
	if err := s.SetEX(ctx, "k", "v", time.Minute); !errors.Is(err, ErrDisabled) {
		t.Errorf("SetEX: %v", err)
	}
	if _, err := s.SetNXEX(ctx, "k", "v", time.Minute); !errors.Is(err, ErrDisabled) {
		t.Errorf("SetNXEX: %v", err)
	}
	if _, _, err := s.GetString(ctx, "k"); !errors.Is(err, ErrDisabled) {
		t.Errorf("GetString: %v", err)
	}
	if _, err := s.DelKeys(ctx, "k"); !errors.Is(err, ErrDisabled) {
		t.Errorf("DelKeys: %v", err)
	}
}
