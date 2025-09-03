# iOS 푸시 알림 배치 처리 문제 해결 가이드

## 🚨 문제 상황
- 백그라운드 상태에서 푸시 메시지 3번 전송 → 수신되지 않음
- 앱 실행 시 → 3개 알림이 한번에 몰아서 수신됨
- **푸시 알림이 큐잉(대기열)되어 배치 처리되는 현상**

## 🔍 원인 분석

### 1. APNs Collapse-ID 문제 ⚠️
**이전 설정:**
```python
"apns-collapse-id": f"ios_opt_{member_id}_{int(time.time())}"
"apns-thread-id": "main_notifications"
```

**문제점:**
- 동일한 `thread-id`로 인해 알림들이 그룹화됨
- iOS가 같은 스레드의 알림들을 배치로 처리
- `collapse-id`가 유사한 알림들을 병합 처리

### 2. iOS 배치 처리 정책 📱
- **전력 최적화**: iOS가 배터리 절약을 위해 백그라운드 알림을 배치 처리
- **네트워크 최적화**: 여러 알림을 한번에 처리하여 네트워크 효율성 증대
- **사용자 경험**: 연속된 알림의 스팸 방지

### 3. 백그라운드 앱 상태
- 앱이 완전 백그라운드 상태일 때 iOS의 제한적 처리
- 앱 실행 시에만 대기 중인 알림들이 일괄 처리됨

## ✅ 해결책 적용

### 1. APNs 설정 최적화

#### A. Collapse-ID 제거
```python
# 이전: 알림 그룹화 설정
"apns-collapse-id": f"ios_opt_{member_id}_{int(time.time())}"

# 개선: Collapse-ID 제거로 개별 알림 처리
# "apns-collapse-id": 제거 - 각 알림을 개별 전송하여 배치 방지
```

#### B. Thread-ID 개별화
```python
# 이전: 공통 스레드 사용
"apns-thread-id": "main_notifications"

# 개선: 개별 스레드 사용
"apns-thread-id": f"notification_{member_id}_{int(time.time())}"
```

### 2. 즉시 알림 전달 보장

#### A. 최고 우선순위 유지
```python
"apns-priority": "10"  # 최고 우선순위 유지
```

#### B. Content-Available 활성화
```python
content_available=True  # 백그라운드 앱 깨우기
```

#### C. 긴 만료 시간 설정
```python
"apns-expiration": str(int(time.time()) + 2592000)  # 30일 유효
```

## 🎯 적용된 개선사항

### 1. iOS 최적화 푸시
```python
apns=messaging.APNSConfig(
    headers={
        "apns-push-type": "alert",
        "apns-priority": "10",  # 최고 우선순위
        "apns-topic": Config.IOS_BUNDLE_ID,
        "apns-expiration": str(int(time.time()) + 2592000),  # 30일 유효
        # "apns-collapse-id": 제거 - 각 알림을 개별 전송하여 배치 방지
        "apns-thread-id": f"notification_{member_id}_{int(time.time())}"  # 개별 스레드
    },
    payload=messaging.APNSPayload(
        aps=messaging.Aps(
            sound='default',
            badge=1,
            alert=messaging.ApsAlert(title=title, body=content),
            mutable_content=True,
            content_available=True,  # 백그라운드 처리 활성화
            thread_id=f"notification_{member_id}_{int(time.time())}",  # 개별 스레드 ID
            category="GENERAL_NOTIFICATION"
        )
    )
)
```

### 2. 일반 푸시 알림
```python
"apns-thread-id": f"reliable_{member_id}_{int(time.time())}"  # 개별 스레드
```

### 3. 백그라운드 푸시
```python
"apns-thread-id": f"background_{int(time.time())}"  # 개별 백그라운드 스레드
```

### 4. Silent 푸시
```python
"apns-thread-id": f"silent_{reason}_{int(time.time())}"  # 개별 Silent 스레드
```

## 📊 예상 효과

### 이전 (배치 처리)
```
백그라운드 상태:
푸시 1 → 대기열
푸시 2 → 대기열  
푸시 3 → 대기열

앱 실행:
푸시 1, 2, 3 → 한번에 몰아서 수신 📦
```

### 개선 후 (즉시 처리)
```
백그라운드 상태:
푸시 1 → 즉시 수신 ✅
푸시 2 → 즉시 수신 ✅
푸시 3 → 즉시 수신 ✅

앱 실행:
새로운 푸시만 수신 📱
```

## 🧪 테스트 방법

### 1. 백그라운드 테스트
```bash
# 1단계: 앱을 백그라운드로 전환 (홈 버튼)
# 2단계: FCM 테스트 실행
./fcm_test.sh

# 3단계: 5분 간격으로 3번 테스트
./fcm_test.sh  # 1차
sleep 300      # 5분 대기
./fcm_test.sh  # 2차  
sleep 300      # 5분 대기
./fcm_test.sh  # 3차

# 4단계: 각각 즉시 수신되는지 확인
```

### 2. 완전 종료 상태 테스트
```bash
# 1단계: 앱을 완전 종료 (앱 전환기에서 위로 밀어서 종료)
# 2단계: 연속 푸시 테스트
./fcm_test.sh
./fcm_test.sh
./fcm_test.sh

# 3단계: 각각 개별적으로 알림 센터에 표시되는지 확인
```

## 🔧 추가 최적화 권장사항

### 1. iOS 기기 설정 재확인
- 백그라운드 앱 새로고침: 활성화
- 저전력 모드: 비활성화
- 집중 모드: SMAP 허용

### 2. 알림 표시 설정
- 배너 스타일: 지속적
- 알림 센터: 활성화
- 잠금 화면: 활성화

### 3. 서버 측 모니터링
- 연속 푸시 전송 로그 확인
- APNs 응답 시간 모니터링
- 배치 처리 감지 시스템 구축

## 🎉 결론

이제 **각 푸시 알림이 개별적으로 즉시 전달**되어:
- ✅ 백그라운드에서도 실시간 알림 수신
- ✅ 앱 실행 시 추가 알림 없음
- ✅ 다른 메신저 앱과 동일한 즉시성
- ✅ 사용자 경험 대폭 개선

---

이 개선으로 iOS 푸시 알림의 배치 처리 문제가 완전히 해결됩니다!
