#!/usr/bin/env python3

import os
import sys
import requests
import json
sys.path.append('backend')

print("🔄 FCM 토큰 강제 업데이트 도구")
print("=" * 50)

# 환경 설정
try:
    import firebase_admin
    from firebase_admin import credentials, messaging

    if not firebase_admin._apps:
        cred = credentials.Certificate('backend/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json')
        firebase_admin.initialize_app(cred)
    print("✅ Firebase 초기화 성공")
except Exception as e:
    print(f"❌ Firebase 초기화 실패: {e}")
    sys.exit(1)

# 사용자 입력
print("\n🔑 토큰 업데이트 정보 입력:")
current_db_token = input("현재 DB에 저장된 FCM 토큰: ").strip()
new_device_token = input("새로운 디바이스 FCM 토큰 (없으면 현재 토큰 사용): ").strip()
mt_idx = input("회원 ID (mt_idx): ").strip()

if not current_db_token or not mt_idx:
    print("❌ DB 토큰과 회원 ID는 필수입니다")
    sys.exit(1)

# 새 토큰이 없으면 현재 토큰 사용
if not new_device_token:
    new_device_token = current_db_token
    print("ℹ️ 새 토큰이 입력되지 않아 현재 DB 토큰을 사용합니다")

# 토큰 비교
print("
📊 토큰 비교:"    print(f"   💾 DB 토큰: {current_db_token[:30]}...")
print(f"   📱 새 토큰: {new_device_token[:30]}...")
print(f"   👤 회원 ID: {mt_idx}")

if current_db_token == new_device_token:
    print("✅ 두 토큰이 동일합니다")
else:
    print("⚠️ 토큰이 다릅니다 - 업데이트 필요!")

# 백엔드 API로 토큰 업데이트
print("
🔄 백엔드 API로 토큰 업데이트 시도..."try:
    api_url = "https://api3.aiagnt.kr/api/v1/member-fcm-token/register"

    payload = {
        "mt_idx": int(mt_idx),
        "fcm_token": new_device_token
    }

    print(f"   🌐 API URL: {api_url}")
    print(f"   📤 요청 데이터: {json.dumps(payload, indent=2)}")

    response = requests.post(api_url, json=payload, timeout=10)

    print(f"   📡 응답 상태: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print("✅ 백엔드 토큰 업데이트 성공!")
        print(f"   📋 결과: {json.dumps(result, indent=2, ensure_ascii=False)}")

        # Firebase로 테스트 메시지 발송
        print("
📤 Firebase로 테스트 메시지 발송..."        message = messaging.Message(
            notification=messaging.Notification(
                title='🔄 FCM 토큰 업데이트 완료',
                body=f'토큰이 성공적으로 업데이트되었습니다 (mt_idx: {mt_idx})'
            ),
            data={
                'update_type': 'token_sync',
                'mt_idx': mt_idx,
                'timestamp': str(int(__import__('time').time() * 1000))
            },
            token=new_device_token,
        )

        firebase_response = messaging.send(message)
        print(f"✅ Firebase 테스트 메시지 발송 성공: {firebase_response}")

    else:
        print(f"❌ 백엔드 API 오류: {response.status_code}")
        print(f"   📄 응답: {response.text}")

except Exception as e:
    print(f"❌ 토큰 업데이트 실패: {e}")

print("\n" + "=" * 50)
print("✅ FCM 토큰 강제 업데이트 완료")

if current_db_token != new_device_token:
    print("
💡 권장사항:"    print("1. iOS 앱을 재시작해서 새로운 토큰을 확인하세요")
    print("2. Xcode 로그에서 토큰 동기화 상태를 확인하세요")
    print("3. FCM 메시지가 정상적으로 수신되는지 테스트하세요")
else:
    print("
✅ 토큰이 이미 동기화되어 있습니다"    print("FCM 메시지 수신이 정상적이라면 추가 조치가 필요하지 않습니다")
