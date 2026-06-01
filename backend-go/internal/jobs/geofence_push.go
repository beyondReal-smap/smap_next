package jobs

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/hibiken/asynq"

	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/model"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// geofence 4종(30초 주기) 잡 구현.
//
// Python 원본: app/jobs/location_alerts.py.
//   - run_location_entry_alert(:215)   → handleGeofenceEnter   (그룹 일정 장소 진입, owner/leader fan-out)
//   - run_location_exit_alert(:285)    → handleGeofenceExit    (그룹 일정 장소 이탈, owner/leader fan-out)
//   - run_my_location_entry_alert(:354)→ handleGeofenceMyEnter (내 장소 진입, 본인만)
//   - run_my_location_exit_alert(:436) → handleGeofenceMyExit  (내 장소 이탈, 본인만)
//
// 히스테리시스(GPS 오차로 인한 반복 전환 방지): 진입 판정 ≤80m / 이탈 판정 ≥120m(비대칭).
// GPS 필터: accuracy>50m 무시, gps_time이 now-5분보다 오래되면 무시.
// 내 장소 쿨다운: 마지막 상태 변경(slt_udate)으로부터 3분 미경과면 skip.
//
// ★Go 개선(claim-then-send): Python은 "거리 판정 통과 → 발송 → 발송 후 마킹"이라 발송-마킹 사이
// 크래시·분산 환경에서 중복(at-least-once)이 가능하다(특히 내 장소 잡은 루프 말미 단일 commit이라
// 부분 발송 후 예외 시 rollback으로 상태 전이가 통째로 소실되는 비원자성 약점이 있다).
// Go는 거리 판정 통과 직후·발송 전에 상태 컬럼을 조건부 UPDATE로 원자적 선점한다(RowsAffected=1만
// 발송). 마킹 컬럼/값/증분은 Python과 동일하고, 선점 위치만 "발송 전"으로 당겼다. 이는 Python에 없는
// 신규 개선이다.

// ── 지오펜스 상수(location_alerts.py:21-25 그대로) ──
const (
	geofenceEntryRadiusM  = 80.0  // 진입 판정 거리 (m)
	geofenceExitRadiusM   = 120.0 // 이탈 판정 거리 (m)
	gpsAccuracyThresholdM = 50.0  // GPS 정확도 필터 (m)
	earthRadiusM          = 6371000.0
)

var (
	myPlaceCooldown   = 3 * time.Minute // 내 장소 상태 전환 쿨다운(MY_PLACE_COOLDOWN)
	gpsStaleThreshold = 5 * time.Minute // GPS 데이터 유효 기간(GPS_STALE_THRESHOLD)
)

// ── 정적 폴백 메시지(AI 미사용, location_alerts.py 인라인 dict 이식) ──

// scheduleEntryMessage는 그룹 일정 장소 도착 문구(location_alerts.py:65-74).
var scheduleEntryMessage = localizedMessage{
	titleKO:   "일정장소 도착알림 📍",
	contentKO: "{name}님이 '{title}' 장소에 도착했어요! 🎉",
	titleEN:   "Arrival at scheduled location 📍",
	contentEN: "{name} has arrived at '{title}'! 🎉",
}

// scheduleExitMessage는 그룹 일정 장소 출발 문구(location_alerts.py:128-137).
var scheduleExitMessage = localizedMessage{
	titleKO:   "일정장소 출발알림 👋",
	contentKO: "{name}님이 '{title}' 장소에서 출발했어요!",
	titleEN:   "Departure from scheduled location 👋",
	contentEN: "{name} has departed from '{title}'!",
}

// myPlaceEntryMessage는 내 장소 방문 문구(location_alerts.py:401-407).
var myPlaceEntryMessage = localizedMessage{
	titleKO:   "내장소 방문알림 📍",
	contentKO: "{name}님이 내장소 '{title}'에 방문했어요! 🎉",
	titleEN:   "My place arrival 📍",
	contentEN: "{name} arrived at '{title}'! 🎉",
}

// myPlaceExitMessage는 내 장소 이탈 문구(location_alerts.py:481-487).
var myPlaceExitMessage = localizedMessage{
	titleKO:   "내장소 이탈알림 👋",
	contentKO: "{name}님이 내장소 '{title}'에서 이탈했어요!",
	titleEN:   "My place departure 👋",
	contentEN: "{name} departed from '{title}'!",
}

