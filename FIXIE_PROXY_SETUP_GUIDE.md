# Fixie 프록시를 통한 고정 IP SMS 발송 설정 가이드

## 📋 개요

Vercel은 서버리스 플랫폼으로 고정 IP를 제공하지 않습니다. 알리고(Aligo) SMS 서비스는 IP 화이트리스트를 요구하므로, Fixie 프록시 서비스를 사용하여 고정 IP를 통해 SMS API를 호출합니다.

## 🔧 설정 단계

### 1단계: Fixie 계정 설정

1. **Fixie 가입**
   - https://usefixie.com/ 접속
   - 계정 생성 (무료 플랜 또는 유료 플랜 선택)

2. **고정 IP 확인**
   - Fixie 대시보드에서 할당된 고정 IP 주소 확인
   - 예: `52.55.123.456`, `54.88.234.567`

3. **프록시 URL 확인**
   - 형식: `http://fixie:PASSWORD@velodrome.usefixie.com:80`
   - 대시보드에서 전체 URL 복사

### 2단계: 알리고 SMS 서비스에 IP 등록

1. 알리고 관리자 페이지 접속
2. IP 화이트리스트 설정으로 이동
3. Fixie에서 제공받은 고정 IP 주소들을 등록
   - 예: `52.55.123.456`, `54.88.234.567`

### 3단계: Vercel 환경 변수 설정

#### 백엔드 (FastAPI) 환경 변수

Vercel 프로젝트 설정에서 다음 환경 변수를 추가:

```bash
# Fixie 프록시 URL
FIXIE_URL=http://fixie:YOUR_PASSWORD@velodrome.usefixie.com:80

# 기존 알리고 설정 (유지)
ALIGO_USER_ID=smap2023
ALIGO_KEY=your_aligo_api_key
ALIGO_SENDER=070-8065-2207
```

#### 프론트엔드 (Next.js) 환경 변수

```bash
# 백엔드 API URL
NEXT_PUBLIC_BACKEND_API_URL=https://api3.smap.site/api/v1
```

### 4단계: 로컬 개발 환경 설정

#### 백엔드 `.env` 파일

```bash
# backend/.env
FIXIE_URL=http://fixie:YOUR_PASSWORD@velodrome.usefixie.com:80
ALIGO_USER_ID=smap2023
ALIGO_KEY=your_aligo_api_key
ALIGO_SENDER=070-8065-2207
```

#### 프론트엔드 `.env.local` 파일

```bash
# frontend/.env.local
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000/api/v1
```

## 📝 코드 변경 사항

### 백엔드 (backend/app/services/sms_service.py)

- Fixie 프록시 URL을 환경변수에서 읽어옴
- aiohttp ClientSession에 프록시 설정 추가
- 프록시 사용 여부를 로그로 출력

### 백엔드 API 엔드포인트 (backend/app/api/v1/endpoints/sms.py)

새로운 SMS API 엔드포인트 추가:

- `POST /api/v1/sms/send-verification-code`: 인증번호 발송
- `POST /api/v1/sms/send`: 일반 SMS 발송

### 프론트엔드 (frontend/src/lib/sms.ts)

- 직접 알리고 API 호출 → 백엔드 API 호출로 변경
- 모든 SMS 발송이 백엔드를 거쳐 Fixie 프록시를 통해 전송됨

## 🧪 테스트 방법

### 1. 백엔드 API 직접 테스트

```bash
# 인증번호 발송 테스트
curl -X POST https://api3.smap.site/api/v1/sms/send-verification-code \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "01012345678"}'

# 일반 SMS 발송 테스트
curl -X POST https://api3.smap.site/api/v1/sms/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "01012345678",
    "message": "테스트 메시지",
    "subject": "테스트"
  }'
```

### 2. 프론트엔드에서 테스트

회원가입 페이지에서 인증번호 발송 버튼 클릭하여 테스트

### 3. 로그 확인

백엔드 로그에서 다음 메시지 확인:

```
🔒 Fixie 프록시 사용: velodrome.usefixie.com:80
📱 SMS 발송 시도: 010***
🔒 프록시를 통해 SMS 발송
✅ SMS 발송 성공: 010***
```

## 🔍 문제 해결

### 프록시 연결 실패

**증상**: SMS 발송 실패, 프록시 연결 오류

**해결 방법**:
1. Fixie URL이 올바른지 확인
2. Fixie 계정 상태 확인 (유료 플랜 만료 여부)
3. 방화벽 설정 확인

### IP 화이트리스트 오류

**증상**: 알리고 API에서 IP 인증 실패

**해결 방법**:
1. 알리고 관리자 페이지에서 등록된 IP 확인
2. Fixie 대시보드에서 현재 사용 중인 IP 확인
3. IP가 변경되었다면 알리고에 재등록

### 환경 변수 미설정

**증상**: `FIXIE_URL` 환경변수를 찾을 수 없음

**해결 방법**:
1. Vercel 대시보드에서 환경 변수 설정 확인
2. 로컬 `.env` 파일 확인
3. 환경 변수 변경 후 재배포 필요

## 💰 비용

### Fixie 요금제

- **무료 플랜**: 월 500 요청 (테스트용)
- **Starter 플랜**: 월 $5 - 5,000 요청
- **Business 플랜**: 월 $50 - 50,000 요청

### 권장 사항

- 개발/테스트: 무료 플랜
- 프로덕션: Starter 또는 Business 플랜

## 📚 참고 자료

- Fixie 공식 문서: https://usefixie.com/docs
- 알리고 API 문서: https://smartsms.aligo.in/admin/api/info.html
- aiohttp 프록시 설정: https://docs.aiohttp.org/en/stable/client_advanced.html#proxy-support

## ⚠️ 주의사항

1. **보안**: Fixie URL에는 비밀번호가 포함되어 있으므로 환경 변수로 관리
2. **요금**: SMS 발송량에 따라 Fixie 요금제 선택
3. **IP 변경**: Fixie IP가 변경될 경우 알리고에 재등록 필요
4. **로그**: 프로덕션 환경에서는 민감한 정보(전화번호 전체) 로깅 제거

## 🔄 대안 방법

Fixie 대신 사용할 수 있는 다른 프록시 서비스:

1. **QuotaGuard Static**: https://www.quotaguard.com/
2. **Proximo**: https://proximo.herokuapp.com/
3. **자체 프록시 서버**: AWS EC2 + Elastic IP

## 📞 문의

문제가 지속되면 다음으로 문의:
- Fixie 지원: support@usefixie.com
- 알리고 고객센터: 1661-5179

