package service

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type fakeMemberReadRepo struct {
	one    *model.Member
	active *model.Member // GetByIdxActive 전용(활성 필터 결과)
	many   []model.Member
	rows   []model.MemberGroupRow
	phone  bool
	email  bool
	nick   bool
	err    error
}

func (f *fakeMemberReadRepo) List(skip, limit int) ([]model.Member, error)      { return f.many, f.err }
func (f *fakeMemberReadRepo) GetByID(mtIdx int) (*model.Member, error)          { return f.one, f.err }
func (f *fakeMemberReadRepo) GetByIdxActive(idx int) (*model.Member, error)     { return f.active, f.err }
func (f *fakeMemberReadRepo) FindByGroup(g int) ([]model.MemberGroupRow, error) { return f.rows, f.err }
func (f *fakeMemberReadRepo) ExistsByPhone(p string) (bool, error)              { return f.phone, f.err }
func (f *fakeMemberReadRepo) ExistsByEmail(e string) (bool, error)              { return f.email, f.err }
func (f *fakeMemberReadRepo) ExistsByNickname(n string) (bool, error)           { return f.nick, f.err }

func pFloat(v float64) *float64 { return &v }

// 실측 멤버 2584 기반 모델(검증용)
func member2584() *model.Member {
	return &model.Member{
		MtIdx: 2584, MtType: pInt(3), MtLevel: pInt(2), MtStatus: pInt(1),
		MtID:   pStr("apple_000423.0341057b689b497ea6079afde9603b93.1431"),
		MtName: pStr("Hyun ok Kwon"), MtNickname: pStr("송지아"),
		MtHp: pStr(""), MtEmail: pStr("nd2zkd84p7@privaterelay.appleid.com"),
		MtBirth:  pTimePtr(time.Date(2015, 9, 3, 0, 0, 0, 0, time.Local)),
		MtGender: pInt(2), MtFile1: pStr("/images/avatar2.png"),
		MtShow:   pStr("Y"),
		MtAgree1: pStr("Y"), MtAgree2: pStr("Y"), MtAgree3: pStr("Y"), MtAgree4: pStr("Y"), MtAgree5: pStr("Y"),
		MtPush1: pStr("N"), MtOnboarding: pStr("N"),
		MtLat: pFloat(37.70771506644053), MtLong: pFloat(126.75734016559830),
		MtWdate: pTimePtr(time.Date(2026, 5, 17, 14, 32, 21, 0, time.Local)),
		MtLdate: pTimePtr(time.Date(2026, 5, 17, 14, 32, 21, 0, time.Local)),
		MtUdate: pTimePtr(time.Date(2026, 5, 17, 14, 33, 37, 0, time.Local)),
	}
}

// TestMemberListItemJSON은 _member_to_dict(/members/?id=) 실측 바이트와 동일한지 검증한다.
func TestMemberListItemJSON(t *testing.T) {
	svc := NewMember(&fakeMemberReadRepo{one: member2584()})
	res, _ := svc.MemberForList(Viewer{MtIdx: 2584, Authenticated: true}, 2584)
	b, _ := json.Marshal(res)
	want := `[{"mt_idx":2584,"mt_type":3,"mt_level":2,"mt_status":1,"mt_id":"apple_000423.0341057b689b497ea6079afde9603b93.1431","mt_name":"Hyun ok Kwon","mt_nickname":"송지아","mt_hp":"","mt_email":"nd2zkd84p7@privaterelay.appleid.com","mt_birth":"2015-09-03","mt_gender":2,"mt_file1":"/images/avatar2.png","mt_show":"Y","mt_agree1":"Y","mt_agree2":"Y","mt_agree3":"Y","mt_agree4":"Y","mt_agree5":"Y","mt_lat":37.70771506644053,"mt_long":126.7573401655983,"mt_wdate":"2026-05-17T14:32:21","mt_ldate":"2026-05-17T14:32:21","mt_udate":"2026-05-17T14:33:37"}]`
	if string(b) != want {
		t.Errorf("불일치\n got: %s\nwant: %s", b, want)
	}
}