// renderGeofenceMessage는 정적 폴백 메시지의 {name}/{title} 플레이스홀더를 치환한다.
// Python render_push_message는 AI/캐시 경로가 있으나 이번 이식은 정적 폴백만이며,
// fallback_template[...].format(name=..., title=...)과 동등하게 두 키만 치환한다.
func renderGeofenceMessage(m localizedMessage, mtLang *string, name, title string) (string, string) {
	t, c := m.pick(mtLang)
	rep := func(s string) string {
		s = strings.ReplaceAll(s, "{name}", name)
		return strings.ReplaceAll(s, "{title}", title)
	}
	return rep(t), rep(c)
}

// ── 푸시 로그 plt_condition / plt_memo(location_alerts.py 그대로) ──
const (
	geofenceEntryPltCondition = "30초 - 장소알림"
	geofenceExitPltCondition  = "30초 - 장소알림"
	myEntryPltCondition       = "30s - My Place Entry"
	myExitPltCondition        = "30s - My Place Exit"
	geofenceEventTitle        = "일정"  // schedule_title fallback(sst_title or "일정")
	myPlaceTitleFallback      = "내장소" // slt_title or "내장소"
	memberNameFallback        = "회원"
)

var (
	geofenceEntryPltMemo = fmt.Sprintf("일정에 입력한 장소의 %d미터 반경에 들어왔을때", int(geofenceEntryRadiusM))
	geofenceExitPltMemo  = fmt.Sprintf("일정에 입력한 장소의 %d미터 반경에서 이탈했을때", int(geofenceExitRadiusM))
	myEntryPltMemo       = fmt.Sprintf("내가 등록한 장소의 %d미터 반경에 들어왔을때", int(geofenceEntryRadiusM))
	myExitPltMemo        = fmt.Sprintf("내가 등록한 장소의 %d미터 반경에서 이탈했을때", int(geofenceExitRadiusM))
)

// ── haversine(미터) ──

// haversineMeters는 Python core.utils.haversine_distance(core/utils.py:7)를 충실 이식한다.
//
//	R=6371000(미터), dlat/dlon=radians 차, a=sin²(dlat/2)+cos(lat1)cos(lat2)sin²(dlon/2),
//	return R*2*atan2(sqrt(a), sqrt(1-a))
//
// ★service/member_location_log.go의 haversineKm는 (a) R=6371(km 반환) (b) 좌표 0 가드가 있어
// geofence(미터 비교·0가드 없음)와 동작이 다르다. 그대로 노출/복제하면 단위·가드 divergence가
// 생기므로 jobs 전용으로 core.utils.haversine_distance를 별도 복제한다(service read-only 파일 무변경).
func haversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	dlat := (lat2 - lat1) * math.Pi / 180
	dlon := (lon2 - lon1) * math.Pi / 180
	rlat1 := lat1 * math.Pi / 180
	rlat2 := lat2 * math.Pi / 180
	a := math.Sin(dlat/2)*math.Sin(dlat/2) +
		math.Cos(rlat1)*math.Cos(rlat2)*math.Sin(dlon/2)*math.Sin(dlon/2)
	return earthRadiusM * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

// ── GPS 필터 ──

// isGPSUsable는 Python _is_gps_usable(location_alerts.py:43)를 이식한다.
//   - accuracy != None AND accuracy > 50.0  → False(부정확)
//   - gps_time != None AND now != None AND (now-gps_time) > 5분 → False(오래됨)
//   - 그 외 True(permissive: accuracy/gps_time가 nil이면 통과)
func isGPSUsable(loc repository.RecentLocation, now time.Time) bool {
	if loc.Accuracy != nil && *loc.Accuracy > gpsAccuracyThresholdM {
		return false
	}
	if loc.GpsTime != nil && now.Sub(*loc.GpsTime) > gpsStaleThreshold {
		return false
	}
	return true
}

// formatDistance는 Python "{:,.1f}".format(distance)(천단위 콤마 + 소수 1자리)를 이식한다.
func formatDistance(d float64) string {
	neg := d < 0
	if neg {
		d = -d
	}
	whole := int64(d)
	frac := int64(math.Round((d-float64(whole))*10)) % 10
	// 반올림이 정수부를 올릴 수 있어 보정.
	if math.Round((d-float64(whole))*10) >= 10 {
		whole++
	}
	intStr := groupThousands(whole)
	if neg {
		intStr = "-" + intStr
	}
	return fmt.Sprintf("%s.%d", intStr, frac)
}

// groupThousands는 정수에 천단위 콤마를 삽입한다(Python "{:,}" 정수부).
func groupThousands(n int64) string {
	s := strconv.FormatInt(n, 10)
	if len(s) <= 3 {
		return s
	}
	// 뒤에서 3자리씩 콤마 삽입.
	var b []byte
	for i, c := range []byte(s) {
		if i > 0 && (len(s)-i)%3 == 0 {
			b = append(b, ',')
		}
		b = append(b, c)
	}
	return string(b)
}

