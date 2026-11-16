#!/usr/bin/env python3
"""스토어 스크린샷용 데모 데이터(가짜 서버 응답)를 만든다.

- 결과물
  - tools/store-demo/fixtures/*.json        : 원본(사람이 읽는 용도)
  - Android/app/src/debug/assets/demo/*.json : Android 디버그 빌드에서만 읽는다
  - iOS/smap/Core/Network/Demo/DemoFixtures.generated.swift : iOS #if DEBUG 에서만 컴파일
- 응답 모양은 운영 Go 서버(apps/api-go)의 DTO 와 테스트 계정의 실제 응답을 그대로 따른다.
- 날짜는 "오늘" 기준이어야 해서 토큰으로 넣고, 앱이 응답을 돌려줄 때 바꾼다.
    {{D+n}}   yyyy-MM-dd          {{MD+n}}  MM.dd
    {{DOW+n}} Mon..Sun            {{WE+n}}  true/false(주말)
    {{NOW-m}} 지금으로부터 m분 전 "yyyy-MM-dd HH:mm:ss"
- 실행: python3 tools/store-demo/build_fixtures.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / "tools/store-demo"
OUT_FIXTURES = HERE / "fixtures"
OUT_ANDROID = ROOT / "Android/app/src/debug/assets/demo"
OUT_IOS = ROOT / "iOS/smap/Core/Network/Demo/DemoFixtures.generated.swift"

GROUP_ID = 112137          # 테스트 그룹(실제 ID 유지 — 쓰기 요청은 실제 서버로 간다)
GROUP_TITLE = "우리 가족"

# ---------------------------------------------------------------------------
# 가족 구성. me 는 로그인한 테스트 계정(실제 mt_idx 유지).
# ---------------------------------------------------------------------------
ME = 9999962
FAMILY = [
    dict(mt_idx=ME, name="김지훈", nick="지훈", avatar="/images/avatar8.png", gender=1,
         owner=True, lat=37.5710, lng=126.9769, speed=0.0, battery=82, ago=2),
    dict(mt_idx=9900101, name="이수연", nick="수연", avatar="/images/avatar7.png", gender=2,
         owner=False, lat=37.5259, lng=126.9284, speed=0.0, battery=64, ago=4),
    dict(mt_idx=9900102, name="김민지", nick="민지", avatar="/images/avatar3.png", gender=2,
         owner=False, lat=37.5430, lng=126.9522, speed=1.2, battery=47, ago=1),
    dict(mt_idx=9900103, name="김준호", nick="준호", avatar="/images/avatar5.png", gender=1,
         owner=False, lat=37.5450, lng=126.9495, speed=0.0, battery=91, ago=6),
]
BY_ID = {m["mt_idx"]: m for m in FAMILY}

# 저장한 장소(내장소)
PLACES = [
    (1, "우리 집", "서울 마포구 공덕동", 37.5450, 126.9495),
    (2, "회사", "서울 종로구 세종대로", 37.5710, 126.9769),
    (3, "민지 학교", "서울 마포구 염리동", 37.5482, 126.9478),
    (4, "준호 학교", "서울 마포구 도화동", 37.5410, 126.9530),
    (5, "공덕 수학학원", "서울 마포구 공덕동", 37.5426, 126.9528),
    (6, "할머니 댁", "서울 서대문구 연희동", 37.5683, 126.9312),
]

# 일정: (id, 담당 mt_idx, 제목, 날짜 오프셋, 시작, 끝, 장소 번호 또는 None, 메모)
SCHEDULES = [
    (510001, 9900102, "수학학원", 0, "15:30", "18:00", 5, "교재 챙기기"),
    (510010, 9900103, "태권도", 0, "17:00", "18:00", None, "도복 챙기기"),
    (510002, ME, "가족 저녁 외식", 0, "19:00", "20:30", None, "여의도 한식당 예약"),
    (510003, 9900101, "치과 정기검진", 1, "11:00", "12:00", None, ""),
    (510004, 9900103, "축구 교실", 2, "16:00", "17:30", 4, "운동화"),
    (510005, ME, "할머니 댁 방문", 5, "12:00", "17:00", 6, "과일 사 가기"),
    (510006, 9900102, "영어 말하기 대회", 8, "10:00", "12:00", 3, ""),
    (510007, 9900101, "학부모 상담", -3, "17:00", "18:00", 3, ""),
    (510008, 9900103, "피아노 레슨", -1, "15:00", "16:00", None, ""),
    (510009, ME, "주말 캠핑", 12, "09:00", "18:00", None, "가평"),
]

# 오늘 이동: (mt_idx, 경로 파일, 출발 HH:MM, 걸린 분)
TRIPS = [
    (ME, "dad_commute", "08:02", 31),
    (ME, "dad_lunch", "12:05", 8),
    (ME, "dad_lunch_back", "12:56", 8),
    (9900102, "minji_school", "07:41", 9),
    (9900102, "minji_academy", "15:03", 14),
    (9900101, "mom_yeouido", "10:31", 24),
    (9900103, "junho_school", "08:11", 9),
    (9900103, "junho_home", "14:42", 9),
]
# 오늘 머문 곳: (mt_idx, 시작, 끝, 위도, 경도)
STAYS = [
    (ME, "06:40", "08:02", 37.5450, 126.9495),
    (ME, "08:33", "12:05", 37.5710, 126.9769),
    (ME, "12:13", "12:56", 37.5663, 126.9770),
    (ME, "13:04", "16:10", 37.5710, 126.9769),
    (9900102, "06:55", "07:41", 37.5450, 126.9495),
    (9900102, "07:50", "15:03", 37.5482, 126.9478),
    (9900102, "15:17", "16:10", 37.5426, 126.9528),
    (9900101, "07:00", "10:31", 37.5450, 126.9495),
    (9900101, "10:55", "16:05", 37.5259, 126.9284),
    (9900103, "07:10", "08:11", 37.5450, 126.9495),
    (9900103, "08:20", "14:42", 37.5410, 126.9530),
    (9900103, "14:51", "16:10", 37.5450, 126.9495),
]
STEPS = {ME: 6820, 9900101: 3410, 9900102: 4120, 9900103: 2310}

# 알림(최근 것이 위)
NOTIFICATIONS = [
    ("민지님이 학원에 도착했어요", "오후 3:17 · 공덕 수학학원", "장소 도착 알림", 0, "15:17:12", "N"),
    ("준호님이 우리 집에 도착했어요", "오후 2:51 · 우리 집", "장소 도착 알림", 0, "14:51:40", "N"),
    ("📅 새 일정이 추가되었습니다", "수연님이 일정 \"치과 정기검진\"을(를) 추가했습니다.", "일정 생성 알림", 0, "11:20:05", "Y"),
    ("수연님이 여의도에 도착했어요", "오전 10:55 · 더현대 서울", "장소 도착 알림", 0, "10:55:31", "Y"),
    ("민지님이 민지 학교에 도착했어요", "오전 7:50 · 민지 학교", "장소 도착 알림", 0, "07:50:20", "Y"),
    ("⏰ 곧 일정이 시작돼요", "\"피아노 레슨\" 일정이 30분 후에 시작됩니다.", "일정 알림", -1, "14:30:00", "Y"),
]


# ---------------------------------------------------------------------------
def tok(kind: str, n: int) -> str:
    return "{{%s%+d}}" % (kind, n)


def dt(day: int, hhmm: str, sep: str = " ") -> str:
    """오늘+day 의 날짜·시각 토큰 문자열."""
    if len(hhmm) == 5:
        hhmm += ":00"
    return f"{tok('D', day)}{sep}{hhmm}"


def hm_to_min(hhmm: str) -> int:
    h, m = hhmm.split(":")[:2]
    return int(h) * 60 + int(m)


def min_to_hms(total_sec: float) -> str:
    s = int(round(total_sec))
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


def haversine(a, b) -> float:
    (lng1, lat1), (lng2, lat2) = a, b
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def trip_points(route: str, start: str, minutes: int, step_sec: int = 12):
    """경로를 시간 축에 깔아 step_sec 마다 한 점씩 만든다(속도는 구간 평균)."""
    coords = json.loads((HERE / "routes" / f"{route}.json").read_text())["coordinates"]
    seg = [haversine(coords[i], coords[i + 1]) for i in range(len(coords) - 1)]
    total = sum(seg)
    dur = minutes * 60
    speed = total / dur
    pts, t = [], 0.0
    while t <= dur:
        d = total * t / dur
        acc = 0.0
        for i, s in enumerate(seg):
            if acc + s >= d or i == len(seg) - 1:
                f = 0 if s == 0 else (d - acc) / s
                lng = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * f
                lat = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * f
                break
            acc += s
        pts.append((hm_to_min(start) * 60 + t, round(lat, 7), round(lng, 7), speed))
        t += step_sec
    return pts, total


def build() -> dict[str, object]:
    fx: dict[str, object] = {}
    me = BY_ID[ME]

    fx["members_me"] = {
        "result": "Y",
        "data": {"mt_idx": ME, "mt_id": "jihoon@example.com", "mt_name": me["name"], "mt_nickname": me["nick"],
                 "mt_hp": None, "mt_email": "jihoon@example.com", "mt_birth": None, "mt_gender": me["gender"],
                 "mt_type": 1, "mt_level": 2, "mt_file1": me["avatar"], "mt_wdate": "2025-03-02T09:00:00"},
        "message": "프로필 조회가 성공했습니다.", "success": True,
    }
    fx["groups_current_user"] = [{
        "sgt_idx": GROUP_ID, "mt_idx": ME, "sgt_title": GROUP_TITLE, "sgt_code": "K7FAMILY25", "sgt_memo": "",
        "sgt_show": "Y", "sgt_wdate": "2025-03-02T09:10:00", "sgt_udate": dt(0, "09:00", "T"),
        "member_count": len(FAMILY), "is_owner": True, "is_leader": False, "join_date": "2025-03-02T09:10:00",
    }]
    fx["groups_summary"] = {"group_count": 1, "total_members": len(FAMILY)}

    week = [s for s in SCHEDULES if -7 < s[3] <= 0]
    fx["group_stats"] = {
        "group_id": GROUP_ID, "group_title": GROUP_TITLE, "member_count": len(FAMILY),
        "weekly_schedules": len(week), "total_locations": len(PLACES),
        "stats_period": {"start_date": dt(-7, "09:00", "T"), "end_date": dt(0, "09:00", "T"), "days": 7},
        "member_stats": [{
            "mt_idx": m["mt_idx"], "mt_name": m["name"], "mt_nickname": m["nick"],
            "weekly_schedules": sum(1 for s in week if s[1] == m["mt_idx"]),
            "total_locations": len(PLACES) if m["mt_idx"] == ME else 0, "weekly_locations": 0,
            "is_owner": m["owner"], "is_leader": False,
        } for m in FAMILY],
    }
    fx["group_members"] = [{
        "sgdt_idx": 2565 + i, "sgt_idx": GROUP_ID, "mt_idx": m["mt_idx"],
        "sgdt_owner_chk": "Y" if m["owner"] else "N", "sgdt_leader_chk": "N",
        "mt_name": m["name"], "mt_nickname": m["nick"], "mt_birth": None, "mt_file1": m["avatar"],
        "mt_gender": m["gender"], "mt_status": 1, "mt_weather_pop": None, "mt_weather_tmn": None,
        "mt_weather_tmx": None, "mt_weather_sky": None, "mt_weather_date": None,
        "mlt_lat": m["lat"], "mlt_long": m["lng"], "mlt_speed": m["speed"], "mlt_battery": m["battery"],
        "mlt_gps_time": tok("NOW", -m["ago"]), "id": str(m["mt_idx"]), "name": m["name"],
        "photo": m["avatar"], "isSelected": False,
    } for i, m in enumerate(FAMILY)]

    place = {p[0]: p for p in PLACES}
    # GET /schedules/group/{id} (Android) — ScheduleGroupItem, 날짜는 isoformat(T)
    fx["schedules_group"] = []
    # GET /schedule/group/{id}/schedules (iOS) — GSMGroupSchedule, 날짜는 "yyyy-MM-dd HH:mm:ss"
    gsm = []
    for sid, mid, title, day, s, e, pid, memo in SCHEDULES:
        p = place.get(pid) if pid else None
        m = BY_ID[mid]
        fx["schedules_group"].append({
            "id": sid, "sst_pidx": None, "mt_schedule_idx": mid, "title": title, "date": dt(day, s, "T"),
            "sst_edate": dt(day, e, "T"), "sst_sedate": None, "sst_all_day": "N",
            "sst_repeat_json": "", "sst_repeat_json_v": "", "sgt_idx": GROUP_ID, "sgdt_idx": None,
            "sgdt_idx_t": None, "sst_alram": None, "sst_alram_t": None, "sst_adate": None,
            "slt_idx": pid, "slt_idx_t": None, "location": p[1] if p else None,
            "sst_location_add": p[2] if p else None, "sst_location_lat": p[3] if p else None,
            "sst_location_long": p[4] if p else None, "sst_supplies": None, "sst_memo": memo,
            "sst_show": "Y", "sst_location_alarm": None, "sst_schedule_alarm_chk": "Y",
            "sst_pick_type": None, "sst_pick_result": None, "sst_schedule_alarm": None,
            "sst_update_chk": None, "sst_wdate": dt(-10, "09:00", "T"), "sst_udate": None,
            "sst_ddate": None, "sst_in_chk": None, "sst_schedule_chk": None,
            "sst_entry_cnt": None, "sst_exit_cnt": None,
        })
        gsm.append({
            "sst_idx": sid, "sst_pidx": None, "mt_idx": mid, "sst_title": title,
            "sst_sdate": dt(day, s), "sst_edate": dt(day, e), "sst_sedate": None, "sst_all_day": "N",
            "sst_repeat_json": "", "sst_repeat_json_v": "", "sgt_idx": GROUP_ID, "sgdt_idx": None,
            "sgdt_idx_t": None, "sst_alram": None, "sst_alram_t": None, "sst_adate": None,
            "slt_idx": pid, "slt_idx_t": None, "sst_location_title": p[1] if p else None,
            "sst_location_add": p[2] if p else None, "sst_location_lat": p[3] if p else None,
            "sst_location_long": p[4] if p else None, "sst_supplies": None, "sst_memo": memo,
            "sst_show": "Y", "sst_location_alarm": None, "sst_schedule_alarm_chk": "Y",
            "sst_pick_type": None, "sst_pick_result": None, "sst_schedule_alarm": None,
            "sst_update_chk": None, "sst_wdate": dt(-10, "09:00"), "sst_udate": None, "sst_ddate": None,
            "sst_in_chk": None, "sst_schedule_chk": None, "sst_entry_cnt": None, "sst_exit_cnt": None,
            "member_name": m["nick"], "member_photo": m["avatar"], "id": str(sid), "title": title,
            "date": dt(day, s), "location": p[1] if p else None, "memberId": str(mid),
        })
    fx["schedules_gsm"] = {
        "success": True,
        "data": {
            "schedules": gsm,
            "groupMembers": [{"mt_idx": m["mt_idx"], "mt_name": m["name"], "mt_file1": m["avatar"],
                              "sgt_idx": GROUP_ID, "sgdt_idx": 2565 + i,
                              "sgdt_owner_chk": "Y" if m["owner"] else "N", "sgdt_leader_chk": "N"}
                             for i, m in enumerate(FAMILY)],
            "userPermission": {"canManage": True, "isOwner": True, "isLeader": False},
        },
    }

    # GET /locations/member/{mid} — 서버 LocationResponse(좌표는 문자열)
    fx["locations_member"] = [{
        "insert_mt_idx": ME, "mt_idx": ME, "sgdt_idx": 2565, "slt_title": t, "slt_add": a,
        "slt_lat": str(lat), "slt_long": str(lng), "slt_fine_location": None, "slt_location_chk": None,
        "slt_all_day": None, "slt_show": "Y", "slt_enter_alarm": "Y", "slt_enter_chk": "N",
        "slt_idx": 880000 + i, "slt_wdate": dt(-30, "09:00", "T"), "slt_udate": None, "slt_ddate": None,
    } for i, t, a, lat, lng in PLACES]

    fx["push_logs"] = [{
        "plt_type": 2, "mt_idx": ME, "sst_idx": None, "plt_condition": cond, "plt_memo": "",
        "plt_title": title, "plt_content": body, "plt_sdate": dt(day, hms, "T"), "plt_status": 2,
        "plt_read_chk": read, "plt_show": "Y", "push_json": None, "plt_idx": 1990000 - i,
        "plt_wdate": dt(day, hms, "T"), "plt_rdate": dt(day, hms, "T") if read == "Y" else None,
    } for i, (title, body, cond, day, hms, read) in enumerate(NOTIFICATIONS)]

    fx["chat_rooms"] = {"rooms": [{
        "scr_idx": 2234, "sgt_idx": GROUP_ID, "scr_type": "group", "scr_title": GROUP_TITLE,
        "scr_udate": dt(0, "15:32", "T"), "unread_count": 2, "last_message": "학원 도착! 끝나면 연락할게요",
        "last_message_time": dt(0, "15:32", "T"), "member_count": len(FAMILY),
        "dm_target_nickname": None, "dm_target_file1": None,
    }], "total_unread": 2}

    # 활동 로그: 멤버별 오늘 이동 점·요약·머문 곳
    counts = {}
    for m in FAMILY:
        mid = m["mt_idx"]
        pts, dist, move_min = [], 0.0, 0
        for tmid, route, start, minutes in TRIPS:
            if tmid != mid:
                continue
            p, d = trip_points(route, start, minutes)
            pts += p
            dist += d
            move_min += minutes
        pts.sort()
        fx[f"markers_{mid}"] = {"result": "Y", "data": [{
            "mlt_idx": 7700000 + mid % 1000 * 1000 + k, "mt_idx": mid,
            "mlt_gps_time": f"{tok('D', 0)} {min_to_hms(t)}", "mlt_speed": round(sp, 5),
            "mlt_lat": lat, "mlt_long": lng, "mlt_accuacy": 5.0, "mt_health_work": 0,
            "mlt_battery": max(m["battery"], 30), "mlt_fine_location": "N", "mlt_location_chk": "N",
            "mlt_wdate": None, "stay_lat": None, "stay_long": None,
        } for k, (t, lat, lng, sp) in enumerate(pts)], "total_markers": len(pts)}
        h, mm = divmod(move_min, 60)
        fx[f"summary_{mid}"] = {"result": "Y", "data": {
            "schedule_count": str(sum(1 for s in SCHEDULES if s[1] == mid and s[3] == 0)),
            "distance": f"{dist / 1000:.1f}km", "duration": f"{h}시간 {mm}분" if h else f"{mm}분",
            "steps": STEPS[mid]}, "message": "위치 로그 요약 조회 성공"}
        stays = [s for s in STAYS if s[0] == mid]
        fx[f"stays_{mid}"] = {"result": "Y", "data": [{
            "label": "stay", "grp": g, "start_time": dt(0, a), "end_time": dt(0, b),
            "duration": float(hm_to_min(b) - hm_to_min(a)), "distance": 0.0, "start_lat": lat, "start_long": lng,
        } for g, (_, a, b, lat, lng) in enumerate(stays)], "total_stays": len(stays)}
        counts[mid] = len(pts)

    # 최근 14일 활동 기록 수
    def day_row(n: int, c: int) -> dict:
        return {"date": tok("D", -n), "count": c, "formatted_date": tok("MD", -n),
                "day_of_week": tok("DOW", -n), "is_today": n == 0, "is_weekend": tok("WE", -n)}
    pattern = [0, 820, 640, 910, 0, 760, 880, 700, 0, 530, 940, 610, 820, 0]
    mdc = []
    for m in FAMILY:
        mid = m["mt_idx"]
        rows = [day_row(n, counts[mid] if n == 0 else int(pattern[n] * (0.6 + (mid % 7) * 0.08)))
                for n in range(14)]
        mdc.append({"member_id": mid, "member_name": m["name"], "mt_nickname": m["nick"],
                    "member_photo": m["avatar"], "member_gender": m["gender"], "daily_counts": rows})
    fx["daily_counts"] = {
        "member_daily_counts": mdc,
        "total_daily_counts": [day_row(n, sum(r["daily_counts"][n]["count"] for r in mdc)) for n in range(14)],
        "total_days": 14, "start_date": tok("D", -13), "end_date": tok("D", 0),
        "group_id": GROUP_ID, "total_members": len(FAMILY),
    }
    fx["empty_markers"] = {"result": "Y", "data": [], "total_markers": 0}
    fx["empty_stays"] = {"result": "Y", "data": [], "total_stays": 0}
    fx["empty_summary"] = {"result": "Y", "data": {"schedule_count": "0", "distance": "0.0km",
                                                   "duration": "0분", "steps": 0},
                           "message": "위치 로그 요약 조회 성공"}
    return fx


# 요청 → 응답 규칙. 경로는 /api/v1/ 뒤 부분, "*" 는 한 칸, "{mid}" 는 한 칸을 받아 응답 이름에 넣는다.
# todayOnly: 쿼리 date 가 오늘이 아니면 fallback 을 준다(활동 로그의 다른 날짜는 빈 화면).
MANIFEST = [
    {"path": "members/me", "fixture": "members_me"},
    {"path": "groups/current-user", "fixture": "groups_current_user"},
    {"path": "groups/current-user/summary", "fixture": "groups_summary"},
    {"path": "groups/*/stats", "fixture": "group_stats"},
    {"path": "group-members/member/*", "fixture": "group_members"},
    {"path": "schedules/group/*", "fixture": "schedules_group"},
    {"path": "schedule/group/*/schedules", "fixture": "schedules_gsm"},
    {"path": "locations/member/*", "fixture": "locations_member"},
    {"path": "push-logs/member/*", "fixture": "push_logs"},
    {"path": "chats/rooms", "fixture": "chat_rooms"},
    {"path": "logs/daily-counts", "fixture": "daily_counts"},
    {"path": "logs/member-location-logs/{mid}/map-markers", "fixture": "markers_{mid}",
     "fallback": "empty_markers", "todayOnly": True},
    {"path": "logs/member-location-logs/{mid}/summary", "fixture": "summary_{mid}",
     "fallback": "empty_summary", "todayOnly": True},
    {"path": "logs/member-location-logs/{mid}/stay-times", "fixture": "stays_{mid}",
     "fallback": "empty_stays", "todayOnly": True},
]


def to_text(obj) -> str:
    """JSON 문자열로 바꾸되 {{WE±n}} 토큰은 따옴표를 벗겨 true/false 자리에 둔다."""
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    for n in range(-40, 41):
        s = s.replace(f'"{tok("WE", n)}"', tok("WE", n))
    return s


def main() -> None:
    fx = build()
    texts = {name: to_text(obj) for name, obj in fx.items()}
    manifest = json.dumps(MANIFEST, ensure_ascii=False, separators=(",", ":"))

    for d in (OUT_FIXTURES, OUT_ANDROID):
        d.mkdir(parents=True, exist_ok=True)
        for old in d.glob("*.json"):
            old.unlink()
        (d / "manifest.json").write_text(manifest + "\n")
        for name, text in texts.items():
            (d / f"{name}.json").write_text(text + "\n")

    OUT_IOS.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "// 자동 생성 파일 — 직접 고치지 말고 tools/store-demo/build_fixtures.py 를 실행한다.",
        "// 스토어 스크린샷용 데모 응답. 디버그 빌드에만 들어간다.",
        "#if DEBUG",
        "import Foundation",
        "",
        "enum DemoFixtures {",
        f'    static let manifest = #"{manifest}"#',
        "",
        "    static let files: [String: String] = [",
    ]
    for name, text in sorted(texts.items()):
        lines.append(f'        "{name}": #"{text}"#,')
    lines += ["    ]", "}", "#endif", ""]
    OUT_IOS.write_text("\n".join(lines))
    print(f"fixtures {len(texts)}개 → {OUT_FIXTURES.relative_to(ROOT)}, {OUT_ANDROID.relative_to(ROOT)}, "
          f"{OUT_IOS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
