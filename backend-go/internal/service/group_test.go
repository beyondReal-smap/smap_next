package service

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// fakeGroupRepo는 groupRepo 인터페이스를 메모리로 대체한다.
type fakeGroupRepo struct {
	one  *model.Group
	many []model.Group
	err  error
}

func (f *fakeGroupRepo) GetByID(id int) (*model.Group, error) { return f.one, f.err }
func (f *fakeGroupRepo) FindByCode(code string) (*model.Group, error) {
	return f.one, f.err
}
func (f *fakeGroupRepo) ListHidden() ([]model.Group, error) { return f.many, f.err }
func (f *fakeGroupRepo) List(skip, limit int, showHidden bool) ([]model.Group, error) {
	return f.many, f.err
}
func (f *fakeGroupRepo) FindByMember(mtIdx int) ([]model.Group, error) {
	return f.many, f.err
}

func pTimePtr(t time.Time) *time.Time { return &t }

func TestGetGroup(t *testing.T) {
	t.Run("정상 - 단건 변환", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{one: &model.Group{
			SgtIdx: 42, MtIdx: pInt(1186), SgtTitle: pStr("가족"),
			SgtCode: pStr("G12345"), SgtShow: pStr("Y"),
		}})
		res, err := svc.GetGroup(42)
		if err != nil || res == nil {
			t.Fatalf("res=%v err=%v", res, err)
		}
		if res.SgtIdx != 42 || res.MtIdx == nil || *res.MtIdx != 1186 ||
			res.SgtTitle == nil || *res.SgtTitle != "가족" || res.SgtShow == nil || *res.SgtShow != "Y" {
			t.Errorf("res=%+v", res)
		}
		// sgt_memo 미설정 → nil(→ null), sgt_wdate/udate nil → nil(→ null)
		if res.SgtMemo != nil || res.SgtWdate != nil || res.SgtUdate != nil {
			t.Errorf("nullable 필드는 nil이어야 함: %+v", res)
		}
	})

	t.Run("없음 → (nil, nil) 404 신호", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{one: nil})
		res, err := svc.GetGroup(99)
		if err != nil || res != nil {
			t.Errorf("res=%v err=%v", res, err)
		}
	})

	t.Run("repo 에러 → err 전파", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{err: errors.New("db down")})
		if _, err := svc.GetGroup(1); err == nil {
			t.Error("expected error")
		}
	})
}

func TestGroupByCode(t *testing.T) {
	t.Run("정상", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{one: &model.Group{SgtIdx: 7, SgtCode: pStr("G54321"), SgtShow: pStr("Y")}})
		res, err := svc.GroupByCode("G54321")
		if err != nil || res == nil || res.SgtIdx != 7 {
			t.Fatalf("res=%v err=%v", res, err)
		}
	})

	t.Run("없음 → (nil, nil)", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{one: nil})
		res, err := svc.GroupByCode("NOPE")
		if err != nil || res != nil {
			t.Errorf("res=%v err=%v", res, err)
		}
	})
}

func TestListAndMemberGroups(t *testing.T) {
	groups := []model.Group{
		{SgtIdx: 1, SgtTitle: pStr("A"), SgtShow: pStr("Y")},
		{SgtIdx: 2, SgtTitle: pStr("B"), SgtShow: pStr("Y")},
	}

	t.Run("ListGroups - 변환 + 순서 보존", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{many: groups})
		res, err := svc.ListGroups(0, 10000, false)
		if err != nil || len(res) != 2 || res[0].SgtIdx != 1 || res[1].SgtIdx != 2 {
			t.Fatalf("res=%+v err=%v", res, err)
		}
	})

	t.Run("MemberGroups - 변환", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{many: groups})
		res, err := svc.MemberGroups(1186)
		if err != nil || len(res) != 2 {
			t.Fatalf("res=%+v err=%v", res, err)
		}
	})

	t.Run("빈 결과 → 빈 슬라이스(→ JSON [])", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{many: nil})
		res, err := svc.ListGroups(0, 10000, false)
		if err != nil || res == nil || len(res) != 0 {
			t.Fatalf("빈 슬라이스여야 함: res=%v err=%v", res, err)
		}
		b, _ := json.Marshal(res)
		if string(b) != "[]" {
			t.Errorf("빈 목록은 [] 직렬화여야 함: %s", b)
		}
	})

	t.Run("repo 에러 → err 전파", func(t *testing.T) {
		svc := NewGroup(&fakeGroupRepo{err: errors.New("db down")})
		if _, err := svc.MemberGroups(1); err == nil {
			t.Error("expected error")
		}
	})
}

// TestGroupResponseJSON은 Python GroupResponse.model_dump_json()의 실측 출력과
// 키 순서·타입·null·datetime 포맷이 바이트 동등한지 검증한다.
func TestGroupResponseJSON(t *testing.T) {
	svc := NewGroup(&fakeGroupRepo{one: &model.Group{
		SgtIdx: 42, MtIdx: pInt(1186), SgtTitle: pStr("가족"),
		SgtCode: pStr("G12345"), SgtMemo: nil, SgtShow: pStr("Y"),
		SgtWdate: pTimePtr(time.Date(2025, 6, 14, 10, 30, 14, 0, time.Local)),
		SgtUdate: nil,
	}})
	res, _ := svc.GetGroup(42)
	b, err := json.Marshal(res)
	if err != nil {
		t.Fatalf("marshal err=%v", err)
	}
	// Python 실측: GroupResponse(...).model_dump_json()
	want := `{"mt_idx":1186,"sgt_title":"가족","sgt_code":"G12345","sgt_memo":null,"sgt_show":"Y","sgt_idx":42,"sgt_wdate":"2025-06-14T10:30:14","sgt_udate":null}`
	if string(b) != want {
		t.Errorf("JSON 불일치\n got: %s\nwant: %s", b, want)
	}
}
