#!/usr/bin/env python3

import os
import sys
sys.path.append('backend')

# 간단한 FCM 테스트 스크립트
print("🔍 FCM 상태 확인 및 테스트 메시지 전송")
print("=" * 50)

# 환경변수 확인
print("📋 환경변수 상태:")
firebase_env_vars = [
    'FIREBASE_CREDENTIALS_JSON',
    'GOOGLE_APPLICATION_CREDENTIALS', 
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL'
]

for var in firebase_env_vars:
    value = os.getenv(var)
    if value:
        if 'PRIVATE_KEY' in var:
            print(f"✅ {var}: {'*' * 20}... (설정됨, 길이: {len(value)})")
        else:
            print(f"✅ {var}: {value[:50]}... (설정됨)")
    else:
        print(f"❌ {var}: 설정되지 않음")

print("\n🔍 Firebase 인증서 파일 존재 확인:")
firebase_files = [
    'backend/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json',
    'backend/app/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json'
]

for file_path in firebase_files:
    if os.path.exists(file_path):
        print(f"✅ {file_path}: 존재함")
    else:
        print(f"❌ {file_path}: 존재하지 않음")

print("\n🧪 FCM 서비스 초기화 테스트:")
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    
    # Firebase 초기화 시도
    try:
        firebase_admin.get_app()
        print("✅ Firebase Admin SDK: 이미 초기화됨")
    except ValueError:
        print("�� Firebase Admin SDK: 초기화 시도 중...")
        
        # 방법 1: 환경변수에서 JSON
        firebase_credentials_json = os.getenv('FIREBASE_CREDENTIALS_JSON')
        if firebase_credentials_json:
            try:
                import json
                cred_dict = json.loads(firebase_credentials_json)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                print("✅ Firebase 초기화 성공 (환경변수 JSON)")
            except Exception as e:
                print(f"❌ Firebase 초기화 실패 (환경변수): {e}")
        
        # 방법 2: 파일에서
        elif os.path.exists('backend/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json'):
            try:
                cred = credentials.Certificate('backend/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json')
                firebase_admin.initialize_app(cred)
                print("✅ Firebase 초기화 성공 (파일)")
            except Exception as e:
                print(f"❌ Firebase 초기화 실패 (파일): {e}")
        else:
            print("❌ Firebase 인증 정보가 없음")
    
    # 테스트 메시지 전송 (더미 토큰 사용)
    test_token = "fXqDFxeJ5UD0hDji1DVCHy:APA91bFLXuEpYC6DJ8upACPkHdeYUgFAzotsD7fjBv1F2ZFFyCRRb6K22Jy3JMupQkmlirHrJxhuKAu9MGL7-xv5NHnTrzHqoh1---GsS2vXM6K2EJCjMjE"  # 예시 토큰
    
    print("\n📤 FCM 테스트 메시지 전송 시도:")
    print(f"   대상 토큰: {test_token[:30]}...")
    
    import time
    current_time = int(time.time())
    
    message = messaging.Message(
        data={
            'title': '🧪 FCM 테스트',
            'body': f'FCM 테스트 메시지 - {current_time}',
            'custom_data': 'fcm_test_simple',
            'timestamp': str(current_time * 1000)
        },
        notification=messaging.Notification(
            title='🧪 FCM 테스트',
            body=f'FCM 테스트 메시지 - {current_time}'
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
                    alert=messaging.ApsAlert(title='🧪 FCM 테스트', body=f'FCM 테스트 메시지 - {current_time}'),
                    sound='default',
                    badge=1,
                    content_available=True,
                    mutable_content=True,
                    category="GENERAL"
                )
            )
        ),
        token=test_token,
    )
    
    response = messaging.send(message)
    print(f"✅ FCM 테스트 메시지 전송 성공: {response}")
    print("📱 iOS Swift 로그에서 다음 메시지들을 확인하세요:")
    print("   📨 [FCM] FCM 메시지 수신 시작")
    print("   📨 [FCM] FCM 메시지 수신 #N")
    print("   📨 [FCM] Dictionary 타입 메시지 수신")
    print("   ✅ [FCM] FCM 메시지 수신 처리 완료")
    
except ImportError as e:
    print(f"❌ Firebase Admin SDK가 설치되지 않음: {e}")
except Exception as e:
    print(f"❌ FCM 테스트 실패: {e}")

print("\n" + "=" * 50)
print("✅ FCM 상태 확인 및 테스트 완료")
