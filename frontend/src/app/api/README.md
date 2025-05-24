# SMAP Next.js API Routes

SMAP 애플리케이션의 백엔드 API를 Next.js API Routes로 구현한 목록입니다.

## 📁 API 구조

```
src/app/api/
├── auth/                    # 인증 관련 API
│   ├── login/route.ts      # 로그인
│   ├── logout/route.ts     # 로그아웃
│   └── refresh/route.ts    # 토큰 갱신
├── members/                 # 멤버 관련 API
│   └── [id]/route.ts       # 멤버 조회/수정
├── groups/                  # 그룹 관련 API
│   └── [id]/
│       ├── route.ts        # 그룹 조회
│       └── members/route.ts # 그룹 멤버 목록
├── group-details/           # 그룹 상세 관련 API
│   └── member/
│       └── [id]/route.ts   # 멤버의 그룹 상세 정보
└── schedules/               # 스케줄 관련 API
    └── group/
        └── [groupId]/route.ts # 그룹 스케줄 조회
```

## 🔐 인증 API

### POST `/api/auth/login`
사용자 로그인

**Request Body:**
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
      // ... 기타 사용자 정보
    }
  }
}
```

### POST `/api/auth/logout`
사용자 로그아웃

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "로그아웃되었습니다."
}
```

### POST `/api/auth/refresh`
토큰 갱신

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "token": "new-jwt-token",
  "message": "토큰이 갱신되었습니다."
}
```

## 👤 멤버 API

### GET `/api/members/{id}`
멤버 상세 정보 조회

**Response:**
```json
{
  "mt_idx": 1186,
  "mt_name": "테스트 사용자",
  "mt_email": "test@test.com",
  "mt_lat": 37.5642,
  "mt_long": 127.0016,
  // ... 기타 멤버 정보
}
```

### PUT `/api/members/{id}`
멤버 정보 업데이트

**Request Body:**
```json
{
  "mt_name": "새로운 이름",
  "mt_email": "new@email.com"
  // ... 업데이트할 필드들
}
```

## 👥 그룹 API

### GET `/api/groups/{id}`
그룹 상세 정보 조회

**Response:**
```json
{
  "sgt_idx": 1,
  "mt_idx": 1186,
  "sgt_title": "테스트 그룹",
  "sgt_code": "GROUP123",
  "sgt_show": "Y"
}
```

### GET `/api/groups/{id}/members`
그룹 멤버 목록 조회

**Response:**
```json
[
  {
    // Member 정보
    "mt_idx": 1186,
    "mt_name": "김철수",
    "mt_lat": 37.5642,
    "mt_long": 127.0016,
    // GroupDetail 정보
    "sgdt_idx": 1,
    "sgt_idx": 1,
    "sgdt_owner_chk": "Y",
    "sgdt_leader_chk": "Y"
  }
]
```

### GET `/api/group-details/member/{id}`
멤버가 속한 그룹 상세 정보 목록

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

## 📅 스케줄 API

### GET `/api/schedules/group/{groupId}?days=7`
그룹 스케줄 조회

**Query Parameters:**
- `days`: 조회할 일수 (기본값: 7)

**Response:**
```json
[
  {
    "id": "1",
    "mt_schedule_idx": 1186,
    "title": "팀 회의",
    "date": "2024-12-27T14:00:00.000Z",
    "sst_edate": "2024-12-27T15:00:00.000Z",
    "sst_location_title": "강남 사무실",
    "sst_location_lat": 37.5642,
    "sst_location_long": 127.0016,
    "sst_memo": "주간 팀 미팅"
  }
]
```

## 🔧 개발 정보

### 환경 변수
```env
NEXT_PUBLIC_API_URL=/api  # API 기본 URL (기본값)
NODE_ENV=development      # 개발 모드 (로깅 활성화)
```

### Mock 데이터
현재 모든 API는 Mock 데이터를 반환합니다. 실제 백엔드와 연동하려면 각 라우트 파일의 `TODO` 주석 부분을 실제 API 호출로 교체하세요.

```typescript
// TODO: 실제 백엔드 API 호출
// const response = await axios.post('http://your-backend-api/auth/login', {
//   mt_id,
//   mt_pwd
// });
```

### 에러 처리
- `400`: 잘못된 요청 (입력 검증 실패)
- `401`: 인증 실패 (토큰 없음/만료)
- `404`: 리소스 없음
- `500`: 서버 내부 오류

### 토큰 관리
- 토큰은 `localStorage`의 `smap_auth_token` 키에 저장
- 자동 토큰 갱신 기능 포함
- 토큰 만료 시 자동 로그인 페이지 리다이렉트

## 🚀 사용 방법

### AuthContext와 함께 사용
```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { login, user, isLoggedIn } = useAuth();
  
  const handleLogin = async () => {
    await login({
      mt_id: 'test@test.com',
      mt_pwd: 'password'
    });
  };
  
  return (
    <div>
      {isLoggedIn ? (
        <p>안녕하세요, {user?.mt_name}님!</p>
      ) : (
        <button onClick={handleLogin}>로그인</button>
      )}
    </div>
  );
}
```

### 직접 API 호출
```typescript
import apiClient from '@/services/apiClient';

// 그룹 멤버 조회
const members = await apiClient.get('/groups/1/members');

// 사용자 정보 업데이트
const updatedUser = await apiClient.put('/members/1186', {
  mt_name: '새로운 이름'
});
``` 