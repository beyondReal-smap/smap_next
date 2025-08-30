#!/usr/bin/env python3

import os
import sys
import time
import json

# FCM 토큰 강제 갱신을 위한 스크립트
print("🔄 FCM 토큰 강제 갱신 스크립트")
print("=" * 50)

# Firebase 초기화
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    
    if not firebase_admin._apps:
        if os.path.exists('backend/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json'):
            cred = credentials.Certificate('backend/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json')
            firebase_admin.initialize_app(cred)
            print("✅ Firebase 초기화 성공")
        else:
            print("❌ Firebase 인증서 파일 없음")
            sys.exit(1)
    
    # FCM 토큰 강제 갱신 메시지 전송
    token = "fXqDFxeJ5UD0hDji1DVCHy:APA91bFLXuEpYC6DJ8upACPkHdeYUgFAzotsD7fjBv1F2ZFFyCRRb6K22Jy3JMupQkmlirHrJxhuKAu9MGL7-xv5NHnTrzHqoh1---GsS2vXM6K2EJCjMjE"
    current_time = int(time.time())
    
    print("📤 FCM 토큰 강제 갱신 메시지 전송...")
    print(f"대상 토큰: {token[:30]}...")
    
    message = messaging.Message(
        data={
            'title': '🔄 FCM 토큰 갱신',
            'body': f'FCM 토큰 강제 갱신 요청 - {current_time}',
            'custom_data': 'force_token_refresh',
            'timestamp': str(current_time * 1000),
            'force_token_update': 'true',
            'reason': 'manual_refresh_test'
        },
        notification=messaging.Notification(
            title='🔄 FCM 토큰 갱신',
            body=f'FCM 토큰 강제 갱신 요청 - {current_time}'
        ),
        android=messaging.AndroidConfig(
            priority='high',
            notification=messaging.AndroidNotification(
                sound='default',
                channel_id='default'
            )
        ),
        apns=messaging.APNSConfig(
            headers={
                "apns-push-type": "background",
                "apns-priority": "5",
                "apns-topic": "com.dmonster.smap",
                "apns-expiration": str(current_time + 300)
            },
            payload=messaging.APNSPayload(
                aps=messaging.Aps(
                    content_available=True,
                    custom_data={
                        'force_token_update': 'true',
                        'reason': 'manual_refresh_test',
                        'background_wake': 'true'
                    }
                )
            )
        ),
        token=token,
    )
    
    response = messaging.send(message)
    print(f"✅ FCM 토큰 갱신 메시지 전송 성공: {response}")
    
    print("\n📱 iOS Xcode 콘솔에서 다음 로그들을 확인하세요:")
    print("   🔍 [FCM DEBUG] 전체 FCM 토큰: {전체 토큰}")
    print("   🔄 [FCM] FCM 토큰 수신: {토큰 prefix}")
    print("   🔄 [FCM BACKGROUND] 백그라운드 FCM 토큰 강제 갱신 시작")
    print("   ✅ [FCM BACKGROUND] 새로운 FCM 토큰 생성됨")
    print("   📨 [FCM] FCM 메시지 수신 시작")
    print("   📨 [FCM] APNs payload 상세:")
    
    print("\n🔍 FCM 토큰 강제 갱신 결과:")
    print("1. iOS 앱이 백그라운드에서 실행 중이어야 함")
    print("2. FCM 토큰이 자동으로 갱신됨")
    print("3. 새로운 토큰이 Xcode 콘솔에 전체 값으로 표시됨")
    print("4. 이 새로운 토큰으로 FCM 테스트 가능")
    
except ImportError as e:
    print(f"❌ Firebase SDK 설치 필요: {e}")
except Exception as e:
    print(f"❌ 오류 발생: {e}")

print("\n" + "=" * 50)
print("✅ FCM 토큰 강제 갱신 완료")
