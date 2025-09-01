#!/usr/bin/env python3
"""
Direct FCM Test Script
FCM 메시지를 직접 전송하여 iOS 앱의 다중 레벨 디버깅 시스템 테스트
"""

import firebase_admin
from firebase_admin import credentials, messaging
import json
from datetime import datetime

# FCM 토큰들 (로그에서 확인한 토큰들)
TOKENS = {
    "DB_토큰": "cyU1UdY_bEayu8-KWty4n6:APA91bFWvtLQQ_eSf7Cl4ja7c8y-wvYcQrXEyrRHF-5xgfCAg1XgcenetEy___WEC2javMjQxlPB1sIxgVBnIZ5cVc3SctTtb3D9XazMmYplw_hK5lFSrEU",
    "현재_iOS_토큰": "eNghU-YVVUoFv6IRvnkAet:APA91bGSOd4Ml4f3N0tfbTw8At98ufURFEvVV0GlJQkCdJWlcbBd0AxoJcoHloLUhY3Ug9AT7LU9TfZazwH3H-jXXdfexIP0MPrwkyOwaOfV-ckgoO3ZXYY",
    "이전_FCM_토큰": "d2P_-7S3-08grwuLvdFB3C:APA91bEaubweY3yDQ6HdqcYn3IGh1XEP0sS5U_jHkAS8jgjiASY03WbRi2K3HhEKv6IhF3m699IraAu4lANxl4Mo1kTyTwoxnFjPBZXrNJG9lz_PvkPgG0Y"
}

FCM_TOKEN = TOKENS["DB_토큰"]  # 기본값

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

def send_test_fcm_message(token, token_name):
    """테스트 FCM 메시지 전송"""
    current_time = datetime.now()

    # 테스트 메시지 생성
    title = f"🧪 FCM 토큰 테스트 - {token_name}"
    body = f"FCM 메시지 수신 테스트 - {token_name} ({current_time.strftime('%Y-%m-%d %H:%M:%S')})"

    print(f"\n📤 [{token_name}] FCM 메시지 전송 준비...")
    print(f"📝 제목: {title}")
    print(f"📝 내용: {body}")
    print(f"📝 토큰: {token[:50]}...")

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
                'notification_id': f'test_{token_name}_{int(current_time.timestamp())}',
                'app_state': 'test',
                'token_type': token_name
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
                'apns-collapse-id': f'test_{token_name}_{int(current_time.timestamp())}',
                'apns-thread-id': 'test'
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
                    mutable_content=True,
                    thread_id='test'
                )
            )
        ),
        token=token,
    )

    try:
        # FCM 메시지 전송
        print(f"🚀 [{token_name}] FCM 메시지 전송 중...")
        response = messaging.send(message)
        print(f"✅ [{token_name}] FCM 메시지 전송 성공! 응답: {response}")
        print(f"🎯 [{token_name}] iOS 앱에서 알림이 표시되어야 합니다")

        return True

    except messaging.UnregisteredError as e:
        print(f"❌ [{token_name}] FCM 토큰이 등록되지 않았습니다: {e}")
        return False

    except messaging.InvalidArgumentError as e:
        print(f"❌ [{token_name}] FCM 토큰 형식이 잘못되었습니다: {e}")
        return False

    except Exception as e:
        print(f"❌ [{token_name}] FCM 메시지 전송 실패: {e}")
        return False

def test_all_tokens():
    """모든 토큰으로 FCM 메시지 전송 테스트"""
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║ 🧪 3가지 FCM 토큰으로 메시지 전송 테스트 시작                 ║")
    print("╚══════════════════════════════════════════════════════════════╝")

    results = {}

    for token_name, token in TOKENS.items():
        print(f"\n{'='*60}")
        print(f"🧪 {token_name} 테스트 시작")
        print(f"{'='*60}")

        success = send_test_fcm_message(token, token_name)
        results[token_name] = success

        # 각 토큰 테스트 사이에 잠시 대기
        if token_name != list(TOKENS.keys())[-1]:  # 마지막 토큰이 아니면
            print("⏳ 3초 대기...")
            import time
            time.sleep(3)

    # 결과 요약
    print(f"\n{'='*60}")
    print("📊 테스트 결과 요약")
    print(f"{'='*60}")

    for token_name, success in results.items():
        status = "✅ 성공" if success else "❌ 실패"
        print(f"{token_name}: {status}")

    total_success = sum(results.values())
    print(f"\n🎯 총 {len(TOKENS)}개 토큰 중 {total_success}개 성공")
    print("💡 iOS 앱의 Notification Center에서 알림을 확인하세요!")

    return results

def main():
    """메인 함수"""
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║ 🧪 FCM 3가지 토큰 테스트 시작                                 ║")
    print("╚══════════════════════════════════════════════════════════════╝")

    # Firebase 초기화
    if not initialize_firebase():
        return

    # 모든 토큰으로 FCM 메시지 전송 테스트
    results = test_all_tokens()

    print("\n📋 테스트 완료!")
    print("💡 iOS 앱에서 다음과 같은 로그가 나타나야 합니다:")
    print("   • 🔔 [FCM] FCM 메시지 수신")
    print("   • 📱 [FCM] Notification Center에 알림 표시")
    print("\n🔍 iOS 앱의 Notification Center에서 3개의 테스트 알림을 확인하세요!")

    # 성공한 토큰이 있는지 확인
    successful_tokens = [name for name, success in results.items() if success]
    if successful_tokens:
        print(f"\n🎯 성공한 토큰들: {', '.join(successful_tokens)}")
        print("💡 이 토큰들 중 하나가 현재 iOS 기기에서 유효한 토큰입니다!")
    else:
        print("\n❌ 모든 토큰이 실패했습니다. 토큰이 모두 만료되었을 수 있습니다.")

if __name__ == "__main__":
    main()
