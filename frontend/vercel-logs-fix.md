# Vercel Logs 페이지 로딩 문제 해결 가이드

## 문제 상황
- 로컬에서는 logs 페이지가 정상적으로 로드됨
- Vercel 배포 후 logs 페이지가 로드되지 않음
- iOS WebView에서도 동일한 문제 발생

## 주요 수정 사항

### 1. 초기 로딩 오버레이 활성화
- `InitialLoadingOverlay` 컴포넌트 주석 해제
- 사용자가 로딩 상태를 확인할 수 있도록 개선

### 2. Vercel 환경 최적화
- Vercel 환경 감지 로직 추가
- 네이버 지도 API 로딩 최적화 (최소 모듈만 로드)
- 타임아웃 시간 조정 (Vercel: 20초, 기타: 10초)

### 3. 백업 타이머 조정
- Vercel 환경: 8초, 기타 환경: 10초
- 빠른 로딩 실패 감지 및 복구

### 4. 재시도 로직 개선
- Vercel 환경에서 더 긴 지연 시간 사용
- 첫 번째 재시도: 3초, 두 번째 재시도: 8초
- 자동 재시도 간격 단축 (0.5초)

### 5. 안전장치 타이머 조정
- Vercel 환경: 20초, 기타 환경: 30초
- Vercel 환경에 맞는 타임아웃 메시지

### 6. 디버깅 패널 추가
- 개발 환경에서 Vercel 상태 확인 가능
- 로딩 단계별 상태 표시

## 환경 변수 확인

### 필수 환경 변수
```bash
# Vercel Dashboard → Settings → Environment Variables
NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID=91y2nh0yff
NEXT_PUBLIC_GOOGLE_CLIENT_ID=283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=https://nextstep.smap.site
```

### API 키 설정
1. Vercel Dashboard 접속
2. 프로젝트 선택 → Settings → Environment Variables
3. 다음 변수들 추가:
   - `NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID`: 네이버 지도 API 클라이언트 ID (91y2nh0yff)
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Google OAuth 클라이언트 ID
   - `NEXTAUTH_SECRET`: NextAuth 시크릿 키
   - `NEXTAUTH_URL`: 프로덕션 URL (https://nextstep.smap.site)

## 배포 후 확인 사항

### 1. 브라우저 콘솔 확인
```javascript
// 다음 로그들이 정상적으로 출력되는지 확인
[LOGS] Naver Maps API 로딩 시작
🗺️ [LOGS] Vercel/iOS 환경 - 최소 모듈 로드
[LOGS] Naver Maps API 로드 완료
[LOGS] 모든 초기 로딩 완료
```

### 2. 네트워크 탭 확인
- 네이버 지도 API 요청이 성공하는지 확인
- API 응답 시간이 적절한지 확인

### 3. 환경 변수 확인
```javascript
// 브라우저 콘솔에서 실행
console.log('NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID:', process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID);
console.log('NEXT_PUBLIC_GOOGLE_CLIENT_ID:', process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
```

## 문제 해결 단계

### 단계 1: 환경 변수 설정
1. Vercel Dashboard → Settings → Environment Variables
2. 필수 환경 변수 추가
3. Production, Preview, Development 모두 설정

### 단계 2: 재배포
```bash
# 새로운 커밋 푸시
git add .
git commit -m "Fix Vercel logs page loading issues"
git push origin main
```

### 단계 3: 확인
1. Vercel 배포 완료 대기
2. 브라우저에서 logs 페이지 접속
3. 개발자 도구 콘솔에서 로그 확인
4. 초기 로딩 오버레이 확인

## 추가 최적화

### 1. CDN 설정
- Vercel에서 정적 자산 캐싱 최적화
- 이미지 및 폰트 최적화

### 2. API 응답 시간 모니터링
- Vercel Analytics에서 API 응답 시간 확인
- 느린 API 호출 최적화

### 3. 에러 모니터링
- Vercel Functions 로그 확인
- 클라이언트 사이드 에러 추적

## 주의사항

1. **환경 변수 범위**: Production, Preview, Development 모두 설정
2. **재배포 필수**: 환경 변수 변경 후 반드시 재배포
3. **캐시 클리어**: 브라우저 캐시 클리어 후 테스트
4. **네트워크 상태**: 안정적인 네트워크 환경에서 테스트

## 디버깅 명령어

### 브라우저 콘솔에서 실행
```javascript
// 환경 정보 확인
console.log('Hostname:', window.location.hostname);
console.log('Is Vercel:', window.location.hostname.includes('vercel.app') || window.location.hostname.includes('nextstep.smap.site'));

// 네이버 지도 API 상태 확인
console.log('Naver Maps:', window.naver?.maps);
console.log('Naver Maps Client ID:', window.naver?.maps?.getClientId?.());

// 환경 변수 확인
console.log('NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID:', process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID);
console.log('NEXT_PUBLIC_GOOGLE_CLIENT_ID:', process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

// 로딩 상태 확인
console.log('Loading Step:', document.querySelector('[data-loading-step]')?.textContent);
```

이 가이드를 따라 설정하면 Vercel에서 logs 페이지가 정상적으로 로드될 것입니다. 