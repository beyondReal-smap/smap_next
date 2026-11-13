# Firebase 푸시 알림 설정 가이드

Firebase 푸시 알림을 사용하기 위해서는 Firebase 프로젝트에서 서비스 계정 키를 설정해야 합니다.

## 1. Firebase Console에서 서비스 계정 키 생성

1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. 프로젝트 선택 또는 새 프로젝트 생성
3. 프로젝트 설정 → 서비스 계정 탭
4. "새 비공개 키 생성" 클릭하여 JSON 파일 다운로드

## 2. 설정 방법 (3가지 중 하나 선택)

### 방법 1: 환경변수에 JSON 문자열 설정 (권장)

`.env` 파일에 다음과 같이 설정:

```bash
FIREBASE_CREDENTIALS_JSON={"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project-id.iam.gserviceaccount.com"}
```

### 방법 2: 인증서 파일 경로 설정

1. 다운로드한 JSON 파일을 서버의 안전한 위치에 저장
2. `.env` 파일에 경로 설정:

```bash
FIREBASE_CREDENTIALS_PATH=/path/to/your/firebase-credentials.json
```

### 방법 3: 개별 환경변수 설정

`.env` 파일에 다음과 같이 설정:

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
```

## 3. 환경변수 파일 생성

`backend/.env` 파일을 생성하고 위의 방법 중 하나를 선택하여 설정하세요.

예시:
```bash
# 데이터베이스 설정
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=smap2
MYSQL_PASSWORD=dmonster
MYSQL_DATABASE=smap2_db

# Flask 설정
SECRET_KEY=your-secret-key-here

# Firebase 설정 (방법 1 사용 예시)
FIREBASE_CREDENTIALS_JSON={"type":"service_account",...}
```

## 4. 서버 재시작

설정 완료 후 백엔드 서버를 재시작하면 Firebase 푸시 알림이 활성화됩니다.

## 주의사항

- Firebase 인증서 정보는 민감한 정보이므로 `.env` 파일을 Git에 커밋하지 마세요
- 프로덕션 환경에서는 환경변수를 안전하게 관리하세요
- 인증서 파일을 사용하는 경우 파일 권한을 적절히 설정하세요 (600 권한 권장) 