// formatCoord는 Python "{:.7f}".format(coord)(소수 7자리 고정)를 이식한다.
func formatCoord(c float64) string {
	return strconv.FormatFloat(c, 'f', 7, 64)
}

// buildPushJSON은 push_json dict({lat, lng, distance})를 JSON 문자열로 직렬화한다
// (Python json.dumps(..., ensure_ascii=False)). 값은 모두 포맷된 문자열이라 키 순서만 고정한다.
func buildPushJSON(latStr, lngStr, distStr string) string {
	return fmt.Sprintf(`{"lat": "%s", "lng": "%s", "distance": "%s"}`, latStr, lngStr, distStr)
}

// ── 데이터 접근 seam(테스트 주입용). nil이면 h.db 기반 실 repository로 폴백한다. ──

// geofenceScheduleSource는 그룹 entry/exit 잡의 일정 조회 + claim 동작이다.
type geofenceScheduleSource interface {
	GetNowScheduleInMembers() ([]model.Schedule, error)
	GetNowScheduleOutMembers() ([]model.Schedule, error)
	ClaimScheduleEntry(sstIdx int) (int64, error)
	ClaimScheduleExit(sstIdx int) (int64, error)
}

// geofenceGroupDetailSource는 sgdt_idx→GroupDetail 배치 조회 동작이다.
type geofenceGroupDetailSource interface {
	FindByIDs(sgdtIdxList []int) (map[int]model.GroupDetail, error)
}

// geofenceLocSource는 회원 최신 위치 배치 조회 동작이다(그룹/내 장소 공용).
type geofenceLocSource interface {
	GetRecentLocationsBatch(mtIdxList []int) (map[int]repository.RecentLocation, error)
}

// geofenceGroupRoleSource는 그룹 owner/leader fan-out 대상 조회 동작이다.
type geofenceGroupRoleSource interface {
	GetGroupMembersWithRoles(sgtIdx int) ([]model.GroupRoleMember, error)
}

// geofenceMyLocationSource는 내 장소 entry/exit 잡의 조회 + claim 동작이다.
type geofenceMyLocationSource interface {
	GetAllActive() ([]model.Location, error)
	GetAllActiveIn() ([]model.Location, error)
	ClaimMyEntry(sltIdx int, now time.Time) (int64, error)
	ClaimMyExit(sltIdx int, now time.Time) (int64, error)
}

// geofenceMemberSource는 내 장소 잡의 회원 prefetch 동작이다.
type geofenceMemberSource interface {
	FindByIDs(ids []int) ([]model.Member, error)
}

// 컴파일 타임에 실 repository가 seam을 만족하는지 확인한다(시그니처 드리프트 방지).
var (
	_ geofenceScheduleSource    = (*repository.ScheduleRepository)(nil)
	_ geofenceGroupDetailSource = (*repository.GroupDetailRepository)(nil)
	_ geofenceLocSource         = (*repository.MemberLocationLogRepository)(nil)
	_ geofenceGroupRoleSource   = (*repository.GroupMemberRepository)(nil)
	_ geofenceMyLocationSource  = (*repository.LocationRepository)(nil)
	_ geofenceMemberSource      = (*repository.MemberRepository)(nil)
)

func (h *Handlers) resolveGeofenceScheduleSrc(ctx context.Context) geofenceScheduleSource {
	if h.geofenceScheduleSrc != nil {
		return h.geofenceScheduleSrc
	}
	return repository.NewSchedule(h.db.WithContext(ctx))
}

func (h *Handlers) resolveGeofenceGroupDetailSrc(ctx context.Context) geofenceGroupDetailSource {
	if h.geofenceGroupDetailSrc != nil {
		return h.geofenceGroupDetailSrc
	}
	return repository.NewGroupDetail(h.db.WithContext(ctx))
}

func (h *Handlers) resolveGeofenceLocSrc(ctx context.Context) geofenceLocSource {
	if h.geofenceLocSrc != nil {
		return h.geofenceLocSrc
	}
	return repository.NewMemberLocationLog(h.db.WithContext(ctx))
}

func (h *Handlers) resolveGeofenceGroupRoleSrc(ctx context.Context) geofenceGroupRoleSource {
	if h.geofenceGroupRoleSrc != nil {
		return h.geofenceGroupRoleSrc
	}
	return repository.NewGroupMember(h.db.WithContext(ctx))
}

func (h *Handlers) resolveGeofenceMyLocationSrc(ctx context.Context) geofenceMyLocationSource {
	if h.geofenceMyLocationSrc != nil {
		return h.geofenceMyLocationSrc
	}
	return repository.NewLocation(h.db.WithContext(ctx))
}

