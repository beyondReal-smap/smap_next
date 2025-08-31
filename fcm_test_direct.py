#!/usr/bin/env python3
"""
Direct FCM Test Script
FCM 메시지를 직접 전송하여 iOS 앱의 다중 레벨 디버깅 시스템 테스트
"""

import firebase_admin
from firebase_admin import credentials, messaging
import json
from datetime import datetime

# FCM 토큰 (로그에서 확인한 토큰)
FCM_TOKEN = "fXEtO2SpOU05gZuZkeSfVD:APA91bF8pqJ_odIToPyTzzeZGTi6qIU9gXjv5eFFWIwgIoVgJm6jQlBp2_Vc46tqeC8_KpVAiinSg-XslG016H04qe3bjtorus561uETKX14v2MA1MGT5J4"

# Firebase 서비스 계정 키 파일 경로
SERVICE_ACCOUNT_KEY_PATH = "/Users/genie/SmapSource/smap_next/backend/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json"

def initialize_firebase():
    """Firebase 앱 초기화"""
    try:
        firebase_admin.get_app()
        print("✅ Firebase 앱이 이미 초기화되어 있습니다")
    except ValueError:
        try:
            cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
            firebase_admin.initialize_app(cred)
            print("✅ Firebase 앱 초기화 성공")
        except Exception as e:
            print(f"❌ Firebase 앱 초기화 실패: {e}")
            return False
    return True

def send_test_fcm_message():
    """테스트 FCM 메시지 전송"""
    current_time = datetime.now()

    # 테스트 메시지 생성
    title = "🧪 FCM 다중 레벨 디버깅 테스트"
    body = f"FCM 메시지 수신 테스트 - {current_time.strftime('%Y-%m-%d %H:%M:%S')}"

    print("📤 FCM 메시지 전송 준비...")
    print(f"📝 제목: {title}")
    print(f"📝 내용: {body}")
    print(f"📝 토큰: {FCM_TOKEN[:50]}...")

    # FCM 메시지 구성
    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body
        ),
        data={
            'title': title,
            'body': body,
            'custom_data': json.dumps({
                'ios_push': True,
                'notification_id': f'test_{int(current_time.timestamp())}',
                'app_state': 'test'
            })
        },
        android=messaging.AndroidConfig(
            priority='high',
            notification=messaging.AndroidNotification(
                sound='default',
                priority='high'
            )
        ),
        apns=messaging.APNSConfig(
            headers={
                'apns-push-type': 'alert',
                'apns-priority': '10',
                'apns-topic': 'com.dmonster.smap',
            },
            payload=messaging.APNSPayload(
                aps=messaging.Aps(
                    alert=messaging.ApsAlert(
                        title=title,
                        body=body
                    ),
                    badge=1,
                    sound='default',
                    category='GENERAL',
                    content_available=True,
                    mutable_content=True
                )
            )
        ),
        token=FCM_TOKEN,
    )

    try:
        # FCM 메시지 전송
        print("🚀 FCM 메시지 전송 중...")
        response = messaging.send(message)
        print(f"✅ FCM 메시지 전송 성공! 응답: {response}")
        print("🎯 iOS 앱에서 다중 레벨 디버깅 시스템이 실행되어야 합니다")

        return True

    except messaging.UnregisteredError as e:
        print(f"❌ FCM 토큰이 등록되지 않았습니다: {e}")
        return False

    except messaging.InvalidArgumentError as e:
        print(f"❌ FCM 토큰 형식이 잘못되었습니다: {e}")
        return False

    except Exception as e:
        print(f"❌ FCM 메시지 전송 실패: {e}")
        return False

def main():
    """메인 함수"""
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║ 🧪 FCM 다중 레벨 디버깅 시스템 테스트 시작                      ║")
    print("╚══════════════════════════════════════════════════════════════╝")

    # Firebase 초기화
    if not initialize_firebase():
        return

    # FCM 메시지 전송
    if send_test_fcm_message():
        print("\n📋 테스트 완료!")
        print("💡 iOS 앱에서 다음과 같은 로그가 나타나야 합니다:")
        print("   • 🔔 [FCM] FCM 메시지 수신 후 알림 표시 시도 #1 (0.3초)")
        print("   • 🔔 [FCM] FCM 메시지 수신 후 알림 표시 시도 #2 (0.6초)")
        print("   • 📱 [FCM] FCM 메시지 수신 후 Notification Center 상태 확인")
        print("   • ✅ [FCM SUCCESS] FCM 메시지가 Notification Center에 정상 표시")
        print("\n🔍 Notification Center에서 테스트 알림을 확인하세요!")
    else:
        print("\n❌ FCM 메시지 전송 실패")

if __name__ == "__main__":
    main()
