# 그룹 스케줄 관리 API (Python FastAPI)

## 개요
이 API는 Python FastAPI를 사용하여 구현된 그룹 스케줄 관리 시스템입니다. 로그인한 멤버의 그룹 권한에 따라 스케줄을 관리할 수 있습니다.

## 권한 시스템
- **그룹 오너** (`sgdt_owner_chk = 'Y'`): 모든 멤버의 스케줄 CRUD 가능
- **그룹 리더** (`sgdt_leader_chk = 'Y'`): 모든 멤버의 스케줄 CRUD 가능
- **일반 멤버**: 자신의 스케줄만 CRUD 가능, 다른 멤버 스케줄은 조회만 가능

## API 엔드포인트

### 1. 그룹 스케줄 조회
**URL:** `GET /api/v1/schedule/group/{group_id}/schedules`

**Query Parameters:**
- `group_id` (path, required): 그룹 ID
- `current_user_id` (query, required): 현재 사용자 ID
- `start_date` (query, optional): 시작 날짜 (YYYY-MM-DD)
- `end_date` (query, optional): 종료 날짜 (YYYY-MM-DD)
- `member_id` (query, optional): 특정 멤버 ID

**Response:**
```json
{
  "success": true,
  "data": {
    "schedules": [
      {
        "sst_idx": 1,
        "mt_idx": 123,
        "sst_title": "회의",
        "sst_sdate": "2024-01-15T09:00:00",
        "sst_edate": "2024-01-15T10:00:00",
        "sst_all_day": "N",
        "sst_location_title": "회의실 A",
        "sst_location_add": "서울시 강남구...",
        "sst_memo": "프로젝트 진행 상황 논의",
        "member_name": "김철수",
        "member_photo": "profile.jpg",
        "id": "1",
        "title": "회의",
        "date": "2024-01-15T09:00:00",
        "location": "회의실 A",
        "memberId": "123"
      }
    ],
    "groupMembers": [
      {
        "mt_idx": 123,
        "mt_name": "김철수",
        "mt_file1": "profile.jpg",
        "sgt_idx": 1,
        "sgdt_idx": 456,
        "sgdt_owner_chk": "Y",
        "sgdt_leader_chk": "N"
      }
    ],
    "userPermission": {
      "canManage": true,
      "isOwner": true,
      "isLeader": false
    }
  }
}
```

### 2. 그룹 스케줄 생성
**URL:** `POST /api/v1/schedule/group/{group_id}/schedules`

**Query Parameters:**
- `group_id` (path, required): 그룹 ID
- `current_user_id` (query, required): 현재 사용자 ID

**Request Body:**
```json
{
  "sst_title": "새 회의",
  "sst_sdate": "2024-01-15T09:00:00",
  "sst_edate": "2024-01-15T10:00:00",
  "sst_all_day": "N",
  "targetMemberId": 123,
  "sst_location_title": "회의실 B",
  "sst_location_add": "서울시 강남구...",
  "sst_memo": "신규 프로젝트 킥오프",
  "sst_alram": 1,
  "sst_schedule_alarm_chk": "Y"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sst_idx": 302633,
    "message": "Schedule created successfully"
  }
}
```

### 3. 그룹 스케줄 수정
**URL:** `PUT /api/v1/schedule/group/{group_id}/schedules/{schedule_id}`

**Query Parameters:**
- `group_id` (path, required): 그룹 ID
- `schedule_id` (path, required): 스케줄 ID
- `current_user_id` (query, required): 현재 사용자 ID

**Request Body:**
```json
{
  "sst_title": "수정된 회의",
  "sst_sdate": "2024-01-15T10:00:00",
  "sst_edate": "2024-01-15T11:00:00",
  "sst_all_day": "N",
  "sst_location_title": "회의실 C",
  "sst_memo": "시간 변경됨"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Schedule updated successfully"
  }
}
```

### 4. 그룹 스케줄 삭제
**URL:** `DELETE /api/v1/schedule/group/{group_id}/schedules/{schedule_id}`

**Query Parameters:**
- `group_id` (path, required): 그룹 ID
- `schedule_id` (path, required): 스케줄 ID
- `current_user_id` (query, required): 현재 사용자 ID

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Schedule deleted successfully"
  }
}
```

## 파일 구조

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   └── group_schedule_manage.py  # 그룹 스케줄 관리 엔드포인트
│   │       └── api.py                        # API 라우터 등록
│   ├── schemas/
│   │   └── group_schedule.py                 # 그룹 스케줄 스키마
│   └── models/
│       ├── schedule.py                       # 스케줄 모델
│       ├── member.py                         # 멤버 모델
│       ├── group.py                          # 그룹 모델
│       └── group_detail.py                   # 그룹 상세 모델
```

## 주요 클래스

### GroupScheduleManager
그룹 스케줄 관리를 위한 유틸리티 클래스입니다.

**주요 메서드:**
- `check_group_permission()`: 그룹 권한 확인
- `has_manage_permission()`: 관리 권한 확인
- `get_group_members()`: 그룹 멤버 목록 조회