func (h *Handlers) resolveGeofenceMemberSrc(ctx context.Context) geofenceMemberSource {
	if h.geofenceMemberSrc != nil {
		return h.geofenceMemberSrc
	}
	return repository.NewMember(h.db.WithContext(ctx))
}

// geofenceTarget은 발송 1건(그룹 fan-out 또는 본인)이다. push_log에 sst_idx(또는 slt_idx)를
// 채우기 위해 식별자/메타를 함께 들고 있다.
type geofenceTarget struct {
	mtIdx    int
	refIdx   int // push_log의 sst_idx 컬럼에 들어가는 값(그룹=sst_idx, 내 장소=slt_idx 재활용)
	token    string
	title    string
	body     string
	pltCond  string
	pltMemo  string
	pushJSON string
}

// ── 그룹 일정 장소 진입/이탈 ──────────────────────────────────────────────

// handleGeofenceEnter는 Python run_location_entry_alert(location_alerts.py:215)를 이식한다.
func (h *Handlers) handleGeofenceEnter(ctx context.Context, t *asynq.Task) error {
	return h.handleGeofenceGroup(ctx, t, true)
}

// handleGeofenceExit는 Python run_location_exit_alert(location_alerts.py:285)를 이식한다.
func (h *Handlers) handleGeofenceExit(ctx context.Context, t *asynq.Task) error {
	return h.handleGeofenceGroup(ctx, t, false)
}

