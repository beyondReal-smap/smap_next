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

// GetByIdxActive는 Python crud_auth.get_user_by_idx와 동등하다(members/me 전용).
// mt_idx + 활성 필터(mt_level>=2 AND mt_status=1 AND mt_show='Y'). 없으면 (nil, nil).
func (r *MemberRepository) GetByIdxActive(idx int) (*model.Member, error) {
	var m model.Member
	err := r.db.
		Where("mt_idx = ? AND mt_level >= ? AND mt_status = ? AND mt_show = ?", idx, 2, 1, "Y").
		First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// GetByMtID는 Python crud_auth.get_user_by_phone과 동등하다(auth/me 전용).
// mt_id(전화/로그인 ID)로 단건 조회, 필터 없음(탈퇴/비노출 포함). 없으면 (nil, nil).
func (r *MemberRepository) GetByMtID(mtID string) (*model.Member, error) {
	var m model.Member
	err := r.db.Where("mt_id = ?", mtID).First(&m).Error
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

// GetAllActive는 활성 회원 전체(mt_level>1 AND mt_status=1)를 조회한다.
// Python Member.get_all_active(member.py:115)와 동등 — 토큰/최근접속 필터 없음.
// daily:app_induce / daily:battery 잡이 발송 대상으로 사용한다(빈 토큰 처리는 호출자 책임,
// Python도 루프에서 send_push가 빈 토큰을 result=False로 처리하므로 동등하게 구현한다).
func (r *MemberRepository) GetAllActive() ([]model.Member, error) {
	out := make([]model.Member, 0)
	err := r.db.Where("mt_level > ? AND mt_status = ?", 1, 1).Find(&out).Error
	return out, err
}

// GetRecentlyActive는 최근 N일 이내 접속(mt_ldate)한 활성 회원을 조회한다.
// Python Member.get_recently_active(member.py:122, days 기본 7)와 동등:
//
//	mt_level>1 AND mt_status=1 AND mt_ldate >= (now - days*24h)
//
// 토큰/정렬 필터 없음(빈 토큰은 발송 단계에서 result=False 처리). daily:weather 잡이
// 발송 대상으로 사용한다(GetAllActive와 달리 "최근 1주일 접속자"로 좁힌다).
func (r *MemberRepository) GetRecentlyActive(days int) ([]model.Member, error) {
	cutoff := time.Now().AddDate(0, 0, -days)
	out := make([]model.Member, 0)
	err := r.db.
		Where("mt_level > ? AND mt_status = ? AND mt_ldate >= ?", 1, 1, cutoff).
		Find(&out).Error
	return out, err
}

// WeatherNear는 GetWeatherNear가 돌려주는 좌표 근처의 캐시된 날씨 1건이다.
// Python get_weather_info(weather_service.py:215)의 SELECT 컬럼과 1:1 대응한다.
type WeatherNear struct {
	MtWeatherSky *int    `gorm:"column:mt_weather_sky"`
	MtWeatherTmx *int    `gorm:"column:mt_weather_tmx"`
	MtWeatherTmn *int    `gorm:"column:mt_weather_tmn"`
	MtWeatherPop *string `gorm:"column:mt_weather_pop"`
	MtSido       *string `gorm:"column:mt_sido"`
	MtGu         *string `gorm:"column:mt_gu"`
	MtDong       *string `gorm:"column:mt_dong"`
}

// GetWeatherNear는 (lat,long) 좌표 근처(±0.1°) 회원 중 24시간 이내 갱신된 날씨 캐시
// 1건을 맨해튼 거리 최근접 순으로 빌려온다. Python get_weather_info(weather_service.py:215)의
// raw SQL을 그대로 이식한다(호출 회원 자기 행이 아니라 좌표 근처 아무 회원 행을 사용).
//
//	WHERE mt_weather_sky IS NOT NULL AND mt_weather_tmx IS NOT NULL
//	  AND mt_weather_date >= staleCutoff   -- 신선도(24h) 판정
//	  AND mt_lat IS NOT NULL AND mt_status = 1
//	  AND mt_lat  BETWEEN lat-0.1 AND lat+0.1
//	  AND mt_long BETWEEN lng-0.1 AND lng+0.1
//	ORDER BY ABS(mt_lat-lat) + ABS(mt_long-lng) LIMIT 1
//
// 결과가 없으면 (nil, nil) — Python의 "no fresh weather data, skipping"과 동등(호출자가 skip).
func (r *MemberRepository) GetWeatherNear(lat, long float64, staleCutoff time.Time) (*WeatherNear, error) {
	var out WeatherNear
	// ORDER BY는 GORM Order가 인자 바인딩을 지원하지 않으므로 gorm.Expr로 파라미터를 바인딩한다
	// (lat/long은 float64 — 문자열 연결 인젝션 위험 없음이지만 일관성을 위해 바인딩 유지).
	err := r.db.
		Table("member_t").
		Select("mt_weather_sky, mt_weather_tmx, mt_weather_tmn, mt_weather_pop, mt_sido, mt_gu, mt_dong").
		Where("mt_weather_sky IS NOT NULL AND mt_weather_tmx IS NOT NULL "+
			"AND mt_weather_date >= ? AND mt_lat IS NOT NULL AND mt_status = ? "+
			"AND mt_lat BETWEEN ? AND ? AND mt_long BETWEEN ? AND ?",
			staleCutoff, 1, lat-0.1, lat+0.1, long-0.1, long+0.1).
		Order(gorm.Expr("ABS(mt_lat - ?) + ABS(mt_long - ?)", lat, long)).
		Limit(1).
		Scan(&out).Error
	if err != nil {
		return nil, err
	}
	// Scan은 행이 없으면 out을 zero값으로 두고 에러를 주지 않는다. 필수 컬럼(tmx/sky)이
	// NOT NULL 조건이므로 둘 다 nil이면 매칭 행이 없었던 것 → Python의 result is None과 동등.
	if out.MtWeatherTmx == nil && out.MtWeatherSky == nil {
		return nil, nil
	}
	return &out, nil
}

// FindByIDs는 mt_idx 목록으로 회원을 배치 조회한다(Python jobs/base.py prefetch_members:34).
// Python은 500개씩 청크로 IN 조회 후 dict로 합치는데, GORM IN 절도 동일 결과이므로 한 번에
// 조회한다(필터 없음 — prefetch_members와 동등). 빈 목록이면 빈 슬라이스를 돌려준다.
// schedule:30min 잡이 일정 소유자 일괄 조회에 사용한다.
func (r *MemberRepository) FindByIDs(ids []int) ([]model.Member, error) {
	out := make([]model.Member, 0)
	if len(ids) == 0 {
		return out, nil
	}
	err := r.db.Where("mt_idx IN ?", ids).Find(&out).Error
	return out, err
}

// GetTokenList는 토큰 보유 활성 회원 전체(mt_level>1 AND mt_token_id NOT NULL AND
// mt_token_id != ” AND mt_status=1)를 조회한다. Python Member.get_token_list(member.py:142)와
// 동등 — 만료일 무관, 정렬 없음(expiry NULL 토큰도 포함). daily:silent 잡이 사용한다.
func (r *MemberRepository) GetTokenList() ([]model.Member, error) {
	out := make([]model.Member, 0)
	err := r.db.
		Where("mt_level > ? AND mt_token_id IS NOT NULL AND mt_token_id <> ? AND mt_status = ?",
			1, "", 1).
		Find(&out).Error
	return out, err
}

// GetTokenExpiringSoon은 만료 임박(mt_token_expiry_date <= threshold) 토큰 보유 활성 회원을
// 만료일 오름차순으로 조회한다. Python Member.get_token_expiring_soon(member.py:151)와 동등 —
// mt_level>1 AND mt_token_id NOT NULL AND mt_token_id != ” AND mt_status=1 AND
// mt_token_expiry_date NOT NULL AND mt_token_expiry_date <= threshold, ORDER BY ASC.
// daily:silent 잡이 우선순위 대상으로 사용한다.
func (r *MemberRepository) GetTokenExpiringSoon(threshold time.Time) ([]model.Member, error) {
	out := make([]model.Member, 0)
	err := r.db.
		Where("mt_level > ? AND mt_token_id IS NOT NULL AND mt_token_id <> ? AND mt_status = ? "+
			"AND mt_token_expiry_date IS NOT NULL AND mt_token_expiry_date <= ?",
			1, "", 1, threshold).
		Order("mt_token_expiry_date ASC").
		Find(&out).Error
	return out, err
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

// registerInsertColumns는 Python crud_auth.create_user가 Member(...)에 명시적으로 넣는 컬럼만
// 화이트리스트한다. 나머지 컬럼(mt_sido/onboarding/weather_*/adate 등)은 INSERT에서 제외해
// DB default가 적용되도록 한다(Go가 nil→NULL로 덮으면 register 응답의 `or` 폴백 결과가 갈림).
var registerInsertColumns = []string{
	"mt_id", "mt_pwd", "mt_name", "mt_email", "mt_nickname", "mt_hp",
	"mt_type", "mt_level", "mt_status", "mt_show", "mt_wdate", "mt_ldate",
	"mt_agree1", "mt_agree2", "mt_agree3", "mt_agree4", "mt_agree5",
	"mt_google_id", "mt_kakao_id", "mt_apple_id",
	"mt_birth", "mt_gender", "mt_file1", "mt_lat", "mt_long", "mt_token_id",
}

// CreateMember는 Python crud_auth.create_user의 INSERT + db.refresh와 동등하다.
// create_user가 설정하는 컬럼만 INSERT(나머지는 DB default), 이후 전체 행을 재조회해 반환한다.
func (r *MemberRepository) CreateMember(m *model.Member) (*model.Member, error) {
	if err := r.db.Select(registerInsertColumns).Create(m).Error; err != nil {
		return nil, err
	}
	// db.refresh(db_user) 등가: INSERT 후 DB default가 채워진 전체 행을 재조회.
	return r.GetByID(m.MtIdx)
}

// userCreateInsertColumns는 Python users.create_user의 Member(**MemberCreate.dict())가 넣는 21컬럼.
// (registerInsertColumns와 달리 mt_push1/mt_onboarding 포함, mt_wdate/ldate/google/kakao/apple/token 제외.)
var userCreateInsertColumns = []string{
	"mt_type", "mt_level", "mt_status", "mt_id", "mt_name", "mt_nickname", "mt_hp", "mt_email",
	"mt_birth", "mt_gender", "mt_show", "mt_agree1", "mt_agree2", "mt_agree3", "mt_agree4", "mt_agree5",
	"mt_push1", "mt_lat", "mt_long", "mt_onboarding", "mt_pwd",
}

// CreateUserMember는 Python users.create_user(POST /users/)를 이식한다. MemberCreate 21컬럼만 INSERT 후 재조회.
func (r *MemberRepository) CreateUserMember(m *model.Member) (*model.Member, error) {
	if err := r.db.Select(userCreateInsertColumns).Create(m).Error; err != nil {
		return nil, err
	}
	return r.GetByID(m.MtIdx)
}

// createFromRegisterColumns는 Python crud_member.create_from_register가 Member(...)에 넣는 28컬럼.
// (userCreateInsertColumns와 달리 mt_wdate/adate/google/kakao/apple/token_id 포함, mt_ldate 제외.)
var createFromRegisterColumns = []string{
	"mt_type", "mt_level", "mt_status", "mt_id", "mt_pwd", "mt_name", "mt_nickname", "mt_hp", "mt_email",
	"mt_birth", "mt_gender", "mt_file1", "mt_show", "mt_agree1", "mt_agree2", "mt_agree3", "mt_agree4",
	"mt_agree5", "mt_push1", "mt_lat", "mt_long", "mt_onboarding", "mt_wdate", "mt_adate",
	"mt_google_id", "mt_kakao_id", "mt_apple_id", "mt_token_id",
}

// CreateFromRegister는 Python crud_member.create_from_register(POST /members/register)를 이식한다.
func (r *MemberRepository) CreateFromRegister(m *model.Member) (*model.Member, error) {
	if err := r.db.Select(createFromRegisterColumns).Create(m).Error; err != nil {
		return nil, err
	}
	return r.GetByID(m.MtIdx)
}

// ExistsPhoneExcept는 Python crud_auth.check_phone_duplicate(자신 제외)와 동등하다.
// mt_hp == cleanPhone AND mt_idx != exceptIdx AND mt_status == 1 AND mt_show == 'Y'.
func (r *MemberRepository) ExistsPhoneExcept(cleanPhone string, exceptIdx int) (bool, error) {
	var n int64
	err := r.db.Model(&model.Member{}).
		Where("mt_hp = ? AND mt_idx <> ? AND mt_status = ? AND mt_show = ?", cleanPhone, exceptIdx, 1, "Y").
		Count(&n).Error
	return n > 0, err
}

// ExistsEmailExcept는 Python crud_auth.check_email_duplicate(자신 제외)와 동등하다.
func (r *MemberRepository) ExistsEmailExcept(email string, exceptIdx int) (bool, error) {
	var n int64
	err := r.db.Model(&model.Member{}).
		Where("mt_email = ? AND mt_idx <> ? AND mt_status = ? AND mt_show = ?", email, exceptIdx, 1, "Y").
		Count(&n).Error
	return n > 0, err
}

// ExistsNicknameExcept는 Python crud_auth.check_nickname_duplicate(자신 제외)와 동등하다.
func (r *MemberRepository) ExistsNicknameExcept(nickname string, exceptIdx int) (bool, error) {
	var n int64
	err := r.db.Model(&model.Member{}).
		Where("mt_nickname = ? AND mt_idx <> ? AND mt_status = ? AND mt_show = ?", nickname, exceptIdx, 1, "Y").
		Count(&n).Error
	return n > 0, err
}

// Delete는 mt_idx 회원을 하드 삭제한다(Python users.delete_user). ⚠️ 무인증 하드 삭제(Python 충실).
func (r *MemberRepository) Delete(mtIdx int) error {
	return r.db.Where("mt_idx = ?", mtIdx).Delete(&model.Member{}).Error
}

// UpdateColumns는 mt_idx 행의 지정 컬럼만 UPDATE한다(Python ORM의 "변경 attr만 UPDATE" 등가).
// 로그인 시각/기기정보 갱신 등 부분 업데이트에 사용한다.
func (r *MemberRepository) UpdateColumns(mtIdx int, fields map[string]interface{}) error {
	if len(fields) == 0 {
		return nil
	}
	return r.db.Model(&model.Member{}).Where("mt_idx = ?", mtIdx).Updates(fields).Error
}

// GetByKakaoID는 Python crud_auth.get_user_by_kakao_id(mt_kakao_id 단건, 필터 없음).
func (r *MemberRepository) GetByKakaoID(kakaoID string) (*model.Member, error) {
	return r.firstByColumn("mt_kakao_id", kakaoID)
}

// GetByGoogleID는 mt_google_id 단건(google_login 우선순위2 조회).
func (r *MemberRepository) GetByGoogleID(googleID string) (*model.Member, error) {
	return r.firstByColumn("mt_google_id", googleID)
}

// GetByAppleID는 mt_apple_id 단건(apple_login 우선순위1 조회).
func (r *MemberRepository) GetByAppleID(appleID string) (*model.Member, error) {
	return r.firstByColumn("mt_apple_id", appleID)
}

func (r *MemberRepository) firstByColumn(col, val string) (*model.Member, error) {
	var m model.Member
	err := r.db.Where(col+" = ?", val).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// GetByPhoneOr는 Python crud_member.get_by_phone와 동등: 하이픈 제거 후 mt_id OR mt_hp 매칭 단건.
func (r *MemberRepository) GetByPhoneOr(phone string) (*model.Member, error) {
	clean := strings.ReplaceAll(phone, "-", "")
	var m model.Member
	err := r.db.Where("mt_id = ? OR mt_hp = ?", clean, clean).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// CountExpiredTokens는 Python cleanup_expired_fcm_tokens의 만료 토큰 집계를 이식한다.
// 조건: mt_token_id NOT NULL AND mt_token_expiry_date NOT NULL AND mt_token_expiry_date < now.
// 반환: (만료 회원 수, 그 중 mt_push1='Y' 수). 실제 삭제는 하지 않는다(Python no-op).
func (r *MemberRepository) CountExpiredTokens(now time.Time) (total int64, withPush1 int64, err error) {
	base := r.db.Model(&model.Member{}).
		Where("mt_token_id IS NOT NULL AND mt_token_expiry_date IS NOT NULL AND mt_token_expiry_date < ?", now)
	if err = base.Count(&total).Error; err != nil {
		return 0, 0, err
	}
	if err = base.Session(&gorm.Session{}).Where("mt_push1 = ?", "Y").Count(&withPush1).Error; err != nil {
		return 0, 0, err
	}
	return total, withPush1, nil
}

// CountMembersWithToken은 Python reset_invalid_fcm_tokens의 total_checked를 이식한다(mt_token_id NOT NULL 수).
func (r *MemberRepository) CountMembersWithToken() (int64, error) {
	var n int64
	err := r.db.Model(&model.Member{}).Where("mt_token_id IS NOT NULL").Count(&n).Error
	return n, err
}

// GetByResetToken은 Python verify_reset_token/reset_password의 조회를 이식한다:
// mt_reset_token 일치 AND mt_token_edate > now(미만료). 없으면 (nil, nil). 상태 필터 없음.
// ⚠️ now는 dbUTCNow()(UTC 벽시계)를 받아야 한다 — 저장 시 utcnow()+1분과 동일 기준으로 비교.
func (r *MemberRepository) GetByResetToken(token string, now time.Time) (*model.Member, error) {
	var m model.Member
	err := r.db.Where("mt_reset_token = ? AND mt_token_edate > ?", token, now).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}
