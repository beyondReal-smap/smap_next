package service

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type fakeUserRepo struct {
	one  *model.Member
	many []model.Member
	cnt  int64
	err  error
}

func (f *fakeUserRepo) List(skip, limit int) ([]model.Member, error)   { return f.many, f.err }
func (f *fakeUserRepo) GetByID(mtIdx int) (*model.Member, error)       { return f.one, f.err }
func (f *fakeUserRepo) GetByEmail(email string) (*model.Member, error) { return f.one, f.err }
func (f *fakeUserRepo) GetByToken(token string) (*model.Member, error) { return f.one, f.err }
func (f *fakeUserRepo) RecentSignin(h int) ([]model.Member, error)     { return f.many, f.err }
func (f *fakeUserRepo) NotJoinedCount() (int64, error)                 { return f.cnt, f.err }

// TestUserResponseJSON은 /users/{id}의 MemberResponse-from-ORM 직렬화가 실측(/users/2584)과
// byte-동등인지 검증한다(딕셔너리 폴백 없이 raw 값).
func TestUserResponseJSON(t *testing.T) {
	svc := NewUser(&fakeUserRepo{one: member2584()})
	resp, found, ok := svc.GetUser(2584)
	if !found || !ok || resp == nil {
		t.Fatalf("found=%v ok=%v", found, ok)
	}
	b, _ := json.Marshal(resp)
	want := `{"mt_type":3,"mt_level":2,"mt_status":1,"mt_id":"apple_000423.0341057b689b497ea6079afde9603b93.1431","mt_name":"Hyun ok Kwon","mt_nickname":"송지아","mt_hp":"","mt_email":"nd2zkd84p7@privaterelay.appleid.com","mt_birth":"2015-09-03","mt_gender":2,"mt_show":"Y","mt_agree1":"Y","mt_agree2":"Y","mt_agree3":"Y","mt_agree4":"Y","mt_agree5":"Y","mt_push1":"N","mt_lat":37.70771506644053,"mt_long":126.7573401655983,"mt_onboarding":"N","mt_idx":2584,"mt_file1":"/images/avatar2.png","mt_wdate":"2026-05-17T14:32:21","mt_ldate":"2026-05-17T14:32:21","mt_udate":"2026-05-17T14:33:37"}`
	if string(b) != want {
		t.Errorf("불일치\n got: %s\nwant: %s", b, want)
	}
}

// TestUserResponseNullName500은 mt_name/nickname null이면 ok=false(→ Python 500)인지 검증한다.
func TestUserResponseNullName500(t *testing.T) {
	m := &model.Member{MtIdx: 262, MtID: pStr("01000000000"), MtName: pStr("x"), MtNickname: nil}
	svc := NewUser(&fakeUserRepo{one: m})
	_, found, ok := svc.GetUser(262)
	if !found || ok {
		t.Errorf("null nickname은 found=true,ok=false 기대: found=%v ok=%v", found, ok)
	}
	// 목록도 한 명이라도 null이면 ok=false
	svc2 := NewUser(&fakeUserRepo{many: []model.Member{*member2584(), *m}})
	_, lok := svc2.ListUsers(0, 100)
	if lok {
		t.Error("목록에 null nickname 멤버 있으면 ok=false 기대")
	}
}

// TestUserFullDumpStructure는 full-dump이 65개 키 + 고정 순서 시작 + 시크릿 포함을 확인한다.
// (키 순서는 Python에서 비결정적이라 byte-동등 검증은 런타임 deep-equal로 대체)
func TestUserFullDumpStructure(t *testing.T) {
	d := toUserFullDump(member2584())
	b, _ := json.Marshal(d)
	var m map[string]json.RawMessage
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	if len(m) != 65 {
		t.Errorf("full-dump 키 수 65 기대, got %d", len(m))
	}
	// 시크릿/전체컬럼 노출 확인(Python 동작 그대로)
	for _, k := range []string{"mt_pwd", "mt_reset_token", "mt_token_id", "mt_remember_token", "mt_apple_id"} {
		if _, present := m[k]; !present {
			t.Errorf("full-dump에 %s 키가 있어야 함(시크릿 노출 이식)", k)
		}
	}
	// Go 고정 순서: mt_id로 시작
	var ordered []struct{ K string }
	_ = ordered
	if got := b[:len(`{"mt_id":`)]; string(got) != `{"mt_id":` {
		t.Errorf("full-dump은 mt_id로 시작해야 함(고정 순서): %s", got)
	}
}

func TestUserNotFoundAndCounts(t *testing.T) {
	t.Run("GetUser 없음 → found=false,ok=true(404)", func(t *testing.T) {
		svc := NewUser(&fakeUserRepo{one: nil})
		resp, found, ok := svc.GetUser(99)
		if resp != nil || found || !ok {
			t.Errorf("resp=%v found=%v ok=%v", resp, found, ok)
		}
	})
	t.Run("GetUser repo 에러 → ok=false(500)", func(t *testing.T) {
		svc := NewUser(&fakeUserRepo{err: errors.New("db down")})
		_, _, ok := svc.GetUser(1)
		if ok {
			t.Error("repo 에러는 ok=false")
		}
	})
	t.Run("email 없음 → found=false", func(t *testing.T) {
		svc := NewUser(&fakeUserRepo{one: nil})
		_, found, err := svc.GetUserByEmail("x@y.z")
		if found || err != nil {
			t.Errorf("found=%v err=%v", found, err)
		}
	})
	t.Run("NotJoinedCount 전파", func(t *testing.T) {
		svc := NewUser(&fakeUserRepo{cnt: 5})
		n, _ := svc.NotJoinedCount()
		if n != 5 {
			t.Errorf("cnt=%d", n)
		}
	})
}