// handleGeofenceGroup은 그룹 entry/exit 공통 파이프라인이다(entry=true면 진입, false면 이탈).
// 두 잡의 차이는 (1)대상 쿼리 (2)거리 판정 방향(≤80 / ≥120) (3)claim UPDATE (4)메시지/메모뿐이라
// 한 함수로 묶고 entry 플래그로 분기한다(Python 두 함수의 거의 동일한 본문 중복을 제거).
func (h *Handlers) handleGeofenceGroup(ctx context.Context, t *asynq.Task, entry bool) error {
	jobType := t.Type()
	now := time.Now()

	schedSrc := h.resolveGeofenceScheduleSrc(ctx)
	var schedules []model.Schedule
	var err error
	if entry {
		schedules, err = schedSrc.GetNowScheduleInMembers()
	} else {
		schedules, err = schedSrc.GetNowScheduleOutMembers()
	}
	if err != nil {
		h.log.Error("geofence query failed", slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}
	if len(schedules) == 0 {
		h.log.Info("geofence: no due schedules", slog.String("type", jobType))
		return nil
	}

	// 배치 Phase 1: sgdt_idx → GroupDetail 사전로드(Python gd_map).
	sgdtIDs := make([]int, 0, len(schedules))
	for i := range schedules {
		if schedules[i].SgdtIdx != nil && *schedules[i].SgdtIdx != 0 {
			sgdtIDs = append(sgdtIDs, *schedules[i].SgdtIdx)
		}
	}
	gdMap, err := h.resolveGeofenceGroupDetailSrc(ctx).FindByIDs(sgdtIDs)
	if err != nil {
		h.log.Error("geofence group_detail prefetch failed", slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}

	// 배치 Phase 2: 관련 회원 최신 위치 사전로드(Python recent_locs).
	mtIdxSet := make(map[int]struct{})
	for i := range schedules {
		s := &schedules[i]
		if s.SgdtIdx != nil && *s.SgdtIdx != 0 {
			if gd, ok := gdMap[*s.SgdtIdx]; ok && gd.MtIdx != nil {
				mtIdxSet[*gd.MtIdx] = struct{}{}
			}
		}
	}
	mtIdxList := make([]int, 0, len(mtIdxSet))
	for id := range mtIdxSet {
		mtIdxList = append(mtIdxList, id)
	}
	recentLocs, err := h.resolveGeofenceLocSrc(ctx).GetRecentLocationsBatch(mtIdxList)
	if err != nil {
		h.log.Error("geofence recent locations failed", slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}

	roleSrc := h.resolveGeofenceGroupRoleSrc(ctx)

	var targets []geofenceTarget
	var claimed, skippedNoMember, skippedGPS, skippedDistance, skippedClaimLost int

	for i := range schedules {
		s := &schedules[i]

		// 멤버 해석: sgt_idx not nil AND sgdt_idx not in(nil,0)일 때만 gd_map에서 mt_idx 해석.
		if s.SgtIdx == nil || s.SgdtIdx == nil || *s.SgdtIdx == 0 {
			skippedNoMember++
			continue
		}
		gd, ok := gdMap[*s.SgdtIdx]
		if !ok || gd.MtIdx == nil {
			skippedNoMember++
			continue
		}
		mtIdx := *gd.MtIdx

		// 액터 제외(해석 단계): 일정 작성자(schedule.mt_idx)와 위치 주인(mt_idx)이 같으면 skip.
		schedMtIdx := 0
		if s.MtIdx != nil {
			schedMtIdx = *s.MtIdx
		}
		if schedMtIdx == mtIdx {
			skippedNoMember++
			continue
		}

		memberLoc, ok := recentLocs[mtIdx]
		if !ok || !isGPSUsable(memberLoc, now) {
			skippedGPS++
			continue
		}

		// 좌표 파싱(DECIMAL→문자열→float, Python float(record["sst_location_lat"])).
		targetLat, ok1 := parseCoord(s.SstLocationLat)
		targetLong, ok2 := parseCoord(s.SstLocationLong)
		if !ok1 || !ok2 {
			skippedNoMember++
			continue
		}

		distance := haversineMeters(coordVal(memberLoc.Lat), coordVal(memberLoc.Long), targetLat, targetLong)

		// 거리 판정(entry ≤80 / exit ≥120).
		pass := false
		if entry {
			pass = distance <= geofenceEntryRadiusM
		} else {
			pass = distance >= geofenceExitRadiusM
		}
		if !pass {
			skippedDistance++
			continue
		}

		// ★claim-then-send: 거리 판정 통과 직후 발송 전 원자적 선점.
		var affected int64
		var cErr error
		if entry {
			affected, cErr = schedSrc.ClaimScheduleEntry(s.SstIdx)
		} else {
			affected, cErr = schedSrc.ClaimScheduleExit(s.SstIdx)
		}
		if cErr != nil {
			h.log.Error("geofence claim failed", slog.String("type", jobType),
				slog.Int("sst_idx", s.SstIdx), slog.String("err", cErr.Error()))
			return cErr
		}
		if affected == 0 {
			skippedClaimLost++
			continue
		}
		claimed++

		// push_json(lat/lng/distance 포맷).
		pushJSON := buildPushJSON(formatCoord(targetLat), formatCoord(targetLong), formatDistance(distance))

		// fan-out: owner + leader만(액터 mt_idx 제외).
		fanouts := h.geofenceFanout(ctx, roleSrc, *s.SgtIdx, mtIdx)
		scheduleTitle := geofenceEventTitle
		if s.SstTitle != nil && *s.SstTitle != "" {
			scheduleTitle = *s.SstTitle
		}
		// 액터 이름(Python: member_payload(mt_nickname or mt_name or "회원")).
		actorName := h.geofenceActorName(ctx, mtIdx)

		msg := scheduleEntryMessage
		cond := geofenceEntryPltCondition
		memo := geofenceEntryPltMemo
		if !entry {
			msg = scheduleExitMessage
			cond = geofenceExitPltCondition
			memo = geofenceExitPltMemo
		}

		for _, fo := range fanouts {
			title, body := renderGeofenceMessage(msg, fo.MtLang, actorName, scheduleTitle)
			targets = append(targets, geofenceTarget{
				mtIdx:    fo.MtIdx,
				refIdx:   s.SstIdx,
				token:    *fo.MtTokenID,
				title:    title,
				body:     body,
				pltCond:  cond,
				pltMemo:  memo,
				pushJSON: pushJSON,
			})
		}
	}

	return h.sendGeofenceTargets(ctx, jobType, targets, now,
		slog.Int("schedules", len(schedules)),
		slog.Int("claimed", claimed),
		slog.Int("skipped_no_member", skippedNoMember),
		slog.Int("skipped_gps", skippedGPS),
		slog.Int("skipped_distance", skippedDistance),
		slog.Int("skipped_claim_lost", skippedClaimLost),
	)
}

// geofenceFanout은 Python _send_entry/exit_notifications의 대상 산정을 이식한다:
// [owner, leader]만(일반 멤버 fan-out 아님). 각 역할에 대해 (1)액터 mt_idx 제외 (2)토큰 보유만.
// owner==leader 중복 제거는 Python도 하지 않으므로 그대로 둔다(둘 다 보냄).
// Python find_owner/find_leader는 단일 행이라, GetGroupMembersWithRoles 결과에서 owner_chk='Y'/
// leader_chk='Y'인 마지막 행을 owner/leader로 채택한다(schedule_push.go fanoutGroupMembers와 동일 규칙).
func (h *Handlers) geofenceFanout(ctx context.Context, roleSrc geofenceGroupRoleSource, sgtIdx, actorMtIdx int) []model.GroupRoleMember {
	roles, err := roleSrc.GetGroupMembersWithRoles(sgtIdx)
	if err != nil {
		// Python get_group_member_data는 예외 시 빈 dict 반환 → owner/leader 없이 진행. 동등.
		h.log.Warn("geofence group roles query failed (no fan-out)",
			slog.Int("sgt_idx", sgtIdx), slog.String("err", err.Error()))
		return nil
	}
	var owner, leader *model.GroupRoleMember
	for i := range roles {
		r := &roles[i]
		if r.SgdtOwnerChk != nil && *r.SgdtOwnerChk == "Y" {
			owner = r
		} else if r.SgdtLeaderChk != nil && *r.SgdtLeaderChk == "Y" {
			leader = r
		}
	}

	out := make([]model.GroupRoleMember, 0, 2)
	for _, cand := range []*model.GroupRoleMember{owner, leader} {
		if cand == nil {
			continue
		}
		if cand.MtIdx == actorMtIdx { // 액터(위치 주인) 제외
			continue
		}
		if cand.MtTokenID == nil || *cand.MtTokenID == "" {
			// Python은 token None 가드가 없으나, FCM Message.Token이 빈 문자열이면 발송 의미가
			// 없고 fake/real 모두 실패 처리되므로 여기서 제외해도 발송 결과는 동등하다.
			continue
		}
		out = append(out, *cand)
	}
	return out
}

// geofenceActorName은 액터(위치 주인)의 표시 이름을 가져온다
// (Python member_payload: mt_nickname or mt_name or "회원"). owner/leader 발송 문구의 {name}에 쓴다.
func (h *Handlers) geofenceActorName(ctx context.Context, mtIdx int) string {
	members, err := h.resolveGeofenceMemberSrc(ctx).FindByIDs([]int{mtIdx})
	if err != nil || len(members) == 0 {
		return memberNameFallback
	}
	return memberDisplayName(&members[0])
}

// ── 내 장소 진입/이탈 ──────────────────────────────────────────────────────

// handleGeofenceMyEnter는 Python run_my_location_entry_alert(location_alerts.py:354)를 이식한다.
func (h *Handlers) handleGeofenceMyEnter(ctx context.Context, t *asynq.Task) error {
	return h.handleGeofenceMy(ctx, t, true)
}

// handleGeofenceMyExit는 Python run_my_location_exit_alert(location_alerts.py:436)를 이식한다.
func (h *Handlers) handleGeofenceMyExit(ctx context.Context, t *asynq.Task) error {
	return h.handleGeofenceMy(ctx, t, false)
}

// handleGeofenceMy는 내 장소 entry/exit 공통 파이프라인이다(본인에게만 발송, fan-out 없음).
func (h *Handlers) handleGeofenceMy(ctx context.Context, t *asynq.Task, entry bool) error {
	jobType := t.Type()
	mySrc := h.resolveGeofenceMyLocationSrc(ctx)

	var locations []model.Location
	var err error
	if entry {
		locations, err = mySrc.GetAllActive()
	} else {
		locations, err = mySrc.GetAllActiveIn()
	}
	if err != nil {
		h.log.Error("geofence my query failed", slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}

	// entry는 코드 레벨에서 미진입(slt_enter_chk != 'Y')만 필터(Python location_alerts.py:366).
	// exit는 SQL이 이미 slt_enter_chk='Y'를 걸어 재필터 없음.
	candidates := locations
	if entry {
		candidates = make([]model.Location, 0, len(locations))
		for i := range locations {
			if locations[i].SltEnterChk == nil || *locations[i].SltEnterChk != "Y" {
				candidates = append(candidates, locations[i])
			}
		}
	}
	if len(candidates) == 0 {
		h.log.Info("geofence my: no candidates", slog.String("type", jobType))
		return nil
	}

	// 배치 prefetch: 회원 최신 위치 + 회원 정보.
	mtIdxSet := make(map[int]struct{})
	for i := range candidates {
		if candidates[i].MtIdx != nil {
			mtIdxSet[*candidates[i].MtIdx] = struct{}{}
		}
	}
	mtIdxList := make([]int, 0, len(mtIdxSet))
	for id := range mtIdxSet {
		mtIdxList = append(mtIdxList, id)
	}
	recentLocs, err := h.resolveGeofenceLocSrc(ctx).GetRecentLocationsBatch(mtIdxList)
	if err != nil {
		h.log.Error("geofence my recent locations failed", slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}
	members, err := h.resolveGeofenceMemberSrc(ctx).FindByIDs(mtIdxList)
	if err != nil {
		h.log.Error("geofence my member prefetch failed", slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}
	memberMap := make(map[int]*model.Member, len(members))
	for i := range members {
		memberMap[members[i].MtIdx] = &members[i]
	}

	now := time.Now()
	var targets []geofenceTarget
	var claimed, skippedGPS, skippedCooldown, skippedDistance, skippedNoToken, skippedClaimLost int

	for i := range candidates {
		loc := &candidates[i]
		if loc.MtIdx == nil {
			continue
		}
		mtIdx := *loc.MtIdx

		memberLoc, ok := recentLocs[mtIdx]
		if !ok || !isGPSUsable(memberLoc, now) {
			skippedGPS++
			continue
		}

		// 쿨다운: 마지막 slt_udate로부터 3분 미경과면 skip(slt_udate nil이면 통과).
		if loc.SltUdate != nil && now.Sub(*loc.SltUdate) < myPlaceCooldown {
			skippedCooldown++
			continue
		}

		targetLat, ok1 := parseCoord(loc.SltLat)
		targetLong, ok2 := parseCoord(loc.SltLong)
		if !ok1 || !ok2 {
			skippedDistance++
			continue
		}
		distance := haversineMeters(coordVal(memberLoc.Lat), coordVal(memberLoc.Long), targetLat, targetLong)

		pass := false
		if entry {
			pass = distance <= geofenceEntryRadiusM
		} else {
			pass = distance >= geofenceExitRadiusM
		}
		if !pass {
			skippedDistance++
			continue
		}

		member := memberMap[mtIdx]
		if member == nil || member.MtTokenID == nil || *member.MtTokenID == "" {
			// Python: member and member.mt_token_id일 때만 발송. 토큰 없으면 발송/마킹/로그 모두 skip.
			skippedNoToken++
			continue
		}

		// ★claim-then-send: 거리 판정 통과 + 토큰 확인 후 발송 전 원자적 선점.
		var affected int64
		var cErr error
		if entry {
			affected, cErr = mySrc.ClaimMyEntry(loc.SltIdx, now)
		} else {
			affected, cErr = mySrc.ClaimMyExit(loc.SltIdx, now)
		}
		if cErr != nil {
			h.log.Error("geofence my claim failed", slog.String("type", jobType),
				slog.Int("slt_idx", loc.SltIdx), slog.String("err", cErr.Error()))
			return cErr
		}
		if affected == 0 {
			skippedClaimLost++
			continue
		}
		claimed++

		name := memberDisplayName(member)
		title := myPlaceTitleFallback
		if loc.SltTitle != nil && *loc.SltTitle != "" {
			title = *loc.SltTitle
		}
		pushJSON := buildPushJSON(formatCoord(targetLat), formatCoord(targetLong), formatDistance(distance))

		msg := myPlaceEntryMessage
		cond := myEntryPltCondition
		memo := myEntryPltMemo
		if !entry {
			msg = myPlaceExitMessage
			cond = myExitPltCondition
			memo = myExitPltMemo
		}
		pTitle, pBody := renderGeofenceMessage(msg, member.MtLang, name, title)
		targets = append(targets, geofenceTarget{
			mtIdx:    mtIdx,
			refIdx:   loc.SltIdx, // ★Python push_log_add는 3번째 인자(sst_idx 컬럼)에 slt_idx를 전달(컬럼 재활용).
			token:    *member.MtTokenID,
			title:    pTitle,
			body:     pBody,
			pltCond:  cond,
			pltMemo:  memo,
			pushJSON: pushJSON,
		})
	}

	return h.sendGeofenceTargets(ctx, jobType, targets, now,
		slog.Int("candidates", len(candidates)),
		slog.Int("claimed", claimed),
		slog.Int("skipped_gps", skippedGPS),
		slog.Int("skipped_cooldown", skippedCooldown),
		slog.Int("skipped_distance", skippedDistance),
		slog.Int("skipped_no_token", skippedNoToken),
		slog.Int("skipped_claim_lost", skippedClaimLost),
	)
}

// ── 공통 발송 + push_log ────────────────────────────────────────────────────

// sendGeofenceTargets는 targets를 FCM 배치 발송하고 결과별 push_log를 적재한다(그룹/내 장소 공용).
func (h *Handlers) sendGeofenceTargets(ctx context.Context, jobType string, targets []geofenceTarget, now time.Time, extra ...slog.Attr) error {
	if len(targets) == 0 {
		attrs := append([]slog.Attr{slog.String("type", jobType), slog.Int("targets", 0)}, extra...)
		h.log.LogAttrs(ctx, slog.LevelInfo, "geofence: no send targets", attrs...)
		return nil
	}

	results := h.sendGeofenceBatches(ctx, jobType, targets)

	logs := make([]model.PushLog, 0, len(targets))
	var successCount, failCount int
	for i := range targets {
		success := results[i]
		if success {
			successCount++
		} else {
			failCount++
		}
		logs = append(logs, buildGeofencePushLog(&targets[i], now, success))
	}

	if err := h.resolvePushLogDst(ctx).CreateBatch(logs); err != nil {
		h.log.Error("geofence push log insert failed", slog.String("type", jobType), slog.String("err", err.Error()))
		return err
	}

	attrs := append([]slog.Attr{
		slog.String("type", jobType),
		slog.Int("targets", len(targets)),
		slog.Int("sent_success", successCount),
		slog.Int("sent_fail", failCount),
	}, extra...)
	h.log.LogAttrs(ctx, slog.LevelInfo, "geofence completed", attrs...)
	return nil
}

// sendGeofenceBatches는 targets(인덱스 정렬)를 ≤fcmBatchSize 청크로 SendEach 발송하고,
// 각 메시지의 성공 여부를 targets와 같은 길이/순서의 []bool로 돌려준다(schedule_push.go와 동일 패턴).
func (h *Handlers) sendGeofenceBatches(ctx context.Context, jobType string, targets []geofenceTarget) []bool {
	results := make([]bool, len(targets))
	for start := 0; start < len(targets); start += fcmBatchSize {
		end := start + fcmBatchSize
		if end > len(targets) {
			end = len(targets)
		}

		msgs := make([]fcm.Message, 0, end-start)
		for i := start; i < end; i++ {
			msgs = append(msgs, fcm.Message{
				Token:         targets[i].token,
				Title:         targets[i].title,
				Body:          targets[i].body,
				TimeSensitive: true,
				Silent:        false,
			})
		}

		resp, err := h.fcm.SendEach(ctx, msgs)
		if err != nil || resp == nil {
			level := slog.LevelWarn
			if !errors.Is(err, fcm.ErrUnavailable) {
				level = slog.LevelError
			}
			h.log.Log(ctx, level, "geofence batch send failed",
				slog.String("type", jobType),
				slog.Int("batch_start", start),
				slog.Int("batch_size", end-start),
				slog.Any("err", err))
			continue
		}

		for j := 0; j < end-start; j++ {
			if j < len(resp.Responses) && resp.Responses[j] != nil {
				results[start+j] = resp.Responses[j].Success
			}
		}
	}
	return results
}

// buildGeofencePushLog는 Python push_log_add(push_service.py:143)의 컬럼 매핑을 구성한다.
//
//	plt_type=2(고정), sst_idx=refIdx(그룹=sst_idx / 내 장소=slt_idx 재활용), plt_read_chk='N',
//	plt_show='Y', plt_status: 성공 2 / 실패 4, plt_sdate=plt_wdate=now,
//	push_json={lat, lng, distance}.
func buildGeofencePushLog(tg *geofenceTarget, now time.Time, success bool) model.PushLog {
	pltType := 2
	status := 4
	if success {
		status = 2
	}
	idx := tg.mtIdx
	ref := tg.refIdx
	cond := tg.pltCond
	memo := tg.pltMemo
	ttl := tg.title
	cnt := tg.body
	readChk := "N"
	show := "Y"
	pj := tg.pushJSON
	sdate := now
	wdate := now
	return model.PushLog{
		PltType:      &pltType,
		MtIdx:        &idx,
		SstIdx:       &ref,
		PltCondition: &cond,
		PltMemo:      &memo,
		PltTitle:     &ttl,
		PltContent:   &cnt,
		PltSdate:     &sdate,
		PltStatus:    &status,
		PltReadChk:   &readChk,
		PltShow:      &show,
		PushJSON:     &pj,
		PltWdate:     &wdate,
		PltRdate:     nil,
	}
}

// ── 좌표/이름 헬퍼 ──────────────────────────────────────────────────────────

// parseCoord는 DECIMAL→문자열(*string) 좌표를 float로 파싱한다(Python float(record[...])).
// nil이거나 파싱 실패면 (0, false)를 돌려 호출자가 skip하도록 한다.
func parseCoord(s *string) (float64, bool) {
	if s == nil || *s == "" {
		return 0, false
	}
	v, err := strconv.ParseFloat(*s, 64)
	if err != nil {
		return 0, false
	}
	return v, true
}

// coordVal은 *float64 좌표를 값으로 변환한다(Python의 lat/long 0 폴백과 동등 — nil이면 0).
func coordVal(f *float64) float64 {
	if f == nil {
		return 0
	}
	return *f
}

// memberDisplayName은 Python member_payload/이름 산정(mt_nickname or mt_name or "회원")을 이식한다.
func memberDisplayName(m *model.Member) string {
	if m.MtNickname != nil && *m.MtNickname != "" {
		return *m.MtNickname
	}
	if m.MtName != nil && *m.MtName != "" {
		return *m.MtName
	}
	return memberNameFallback
}
