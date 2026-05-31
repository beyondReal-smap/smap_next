package service

import (
	"strconv"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// adminQuerier는 AdminService가 필요로 하는 조회 동작(소비자 인터페이스).
// *repository.AdminRepository가 이를 만족하며, 테스트에서는 fake로 대체한다.
type adminQuerier interface {
	Stats() (repository.AdminStats, error)
	Groups(offset, limit int, showHidden bool) ([]repository.AdminGroupRow, error)
}

// AdminService는 Python `app/api/v1/endpoints/admin_stats.py`의 read 엔드포인트 로직을
// 이식한다(통계/그룹 목록). 인증(관리자 권한)은 미들웨어가 선처리한다.
type AdminService struct {
	repo adminQuerier
}

func NewAdmin(repo adminQuerier) *AdminService {
	return &AdminService{repo: repo}
}

// derefOr는 Python `value or default`(value가 nil/"" 이면 default)와 동등하다.
func derefOr(s *string, def string) string {
	if s == nil || *s == "" {
		return def
	}
	return *s
}

// isoPtr은 Python `dt.isoformat() if dt else None`과 동등하다.
func isoPtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	v := t.Format("2006-01-02T15:04:05")
	return &v
}

// GetStats는 Python `GET /admin/stats`와 동등하다. repo 에러는 호출자가
// success:false + message로 변환한다(Python except 분기).
func (s *AdminService) GetStats() (dto.AdminStatsResponse, error) {
	stats, err := s.repo.Stats()
	if err != nil {
		return dto.AdminStatsResponse{}, err
	}
	return dto.AdminStatsResponse{
		Success: true,
		Data: dto.AdminStatsData{
			TotalMembers:     stats.TotalMembers,
			TotalGroups:      stats.TotalGroups,
			TodaySignups:     stats.TodaySignups,
			PendingInquiries: 0,
		},
	}, nil
}

// GetGroups는 Python `GET /admin/groups`와 동등하다.
func (s *AdminService) GetGroups(offset, limit int, showHidden bool) ([]dto.AdminGroupItem, error) {
	rows, err := s.repo.Groups(offset, limit, showHidden)
	if err != nil {
		return nil, err
	}
	items := make([]dto.AdminGroupItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, toAdminGroupItem(row))
	}
	return items, nil
}

// toAdminGroupItem은 쿼리 행을 응답 DTO로 변환한다.
// owner_name = mt_name or mt_nickname or f"사용자 {mt_idx}" (Python 동일).
func toAdminGroupItem(row repository.AdminGroupRow) dto.AdminGroupItem {
	var owner string
	switch {
	case nonEmpty(row.MtName):
		owner = *row.MtName
	case nonEmpty(row.MtNickname):
		owner = *row.MtNickname
	default:
		idStr := "None" // Python str(None) — mt_idx가 NULL인 드문 경우
		if row.MtIdx != nil {
			idStr = strconv.Itoa(*row.MtIdx)
		}
		owner = "사용자 " + idStr
	}
	return dto.AdminGroupItem{
		SgtIdx:        row.SgtIdx,
		SgtTitle:      derefOr(row.SgtTitle, ""),
		SgtMemo:       derefOr(row.SgtMemo, ""),
		SgtCode:       derefOr(row.SgtCode, ""),
		SgtShow:       derefOr(row.SgtShow, "Y"),
		MtIdx:         row.MtIdx,
		OwnerName:     owner,
		MemberCount:   row.MemberCount,
		ScheduleCount: row.ScheduleCount,
		LocationCount: row.LocationCount,
		SgtWdate:      isoPtr(row.SgtWdate),
		SgtUdate:      isoPtr(row.SgtUdate),
	}
}
