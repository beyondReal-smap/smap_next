package service

import (
	"strconv"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// pyDecimalStr는 Python str(Decimal)의 zero 표기를 재현한다. MySQL DECIMAL은 "0.00000000000000"을
// 주지만 Python Decimal은 zero를 "0E-14"(과학표기, 소수자리수=지수)로 직렬화한다. 0이 아니면 원문 유지
// (Decimal은 trailing zero를 보존하므로 DB 문자열과 동일). schedules sst_location_lat/long도 공용.
func pyDecimalStr(s *string) *string {
	if s == nil {
		return nil
	}
	scale := 0
	zero := true
	seenDot := false
	for _, ch := range *s {
		switch {
		case ch == '.':
			seenDot = true
		case ch == '-' || ch == '+':
		default:
			if seenDot {
				scale++
			}
			if ch != '0' {
				zero = false
			}
		}
	}
	if zero && scale > 0 {
		z := "0E-" + strconv.Itoa(scale)
		return &z
	}
	return s
}

// locationRepo는 LocationService가 의존하는 데이터 접근 인터페이스.
type locationRepo interface {
	List(skip, limit int) ([]model.Location, error)
	GetByID(id int) (*model.Location, error)
	FindByMember(mtIdx int) ([]model.Location, error)
	FindByGroupDetail(sgdtIdx int) ([]model.Location, error)
	Create(l *model.Location) error
	UpdateFields(id int, fields map[string]interface{}) (int64, error)
	Delete(id int) error
	MemberExists(mtIdx int) (bool, error)
	FirstGroupForMember(mtIdx int) (*int, *int, error)
}

// LocationService는 Python `app/api/v1/endpoints/locations.py`의 read 핸들러를 이식한다.
type LocationService struct {
	repo locationRepo
}

func NewLocation(repo locationRepo) *LocationService {
	return &LocationService{repo: repo}
}

func toLocationResponse(l *model.Location) dto.LocationResponse {
	return dto.LocationResponse{
		InsertMtIdx: l.InsertMtIdx,
		MtIdx:       l.MtIdx,
		SgdtIdx:     l.SgdtIdx,
		SltTitle:    l.SltTitle,
		SltAdd:      l.SltAdd,
		SltLat:      pyDecimalStr(l.SltLat),
		SltLong:     pyDecimalStr(l.SltLong),
		// FineLocation/LocationChk/AllDay: 모델 미매핑 → nil(null)
		SltShow:       l.SltShow,
		SltEnterAlarm: l.SltEnterAlarm,
		SltEnterChk:   l.SltEnterChk,
		SltIdx:        l.SltIdx,
		SltWdate:      pyISOPtr(l.SltWdate),
		SltUdate:      pyISOPtr(l.SltUdate),
		SltDdate:      pyISOPtr(l.SltDdate),
	}
}

func toLocationResponses(items []model.Location) []dto.LocationResponse {
	out := make([]dto.LocationResponse, 0, len(items))
	for i := range items {
		out = append(out, toLocationResponse(&items[i]))
	}
	return out
}

// ListLocations는 전체 목록.
func (s *LocationService) ListLocations(skip, limit int) ([]dto.LocationResponse, error) {
	items, err := s.repo.List(skip, limit)
	if err != nil {
		return nil, err
	}
	return toLocationResponses(items), nil
}

// GetLocation은 단건. 없으면 (nil, nil)로 404 신호.
func (s *LocationService) GetLocation(id int) (*dto.LocationResponse, error) {
	l, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if l == nil {
		return nil, nil
	}
	r := toLocationResponse(l)
	return &r, nil
}

// MemberLocations는 회원의 활성 장소(other-members도 동일).
func (s *LocationService) MemberLocations(mtIdx int) ([]dto.LocationResponse, error) {
	items, err := s.repo.FindByMember(mtIdx)
	if err != nil {
		return nil, err
	}
	return toLocationResponses(items), nil
}

// GroupDetailLocations는 그룹 상세의 활성 장소.
func (s *LocationService) GroupDetailLocations(sgdtIdx int) ([]dto.LocationResponse, error) {
	items, err := s.repo.FindByGroupDetail(sgdtIdx)
	if err != nil {
		return nil, err
	}
	return toLocationResponses(items), nil
}

// InMyplays/OutMyplays는 Python get_in/out_myplays_list가 `[dict(row) for row in result]`에서
// SQLAlchemy 2.0의 dict(Row) TypeError로 항상 except→[]를 반환하는 버그를 그대로 이식한다.
// (매칭 행이 395개여도 Python은 [] 반환 — 실측 확인). 쿼리 결과가 어차피 버려지므로 빈 배열만 응답.
func (s *LocationService) InMyplays() []dto.LocationResponse {
	return make([]dto.LocationResponse, 0)
}

func (s *LocationService) OutMyplays() []dto.LocationResponse {
	return make([]dto.LocationResponse, 0)
}
