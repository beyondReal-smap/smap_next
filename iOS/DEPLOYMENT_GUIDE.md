# SMAP iOS 웹뷰 앱 배포 가이드

frontend 폴더의 Next.js 애플리케이션을 iOS 웹뷰로 감싸는 하이브리드 앱의 배포 가이드입니다.

## 📱 프로젝트 개요

- **웹 URL**: https://next.smap.site
- **Bundle ID**: com.dmonster.smap
- **최소 iOS 버전**: 13.0
- **아키텍처**: 웹뷰 하이브리드 앱

## 🛠 배포 전 준비사항

### 1. 개발 환경 설정
```bash
# Xcode 설치 (App Store에서)
# CocoaPods 설치
sudo gem install cocoapods

# 프로젝트 의존성 설치
cd iOS
pod install
```

### 2. 웹 애플리케이션 확인
- **next.smap.site**가 정상적으로 배포되어 있는지 확인
- HTTPS 연결이 안정적인지 확인
- 모바일 반응형 디자인이 적용되어 있는지 확인

### 3. Firebase 설정 확인
- `GoogleService-Info.plist` 파일이 올바른지 확인
- FCM(Firebase Cloud Messaging) 설정 확인
- APNs 인증서 등록 확인

## 🔧 프로젝트 설정

### 1. Xcode 프로젝트 열기
```bash
cd iOS
open smap.xcworkspace  # .xcodeproj가 아닌 .xcworkspace 열기
```

### 2. 프로젝트 설정 확인
1. **General** 탭
   - Display Name: `SMAP`
   - Bundle Identifier: `com.dmonster.smap`
   - Version: `1.0`
   - Build: `1`
   - Deployment Target: `13.0`

2. **Signing & Capabilities** 탭
   - Team 선택
   - Bundle Identifier 확인
   - Push Notifications 추가
   - Background Modes 추가
     - Background fetch
     - Remote notifications

3. **Build Settings** 탭
   - iOS Deployment Target: `13.0`
   - Architectures: `Standard architectures`

### 3. 빌드 설정 확인
- **Debug**: 개발/테스트용
  - localhost 접근 허용
  - 자세한 로그 출력
- **Release**: 배포용
  - next.smap.site만 허용
  - 최적화된 빌드

## 🚀 빌드 및 테스트

### 1. 시뮬레이터에서 테스트
```bash
# Xcode에서 시뮬레이터 선택 후 ⌘+R
```

확인사항:
- [ ] 웹페이지가 정상적으로 로드되는가
- [ ] 네비게이션이 원활한가
- [ ] 푸시 알림 권한 요청이 작동하는가
- [ ] JavaScript 브릿지가 정상 작동하는가

### 2. 실제 기기에서 테스트
1. iOS 기기를 Mac에 연결
2. Xcode에서 기기 선택
3. 개발자 인증서로 서명 후 설치
4. 설정 > 일반 > VPN 및 기기 관리에서 개발자 앱 신뢰

확인사항:
- [ ] 실제 네트워크에서 웹페이지 로드
- [ ] 푸시 알림 수신 테스트
- [ ] 딥링크 동작 테스트
- [ ] 배터리 사용량 확인

## 📦 App Store 배포

### 1. 아카이브 생성
1. Xcode에서 **Product > Archive** 선택
2. 아카이브 완료까지 대기
3. Organizer에서 아카이브 확인

### 2. App Store Connect 업로드
1. Organizer에서 **Distribute App** 선택
2. **App Store Connect** 선택
3. **Upload** 선택
4. 서명 설정 확인 후 업로드

### 3. App Store Connect 설정
1. [App Store Connect](https://appstoreconnect.apple.com) 접속
2. 앱 정보 입력:
   - 앱 이름: `SMAP`
   - 부제목: `스마트 일정 관리`
   - 설명: 앱 상세 설명
   - 키워드: `일정관리,위치공유,그룹관리`
   - 카테고리: `생산성`

3. 스크린샷 업로드:
   - iPhone 6.7" (필수)
   - iPhone 6.5" (필수)
   - iPhone 5.5" (선택)
   - iPad Pro (12.9") (선택)

4. 앱 검토 정보:
   - 테스트 계정 정보
   - 검토 노트 작성

### 4. 심사 제출
1. 빌드 선택
2. 앱 정보 검토
3. **심사 제출** 클릭

## 🔄 업데이트 배포

### 웹 애플리케이션 업데이트
- Next.js 앱만 업데이트하면 앱 심사 없이 즉시 반영
- 새로운 기능이나 버그 수정이 자동으로 적용

### 네이티브 앱 업데이트
네이티브 코드 변경 시:
1. Version 또는 Build 번호 증가
2. 새로운 아카이브 생성
3. App Store Connect 업로드
4. 앱 심사 진행

## ⚠️ 주의사항

### 보안
- HTTPS만 사용 (HTTP 차단됨)
- 신뢰할 수 있는 도메인만 허용
- 사용자 데이터 보호

### 성능
- 웹뷰 메모리 사용량 모니터링
- 네트워크 연결 상태 확인
- 앱 응답성 최적화

### 앱 스토어 정책
- 웹뷰 앱도 App Store 가이드라인 준수 필요
- 네이티브 기능 제공으로 차별화
- 웹과 동일한 콘텐츠만 표시 금지

## 🐛 트러블슈팅

### 빌드 오류
```bash
# CocoaPods 캐시 정리
pod cache clean --all
pod deintegrate
pod install

# Xcode 파생 데이터 삭제
rm -rf ~/Library/Developer/Xcode/DerivedData/
```

### 웹페이지 로딩 실패
1. 네트워크 연결 확인
2. 도메인 설정 확인 (`Info.plist`)
3. HTTPS 인증서 확인

### 푸시 알림 문제
1. APNs 인증서 유효성 확인
2. Firebase 프로젝트 설정 확인
3. 번들 ID 일치 여부 확인

## 📞 지원

문제가 발생하면 다음을 확인하세요:
1. 로그 확인 (Xcode Console)
2. 네트워크 상태 확인
3. 기기 호환성 확인

---

**중요**: 배포 전 반드시 실제 기기에서 충분한 테스트를 진행하세요. 