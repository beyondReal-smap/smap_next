#!/usr/bin/env python3

import os
import sys
import time
import json

# iOS FCM 디버깅 스크립트
print("🔧 iOS FCM 수신 디버깅 도구")
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
    
    # 테스트할 FCM 토큰들
    test_tokens = [
        "fXqDFxeJ5UD0hDji1DVCHy:APA91bFLXuEpYC6DJ8upACPkHdeYUgFAzotsD7fjBv1F2ZFFyCRRb6K22Jy3JMupQkmlirHrJxhuKAu9MGL7-xv5NHnTrzHqoh1---GsS2vXM6K2EJCjMjE",
        "eODCX1Ru-07Tq4K5NaLm",  # 백엔드에서 확인된 토큰 (일부만)
    ]
    
    print("\n🧪 FCM 토큰별 메시지 전송 테스트:")
    
    for i, token in enumerate(test_tokens, 1):
        print(f"\n📤 토큰 {i} 테스트: {token[:30]}...")
        
        current_time = int(time.time())
        
        try:
            message = messaging.Message(
                data={
                    'title': f'🧪 FCM 디버그 {i}',
                    'body': f'iOS FCM 수신 테스트 {i} - {current_time}',
                    'custom_data': f'ios_debug_{i}',
                    'timestamp': str(current_time * 1000),
                    'debug_test': 'true',
                    'test_number': str(i)
                },
                notification=messaging.Notification(
                    title=f'🧪 FCM 디버그 {i}',
                    body=f'iOS FCM 수신 테스트 {i} - {current_time}'
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
                        "apns-push-type": "alert",
                        "apns-priority": "10",
                        "apns-topic": "com.dmonster.smap",
                        "apns-expiration": str(current_time + 300)
                    },
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            alert=messaging.ApsAlert(
                                title=f'🧪 FCM 디버그 {i}',
                                body=f'iOS FCM 수신 테스트 {i} - {current_time}'
                            ),
                            sound='default',
                            badge=i,
                            content_available=True,
                            mutable_content=True,
                            category="GENERAL"
                        )
                    )
                ),
                token=token,
            )
            
            response = messaging.send(message)
            print(f"✅ 전송 성공: {response}")
            
        except Exception as e:
            print(f"❌ 전송 실패: {e}")
    
    print("\n📱 iOS Xcode 콘솔에서 다음 로그들을 확인하세요:")
    print("   📨 [FCM] FCM 메시지 수신 시작")
    print("   📨 [FCM] FCM 메시지 수신 #N")
    print("   📨 [FCM] Dictionary 타입 메시지 수신")
    print("   🧪 FCM 디버그 N (메시지 내용에 포함)")
    print("   ✅ [FCM] FCM 메시지 수신 처리 완료")
    
    print("\n🔍 문제 해결 가이드:")
    print("1. iOS 앱이 백그라운드에서 실행 중인지 확인")
    print("2. 설정 > 알림 > SMAP 앱 권한 확인")
    print("3. Xcode 콘솔에서 FCM 관련 로그 확인")
    print("4. 앱을 완전히 종료 후 다시 실행해보기")
    
except ImportError as e:
    print(f"❌ Firebase SDK 설치 필요: {e}")
except Exception as e:
    print(f"❌ 오류 발생: {e}")

print("\n" + "=" * 50)
print("✅ iOS FCM 디버깅 완료")
