// Package fakes 는 구독 테스트용 메모리 가짜(저장소, 스토어 검증기)다. 운영 코드에서 쓰지 않는다.
package fakes

import (
	"context"
	"sync"
	"time"

	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
	"github.com/bluemusk/smap_next_go/internal/subscription/store"
)

// Repo 는 구독 저장소의 메모리 구현이다. WithMemberLock 은 전체를 직렬화하고, 오류가 나면 변경을 되돌린다(트랜잭션 롤백).
type Repo struct {
	mu      sync.Mutex
	Members map[int]*model.SubscriptionMemberPlan
	Rows    []*model.SubscriptionTransaction
	Places  map[int]int64
	nextID  int
	// external: 다른 요청이 이미 커밋한 행(내 트랜잭션이 롤백돼도 남는다).
	external []model.SubscriptionTransaction

	// TableMissing 이 true 면 거래 테이블 접근이 repository.ErrSubscriptionTableMissing 로 실패한다(member_t 접근은 정상).
	TableMissing bool
	// InsertHook 은 Insert 직전에 호출된다. 오류를 돌려주면 그 오류로 Insert 가 실패한다(동시 삽입 경쟁 재현용).
	// 훅 안에서 r.AddRowLocked 로 경쟁 요청이 먼저 커밋한 행을 만들 수 있다.
	InsertHook func(r *Repo, row *model.SubscriptionTransaction) error
	// MemberReadErr 는 MemberPlan 이 돌려줄 오류(DB 장애 재현).
	MemberReadErr error
	// Locks 는 WithMemberLock 호출 횟수다.
	Locks int
}

func NewRepo() *Repo {
	return &Repo{Members: map[int]*model.SubscriptionMemberPlan{}, Places: map[int]int64{}, nextID: 1}
}

// AddMember 는 회원 행을 만든다. level/planDate 가 nil 이면 NULL.
func (r *Repo) AddMember(mt int, level *int, planDate *time.Time, planCheck string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	pc := planCheck
	r.Members[mt] = &model.SubscriptionMemberPlan{MtIdx: mt, MtLevel: level, MtPlanDate: planDate, MtPlanCheck: &pc}
}

// AddRowLocked 는 (락을 이미 잡은 상태에서) 다른 요청이 커밋한 것처럼 거래 행을 추가한다.
func (r *Repo) AddRowLocked(row model.SubscriptionTransaction) *model.SubscriptionTransaction {
	row.ID = r.nextID
	r.nextID++
	c := row
	r.Rows = append(r.Rows, &c)
	r.external = append(r.external, row)
	return &c
}

func (r *Repo) Member(mt int) model.SubscriptionMemberPlan {
	r.mu.Lock()
	defer r.mu.Unlock()
	return *r.Members[mt]
}

func (r *Repo) RowsOf(mt int) []model.SubscriptionTransaction {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []model.SubscriptionTransaction
	for _, x := range r.Rows {
		if x.MtIdx == mt {
			out = append(out, *x)
		}
	}
	return out
}

func (r *Repo) RowCount() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.Rows)
}

func (r *Repo) MemberPlan(_ context.Context, mt int) (*model.SubscriptionMemberPlan, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.MemberReadErr != nil {
		return nil, r.MemberReadErr
	}
	m, ok := r.Members[mt]
	if !ok {
		return nil, repository.ErrMemberNotFound
	}
	c := *m
	return &c, nil
}

func (r *Repo) CountVisiblePlaces(_ context.Context, mt int) (int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.Places[mt], nil
}

func (r *Repo) FindByHash(_ context.Context, platform, hash string) (*model.SubscriptionTransaction, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.TableMissing {
		return nil, repository.ErrSubscriptionTableMissing
	}
	for _, x := range r.Rows {
		if x.Platform == platform && x.StoreIDHash == hash {
			c := *x
			return &c, nil
		}
	}
	return nil, nil
}

func (r *Repo) ListByMember(_ context.Context, mt int) ([]model.SubscriptionTransaction, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.TableMissing {
		return nil, repository.ErrSubscriptionTableMissing
	}
	var out []model.SubscriptionTransaction
	for _, x := range r.Rows {
		if x.MtIdx == mt {
			out = append(out, *x)
		}
	}
	return out, nil
}

func (r *Repo) SyncMemberLevel(_ context.Context, mt, want int) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	m, ok := r.Members[mt]
	if !ok || m.MtLevel == nil || (*m.MtLevel != 2 && *m.MtLevel != 5) || *m.MtLevel == want {
		return false, nil
	}
	v := want
	m.MtLevel = &v
	if want == 2 {
		n := "N"
		m.MtPlanCheck = &n
	}
	return true, nil
}

func (r *Repo) ExpireLapsed(_ context.Context, now time.Time) (int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var n int64
	for _, m := range r.Members {
		if m.MtLevel != nil && *m.MtLevel == 5 && m.MtPlanDate != nil && !m.MtPlanDate.After(now) {
			v, c := 2, "N"
			m.MtLevel, m.MtPlanCheck = &v, &c
			n++
		}
	}
	return n, nil
}