## 데이터베이스 스키마

### 주요 테이블
- `smap_schedule_t`: 스케줄 정보
- `member_t`: 멤버 정보
- `smap_group_t`: 그룹 정보
- `smap_group_detail_t`: 그룹 멤버 상세 정보 (권한 포함)

### 권한 확인 쿼리
```sql
SELECT 
    m.mt_idx,
    m.mt_name,
    sgd.sgt_idx,
    sgd.sgdt_idx,
    sgd.sgdt_owner_chk,
    sgd.sgdt_leader_chk,
    sgd.sgdt_discharge,
    sgd.sgdt_exit
FROM member_t m
JOIN smap_group_detail_t sgd ON m.mt_idx = sgd.mt_idx
JOIN smap_group_t sg ON sgd.sgt_idx = sg.sgt_idx
WHERE m.mt_idx = :user_id 
    AND sgd.sgt_idx = :group_id 
    AND sgd.sgdt_discharge = 'N' 
    AND sgd.sgdt_exit = 'N'
    AND sg.sgt_show = 'Y'
```

## 에러 처리

### HTTP 상태 코드
- `200`: 성공
- `400`: 잘못된 요청 (필수 필드 누락 등)
- `401`: 인증 실패
- `403`: 권한 부족
- `404`: 리소스를 찾을 수 없음
- `500`: 서버 내부 오류

### 에러 응답 형식
```json
{
  "detail": "Error message"
}
```

## 사용 예시

### Python 클라이언트 예시
```python
import requests

# 그룹 스케줄 조회
response = requests.get(
    f"http://localhost:8000/api/v1/schedule/group/{group_id}/schedules",
    params={"current_user_id": user_id}
)

# 스케줄 생성
schedule_data = {
    "sst_title": "새 회의",
    "sst_sdate": "2024-01-15T09:00:00",
    "sst_edate": "2024-01-15T10:00:00",
    "sst_all_day": "N"
}

response = requests.post(
    f"http://localhost:8000/api/v1/schedule/group/{group_id}/schedules",
    params={"current_user_id": user_id},
    json=schedule_data
)
```

### JavaScript/TypeScript 클라이언트 예시
```typescript
// 그룹 스케줄 조회
const response = await fetch(
  `/api/v1/schedule/group/${groupId}/schedules?current_user_id=${userId}`
);
const data = await response.json();

// 스케줄 생성
const scheduleData = {
  sst_title: "새 회의",
  sst_sdate: "2024-01-15T09:00:00",
  sst_edate: "2024-01-15T10:00:00",
  sst_all_day: "N"
};

const createResponse = await fetch(
  `/api/v1/schedule/group/${groupId}/schedules?current_user_id=${userId}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scheduleData)
  }
);
```

## 개발 환경 설정

### 1. 의존성 설치
```bash
cd backend
pip install -r requirements.txt
```

### 2. 환경 변수 설정
```bash
# .env 파일 생성
DATABASE_URL=mysql://user:password@localhost/smap2_db
SECRET_KEY=your-secret-key
```

### 3. 서버 실행
```bash
# 개발 모드
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 또는 Docker 사용
docker-compose up -d
```

### 4. API 문서 확인
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 보안 고려사항

1. **인증**: JWT 토큰 기반 인증 시스템 사용
2. **권한 검증**: 모든 요청에서 그룹 멤버십 및 권한 확인
3. **SQL 인젝션 방지**: SQLAlchemy의 text() 함수와 파라미터 바인딩 사용
4. **입력 검증**: Pydantic 스키마를 통한 요청 데이터 검증
5. **로깅**: 모든 요청과 오류에 대한 상세 로깅

## 성능 최적화

1. **데이터베이스 인덱스**: 자주 조회되는 필드에 인덱스 설정
2. **쿼리 최적화**: JOIN을 활용한 효율적인 데이터 조회
3. **페이지네이션**: 대량 데이터 조회 시 페이지네이션 적용
4. **캐싱**: Redis를 활용한 자주 조회되는 데이터 캐싱

## 테스트

### 단위 테스트 실행
```bash
pytest tests/
```

### API 테스트
```bash
# 특정 엔드포인트 테스트
pytest tests/test_group_schedule_manage.py -v
```

## 배포

### Docker를 사용한 배포
```bash
# 프로덕션 이미지 빌드
docker build -f Dockerfile.prod -t smap-backend:latest .

# 컨테이너 실행
docker run -d -p 8000:8000 --env-file .env smap-backend:latest
```

### 환경별 설정
- **개발**: `Dockerfile.dev` 사용
- **프로덕션**: `Dockerfile.prod` 사용
- **설정 파일**: `docker-compose.yml`

## 모니터링

### 로그 확인
```bash
# 애플리케이션 로그
tail -f app.log

# Docker 로그
docker logs -f container_name
```

### 헬스체크
```bash
curl http://localhost:8000/health
``` 