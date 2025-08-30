#!/usr/bin/env python3

import os
import sys
import requests
import json
sys.path.append('backend')

print("🔍 FCM 토큰 동기화 디버깅 도구")
print("=" * 50)

# 1. 환경 설정 확인
print("📋 환경 설정 확인:")
try:
    import firebase_admin
    from firebase_admin import credentials, messaging

    # Firebase 초기화
    if not firebase_admin._apps:
        cred = credentials.Certificate('backend/com-dmonster-smap-firebase-adminsdk-2zx5p-2610556cf5.json')
        firebase_admin.initialize_app(cred)
    print("✅ Firebase 초기화 성공")
except Exception as e:
    print(f"❌ Firebase 초기화 실패: {e}")
    sys.exit(1)

# 2. 토큰 정보 입력받기
print("\n🔑 토큰 정보 입력:")
current_db_token = input("현재 DB에 저장된 FCM 토큰: ").strip()
actual_device_token = input("실제 디바이스에서 확인된 FCM 토큰 (없으면 엔터): ").strip()

if not current_db_token:
    print("❌ DB 토큰을 입력해주세요")
    sys.exit(1)

# 3. 토큰 유효성 검증
tokens_to_test = []
if current_db_token:
    tokens_to_test.append({"name": "DB 저장 토큰", "token": current_db_token})
if actual_device_token:
    tokens_to_test.append({"name": "실제 디바이스 토큰", "token": actual_device_token})

print(f"\n🧪 토큰 검증 시작 ({len(tokens_to_test)}개 토큰):")

for i, token_info in enumerate(tokens_to_test, 1):
    print(f"\n🔄 토큰 #{i}: {token_info['name']}")

    try:
        # Dry-run으로 토큰 유효성 검증
        test_message = messaging.Message(
            data={'test_validation': 'true', 'timestamp': str(int(__import__('time').time() * 1000))},
            token=token_info['token'],
        )
        messaging.send(test_message, dry_run=True)
        print("   ✅ Firebase 검증: 유효한 토큰")

        # 실제 메시지 발송 테스트
        message = messaging.Message(
            notification=messaging.Notification(
                title=f'🧪 토큰 검증 #{i}',
                body=f'{token_info["name"]} 토큰으로 발송된 테스트 메시지'
            ),
            data={
                'test_type': 'token_validation',
                'token_name': token_info['name'],
                'timestamp': str(int(__import__('time').time() * 1000))
            },
            token=token_info['token'],
        )

        response = messaging.send(message)
        print(f"   ✅ 메시지 발송 성공: {response}")

    except messaging.UnregisteredError as e:
        print(f"   ❌ 등록 해제됨: 이 토큰은 더 이상 유효하지 않습니다")
        print(f"   📝 오류: {str(e)}")
    except Exception as e:
        print(f"   ❌ 검증 실패: {str(e)}")

print("\n" + "=" * 50)
print("📋 분석 결과:")

if len(tokens_to_test) == 2:
    if tokens_to_test[0]['token'] == tokens_to_test[1]['token']:
        print("✅ 두 토큰이 동일합니다 - 동기화되어 있습니다")
    else:
        print("⚠️ 두 토큰이 다릅니다 - 동기화 필요!")
        print(f"   DB 토큰: {tokens_to_test[0]['token'][:30]}...")
        print(f"   디바이스 토큰: {tokens_to_test[1]['token'][:30]}...")

print("\n🔧 해결 방법:")
print("1. 실제 디바이스 토큰을 DB에 업데이트하세요")
print("2. 백엔드 API로 토큰 동기화 요청을 보내보세요")
print("3. 앱을 재시작해서 토큰 갱신을 유도해보세요")

print("\n✅ FCM 토큰 동기화 디버깅 완료")