type txState struct {
	members map[int]model.SubscriptionMemberPlan
	rows    []model.SubscriptionTransaction
	nextID  int
}

func (r *Repo) snapshot() txState {
	s := txState{members: map[int]model.SubscriptionMemberPlan{}, nextID: r.nextID}
	for k, v := range r.Members {
		s.members[k] = *v
	}
	for _, x := range r.Rows {
		s.rows = append(s.rows, *x)
	}
	return s
}

func (r *Repo) restore(s txState) {
	r.Members = map[int]*model.SubscriptionMemberPlan{}
	for k, v := range s.members {
		c := v
		r.Members[k] = &c
	}
	r.Rows = nil
	for _, x := range s.rows {
		c := x
		r.Rows = append(r.Rows, &c)
	}
	r.nextID = s.nextID
	for _, x := range r.external {
		found := false
		for _, y := range r.Rows {
			if y.ID == x.ID {
				found = true
			}
		}
		if !found {
			c := x
			r.Rows = append(r.Rows, &c)
			if x.ID >= r.nextID {
				r.nextID = x.ID + 1
			}
		}
	}
}

type tx struct {
	r  *Repo
	mt int
}

func (r *Repo) WithMemberLock(_ context.Context, mt int, fn func(repository.SubscriptionTxOps, *model.SubscriptionMemberPlan) error) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Locks++
	m, ok := r.Members[mt]
	if !ok {
		return repository.ErrMemberNotFound
	}
	snap := r.snapshot()
	c := *m
	// fn 안에서 락이 필요한 보조 메서드(AddRowLocked)는 이미 잡힌 락을 쓴다.
	err := fn(&tx{r: r, mt: mt}, &c)
	if err != nil {
		r.restore(snap)
	}
	return err
}

func (t *tx) FindByHash(platform, hash string) (*model.SubscriptionTransaction, error) {
	if t.r.TableMissing {
		return nil, repository.ErrSubscriptionTableMissing
	}
	for _, x := range t.r.Rows {
		if x.Platform == platform && x.StoreIDHash == hash {
			c := *x
			return &c, nil
		}
	}
	return nil, nil
}

func (t *tx) ListByMember() ([]model.SubscriptionTransaction, error) {
	var out []model.SubscriptionTransaction
	for _, x := range t.r.Rows {
		if x.MtIdx == t.mt {
			out = append(out, *x)
		}
	}
	return out, nil
}

func (t *tx) Insert(row *model.SubscriptionTransaction) error {
	if t.r.InsertHook != nil {
		if err := t.r.InsertHook(t.r, row); err != nil {
			return err
		}
	}
	for _, x := range t.r.Rows {
		if x.Platform == row.Platform && x.StoreIDHash == row.StoreIDHash {
			return repository.ErrDuplicateKey
		}
	}
	row.ID = t.r.nextID
	t.r.nextID++
	c := *row
	t.r.Rows = append(t.r.Rows, &c)
	return nil
}

func (t *tx) Save(row *model.SubscriptionTransaction) error {
	for i, x := range t.r.Rows {
		if x.ID == row.ID {
			c := *row
			t.r.Rows[i] = &c
			return nil
		}
	}
	return repository.ErrMemberNotFound
}

func (t *tx) UpdateMemberPlan(planDate time.Time, planCheck string, level *int) error {
	m := t.r.Members[t.mt]
	d := planDate
	m.MtPlanDate = &d
	m.MtPlanCheck = &planCheck
	if level != nil {
		v := *level
		m.MtLevel = &v
	}
	return nil
}

// Store 는 store.Verifier 와 store.NotificationVerifier 의 가짜다. 필드 함수를 채워 동작을 정한다.
type Store struct {
	mu        sync.Mutex
	Apple     func(jws string) (*store.Verified, error)
	Google    func(productID, token string) (*store.Verified, error)
	Ack       func(productID, token string) error
	AppleN    func(payload string) (*store.Notification, error)
	GoogleN   func(auth string, body []byte) (*store.Notification, error)
	AckCalls  []string
	VerifyCnt int
}

func (s *Store) VerifyApple(_ context.Context, jws string) (*store.Verified, error) {
	s.mu.Lock()
	s.VerifyCnt++
	s.mu.Unlock()
	return s.Apple(jws)
}

func (s *Store) VerifyGoogle(_ context.Context, productID, token string) (*store.Verified, error) {
	s.mu.Lock()
	s.VerifyCnt++
	s.mu.Unlock()
	return s.Google(productID, token)
}

func (s *Store) AcknowledgeGoogle(_ context.Context, productID, token string) error {
	s.mu.Lock()
	s.AckCalls = append(s.AckCalls, productID)
	s.mu.Unlock()
	if s.Ack == nil {
		return nil
	}
	return s.Ack(productID, token)
}

func (s *Store) ParseApple(_ context.Context, payload string) (*store.Notification, error) {
	return s.AppleN(payload)
}

func (s *Store) ParseGoogle(_ context.Context, auth string, body []byte) (*store.Notification, error) {
	return s.GoogleN(auth, body)
}

var (
	_ store.Verifier             = (*Store)(nil)
	_ store.NotificationVerifier = (*Store)(nil)
)
