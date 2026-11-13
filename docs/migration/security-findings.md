# 보안 발견 — Python→Go 이식 중 식별 (의사결정 필요)
> 워크플로 인벤토리 분석에서 자동 식별 · 분류 **43건**.
> ⚠️ 설계서 비목표("클라이언트 API 계약·인증 방식 변경 없음")와 충돌 → 이식 정책 결정 필요.

## 처리 방침 (권장)
1. **동등 이식 우선** — 무인증을 그대로 옮기고 canary 응답 비교. 보안 변경은 별도 트랙.
2. **앱 토큰 송신 여부 선확인** — 앱이 이미 Authorization 헤더를 보내면 인증 게이트 추가 비용 낮음. 안 보내면 앱 릴리스 필요.
3. **명백한 디버그/테스트는 이식 제외** (`정리` 섹션).
4. **P1 항목은 대표님 의사결정** — 동등 이식 vs 이식 시 인증 추가.

## P1 · 무인증 쓰기/삭제 (17건)
> 인증 없이 임의 리소스 생성/수정/삭제 가능. 수평 인가 전면 부재.

| 도메인 | Method | Path | auth | 비고 |
|--------|--------|------|------|------|
| auth | POST | `/users/` | none | 인증 없음. 비밀번호 해싱/검증 없이 raw dict 그대로 저장 — 보안 우려. 이식 시 사용처 확인 후 노출 여부 결정 권장 |
| auth | PUT | `/users/{user_id}` | none | 인증 없음(임의 회원 수정 가능 — 보안 우려). exclude_unset=True 부분 갱신 |
| auth | DELETE | `/users/{user_id}` | none | 인증 없음 + soft delete 아닌 물리 삭제(mt_level=1 탈퇴 정책과 불일치) — 보안/데이터 정합성 우려. 이식 시 정책 재검토 권장 |
| member | POST | `/members/` | none | 인증 없이 Member(**member_in.dict())로 직접 생성 — 비번 해싱 없음, register와 별개. 보안 검토 필요. 관리/내부용 추정. |
| group | POST | `/groups/{group_id}/join-new-member` | none | 회원가입 직후 호출용 의도로 무인증. /join과 달리 재가입 조건이 (show='Y' AND exit='N'), 재가입 시 sgdt_discharge='N'도 초기화. 채팅 추가 호출 없음(차이점). 무인증 mt_idx 임의 가입 가능 |
| group | POST | `/group-details/` | none | **스키마 컬럼 불일치 주의**: GroupDetailBase는 sgdt_discharge_chk/sgdt_exit_chk/sgdt_in_chk/sgdt_schedule_chk/sgdt_read_chk/sgdt_enter_alarm/sgdt_enter |
| group | POST | `/group-members/add` | none | group_id/member_id가 query 파라미터로 전달됨(POST지만 body 미사용). 이미 show='Y' 존재 시 success:false 반환(200 유지). 신규 생성 시 sgdt_show만 세팅(다른 chk 필드 미설정). 무인증 |
| location | POST | `/locations/` | none | 인증 없는 쓰기 + mt_idx 하드코딩 기본값 282(보안/데이터 무결성 위험). Pydantic 스키마 미사용, dict 직접 파싱 후 text() INSERT. 좌표 검증 실패를 기본값으로 흡수(에러 뭉개기). slt_title 100자/slt_ |
| location | POST | `/locations/members/{member_id}/locations` | none | 다중 raw SQL(멤버검증→그룹조회→INSERT→LAST_INSERT_ID→재조회). 인증 없는 쓰기. sgdt_idx/sgt_idx 폴백 641 하드코딩(데이터 무결성 위험). 그룹 자동선택은 sgdt_show=Y 첫 행. Go 이식 시 단일 트랜 |
| schedule | POST | `/api/v1/schedules/` | none | Schedule(**dict()) 단순 생성. 권한/그룹 검증 없음. 반복일정/알림계산/푸시 없음(group_schedule_manage 쪽과 별개). Go: GORM Create |
| push | POST | `/push-logs/` | none | 중복 로그 차단 분기(API3_FCM_service/system_auto) Go에서 그대로 이식 필수 — 누락 시 스케줄러 중복 로그 발생. 더미 응답 시 plt_idx=0 반환 계약 유지. |
| push | DELETE | `/push-logs/{push_log_id}` | none | 실제 row 삭제(soft delete 아님). delete-all과 동작이 다름 주의. |
| push | POST | `/push-fcms/` | none | 단순 모델 매핑 INSERT. |
| push | DELETE | `/push-fcms/{push_fcm_id}` | none | 물리 삭제. |
| push | POST | `/fcm_sendone/` | none | mt_idx==0 분기: Member.get_token_list() 후 한 명씩 순차 send(N건 개별 호출, 배치 아님 → N+1/성능 이슈). plt_type=='admin'이면 로그 저장 시 '1'로 변환(Integer 컬럼 대응). 응답 성공 |
| push | POST | `/fcm_sendone/background` | none | 엔드포인트 로컬 BaseModel(BackgroundPushRequest)로 스키마 정의 — schemas/ 외부 아님. status 코드 매핑(2~7) 비즈니스 규칙 정확 이식 필수. apns content_available, 90일 만료 등 페이로 |
| misc_write | POST | `/sms/verify-code` | none | Go 이식: secrets.compare_digest → crypto/subtle.ConstantTimeCompare(타이밍 공격 방지 — 단순 == 금지). 코드 미요청시 '먼저 요청' 에러. 검증 성공 후 코드 즉시 삭제 + verified 마킹( |

## P1 · 인증 후 수평인가 부재 (4건)
> 로그인만 하면 타 사용자 리소스 조작 가능.

| 도메인 | Method | Path | auth | 비고 |
|--------|--------|------|------|------|
| member | POST | `/member-fcm-token/validate-and-refresh` | required | 수평인가 없음(여기는 _check_horizontal_authorization 미호출 — 다른 토큰 엔드포인트와 불일치, 검토 필요). 만료/변경/30일 미갱신 등 needs_refresh 다중 분기. firebase messaging.Message  |
| member | POST | `/member-fcm-token/background-check` | required | 수평인가 미호출(검토 필요). is_preview_token(길이<100 or '...' 끝 or 형식불일치) 판단 후 DB 실제토큰과 비교 분기. 2시간 중복방지, 85일 미갱신 갱신. 미리보기 토큰이면 DB 토큰 미갱신. 분기 복잡 — Go 이식  |
| member | POST | `/member-fcm-token/notify-token-refresh` | required | 수평인가 없음. mt_idx를 query로 받음(타 회원 지정 가능, 검토). firebase_service._send_token_refresh_notification 호출(내부 private 메서드 의존). 실제 알림은 미구현(로그만). |
| misc_write | PUT | `/orders/status/{order_id}` | required | Go 이식 보안 주의: 인증만 통과하면 임의 order_id의 상태를 누구나 변경 가능(소유자/관리자 검증 없음) — 이식 시 권한 누락 그대로 옮기지 말고 검토 필요(P1 잠재 취약). status는 query string 파라미터. response |

## P1 · 무인증 발송/파일 I/O (6건)
> 누구나 전체 푸시 발송·파일 업로드·OpenAI 비용 유발 가능.

| 도메인 | Method | Path | auth | 비고 |
|--------|--------|------|------|------|
| push | POST | `/fcm_sendone/silent-batch` | none | Member.get_token_list() 후 사용자별 순차 send(배치 미사용 → N+1). 운영상 관리/스케줄러 트리거 성격인데 인증 없음(공개) — Go 이식 시 admin 권한 부여 검토 강력 권장. send_each 배치 전환 권장. |
| misc_write | GET | `/hwgi/all-data` | none | Go 이식 핵심: (1) raw SQL text()로 3테이블 전체 SELECT(WHERE 없음 — 전건 로드, 데이터 증가시 성능 위험) 후 Python 메모리에서 지점별 dict 조립. GORM raw 또는 명시 SQL. (2) ORM 모델 없음  |
| misc_write | POST | `/hwgi/bulk-save` | none | Go 이식 핵심: (1) 명시적 트랜잭션(commit/rollback) — GORM tx.Begin/Commit/Rollback. (2) upsert를 SELECT 후 UPDATE/INSERT 분기로 수동 구현 — N+1(items 개수만큼 SELEC |
| misc_write | POST | `/hwgi/upload-photo` | none | Go 이식 핵심: (1) base64 디코딩 — data URI prefix('data:...,') 있으면 split. Go base64.StdEncoding. (2) 파일명 ts(ms)+uuid4 hex 8자, 디렉토리 자동 생성(os.MkdirAl |
| misc_write | DELETE | `/hwgi/delete-photo/{photo_id}` | none | Go 이식: (1) DB에서 ip_file_path 조회 후 BACKEND_DIR/storage/{path.lstrip('/')} 경로 파일 삭제. lstrip('/')로 선행 슬래시 제거 후 join — Go에선 filepath.Join 경로 tra |
| misc_write | POST | `/hwgi/generate-report` | none | Go 이식 핵심: (1) settings.OPENAI_API_KEY/OPENAI_MODEL 참조하나 config.py에 해당 필드 정의 없음(extra='ignore') — 현재 settings 속성 접근시 AttributeError 가능성(잠재 버그 |

## P2 · 무인증 정보 노출 (8건)
> 인증 없이 전체 회원/PII/내부 데이터 조회.

| 도메인 | Method | Path | auth | 비고 |
|--------|--------|------|------|------|
| auth | GET | `/users/` | none | 인증 없음(보안 우려: 전체 회원 노출). Go 이식 시 인증 게이트 검토 권장 |
| member | GET | `/members/` | none | 인증 없이 전체 회원 목록 노출(limit 기본 10000) — 보안 검토 필요. _member_to_dict가 None 안전변환+날짜 isoformat. id 있으면 단건도 리스트로 래핑 반환. |
| member | DELETE | `/members/{member_id}` | none | 인증 없이 누구나 삭제 가능 — 보안 검토 필요. 실제 삭제 아닌 status 변경. |
| group | GET | `/group-details/` | none | 필터 없이 전체 offset/limit. 무인증 전체 노출 주의 |
| group | PUT | `/group-details/{group_detail_id}/role` | none | 'Y'면 LeaderCheckEnum.Y 아니면 N. 무인증(누구나 리더 임명 가능-권한 미흡, 보안 검토 필요) |
| group | PUT | `/group-members/{group_id}/role` | none | **느슨한 계약**: body가 raw dict로 member_id/mt_idx, is_leader/sgdt_leader_chk 다중 키 폴백 + bool/str 타입 분기 처리. Go 이식 시 명시적 구조체+검증으로 변환 권장(400 if no me |
| location | GET | `/locations/` | none | 인증 전혀 없음(공개). slt_ddate(삭제) 필터 없이 전체 반환 — Go 이식 시 소유권/노출 정책 재검토 필요. Row 매핑 방식이 다른 엔드포인트와 미묘하게 다름 |
| push | GET | `/push-logs/` | none | 단순 offset/limit. mt_idx 필터 없는 전역 조회 — Go 이식 시 GORM Offset().Limit().Order("plt_idx desc"). 인증 없음 주의(전체 사용자 로그 노출). 응답 enum 필드는 Y/N 문자열. |

## P2 · 에러/토큰 정보 노출 (3건)
> 예외 메시지·토큰 평문이 응답/로그로 유출.

| 도메인 | Method | Path | auth | 비고 |
|--------|--------|------|------|------|
| auth | GET | `/users/email/{email}` | none | Member 모델 클래스메서드 find_by_email 사용. except 시 500+str(e)로 내부 에러 노출(보안 우려) |
| auth | GET | `/users/token/{token}` | none | 여기 token은 JWT 아닌 mt_token_id(FCM) 추정. Member.find_by_token 모델 메서드 의존. except 500 노출 |
| member | GET | `/member-fcm-token/full-token/{mt_idx}` | required | settings.DEBUG False면 404. 전체 토큰 평문 노출(보안 민감) — DEBUG 가드 필수 유지. 수평인가 없음. |

## 정리 · 디버그/데드 코드 (5건)
> 하드코딩 디버그·테스트 엔드포인트. 이식 제외 권장.

| 도메인 | Method | Path | auth | 비고 |
|--------|--------|------|------|------|
| member | POST | `/member-fcm-token/cleanup-expired-tokens` | none | 주석상 '관리자용'이지만 인증 Depends 없음(보안 검토 필요). 만료 토큰 전체 조회 후 실제 초기화 로직은 주석처리되어 no-op(cleaned_count 증가만). mt_push1=='Y' 알림은 로그만. Go 이식 시 현 동작(no-op)  |
| group | POST | `/groups/emergency-restore` | none | mt_idx=1186 하드코딩된 운영 임시/디버그 엔드포인트. 인증 없음. Go 이식 대상에서 제외 검토 권장(데드/위험 코드-언급만) |
| location | GET | `/logs/member-location-logs/{mt_idx}/path` | none | 데드 라우트 — line 563의 동일경로 GET이 먼저 등록되어 이 핸들러(line 602)는 실행되지 않음. 기능은 act=get_daily_location_path(디스패처)로 접근 가능. Go 이식 시 경로 분리 또는 제거 결정 필요 |
| push | POST | `/push-fcms/mark-delivered/{push_fcm_id}` | none | PushFCM 모델에 delivered_at 컬럼 미존재 → hasattr False → 실제 변경 없이 commit. 데드 로직에 가까움. Go 이식 시 'delivered 상태 컬럼이 없다'는 사실 확인 후 no-op 또는 신규 컬럼 도입 결정 필 |
| push | POST | `/fcm_sendone/test-send/{mt_idx}` | none | Member.find_by_idx 후 토큰/Firebase 가용성 체크 → 단건 send. 운영에 노출된 테스트 엔드포인트(공개) — Go 이식 시 보호/제거 검토. |
