package service

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type fakePushLogRepo struct {
	one  *model.PushLog
	many []model.PushLog
	err  error
}

func (f *fakePushLogRepo) List(skip, limit int) ([]model.PushLog, error)   { return f.many, f.err }
func (f *fakePushLogRepo) GetByID(id int) (*model.PushLog, error)          { return f.one, f.err }
func (f *fakePushLogRepo) FindByMember(mtIdx int) ([]model.PushLog, error) { return f.many, f.err }
func (f *fakePushLogRepo) FindBySchedule(s int) ([]model.PushLog, error)   { return f.many, f.err }
func (f *fakePushLogRepo) FindUnread(mtIdx int) ([]model.PushLog, error)   { return f.many, f.err }
func (f *fakePushLogRepo) Create(p *model.PushLog) error                   { return f.err }
func (f *fakePushLogRepo) UpdateFields(id int, fields map[string]interface{}) error {
	return f.err
}
func (f *fakePushLogRepo) Delete(id int) error                                   { return f.err }
func (f *fakePushLogRepo) MarkReadByID(id int, now time.Time) error              { return f.err }
func (f *fakePushLogRepo) SoftDeleteAllForMember(mtIdx int, now time.Time) error { return f.err }
func (f *fakePushLogRepo) MarkReadAllForMember(mtIdx int, now time.Time) error   { return f.err }

func TestPushLogResponseJSON(t *testing.T) {
	svc := NewPushLog(&fakePushLogRepo{one: &model.PushLog{
		PltIdx: 100, PltType: pInt(2), MtIdx: pInt(1893), SstIdx: pInt(907),
		PltCondition: pStr("30s - My Place Exit"), PltTitle: pStr("알림"), PltStatus: pInt(2),
		PltReadChk: pStr("N"), PltShow: pStr("Y"),
		PltSdate: pTimePtr(time.Date(2026, 5, 1, 10, 0, 0, 0, time.Local)),
	}})
	res, found, ok := svc.GetPushLog(100)
	if !found || !ok {
		t.Fatalf("found=%v ok=%v", found, ok)
	}
	b, _ := json.Marshal(res)
	want := `{"plt_type":2,"mt_idx":1893,"sst_idx":907,"plt_condition":"30s - My Place Exit","plt_memo":null,"plt_title":"알림","plt_content":null,"plt_sdate":"2026-05-01T10:00:00","plt_status":2,"plt_read_chk":"N","plt_show":"Y","push_json":null,"plt_idx":100,"plt_wdate":null,"plt_rdate":null}`
	if string(b) != want {
		t.Errorf("불일치\n got: %s\nwant: %s", b, want)
	}
}

func TestPushLogZeroDate500(t *testing.T) {
	zero := time.Time{}
	svc := NewPushLog(&fakePushLogRepo{one: &model.PushLog{PltIdx: 1, PltRdate: &zero}})
	_, found, ok := svc.GetPushLog(1)
	if !found || ok {
		t.Errorf("zero date → found=true, ok=false 기대: found=%v ok=%v", found, ok)
	}
}

type fakePushFCMRepo struct {
	one  *model.PushFCM
	many []model.PushFCM
	err  error
}

func (f *fakePushFCMRepo) List(skip, limit int) ([]model.PushFCM, error)   { return f.many, f.err }
func (f *fakePushFCMRepo) GetByID(id int) (*model.PushFCM, error)          { return f.one, f.err }
func (f *fakePushFCMRepo) FindByMember(mtIdx int) ([]model.PushFCM, error) { return f.many, f.err }
func (f *fakePushFCMRepo) FindByCode(code string) ([]model.PushFCM, error) { return f.many, f.err }
func (f *fakePushFCMRepo) FindPending(mtIdx int, since *float64) ([]model.PushFCM, error) {
	return f.many, f.err
}
func (f *fakePushFCMRepo) Create(p *model.PushFCM) error { return f.err }
func (f *fakePushFCMRepo) UpdateFields(id int, fields map[string]interface{}) error {
	return f.err
}
func (f *fakePushFCMRepo) Delete(id int) error { return f.err }

func TestPushFCMResponseJSON(t *testing.T) {
	svc := NewPushFCM(&fakePushFCMRepo{one: &model.PushFCM{
		PftIdx: 5, PftCode: pStr("EVENT"), PftTitle: pStr("공지"), PftSendType: pInt(1),
		PftSendMtIdx: pInt(272), PftStatus: pInt(1), PftShow: pStr("Y"),
		PftRdate: pTimePtr(time.Date(2026, 6, 1, 9, 0, 0, 0, time.Local)),
	}})
	res, found, ok := svc.GetPushFCM(5)
	if !found || !ok {
		t.Fatalf("found=%v ok=%v", found, ok)
	}
	b, _ := json.Marshal(res)
	want := `{"pft_code":"EVENT","pft_title":"공지","pft_content":null,"pft_send_type":1,"pft_send_mt_idx":272,"pft_rdate":"2026-06-01T09:00:00","pft_url":null,"pft_status":1,"pft_show":"Y","pft_sdate":null,"pft_edate":null,"pft_idx":5,"pft_wdate":null}`
	if string(b) != want {
		t.Errorf("불일치\n got: %s\nwant: %s", b, want)
	}
}

func TestPushFCMRepoErr500(t *testing.T) {
	// 실DB에서 pft_send_mt_idx가 JSON 문자열이라 GORM int 스캔 실패→repo err→ok=false(plain 500).
	svc := NewPushFCM(&fakePushFCMRepo{err: errPushScan})
	if _, ok := svc.ListPushFCMs(0, 100); ok {
		t.Error("repo 에러는 ok=false(500) 기대")
	}
}

var errPushScan = &scanErr{}

type scanErr struct{}

func (*scanErr) Error() string { return "sql: Scan error converting [\"272\"] into *int" }
