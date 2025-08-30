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
    
    # 토큰 목록 - DB에 저장된 토큰과 이전 토큰 비교
    tokens_to_test = [
        {
            "name": "현재 DB 토큰 (2025-08-30 20:25:29)",
            "token": "f7Tc8eXAwkW1s0irB0wpS6:APA91bFRuyzX9HBmoNdFvLmCUrYv1FD2RNm3tIeugFMiIOTeb5aG4Hlwjh0LZhJiXK5jEN8r_xoRVjTPKfS9jiaUM0OrA5HYc9L1n0KHyf0VqUuSBhQxNZk"
        },
        {
            "name": "이전 토큰 (2025-08-30 21:32:06)",
            "token": "diyqlVHetUAav2L6C2IhMu:APA91bEJxihlN6o9YjQEDYGGT2m74vaB7Z1ey2ZSszSPV-wrVLpYCQbHMUYmJKAeiJTS22N7Gp91UPpUYfQUYTV9m8wPC4FI1v_9_dbuGhuplGactA_GyBM"
        }
    ]
    
    print("\n📤 FCM 토큰별 테스트 메시지 전송:")
    print("=" * 60)

    import time
    current_time = int(time.time())

    # 각 토큰별로 메시지 발송
    for i, token_info in enumerate(tokens_to_test, 1):
        print(f"\n🔄 토큰 #{i} 테스트: {token_info['name']}")
        print(f"   토큰: {token_info['token'][:30]}...")

        # 1. 먼저 토큰 유효성 검증 (dry-run)
        print("   🔍 토큰 유효성 검증 중...")
        try:
            test_message = messaging.Message(
                data={'test_validation': 'true', 'timestamp': str(current_time * 1000)},
                token=token_info['token'],
            )
            # dry_run=True로 실제 발송하지 않고 검증만 수행
            messaging.send(test_message, dry_run=True)
            print("   ✅ 토큰 유효성 검증 성공")
        except messaging.UnregisteredError as e:
            print(f"   ❌ 토큰 등록 해제됨 (Unregistered): {str(e)}")
            print("   📝 이 토큰은 더 이상 유효하지 않습니다.")
        except Exception as e:
            print(f"   ⚠️ 토큰 검증 중 오류: {str(e)}")

        # 2. 실제 메시지 발송
        print("   📤 실제 메시지 발송 중...")
        try:
            message = messaging.Message(
                data={
                    'title': f'🧪 FCM 토큰 테스트 #{i}',
                    'body': f'FCM 토큰 테스트 메시지 #{i} - {current_time}',
                    'custom_data': f'fcm_token_test_{i}',
                    'timestamp': str(current_time * 1000),
                    'token_info': token_info['name']
                },
                notification=messaging.Notification(
                    title=f'🧪 FCM 토큰 테스트 #{i}',
                    body=f'FCM 토큰 테스트 메시지 #{i} - {current_time}'
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
                                title=f'🧪 FCM 토큰 테스트 #{i}',
                                body=f'FCM 토큰 테스트 메시지 #{i} - {current_time}'
                            ),
                            sound='default',
                            badge=i,
                            content_available=True,
                            mutable_content=True,
                            category="GENERAL"
                        )
                    )
                ),
                token=token_info['token'],
            )

            response = messaging.send(message)
            print(f"✅ 토큰 #{i} 메시지 전송 성공: {response}")

        except messaging.UnregisteredError as e:
            print(f"❌ 토큰 #{i} 등록 해제됨 (Unregistered): {str(e)}")
            print("   📝 이 토큰은 더 이상 유효하지 않습니다.")
        except messaging.InvalidArgumentError as e:
            print(f"❌ 토큰 #{i} 잘못된 형식 (Invalid): {str(e)}")
            print("   📝 토큰 형식이 올바르지 않습니다.")
        except Exception as e:
            print(f"❌ 토큰 #{i} 전송 실패: {str(e)}")

        # 각 토큰별로 잠시 대기
        if i < len(tokens_to_test):
            print("   ⏳ 다음 토큰 테스트 준비 중...")
            time.sleep(2)

    print("\n" + "=" * 60)
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
