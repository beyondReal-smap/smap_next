# Vercel 환경변수 설정 가이드

## 문제 상황
로컬에서는 정상 동작하지만 Vercel에 배포된 페이지에서 `/api/v1/members/profile` API가 503 에러를 반환하거나 로그조차 안 나오는 문제가 발생하고 있습니다.

## 원인
Vercel의 서버리스 함수에서 백엔드 서버로 연결할 때 환경변수가 올바르게 설정되지 않아 발생하는 문제입니다.

## 해결 방법

### 1. Vercel 대시보드에서 환경변수 설정

1. [Vercel 대시보드](https://vercel.com/dashboard)에 접속
2. 해당 프로젝트 선택
3. **Settings** 탭 클릭
4. **Environment Variables** 섹션으로 이동

### 2. 필요한 환경변수 추가

다음 환경변수들을 **Production** 환경에 추가하세요:

| Key | Value | Environment |
|-----|-------|-------------|
| `BACKEND_URL` | `https://118.67.130.71:8000` | Production |
| `NEXT_PUBLIC_BACKEND_URL` | `https://118.67.130.71:8000` | Production |

### 3. 환경변수 설정 단계

1. **Key** 입력란에 `BACKEND_URL` 입력
2. **Value** 입력란에 `https://118.67.130.71:8000` 입력
3. **Environment**에서 **Production** 선택
4. **Add** 버튼 클릭
5. 같은 방법으로 `NEXT_PUBLIC_BACKEND_URL`도 추가

### 4. 배포 재실행

환경변수 설정 후:
1. **Deployments** 탭으로 이동
2. 최신 배포를 찾아 **Redeploy** 버튼 클릭
3. 또는 새로운 커밋을 푸시하여 자동 배포 트리거

### 5. 확인 방법

배포 완료 후:
1. 프로덕션 URL에서 `/setting/account/profile` 페이지 접속
2. 개발자 도구 콘솔에서 503 에러가 사라졌는지 확인
3. 프로필 정보가 정상적으로 로드되는지 확인

## 추가 문제 해결

### SSL 인증서 문제
백엔드 서버의 SSL 인증서가 자체 서명된 경우, 코드에서 이미 SSL 검증을 비활성화하도록 설정되어 있습니다.

### 네트워크 연결 문제
백엔드 서버가 외부에서 접근 가능한지 확인:
```bash
curl -k https://118.67.130.71:8000/api/v1/health
```

### 방화벽 설정
백엔드 서버의 방화벽에서 8000 포트가 열려있는지 확인하세요.

## 디버깅 방법

### 1. Vercel 함수 로그 확인
1. Vercel 대시보드 → 프로젝트 → **Functions** 탭
2. `/api/v1/members/profile` 함수 클릭
3. **Logs** 탭에서 에러 메시지 확인

### 2. 환경변수 확인
Vercel 함수에서 환경변수가 제대로 로드되는지 확인:
```javascript
console.log('BACKEND_URL:', process.env.BACKEND_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);
```

### 3. 네트워크 요청 확인
브라우저 개발자 도구 → Network 탭에서:
- `/api/v1/members/profile` 요청이 실제로 발생하는지 확인
- 요청/응답 상태 코드 확인
- 요청 헤더에 Authorization 토큰이 포함되는지 확인

## 참고 사항

- 환경변수는 배포 후에만 적용됩니다
- `NEXT_PUBLIC_` 접두사가 붙은 변수는 클라이언트 사이드에서도 접근 가능합니다
- 환경변수 변경 후에는 반드시 재배포가 필요합니다
- Vercel의 서버리스 함수는 콜드 스타트로 인해 첫 요청이 느릴 수 있습니다 