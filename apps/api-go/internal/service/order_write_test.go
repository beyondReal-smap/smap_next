package service

import (
	"testing"

	"github.com/bluemusk/smap_next_go/internal/model"
)

func owMock(o *model.Order) *mockOrderRepo {
	return &mockOrderRepo{getByID: func(id int) (*model.Order, error) { return o, nil }}
}

func TestUpdateStatusFoundNotFound(t *testing.T) {
	found, err := owMock(&model.Order{OtIdx: 1}).newSvc().UpdateStatus(1, 2)
	if !found || err != nil {
		t.Fatalf("update found: %v %v", found, err)
	}
	nf, _ := owMock(nil).newSvc().UpdateStatus(99, 2)
	if nf {
		t.Fatal("not-found false 기대")
	}
}

func TestCancelOutcomes(t *testing.T) {
	if owMock(nil).newSvc().Cancel(99, 1186, "r", nil, nil) != CancelNotFound {
		t.Fatal("not-found")
	}
	other := &model.Order{OtIdx: 1, MtIdx: oPtrInt(98)}
	if owMock(other).newSvc().Cancel(1, 1186, "r", nil, nil) != CancelForbidden {
		t.Fatal("forbidden")
	}
	cancelled := &model.Order{OtIdx: 1, MtIdx: oPtrInt(1186), OtStatus: oPtrInt(99)}
	if owMock(cancelled).newSvc().Cancel(1, 1186, "r", nil, nil) != CancelAlready {
		t.Fatal("already")
	}
	ok := &model.Order{OtIdx: 1, MtIdx: oPtrInt(1186), OtStatus: oPtrInt(2)}
	if owMock(ok).newSvc().Cancel(1, 1186, "r", nil, nil) != CancelDone {
		t.Fatal("done")
	}
}

func (m *mockOrderRepo) newSvc() *OrderService { return NewOrder(m) }
