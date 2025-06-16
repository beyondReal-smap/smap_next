# 환경 변수 설정 가이드

## Google Auth 400 오류 해결을 위한 환경 변수 설정

### 방법 1: .env.local 파일 생성 (권장)

`frontend/.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# Google OAuth 설정
GOOGLE_CLIENT_ID=283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com
NEXTAUTH_SECRET=your-secret-key-here

# 개발환경 설정
NODE_ENV=development
```

### 방법 2: 서버 시작 시 환경 변수 설정

터미널에서 다음 명령어로 서버를 시작하세요:

```bash
# macOS/Linux
export GOOGLE_CLIENT_ID=283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com
export NEXTAUTH_SECRET=your-secret-key-here
npm run dev

# 또는 한 줄로
GOOGLE_CLIENT_ID=283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com NEXTAUTH_SECRET=your-secret-key-here npm run dev
```

### 방법 3: package.json 스크립트 수정

`frontend/package.json`의 scripts 섹션을 다음과 같이 수정:

```json
{
  "scripts": {
    "dev": "GOOGLE_CLIENT_ID=283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com NEXTAUTH_SECRET=your-secret-key-here next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

## 확인 방법

서버 시작 후 다음 로그가 표시되면 환경 변수가 올바르게 설정된 것입니다:

```
[GOOGLE API INFO] 환경 변수 확인: {
  "hasGoogleClientId": true,
  "googleClientIdLength": 72,
  "hasNextAuthSecret": true,
  "usingClientId": "283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com"
}
```

## 주의사항

1. `.env.local` 파일은 git에 커밋하지 마세요 (이미 .gitignore에 포함됨)
2. `NEXTAUTH_SECRET`는 실제 프로덕션에서는 보안이 강화된 랜덤 문자열을 사용하세요
3. 환경 변수 변경 후에는 개발 서버를 재시작해야 합니다 