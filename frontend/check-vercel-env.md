# Vercel 환경 변수 확인 가이드

## 1. Vercel Functions 로그에서 확인

1. **Vercel 대시보드** → **프로젝트** → **Functions** 탭
2. Google 로그인 시도 후 **google-auth** 함수 클릭
3. **Invocations**에서 최근 실행 로그 확인
4. 다음과 같은 로그가 보여야 함:

```json
[GOOGLE API INFO] 환경 변수 확인: {
  "hasGoogleClientId": true,
  "googleClientIdLength": 72,
  "hasNextAuthSecret": true,
  "usingClientId": "283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com"
}
```

## 2. 환경 변수가 설정되지 않은 경우

로그에서 다음과 같이 나타남:

```json
[GOOGLE API INFO] 환경 변수 확인: {
  "hasGoogleClientId": false,
  "googleClientIdLength": 0,
  "hasNextAuthSecret": false,
  "usingClientId": "283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com"
}
```

이 경우 Vercel 대시보드에서 환경 변수를 설정해야 합니다.

## 3. Vercel CLI로 현재 환경 변수 확인

```bash
# 현재 설정된 환경 변수 목록 확인
vercel env ls

# 특정 환경 변수 값 확인 (마스킹됨)
vercel env get GOOGLE_CLIENT_ID
```

## 4. 문제 해결 단계

### 단계 1: 환경 변수 설정
- Vercel Dashboard → Settings → Environment Variables
- `GOOGLE_CLIENT_ID` 추가
- `NEXTAUTH_SECRET` 추가

### 단계 2: 재배포
- 환경 변수 변경 후 반드시 재배포 필요
- Dashboard에서 "Redeploy" 버튼 클릭
- 또는 새로운 commit push

### 단계 3: 확인
- Google 로그인 시도
- Vercel Functions 로그에서 환경 변수 확인
- iOS Xcode 로그에서 API 응답 확인

## 5. 주의사항

1. **Environment 범위**: Production, Preview, Development 모두 설정
2. **대소문자 구분**: 환경 변수명은 정확히 입력
3. **특수문자**: 값에 특수문자가 있으면 따옴표로 감싸기
4. **재배포 필수**: 환경 변수 변경 후 반드시 재배포 