#!/usr/bin/env python3

import os
import sys
import time
import json
import requests
from datetime import datetime, timedelta

# FCM 토큰 모니터링 및 자동 갱신 스크립트
print("🔍 FCM 토큰 자동 모니터링 시스템")
print("=" * 50)

class FCMTokenMonitor:
    def __init__(self):
        self.backend_url = "https://api3.smap.site"
        self.check_interval = 300  # 5분마다 체크
        self.warning_days = 3      # 만료 3일 전부터 경고
        self.max_retries = 3       # 최대 재시도 횟수
        
    def get_all_fcm_tokens(self):
        """모든 FCM 토큰 정보 조회"""
        try:
            # 실제 구현에서는 백엔드 API를 통해 모든 토큰을 조회
            # 현재는 샘플 데이터 사용
            sample_tokens = [
                {
                    "mt_idx": 1186,
                    "token": "euWDxWueMEb6uAhmrYeDyF:APA91bF-9jNdry5NMa3viQ3k3uB9bQiiyqFKzYXX1toj6o9er6UNUZV-WHWjBowPiaX53EZ1w9-jGlA0mvXGEGdqeweIruuQxwiFcyOKAlUTi4LzGhSKSHE",
                    "last_updated": "2025-08-30T19:52:39",
                    "is_expired": False
                }
            ]
            return sample_tokens
            
        except Exception as e:
            print(f"❌ 토큰 조회 실패: {e}")
            return []
    
    def validate_token(self, token_data):
        """FCM 토큰 유효성 검증"""
        try:
            url = f"{self.backend_url}/api/v1/member-fcm-token/validate"
            payload = {
                "mt_idx": token_data["mt_idx"],
                "fcm_token": token_data["token"],
                "validate_only": True,
                "auto_recover": True
            }
            
            response = requests.post(url, json=payload, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ 토큰 검증 성공: 사용자 {token_data['mt_idx']}")
                return result
            else:
                print(f"❌ 토큰 검증 실패: 사용자 {token_data['mt_idx']} - HTTP {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ 토큰 검증 중 오류: {e}")
            return None
    
    def check_token_expiry(self, token_data):
        """토큰 만료 상태 확인"""
        try:
            last_updated = datetime.fromisoformat(token_data["last_updated"].replace('Z', '+00:00'))
            days_since_update = (datetime.now() - last_updated).days
            
            if days_since_update >= 7:
                return "expired"
            elif days_since_update >= (7 - self.warning_days):
                return "warning"
            else:
                return "valid"
                
        except Exception as e:
            print(f"❌ 만료 확인 중 오류: {e}")
            return "unknown"
    
    def monitor_tokens(self):
        """FCM 토큰 모니터링 메인 루프"""
        print("🚀 FCM 토큰 모니터링 시작...")
        
        while True:
            try:
                print(f"\n📅 [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 토큰 검증 시작")
                
                tokens = self.get_all_fcm_tokens()
                print(f"📊 총 {len(tokens)}개의 토큰을 모니터링 중")
                
                expired_count = 0
                warning_count = 0
                valid_count = 0
                
                for token_data in tokens:
                    mt_idx = token_data["mt_idx"]
                    expiry_status = self.check_token_expiry(token_data)
                    
                    if expiry_status == "expired":
                        print(f"⏰ 만료됨: 사용자 {mt_idx} - 토큰 갱신 필요")
                        expired_count += 1
                        
                        # 토큰 검증 및 복구 시도
                        validation_result = self.validate_token(token_data)
                        if validation_result:
                            print(f"🔄 복구 시도됨: 사용자 {mt_idx}")
                            
                    elif expiry_status == "warning":
                        print(f"⚠️ 만료 임박: 사용자 {mt_idx} - {7 - (datetime.now() - datetime.fromisoformat(token_data['last_updated'].replace('Z', '+00:00'))).days}일 남음")
                        warning_count += 1
                        
                    else:
                        print(f"✅ 유효함: 사용자 {mt_idx}")
                        valid_count += 1
                        
                        # 주기적인 검증 (선택사항)
                        # validation_result = self.validate_token(token_data)
                
                print("
📈 모니터링 결과:"                print(f"   ✅ 유효 토큰: {valid_count}개")
                print(f"   ⚠️ 만료 임박: {warning_count}개") 
                print(f"   ⏰ 만료됨: {expired_count}개")
                
                print(f"⏳ 다음 검증까지 {self.check_interval}초 대기...")
                time.sleep(self.check_interval)
                
            except KeyboardInterrupt:
                print("\n🛑 모니터링 중단됨")
                break
            except Exception as e:
                print(f"❌ 모니터링 중 오류: {e}")
                time.sleep(60)  # 오류 시 1분 대기 후 재시도

def main():
    monitor = FCMTokenMonitor()
    monitor.monitor_tokens()

if __name__ == "__main__":
    main()
