# SMAP 백엔드 API - home/page.tsx 연동

`home/page.tsx`에서 사용하는 FastAPI 백엔드 API 목록입니다.

## 📁 API 구조

```
backend/app/api/v1/endpoints/
├── auth.py                 # 인증 관련 API
├── members.py             # 멤버 관련 API  
├── groups.py              # 그룹 관련 API
├── group_details.py       # 그룹 상세 관련 API
├── schedules.py           # 스케줄 관련 API
└── weather.py             # 날씨 관련 API (신규)
```

## 🔐 인증 API (`/api/v1/auth`)

### POST `/api/v1/auth/login`
home/page.tsx의 AuthContext에서 사용하는 로그인

**Request:**
```json
{
  "mt_id": "test@test.com",
  "mt_pwd": "password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "로그인 성공",
  "data": {
    "token": "jwt-token",
    "user": {
      "mt_idx": 1186,
      "mt_name": "테스트 사용자",
      "mt_lat": 37.5642,
      "mt_long": 127.0016,
      // ... 기타 사용자 정보
    }
  }
}
```

### POST `/api/v1/auth/logout`
로그아웃

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "message": "로그아웃되었습니다."
}
```

### POST `/api/v1/auth/refresh`
토큰 갱신

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "token": "new-jwt-token",
  "message": "토큰이 갱신되었습니다."
}
```

## 👤 멤버 API (`/api/v1/members`)

### GET `/api/v1/members/{member_id}`
멤버 상세 정보 조회 (AuthContext의 getUserProfile)

**Response:**
```json
{
  "mt_idx": 1186,
  "mt_name": "테스트 사용자",
  "mt_lat": 37.5642,
  "mt_long": 127.0016,
  "mt_weather_sky": 8,
  "mt_weather_tmx": 25,
  // ... 기타 멤버 정보
}
```

### GET `/api/v1/members/group/{group_id}`
그룹 멤버 목록 조회 (memberService.getGroupMembers)

**Response:**
```json
[
  {
    // Member 정보
    "mt_idx": 1186,
    "mt_name": "김철수",
    "mt_lat": 37.5642,
    "mt_long": 127.0016,
    "mt_weather_sky": 8,
    "mt_weather_tmx": 25,
    // GroupDetail 정보
    "sgdt_idx": 1,
    "sgt_idx": 1,
    "sgdt_owner_chk": "Y",
    "sgdt_leader_chk": "Y"
  }
]
```

### PUT `/api/v1/members/{member_id}`
멤버 정보 업데이트 (AuthContext의 updateUserProfile)

## 👥 그룹 API (`/api/v1/groups`)

### GET `/api/v1/groups/current-user`
현재 사용자 그룹 목록 조회 (groupService.getCurrentUserGroups)

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
[
  {
    "sgt_idx": 1,
    "sgt_title": "테스트 그룹",
    "sgt_code": "GROUP123",
    "is_owner": true,
    "is_leader": true,
    "join_date": "2024-12-27T00:00:00"
  }
]
```

### GET `/api/v1/groups/{group_id}`
그룹 상세 정보 조회

## 📋 그룹 상세 API (`/api/v1/group-details`)

### GET `/api/v1/group-details/member/{member_id}`
멤버의 그룹 상세 정보 목록 (AuthContext에서 사용)

**Response:**
```json
[
  {
    "sgdt_idx": 1,
    "sgt_idx": 1,
    "mt_idx": 1186,
    "sgdt_owner_chk": "Y",
    "sgdt_leader_chk": "Y",
    "sgdt_show": "Y"
  }
]
```

## 📅 스케줄 API (`/api/v1/schedules`)

### GET `/api/v1/schedules/group/{group_id}?days=7`
그룹 스케줄 조회 (scheduleService.getGroupSchedules)

**Query Parameters:**
- `days`: 조회할 일수 (기본값: 전체)

**Response:**
```json
[
  {
    "id": "1",
    "mt_schedule_idx": 1186,
    "title": "팀 회의",
    "date": "2024-12-27T14:00:00.000Z",
    "sst_edate": "2024-12-27T15:00:00.000Z",
    "location": "강남 사무실",
    "sst_location_lat": 37.5642,
    "sst_location_long": 127.0016,
    "sst_memo": "주간 팀 미팅"
  }
]
```

## 🌤️ 날씨 API (`/api/v1/weather`) - 신규

### GET `/api/v1/weather/current?lat={lat}&lng={lng}`
현재 날씨 정보 조회 (home/page.tsx의 날씨 정보)

**Headers:** `Authorization: Bearer {token}` (선택적)

**Query Parameters:**
- `lat`: 위도 (선택적)
- `lng`: 경도 (선택적)

**Response:**
```json
{
  "success": true,
  "data": {
    "sky": "8",
    "temp_max": 25,
    "temp_min": 18,
    "pop": "20",
    "location": "현재 위치",
    "updated_at": "2024-12-27T12:00:00Z"
  }
}
```

### GET `/api/v1/weather/member/{member_id}`
멤버별 날씨 정보 조회

**Response:**
```json
{
  "mt_idx": 1186,
  "mt_name": "김철수",
  "sky": "8",
  "temp_max": 25,
  "temp_min": 18,
  "pop": "20",
  "location": "서울시 강남구",
  "updated_at": "2024-12-27T12:00:00Z"
}
```

### PUT `/api/v1/weather/member/{member_id}`
멤버 날씨 정보 업데이트

**Request:**
```json
{
  "sky": "8",
  "temp_max": 25,
  "temp_min": 18,
  "pop": "20"
}
```

## 🔧 개발 정보

### 환경 변수
```env
DATABASE_URL=postgresql://user:password@localhost/dbname
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### 데이터베이스 테이블
- `member_t`: 회원 정보
- `smap_group_t`: 그룹 정보  
- `smap_group_detail_t`: 그룹 상세 정보 (멤버-그룹 관계)
- `smap_schedule_t`: 스케줄 정보

### 실행 방법
```bash
# 개발 환경
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Docker
docker-compose up -d
```

### API 문서 확인
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 📝 home/page.tsx 연동 매핑

| 프론트엔드 서비스 | 백엔드 API | 설명 |
|------------------|------------|------|
| `authService.login()` | `POST /auth/login` | 로그인 |
| `authService.logout()` | `POST /auth/logout` | 로그아웃 |
| `authService.getUserProfile()` | `GET /members/{id}` | 사용자 정보 조회 |
| `memberService.getGroupMembers()` | `GET /members/group/{group_id}` | 그룹 멤버 조회 |
| `groupService.getCurrentUserGroups()` | `GET /groups/current-user` | 사용자 그룹 목록 |
| `scheduleService.getGroupSchedules()` | `GET /schedules/group/{group_id}` | 그룹 스케줄 조회 |
| 날씨 정보 조회 | `GET /weather/current` | 현재 날씨 |
| 멤버별 날씨 조회 | `GET /weather/member/{id}` | 멤버 날씨 |

## ⚠️ 주의사항

1. **토큰 인증**: 대부분의 API는 JWT 토큰이 필요합니다
2. **CORS 설정**: 프론트엔드 도메인을 FastAPI CORS에 추가해야 합니다
3. **데이터 변환**: 응답 데이터가 프론트엔드 타입과 일치하도록 변환됩니다
4. **에러 처리**: HTTP 상태 코드와 에러 메시지를 적절히 처리해야 합니다

## 🚀 다음 단계

1. 실제 외부 날씨 API 연동
2. 실시간 알림 기능 추가  
3. 파일 업로드 API 구현
4. 캐싱 및 성능 최적화 