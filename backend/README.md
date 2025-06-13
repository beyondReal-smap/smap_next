# SMAP Backend Server

SMAP 프로젝트의 백엔드 서버입니다. 외부 API 서버와의 연동 및 데이터베이스 백업 기능을 제공합니다.

## 개요
SMAP 프로젝트의 백엔드 서버로, 외부 API 서버 (https://118.67.130.71:8000)와 연동하여 비밀번호 변경 및 사용자 관리 기능을 제공합니다.

## 주요 기능

### 🔐 인증 및 회원 관리
- JWT 기반 인증 시스템
- 외부 API 서버 연동 (https://118.67.130.71:8000)
- 데이터베이스 백업 폴백 시스템
- 비밀번호 변경 및 확인 기능

### 🌐 다단계 폴백 시스템
1. **외부 API 서버** (1차 시도)
2. **로컬 데이터베이스** (2차 백업)
3. **임시 모드** (개발용)

### 📊 모니터링
- 헬스 체크 API
- 요청/응답 로깅
- 연결 상태 모니터링

## API 엔드포인트

### 인증 API (`/api/auth`)

#### POST `/api/auth/login`
사용자 로그인

```json
{
  "mt_id": "user_id",
  "mt_pwd": "password"
}
```

**응답:**
```json
{
  "success": true,
  "message": "로그인 성공",
  "data": {
    "access_token": "jwt_token",
    "token_type": "Bearer",
    "user": {
      "mt_idx": 1,
      "mt_id": "user_id",
      "mt_name": "사용자명",
      "mt_nickname": "닉네임",
      "mt_type": 1
    }
  }
}
```

#### GET `/api/auth/me`
토큰 기반 사용자 정보 조회

**헤더:**
```
Authorization: Bearer {token}
```

#### POST `/api/auth/refresh`
토큰 새로고침

#### POST `/api/auth/logout`
로그아웃 (클라이언트에서 토큰 제거 안내)

#### GET `/api/auth/health`
인증 시스템 헬스 체크

### 회원 API (`/api/member`)

#### POST `/api/member/verify-password`
현재 비밀번호 확인

**헤더:**
```
Authorization: Bearer {token}
```

**요청:**
```json
{
  "currentPassword": "current_password"
}
```

**응답:**
```json
{
  "success": true,
  "message": "비밀번호가 확인되었습니다."
}
```

#### POST `/api/member/change-password`
비밀번호 변경

**헤더:**
```
Authorization: Bearer {token}
```

**요청:**
```json
{
  "currentPassword": "current_password",
  "newPassword": "new_password"
}
```

**비밀번호 요구사항:**
- 8자 이상
- 대문자 포함
- 소문자 포함  
- 숫자 포함
- 특수문자 포함 (@$!%*?&)

**응답:**
```json
{
  "success": true,
  "message": "비밀번호가 성공적으로 변경되었습니다."
}
```

#### GET `/api/member/info`
회원 정보 조회 (디버깅용)

**헤더:**
```
Authorization: Bearer {token}
```

## 설치 및 실행

### 1. 의존성 설치
```bash
cd backend
npm install
```

### 2. 환경 변수 설정
`env.example` 파일을 참고하여 환경 변수를 설정하세요:

```bash
# 서버 설정
PORT=3001
NODE_ENV=development

# 외부 API 설정
EXTERNAL_API_BASE_URL=https://118.67.130.71:8000
EXTERNAL_API_TIMEOUT=10000

# 데이터베이스 설정 (백업용)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=smap

# JWT 설정
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# 비밀번호 해싱
BCRYPT_ROUNDS=12
```

### 3. 서버 실행
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

서버가 실행되면 다음 주소에서 확인할 수 있습니다:
- 헬스 체크: http://localhost:3001/health
- 인증 API: http://localhost:3001/api/auth
- 회원 API: http://localhost:3001/api/member

## 아키텍처

### 폴백 시스템 흐름

```
프론트엔드 요청
       ↓
  Next.js API Route
       ↓
   백엔드 서버
       ↓
┌─────────────────┐
│ 1차: 외부 API   │ → 성공 시 응답 반환
│ 서버 시도       │
└─────────────────┘
       ↓ (실패 시)
┌─────────────────┐
│ 2차: 로컬 DB    │ → 성공 시 응답 반환
│ 직접 접근       │
└─────────────────┘
       ↓ (실패 시)
┌─────────────────┐
│ 3차: 임시 모드  │ → 개발용 응답
│ (개발용)        │
└─────────────────┘
```

### 보안 기능

1. **비밀번호 해싱**: bcrypt 사용 (12 rounds)
2. **JWT 토큰**: 7일 만료 시간 설정
3. **HTTPS 지원**: 자체 서명 인증서 허용
4. **입력 검증**: 비밀번호 강도 검사
5. **로그 보안**: 민감한 정보 마스킹

### 데이터베이스 스키마

#### member_t 테이블
```sql
-- 기본 회원 정보
mt_idx          INT PRIMARY KEY AUTO_INCREMENT
mt_id           VARCHAR(50) UNIQUE NOT NULL
mt_name         VARCHAR(50) NOT NULL
mt_nickname     VARCHAR(50) NOT NULL
mt_pwd          VARCHAR(255) NOT NULL -- bcrypt 해시
mt_email        VARCHAR(100)
mt_hp           VARCHAR(20)
mt_type         INT DEFAULT 1 -- 1:일반, 2:카카오, 3:애플, 4:구글
mt_show         ENUM('Y','N') DEFAULT 'Y'
mt_wdate        DATETIME DEFAULT CURRENT_TIMESTAMP
mt_ldate        DATETIME -- 최근 로그인
mt_udate        DATETIME -- 최근 업데이트
```

## 모니터링 및 로깅

### 로그 레벨
- 🌐 API 요청/응답
- ✅ 성공 작업
- ❌ 오류 발생  
- 🔄 재시도 작업
- 🏥 헬스 체크

### 헬스 체크 상태
```json
{
  "success": true,
  "message": "백엔드 서버가 정상 작동 중입니다",
  "status": {
    "backend": true,
    "externalAPI": true,
    "database": true,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## 오류 처리

### 일반적인 오류 응답 형식
```json
{
  "success": false,
  "message": "오류 메시지",
  "error": "상세 오류 정보 (개발 모드에서만)"
}
```

### 주요 HTTP 상태 코드
- `200`: 성공
- `400`: 잘못된 요청 (유효성 검사 실패)
- `401`: 인증 실패 (토큰 없음/잘못됨)
- `403`: 권한 없음
- `404`: 리소스 없음
- `500`: 서버 내부 오류

## 개발 가이드

### 새로운 API 추가
1. `routes/` 디렉토리에 라우터 파일 생성
2. `app.js`에 라우터 등록
3. 필요시 `utils/apiClient.js`에 헬퍼 함수 추가

### 외부 API 연동
`utils/apiClient.js`의 메서드를 사용하여 외부 API와 통신:

```javascript
const response = await apiClient.get('/api/v1/endpoint');
if (response.success) {
  // 성공 처리
} else {
  // 오류 처리
}
```

### 데이터베이스 백업 로직
```javascript
// 1차: 외부 API 시도
try {
  const result = await apiClient.someMethod();
  return result;
} catch (error) {
  // 2차: 데이터베이스 폴백
  const dbResult = await directDatabaseQuery();
  return dbResult;
}
```

## 성능 최적화

### 재시도 로직
- 최대 3회 재시도
- 지수 백오프 (1초, 2초, 3초)
- 재시도 가능한 오류만 재시도 (5xx, 408, 429)

### 연결 풀링
- MySQL 연결 풀 사용
- 적절한 타임아웃 설정
- 연결 해제 보장

### 메모리 관리
- 대용량 요청 제한 (10MB)
- 적절한 가비지 컬렉션

## 보안 고려사항

1. **환경 변수**: 민감한 정보는 환경 변수로 관리
2. **CORS**: 허용된 도메인만 접근 가능
3. **Rate Limiting**: 필요시 추가 구현
4. **SQL Injection**: Prepared Statement 사용
5. **XSS**: 입력 검증 및 이스케이프

## 배포

### Docker 배포 (권장)
```bash
# 이미지 빌드
docker build -t smap-backend .

# 컨테이너 실행
docker run -p 3001:3001 smap-backend
```

### PM2 배포
```bash
# PM2 설치
npm install -g pm2

# 앱 시작
pm2 start app.js --name "smap-backend"

# 모니터링
pm2 monit
```

## 문제 해결

### 외부 API 연결 실패
1. 네트워크 연결 확인
2. SSL 인증서 문제 확인
3. 방화벽 설정 확인

### 데이터베이스 연결 실패
1. MySQL 서버 상태 확인
2. 연결 정보 확인
3. 권한 설정 확인

### JWT 토큰 문제
1. 토큰 만료 시간 확인
2. JWT_SECRET 설정 확인
3. 토큰 형식 검증

## 라이센스

MIT License

## 기여하기

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request 