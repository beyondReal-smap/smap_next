package service

import "time"

// dbUTCNow는 Python `datetime.utcnow()`(naive UTC 벽시계)와 동일한 값을 DB에 저장하기 위한 공용 헬퍼.
//
// ⚠️ DSN이 loc=Local이라 go-sql-driver는 time.Time을 저장할 때 Local로 변환한다(t.In(Local)).
// time.Now().UTC()를 그대로 넘기면 KST 변환분(+9h)이 저장돼 Python(UTC 벽시계)과 9시간 어긋난다.
// 그래서 현재 UTC 벽시계 숫자를 Local 존으로 감싸 반환 → 드라이버가 무변환 후 UTC 벽시계 문자열을 저장한다.
// (서버 TZ가 무엇이든 UTC 벽시계가 보존된다.) pyISO로 응답에 쓸 때도 동일 벽시계를 출력한다.
//
// 적용 대상: Python이 `datetime.utcnow()`로 저장하는 모든 write 사이트(auth, groups-write, chat,
// refresh[repository.dbNow와 동일 로직]). ⚠️Python이 `datetime.now()`(KST)를 쓰는 Phase 3 잡은
// time.Now()(로컬)를 그대로 써야 하므로 이 헬퍼를 쓰지 않는다(loc=Local에서 이미 일치).
func dbUTCNow() time.Time {
	u := time.Now().UTC()
	return time.Date(u.Year(), u.Month(), u.Day(), u.Hour(), u.Minute(), u.Second(), u.Nanosecond(), time.Local)
}
