# Member API Documentation

## 개요
회원 관리를 위한 CRUD API입니다. 회원가입, 로그인, 회원 정보 조회/수정/삭제 기능을 제공합니다.

## 엔드포인트

### 1. 회원가입
```
POST /api/v1/members/register
```

**요청 본문:**
```json
{
  "mt_type": 1,
  "mt_level": 2,
  "mt_status": 1,
  "mt_id": "01012345678",
  "mt_pwd": "password123!",
  "mt_name": "홍길동",
  "mt_nickname": "길동이",
  "mt_email": "test@example.com",
  "mt_birth": "1990-01-01",
  "mt_gender": 1,
  "mt_onboarding": "N",
  "mt_show": "Y",
  "mt_agree1": true,
  "mt_agree2": true,
  "mt_agree3": true,
  "mt_agree4": false,
  "mt_agree5": false,
  "mt_push1": true,
  "mt_lat": 37.5665,
  "mt_long": 126.9780
}
```

**응답:**
```json
{
  "success": true,
  "message": "회원가입이 완료되었습니다.",
  "data": {
    "mt_idx": 1,
    "mt_id": "01012345678",
    "mt_name": "홍길동",
    "mt_nickname": "길동이",
    "mt_email": "test@example.com",
    "mt_wdate": "2024-01-01T00:00:00"
  }
}
```

### 2. 로그인
```
POST /api/v1/members/login
```

**요청 본문:**
```json
{
  "mt_id": "01012345678",
  "mt_pwd": "password123!"
}
```

**응답:**
```json
{
  "success": true,
  "message": "로그인 성공",
  "data": {
    "user": {
      "mt_idx": 1,
      "mt_type": 1,
      "mt_level": 2,
      "mt_status": 1,
      "mt_id": "01012345678",
      "mt_name": "홍길동",
      "mt_nickname": "길동이",
      "mt_hp": "01012345678",
      "mt_email": "test@example.com",
      "mt_birth": "1990-01-01",
      "mt_gender": 1,
      "mt_file1": "",
      "mt_lat": 37.5665,
      "mt_long": 126.9780,
      "mt_sido": "",
      "mt_gu": "",
      "mt_dong": "",
      "mt_onboarding": "Y",
      "mt_push1": "Y",
      "mt_plan_check": "N",
      "mt_plan_date": "",
      "mt_weather_pop": "",
      "mt_weather_sky": 8,
      "mt_weather_tmn": 18,
      "mt_weather_tmx": 25,
      "mt_weather_date": "2024-01-01T00:00:00",
      "mt_ldate": "2024-01-01T00:00:00",
      "mt_adate": "2024-01-01T00:00:00"
    }
  }
}
```

### 3. 중복 확인

#### 전화번호 중복 확인
```
GET /api/v1/members/check/phone/{phone}
```

#### 이메일 중복 확인
```
GET /api/v1/members/check/email/{email}
```

#### 닉네임 중복 확인
```
GET /api/v1/members/check/nickname/{nickname}
```

**응답:**
```json
{
  "available": true,
  "message": "사용 가능한 전화번호입니다."
}
```

### 4. 회원 목록 조회
```
GET /api/v1/members/
```

**쿼리 파라미터:**
- `skip`: 건너뛸 개수 (기본값: 0)
- `limit`: 조회할 개수 (기본값: 100)
- `status`: 회원 상태 필터
- `level`: 회원 등급 필터

### 5. 회원 검색
```
GET /api/v1/members/search?q={검색어}
```

**쿼리 파라미터:**
- `q`: 검색어 (이름, 닉네임, 전화번호, 이메일)
- `skip`: 건너뛸 개수 (기본값: 0)
- `limit`: 조회할 개수 (기본값: 100)

### 6. 특정 회원 조회
```
GET /api/v1/members/{member_id}
```

### 7. 회원 정보 수정
```
PUT /api/v1/members/{member_id}
```

**요청 본문:**
```json
{
  "mt_name": "홍길동",
  "mt_nickname": "새닉네임",
  "mt_email": "new@example.com",
  "mt_birth": "1990-01-01",
  "mt_gender": 1,
  "mt_lat": 37.5665,
  "mt_long": 126.9780,
  "mt_push1": "Y",
  "mt_file1": "profile.jpg"
}
```

### 8. 회원 위치 정보 업데이트
```
PUT /api/v1/members/{member_id}/location?lat={위도}&lng={경도}
```

### 9. 회원 탈퇴
```
DELETE /api/v1/members/{member_id}
```

## 데이터베이스 스키마

