#!/usr/bin/env python3

import os
import sys
import time
import firebase_admin
from firebase_admin import credentials, messaging

# Firebase 인증서 경로
CRED_PATH = 'backend/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json'

def send_fcm_test(token):
    """제공된 토큰으로 FCM 테스트 메시지 전송"""

    print("🔍 FCM 토큰 테스트 시작")
    print("=" * 50)
    print(f"📱 테스트 토큰: {token[:50]}...")

    try:
        # Firebase 초기화
        if not firebase_admin._apps:
            cred = credentials.Certificate(CRED_PATH)
            firebase_admin.initialize_app(cred)
            print("✅ Firebase 초기화 성공")

        current_time = int(time.time())

        # 1. 토큰 유효성 검증 (dry-run)
        print("\n🔍 토큰 유효성 검증 중...")
        try:
            test_message = messaging.Message(
                data={'test_validation': 'true', 'timestamp': str(current_time * 1000)},
                token=token,
            )
            messaging.send(test_message, dry_run=True)
            print("✅ 토큰 유효성 검증 성공")
        except messaging.UnregisteredError as e:
            print(f"❌ 토큰 등록 해제됨 (Unregistered): {str(e)}")
            return False
        except Exception as e:
            print(f"⚠️ 토큰 검증 중 오류: {str(e)}")

        # 2. 실제 FCM 메시지 전송
        print("\n📤 FCM 메시지 전송 중...")
        message = messaging.Message(
            data={
                'title': '🧪 FCM 토큰 테스트',
                'body': f'FCM 토큰 테스트 메시지 - {current_time}',
                'custom_data': f'fcm_token_test_{current_time}',
                'timestamp': str(current_time * 1000),
                'token_info': '사용자 제공 토큰'
            },
            notification=messaging.Notification(
                title='🧪 FCM 토큰 테스트',
                body=f'FCM 토큰 테스트 메시지 - {current_time}'
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
                            title='🧪 FCM 토큰 테스트',
                            body=f'FCM 토큰 테스트 메시지 - {current_time}'
                        ),
                        sound='default',
                        badge=1,
                        content_available=True,
                        mutable_content=True,
                        category="GENERAL"
                    )
                )
            ),
            token=token,
        )

        response = messaging.send(message)
        print(f"✅ FCM 메시지 전송 성공: {response}")

        print("\n📱 iOS 디바이스에서 다음을 확인하세요:")
        print("   📨 FCM 메시지 수신")
        print("   📨 Dictionary 타입 메시지 수신")
        print("   ✅ FCM 메시지 수신 처리 완료")

        return True

    except messaging.UnregisteredError as e:
        print(f"❌ 토큰 등록 해제됨 (Unregistered): {str(e)}")
        return False
    except messaging.InvalidArgumentError as e:
        print(f"❌ 잘못된 토큰 형식 (Invalid): {str(e)}")
        return False
    except Exception as e:
        print(f"❌ FCM 전송 실패: {str(e)}")
        return False

if __name__ == "__main__":
    # 사용자가 제공한 토큰
    user_token = "ca8lttgAMEjFu91yEL8ggX:APA91bH6lSTS8Wf8YMe0APm40guCKiwbPTjVYXS2o830lVilna74T-TEztM33XFwW6NRqYP4VpujfRJ-1-Fy65jSQlEYTMx0YNw7JUCROTcO92HwAwIqwdE"

    success = send_fcm_test(user_token)

    print("\n" + "=" * 50)
    if success:
        print("✅ FCM 토큰 테스트 완료 (성공)")
    else:
        print("❌ FCM 토큰 테스트 완료 (실패)")

    print("\n💡 추가 테스트:")
    print("   - iOS 디바이스에서 알림 수신 확인")
    print("   - Android 디바이스에서 알림 수신 확인")
    print("   - 앱 로그에서 FCM 메시지 처리 확인")