// TestMemberDetailJSON은 /members/{id}의 MemberResponse 필터링 실측 바이트와 동일한지 검증한다.
// (mt_show=Y, mt_agree1~5=N 기본값, mt_udate=null)
func TestMemberDetailJSON(t *testing.T) {
	svc := NewMember(&fakeMemberReadRepo{one: member2584()})
	res, _ := svc.GetMemberDetail(Viewer{MtIdx: 2584, Authenticated: true}, 2584)
	b, _ := json.Marshal(res)
	want := `{"mt_type":3,"mt_level":2,"mt_status":1,"mt_id":"apple_000423.0341057b689b497ea6079afde9603b93.1431","mt_name":"Hyun ok Kwon","mt_nickname":"송지아","mt_hp":"","mt_email":"nd2zkd84p7@privaterelay.appleid.com","mt_birth":"2015-09-03","mt_gender":2,"mt_show":"Y","mt_agree1":"N","mt_agree2":"N","mt_agree3":"N","mt_agree4":"N","mt_agree5":"N","mt_push1":"N","mt_lat":37.70771506644053,"mt_long":126.7573401655983,"mt_onboarding":"N","mt_idx":2584,"mt_file1":"/images/avatar2.png","mt_wdate":"2026-05-17T14:32:21","mt_ldate":"2026-05-17T14:32:21","mt_udate":null}`
	if string(b) != want {
		t.Errorf("불일치\n got: %s\nwant: %s", b, want)
	}
}

// TestMemberDefaultsAndFalsy는 null/0 폴백(type/level/status/gender or default, lat=0→null/default)을 검증한다.
func TestMemberDefaultsAndFalsy(t *testing.T) {
	// 전부 nil + lat=0 → 리스트: lat/long null, 기본값
	svc := NewMember(&fakeMemberReadRepo{one: &model.Member{MtIdx: 7, MtLat: pFloat(0)}})
	res, _ := svc.MemberForList(Viewer{MtIdx: 7, Authenticated: true}, 7)
	it := res[0]
	if it.MtType != 1 || it.MtLevel != 2 || it.MtStatus != 1 || it.MtGender != 1 {
		t.Errorf("int 기본값 불일치: %+v", it)
	}
	if it.MtID != "" || it.MtShow != "Y" || it.MtAgree1 != "N" {
		t.Errorf("문자열 기본값 불일치: %+v", it)
	}
	if it.MtLat != nil { // lat=0 → falsy → null
		t.Errorf("lat=0은 null이어야 함: %v", *it.MtLat)
	}
	if it.MtBirth != nil || it.MtWdate != nil {
		t.Errorf("null 날짜는 nil이어야 함: %+v", it)
	}
	// 단건(detail): lat=0 → 기본값 37.5642
	d, _ := svc.GetMemberDetail(Viewer{MtIdx: 7, Authenticated: true}, 7)
	if d.MtLat != 37.5642 || d.MtLong != 127.0016 {
		t.Errorf("detail lat/long 기본값 불일치: %v %v", d.MtLat, d.MtLong)
	}
}

// TestPyISOMicro는 isoformat 마이크로초 분기를 검증한다.
func TestPyISOMicro(t *testing.T) {
	noMicro := time.Date(2026, 5, 17, 14, 32, 21, 0, time.Local)
	if got := pyISO(noMicro); got != "2026-05-17T14:32:21" {
		t.Errorf("초단위: %s", got)
	}
	micro := time.Date(2026, 5, 30, 6, 16, 30, 92908000, time.Local) // .092908
	if got := pyISO(micro); got != "2026-05-30T06:16:30.092908" {
		t.Errorf("마이크로초: %s", got)
	}
}

func TestMemberChecks(t *testing.T) {
	t.Run("phone 존재 → 불가", func(t *testing.T) {
		svc := NewMember(&fakeMemberReadRepo{phone: true})
		r, _ := svc.CheckPhone("01012345678")
		if r.Available || r.Message != "이미 가입된 전화번호입니다." {
			t.Errorf("%+v", r)
		}
	})
	t.Run("email 미존재 → 가능", func(t *testing.T) {
		svc := NewMember(&fakeMemberReadRepo{email: false})
		r, _ := svc.CheckEmail("x@y.com")
		if !r.Available || r.Message != "사용 가능한 이메일입니다." {
			t.Errorf("%+v", r)
		}
	})
	t.Run("nickname 존재 → 불가", func(t *testing.T) {
		svc := NewMember(&fakeMemberReadRepo{nick: true})
		r, _ := svc.CheckNickname("송지아")
		if r.Available || r.Message != "이미 사용 중인 닉네임입니다." {
			t.Errorf("%+v", r)
		}
	})
}