### member_t 테이블
- `mt_idx`: 회원 고유 ID (Primary Key, Auto Increment)
- `mt_type`: 로그인 구분 (1:일반, 2:카톡, 3:애플, 4:구글)
- `mt_level`: 회원 등급 (1:탈퇴, 2:일반(무료), 3:휴면, 4:유예, 5:유료, 9:관리자)
- `mt_status`: 회원 상태 (1:정상, 2:정지)
- `mt_id`: 아이디(전화번호)
- `mt_pwd`: 비밀번호 (bcrypt 해싱)
- `mt_name`: 이름
- `mt_nickname`: 닉네임
- `mt_hp`: 연락처
- `mt_email`: 이메일
- `mt_birth`: 생년월일
- `mt_gender`: 성별
- `mt_file1`: 프로필 이미지
- `mt_show`: 노출 여부 (Y:노출, N:노출안함)
- `mt_agree1`: 서비스 이용약관 동의 여부
- `mt_agree2`: 개인정보 처리방침 동의 여부
- `mt_agree3`: 위치기반서비스 이용약관 동의 여부
- `mt_agree4`: 개인정보 제3자 제공 동의 여부
- `mt_agree5`: 마케팅 정보 수집 및 이용 동의
- `mt_push1`: 알림 수신 여부 동의
- `mt_lat`: 위도
- `mt_long`: 경도
- `mt_sido`: 접속 위치 시도
- `mt_gu`: 접속 위치 구군
- `mt_dong`: 접속 위치 읍면동
- `mt_onboarding`: 온보딩 여부
- `mt_wdate`: 등록일시
- `mt_ldate`: 로그인일시
- `mt_udate`: 수정일시
- `mt_adate`: 최근 접속일시

## 에러 코드

### 400 Bad Request
- 필수 필드 누락
- 잘못된 데이터 형식
- 유효성 검사 실패

### 404 Not Found
- 존재하지 않는 회원

### 409 Conflict
- 중복된 전화번호/이메일/닉네임

### 500 Internal Server Error
- 서버 내부 오류
- 데이터베이스 연결 오류

## 사용 예시

### 프론트엔드에서 회원가입 호출
```javascript
const registerData = {
  mt_type: 1,
  mt_level: 2,
  mt_status: 1,
  mt_id: "01012345678",
  mt_pwd: "password123!",
  mt_name: "홍길동",
  mt_nickname: "길동이",
  mt_email: "test@example.com",
  mt_birth: "1990-01-01",
  mt_gender: 1,
  mt_onboarding: "N",
  mt_show: "Y",
  mt_agree1: true,
  mt_agree2: true,
  mt_agree3: true,
  mt_agree4: false,
  mt_agree5: false,
  mt_push1: true,
  mt_lat: 37.5665,
  mt_long: 126.9780
};

const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(registerData),
});

const result = await response.json();
if (result.success) {
  console.log('회원가입 성공:', result.data);
} else {
  console.error('회원가입 실패:', result.message);
}
```

## 보안 고려사항

1. **비밀번호 해싱**: bcrypt를 사용하여 비밀번호를 안전하게 해싱
2. **입력 검증**: Pydantic을 사용한 데이터 유효성 검사
3. **SQL 인젝션 방지**: SQLAlchemy ORM 사용
4. **CORS 설정**: 허용된 도메인에서만 API 접근 가능
5. **로깅**: 민감한 정보는 마스킹하여 로깅

## 테스트

### 회원가입 테스트
```bash
curl -X POST "https://118.67.130.71:8000/api/v1/members/register" \
  -H "Content-Type: application/json" \
  -d '{
    "mt_type": 1,
    "mt_level": 2,
    "mt_status": 1,
    "mt_id": "01012345678",
    "mt_pwd": "password123!",
    "mt_name": "홍길동",
    "mt_nickname": "길동이",
    "mt_email": "test@example.com",
    "mt_birth": "1990-01-01",
    "mt_gender": 1,
    "mt_onboarding": "N",
    "mt_show": "Y",
    "mt_agree1": true,
    "mt_agree2": true,
    "mt_agree3": true,
    "mt_agree4": false,
    "mt_agree5": false,
    "mt_push1": true,
    "mt_lat": 37.5665,
    "mt_long": 126.9780
  }'
```

### 로그인 테스트
```bash
curl -X POST "https://118.67.130.71:8000/api/v1/members/login" \
  -H "Content-Type: application/json" \
  -d '{
    "mt_id": "01012345678",
    "mt_pwd": "password123!"
  }'
``` 