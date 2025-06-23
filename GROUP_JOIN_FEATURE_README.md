# 그룹 가입 기능 구현 완료

## 구현된 기능

### 1. 웹 페이지 (`/group/[id]/join`)

#### 주요 기능:
- **그룹 정보 표시**: 그룹 제목, 설명, 멤버 수 등 표시
- **앱 설치/열기**: 모바일에서 SMAP 앱 설치 또는 열기
- **웹에서 가입**: 웹에서 바로 회원가입 후 그룹 가입
- **딥링크 지원**: 앱이 설치된 경우 직접 앱으로 이동

#### 버튼 구성:
1. **SMAP 앱에서 열기** (모바일만 표시)
   - 앱이 설치되어 있으면 딥링크로 앱 열기
   - 앱이 설치되어 있지 않으면 스토어로 이동
   
2. **웹에서 그룹 가입하기**
   - 로그인되어 있지 않으면 회원가입 페이지로 이동
   - 로그인되어 있으면 바로 그룹 가입

3. **앱 다운로드 링크** (데스크탑만 표시)
   - App Store 및 Play Store 링크 제공

### 2. 회원가입 페이지 (`/register`)

#### 자동 그룹 가입 기능:
- 그룹 초대 링크에서 회원가입 시 자동으로 해당 그룹에 가입
- 가입 완료 후 그룹 페이지로 자동 이동
- 그룹 가입 중 로딩 상태 표시

### 3. 딥링크 지원

#### iOS:
- 커스텀 스키마: `smap://group/{groupId}/join`
- Universal Links 지원 (선택사항)

#### Android:
- 커스텀 스키마: `smap://group/{groupId}/join`
- Intent URL: `intent://group/{groupId}/join#Intent;scheme=smap;package=com.dmonster.smap;...`
- App Links 지원 (선택사항)

## 앱 스토어 링크

### iOS App Store:
```
https://apps.apple.com/kr/app/smap-%EC%9C%84%EC%B9%98%EC%B6%94%EC%A0%81-%EC%9D%B4%EB%8F%99%EA%B2%BD%EB%A1%9C-%EC%9D%BC%EC%A0%95/id6480279658?platform=iphone
```

### Google Play Store:
```
https://play.google.com/store/apps/details?id=com.dmonster.smap&hl=ko
```

## 사용자 플로우

### 시나리오 1: 앱이 설치된 경우
1. 사용자가 그룹 초대 링크 접속
2. "SMAP 앱에서 열기" 버튼 클릭
3. 딥링크로 앱이 열림
4. 앱에서 그룹 가입 처리

### 시나리오 2: 앱이 설치되지 않은 경우
1. 사용자가 그룹 초대 링크 접속
2. "SMAP 앱에서 열기" 버튼 클릭
3. 스토어로 이동하여 앱 설치
4. 앱 설치 후 로그인하면 자동으로 그룹 가입

### 시나리오 3: 웹에서 가입
1. 사용자가 그룹 초대 링크 접속
2. "웹에서 그룹 가입하기" 버튼 클릭
3. 회원가입 페이지로 이동
4. 회원가입 완료 후 자동으로 그룹 가입
5. 그룹 페이지로 이동

## 기술적 구현

### 웹 페이지 (`frontend/src/app/group/[id]/join/page.tsx`)
- 그룹 정보 조회 및 표시
- 플랫폼 감지 (iOS/Android/Desktop)
- 앱 설치 여부 감지
- 딥링크 실행
- localStorage를 통한 그룹 정보 전달

### 회원가입 페이지 (`frontend/src/app/register/page.tsx`)
- 자동 그룹 가입 처리
- 가입 완료 후 그룹 가입 시도
- 로딩 상태 관리
- 그룹 페이지로 자동 이동

### 앱 설정 가이드
- `iOS_DEEP_LINK_SETUP.md`: iOS 앱 딥링크 설정
- `ANDROID_DEEP_LINK_SETUP.md`: Android 앱 딥링크 설정

## 데이터 흐름

### 그룹 정보 전달:
1. 그룹 초대 페이지에서 `localStorage.setItem('pendingGroupJoin', JSON.stringify({...}))`
2. 회원가입 완료 후 `localStorage.getItem('pendingGroupJoin')`으로 정보 확인
3. 그룹 가입 API 호출
4. 성공 시 localStorage 정리

### 딥링크 처리:
1. 웹에서 `smap://group/{groupId}/join` 실행
2. 앱에서 URL 파싱하여 그룹 ID 추출
3. 앱 내부 저장소에 그룹 정보 저장
4. 앱 시작 시 저장된 정보 확인하여 그룹 가입 처리

## 테스트 방법

### 웹 테스트:
1. `/group/123/join` 페이지 접속
2. 각 버튼 클릭하여 동작 확인
3. 회원가입 플로우 테스트

### 앱 테스트:
1. 앱 설치 후 딥링크 테스트
2. `smap://group/123/join` 실행
3. 그룹 가입 처리 확인

## 주의사항

1. **앱 설치 여부 감지**: 완벽하지 않을 수 있으므로 타임아웃 기반으로 처리
2. **로그인 상태**: 그룹 가입은 로그인된 상태에서만 가능
3. **딥링크**: 앱이 설치되어 있어야 작동
4. **타임아웃**: 그룹 가입 정보는 5분 이내에만 유효

## 향후 개선 사항

1. **더 정확한 앱 설치 감지**: 더 정교한 방법으로 앱 설치 여부 확인
2. **에러 처리 강화**: 네트워크 오류, API 오류 등에 대한 더 나은 처리
3. **사용자 피드백**: 그룹 가입 성공/실패에 대한 명확한 피드백
4. **분석 도구**: 그룹 가입 전환율 추적을 위한 분석 도구 추가 