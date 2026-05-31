package repository

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

type MemberRepository struct {
	db *gorm.DB
}

func NewMember(db *gorm.DB) *MemberRepository {
	return &MemberRepository{db: db}
}

// GetByID는 mt_idx로 단건 조회. 없으면 (nil, nil). weather 엔드포인트가 사용한다.
func (r *MemberRepository) GetByID(mtIdx int) (*model.Member, error) {
	var m model.Member
	err := r.db.Where("mt_idx = ?", mtIdx).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// GetActiveByID는 mt_idx + mt_status=1 조건으로 조회. Python get_required_admin_id의
// `Member.mt_idx == user_id, Member.mt_status == 1` 필터와 동등. 없으면 (nil, nil).
func (r *MemberRepository) GetActiveByID(mtIdx int) (*model.Member, error) {
	var m model.Member
	err := r.db.Where("mt_idx = ? AND mt_status = ?", mtIdx, 1).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// List는 필터 없는 offset/limit 목록(Python get_members). 정렬 없음(DB 기본 PK 순서).
func (r *MemberRepository) List(skip, limit int) ([]model.Member, error) {
	out := make([]model.Member, 0)
	err := r.db.Offset(skip).Limit(limit).Find(&out).Error
	return out, err
}

// ExistsByPhone은 하이픈 제거 후 mt_id OR mt_hp 매칭(Python crud_member.get_by_phone).
func (r *MemberRepository) ExistsByPhone(phone string) (bool, error) {
	clean := strings.ReplaceAll(phone, "-", "")
	var m model.Member
	err := r.db.Select("mt_idx").Where("mt_id = ? OR mt_hp = ?", clean, clean).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return err == nil, err
}

// ExistsByEmail은 mt_email 매칭(Python crud_member.get_by_email).
func (r *MemberRepository) ExistsByEmail(email string) (bool, error) {
	var m model.Member
	err := r.db.Select("mt_idx").Where("mt_email = ?", email).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return err == nil, err
}

// ExistsByNickname은 mt_nickname 매칭(Python check_nickname_availability).
func (r *MemberRepository) ExistsByNickname(nickname string) (bool, error) {
	var m model.Member
	err := r.db.Select("mt_idx").Where("mt_nickname = ?", nickname).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return err == nil, err
}

// GetByEmail은 mt_email 매칭 단건(Python Member.find_by_email). 없으면 (nil, nil).
func (r *MemberRepository) GetByEmail(email string) (*model.Member, error) {
	var m model.Member
	err := r.db.Where("mt_email = ?", email).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// GetByToken은 mt_token_id 매칭 단건(Python Member.find_by_token). 없으면 (nil, nil).
func (r *MemberRepository) GetByToken(token string) (*model.Member, error) {
	var m model.Member
	err := r.db.Where("mt_token_id = ?", token).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// RecentSignin은 (now-hoursAgo) ~ (+1h) 사이 가입(mt_wdate) + 토큰 보유 회원을 조회한다.
// Python Member.get_sign_in_3(hoursAgo=3)/get_sign_in_24(24)와 동등. now는 로컬 시각, 초 단위.
func (r *MemberRepository) RecentSignin(hoursAgo int) ([]model.Member, error) {
	start := time.Now().Add(time.Duration(-hoursAgo) * time.Hour)
	end := start.Add(time.Hour)
	startStr := start.Format("2006-01-02 15:04:05")
	endStr := end.Format("2006-01-02 15:04:05")
	out := make([]model.Member, 0)
	err := r.db.
		Where("mt_wdate BETWEEN ? AND ? AND mt_token_id IS NOT NULL AND mt_token_id <> ?",
			startStr, endStr, "").
		Find(&out).Error
	return out, err
}

// NotJoinedCount는 Python Member.get_not_join_group_11의 행 수를 센다(11일 전 가입+그룹 소유 회원).
// Python은 raw Row를 반환하나 jsonable_encoder가 Row를 직렬화 못 해(TypeError) 행이 있으면 500이
// 되므로, 핸들러는 이 카운트가 0이면 {"users":[]}, >0이면 500으로 동작을 재현한다. 11일 전 날짜창.
func (r *MemberRepository) NotJoinedCount() (int64, error) {
	before11 := time.Now().AddDate(0, 0, -11)
	startStr := before11.Format("2006-01-02") + " 00:00:00"
	endStr := before11.Format("2006-01-02") + " 23:59:59"
	var count int64
	err := r.db.Raw(`
		SELECT COUNT(*) FROM (
			SELECT a1.mt_idx
			FROM member_t a1
			LEFT JOIN smap_group_detail_t a2 ON a1.mt_idx = a2.mt_idx
			WHERE (a1.mt_level = 2 AND a1.mt_wdate BETWEEN ? AND ?)
			  AND (a2.sgdt_owner_chk = 'Y' AND a2.sgdt_discharge = 'N'
			       AND a2.sgdt_exit = 'N' AND a2.sgdt_show = 'Y')
			GROUP BY a1.mt_idx
		) t`, startStr, endStr).Scan(&count).Error
	return count, err
}

// FindByGroup은 member_t JOIN smap_group_detail_t(sgt_idx + show=Y/exit=N/discharge=N)로
// 그룹 멤버를 조회한다(Python get_group_members). member_t.mt_idx만 골라 mt_idx 모호성 회피,
// 정렬 없음(Python과 동일 JOIN → 동일 행 순서).
func (r *MemberRepository) FindByGroup(groupID int) ([]model.MemberGroupRow, error) {
	out := make([]model.MemberGroupRow, 0)
	err := r.db.Table("member_t").
		Select("member_t.*, "+
			"smap_group_detail_t.sgdt_idx, smap_group_detail_t.sgt_idx, "+
			"smap_group_detail_t.sgdt_owner_chk, smap_group_detail_t.sgdt_leader_chk, "+
			"smap_group_detail_t.sgdt_discharge, smap_group_detail_t.sgdt_group_chk, "+
			"smap_group_detail_t.sgdt_exit, smap_group_detail_t.sgdt_show, "+
			"smap_group_detail_t.sgdt_push_chk, smap_group_detail_t.sgdt_wdate, "+
			"smap_group_detail_t.sgdt_udate, smap_group_detail_t.sgdt_ddate, "+
			"smap_group_detail_t.sgdt_xdate, smap_group_detail_t.sgdt_adate").
		Joins("JOIN smap_group_detail_t ON member_t.mt_idx = smap_group_detail_t.mt_idx").
		Where("smap_group_detail_t.sgt_idx = ? AND smap_group_detail_t.sgdt_show = ? "+
			"AND smap_group_detail_t.sgdt_exit = ? AND smap_group_detail_t.sgdt_discharge = ?",
			groupID, "Y", "N", "N").
		Scan(&out).Error
	return out, err
}
