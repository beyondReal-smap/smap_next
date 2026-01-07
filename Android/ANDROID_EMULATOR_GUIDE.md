# 안드로이드 에뮬레이터 개발 서버 연결 가이드

## 🚨 문제: 에뮬레이터에서 "서버에 연결할 수 없다" 오류

안드로이드 에뮬레이터는 `localhost`를 호스트 머신이 아닌 에뮬레이터 자체로 인식하기 때문에 개발 서버에 연결할 수 없습니다.

## ✅ 해결 방법

### 1. 프론트엔드 개발 서버 실행
```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

이렇게 하면 개발 서버가 모든 네트워크 인터페이스에서 접근 가능해집니다.

### 2. 에뮬레이터에서 접근할 URL
- **에뮬레이터**: `http://10.0.2.2:3000` (에뮬레이터 전용 IP)
- **실제 기기**: `http://[PC-IP]:3000` (PC의 실제 IP 주소)

### 3. 앱 동작 방식 (자동 감지)

**DEBUG 빌드 + 에뮬레이터:**
- 자동으로 `10.0.2.2:3000` 연결 시도
- 개발 서버가 없으면 운영 서버로 폴백

**RELEASE 빌드 또는 실제 기기:**
- 운영 서버 `https://nextstep.smap.site` 사용

## 🔧 네트워크 설정

### AndroidManifest.xml
```xml
<application
    android:usesCleartextTraffic="true"
    android:networkSecurityConfig="@xml/network_security_config">
```

### network_security_config.xml
```xml
<domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">10.0.2.2</domain>
    <domain includeSubdomains="true">localhost</domain>
    <domain includeSubdomains="true">127.0.0.1</domain>
</domain-config>
```

## 🐛 디버깅 방법

### 1. 로그 확인
```bash
adb logcat -s SMAP_WebView DevServer Network
```

### 2. 개발 서버 연결 테스트
에뮬레이터 브라우저에서 직접 접속 테스트:
```
http://10.0.2.2:3000
```

### 3. Toast 메시지 확인
- 앱 시작 시 에뮬레이터 감지 메시지 표시
- 개발 서버 연결 상태 메시지 표시

## ⚠️ 주의사항

1. **개발 서버는 `--host 0.0.0.0`으로 실행**해야 함
2. **방화벽**에서 3000 포트 허용 필요할 수 있음
3. **에뮬레이터 네트워크 설정** 확인 (NAT 모드 권장)

## 🔍 문제 해결 체크리스트

- [ ] 개발 서버가 `--host 0.0.0.0`로 실행되고 있는가?
- [ ] `http://10.0.2.2:3000`에 브라우저로 접근 가능한가?
- [ ] 앱에서 에뮬레이터 감지 Toast 메시지가 나타나는가?
- [ ] 네트워크 보안 설정이 올바른가?
- [ ] 방화벽이 3000 포트를 차단하고 있지 않은가?

## 🎯 빠른 테스트

1. 개발 서버 실행:
   ```bash
   cd frontend && npm run dev -- --host 0.0.0.0
   ```

2. 에뮬레이터에서 브라우저 열고 접속:
   ```
   http://10.0.2.2:3000
   ```

3. 접속되면 SMAP 앱 실행하여 확인

---

**이 설정으로 에뮬레이터에서도 개발 서버에 정상적으로 연결될 것입니다! 🚀** 