func TestMemberNotFoundAndErr(t *testing.T) {
	t.Run("detail 없음 → (nil,nil)", func(t *testing.T) {
		svc := NewMember(&fakeMemberReadRepo{one: nil})
		res, err := svc.GetMemberDetail(Viewer{}, 99)
		if err != nil || res != nil {
			t.Errorf("res=%v err=%v", res, err)
		}
	})
	t.Run("?id 없음 → 빈 목록", func(t *testing.T) {
		svc := NewMember(&fakeMemberReadRepo{one: nil})
		res, _ := svc.MemberForList(Viewer{}, 99)
		b, _ := json.Marshal(res)
		if string(b) != "[]" {
			t.Errorf("빈 목록 []: %s", b)
		}
	})
	t.Run("repo 에러 전파", func(t *testing.T) {
		svc := NewMember(&fakeMemberReadRepo{err: errors.New("db down")})
		if _, err := svc.ListMembers(Viewer{}, 0, 10); err == nil {
			t.Error("expected error")
		}
	})
}

// TestMyProfileJSON은 GET /members/me data dict(12키, 순서)의 바이트 동등을 검증한다.
func TestMyProfileJSON(t *testing.T) {
	svc := NewMember(&fakeMemberReadRepo{active: member2584()})
	data, found, err := svc.MyProfile(2584)
	if err != nil || !found {
		t.Fatalf("found=%v err=%v", found, err)
	}
	b, _ := json.Marshal(data)
	// mt_birth=strftime('%Y-%m-%d'), mt_wdate=isoformat(); 폴백 없음(raw DB값).
	want := `{"mt_idx":2584,"mt_id":"apple_000423.0341057b689b497ea6079afde9603b93.1431","mt_name":"Hyun ok Kwon","mt_nickname":"송지아","mt_hp":"","mt_email":"nd2zkd84p7@privaterelay.appleid.com","mt_birth":"2015-09-03","mt_gender":2,"mt_type":3,"mt_level":2,"mt_file1":"/images/avatar2.png","mt_wdate":"2026-05-17T14:32:21"}`
	if string(b) != want {
		t.Errorf("불일치\n got: %s\nwant: %s", b, want)
	}
}

// TestMyProfileNotFound는 활성 필터 미통과(active=nil) 시 found=false를 검증한다.
func TestMyProfileNotFound(t *testing.T) {
	svc := NewMember(&fakeMemberReadRepo{active: nil})
	_, found, err := svc.MyProfile(2584)
	if err != nil || found {
		t.Errorf("found=%v err=%v (둘 다 false/nil이어야 함)", found, err)
	}
}

// TestConsentInfo는 동의 5필드 정상/검증실패/미발견을 검증한다.
func TestConsentInfo(t *testing.T) {
	t.Run("정상 Y/N", func(t *testing.T) {
		m := &model.Member{
			MtIdx:    2584,
			MtAgree1: pStr("Y"), MtAgree2: pStr("N"), MtAgree3: pStr("Y"),
			MtAgree4: pStr("Y"), MtAgree5: pStr("N"),
		}
		svc := NewMember(&fakeMemberReadRepo{one: m})
		info, found, valid, err := svc.ConsentInfo(2584)
		if err != nil || !found || !valid {
			t.Fatalf("found=%v valid=%v err=%v", found, valid, err)
		}
		b, _ := json.Marshal(info)
		want := `{"mt_agree1":"Y","mt_agree2":"N","mt_agree3":"Y","mt_agree4":"Y","mt_agree5":"N"}`
		if string(b) != want {
			t.Errorf("불일치\n got: %s\nwant: %s", b, want)
		}
	})
	t.Run("nil 값 → 검증 실패(500 신호)", func(t *testing.T) {
		m := &model.Member{MtIdx: 1, MtAgree1: pStr("Y")} // 2~5 nil
		svc := NewMember(&fakeMemberReadRepo{one: m})
		_, found, valid, _ := svc.ConsentInfo(1)
		if !found || valid {
			t.Errorf("found=%v valid=%v (found=true, valid=false여야 함)", found, valid)
		}
	})
	t.Run("미발견 → found=false", func(t *testing.T) {
		svc := NewMember(&fakeMemberReadRepo{one: nil})
		_, found, _, _ := svc.ConsentInfo(99)
		if found {
			t.Errorf("found=true (false여야 함)")
		}
	})
}
