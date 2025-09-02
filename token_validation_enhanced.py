#!/usr/bin/env python3
"""
FCM 토큰 유효성 검증 강화 스크립트
백그라운드 푸시 알림 문제 해결을 위한 토큰 관리 개선
"""

import requests
import json
import time
from datetime import datetime, timedelta
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EnhancedTokenValidator:
    def __init__(self, base_url="https://api3.smap.site/api/v1"):
        self.base_url = base_url
        self.session = requests.Session()
        
    def validate_token_background_capability(self, member_id, fcm_token):
        """
        FCM 토큰의 백그라운드 푸시 수신 능력을 검증
        """
        logger.info(f"🔍 [Token Validation] 회원 {member_id}의 백그라운드 푸시 능력 검증 시작")
        
        # 1. 토큰 기본 유효성 검사
        if not self._validate_token_format(fcm_token):
            logger.error(f"❌ [Token Validation] 잘못된 토큰 형식: {fcm_token[:30]}...")
            return False, "토큰 형식 오류"
            
        # 2. 서버 토큰 상태 확인
        server_status = self._check_server_token_status(member_id, fcm_token)
        if not server_status['valid']:
            logger.warning(f"⚠️ [Token Validation] 서버 토큰 상태 이상: {server_status['reason']}")
            return False, server_status['reason']
            
        # 3. 백그라운드 푸시 테스트
        background_test = self._test_background_push_capability(member_id, fcm_token)
        if not background_test['success']:
            logger.error(f"❌ [Token Validation] 백그라운드 푸시 테스트 실패: {background_test['reason']}")
            return False, background_test['reason']
            
        logger.info(f"✅ [Token Validation] 회원 {member_id} 백그라운드 푸시 능력 검증 통과")
        return True, "백그라운드 푸시 지원"
        
    def _validate_token_format(self, token):
        """FCM 토큰 형식 검증"""
        if not token or len(token) < 100:
            return False
        if not token.replace('-', '').replace('_', '').replace(':', '').isalnum():
            return False
        return True
        
    def _check_server_token_status(self, member_id, fcm_token):
        """서버에서 토큰 상태 확인"""
        try:
            url = f"{self.base_url}/member-fcm-token/validate-and-refresh"
            payload = {
                "mt_idx": member_id,
                "fcm_token": fcm_token,
                "validation_type": "background_check"
            }
            
            response = self.session.post(url, json=payload, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return {
                    'valid': data.get('success', False),
                    'reason': data.get('message', '알 수 없는 오류')
                }
            else:
                return {
                    'valid': False,
                    'reason': f"HTTP {response.status_code}"
                }
                
        except Exception as e:
            logger.error(f"❌ [Server Check] 서버 토큰 상태 확인 실패: {e}")
            return {
                'valid': False,
                'reason': f"네트워크 오류: {e}"
            }
            
    def _test_background_push_capability(self, member_id, fcm_token):
        """백그라운드 푸시 수신 능력 테스트"""
        try:
            url = f"{self.base_url}/fcm-sendone"
            payload = {
                "plt_type": "BACKGROUND_TEST",
                "sst_idx": "0",
                "plt_condition": "백그라운드 푸시 테스트",
                "plt_memo": f"백그라운드 푸시 능력 테스트 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                "mt_idx": member_id,
                "plt_title": "🔋 백그라운드 테스트",
                "plt_content": "백그라운드에서 수신되면 성공입니다",
                "background_mode": True  # 백그라운드 모드로 전송
            }
            
            response = self.session.post(url, json=payload, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                success = data.get('success') == 'true'
                return {
                    'success': success,
                    'reason': data.get('message', '백그라운드 푸시 전송 완료')
                }
            else:
                return {
                    'success': False,
                    'reason': f"푸시 전송 실패 - HTTP {response.status_code}"
                }
                
        except Exception as e:
            logger.error(f"❌ [Background Test] 백그라운드 푸시 테스트 실패: {e}")
            return {
                'success': False,
                'reason': f"테스트 실패: {e}"
            }
            
    def refresh_expired_tokens(self):
        """만료된 토큰들을 일괄 갱신"""
        logger.info("🔄 [Token Refresh] 만료된 토큰 일괄 갱신 시작")
        
        try:
            # 만료 임박 토큰 조회
            url = f"{self.base_url}/member-fcm-token/expired-tokens"
            response = self.session.get(url, timeout=10)
            
            if response.status_code != 200:
                logger.error(f"❌ [Token Refresh] 만료 토큰 조회 실패: HTTP {response.status_code}")
                return False
                
            expired_tokens = response.json().get('tokens', [])
            logger.info(f"📊 [Token Refresh] 만료 임박 토큰 {len(expired_tokens)}개 발견")
            
            # 각 토큰에 대해 갱신 요청
            refreshed_count = 0
            for token_info in expired_tokens:
                member_id = token_info.get('mt_idx')
                if self._request_token_refresh(member_id):
                    refreshed_count += 1
                    
            logger.info(f"✅ [Token Refresh] {refreshed_count}/{len(expired_tokens)}개 토큰 갱신 완료")
            return True
            
        except Exception as e:
            logger.error(f"❌ [Token Refresh] 토큰 갱신 프로세스 실패: {e}")
            return False
            
    def _request_token_refresh(self, member_id):
        """특정 회원의 토큰 갱신 요청"""
        try:
            url = f"{self.base_url}/member-fcm-token/force-refresh"
            payload = {
                "mt_idx": member_id,
                "reason": "백그라운드 푸시 최적화"
            }
            
            response = self.session.post(url, json=payload, timeout=10)
            if response.status_code == 200:
                logger.info(f"✅ [Token Refresh] 회원 {member_id} 토큰 갱신 요청 성공")
                return True
            else:
                logger.warning(f"⚠️ [Token Refresh] 회원 {member_id} 토큰 갱신 요청 실패: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"❌ [Token Refresh] 회원 {member_id} 토큰 갱신 요청 실패: {e}")
            return False
            
    def generate_token_health_report(self):
        """토큰 상태 종합 리포트 생성"""
        logger.info("📊 [Token Report] 토큰 상태 종합 리포트 생성 시작")
        
        try:
            url = f"{self.base_url}/member-fcm-token/health-report"
            response = self.session.get(url, timeout=15)
            
            if response.status_code == 200:
                report = response.json()
                
                print("\n" + "="*80)
                print("📊 FCM 토큰 상태 종합 리포트")
                print("="*80)
                print(f"📅 생성 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"👥 전체 사용자: {report.get('total_users', 0):,}명")
                print(f"🔑 유효한 토큰: {report.get('valid_tokens', 0):,}개")
                print(f"⚠️  만료 임박 토큰: {report.get('expiring_tokens', 0):,}개")
                print(f"❌ 만료된 토큰: {report.get('expired_tokens', 0):,}개")
                print(f"📱 iOS 토큰: {report.get('ios_tokens', 0):,}개")
                print(f"🤖 Android 토큰: {report.get('android_tokens', 0):,}개")
                print(f"🔋 백그라운드 푸시 지원: {report.get('background_capable', 0):,}개")
                print("="*80)
                
                # 권장사항 출력
                recommendations = report.get('recommendations', [])
                if recommendations:
                    print("\n💡 권장사항:")
                    for i, rec in enumerate(recommendations, 1):
                        print(f"   {i}. {rec}")
                        
                return True
                
            else:
                logger.error(f"❌ [Token Report] 리포트 생성 실패: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"❌ [Token Report] 리포트 생성 실패: {e}")
            return False

def main():
    """메인 실행 함수"""
    print("🔧 FCM 토큰 유효성 검증 강화 도구")
    print("백그라운드 푸시 알림 문제 해결용")
    print("-" * 50)
    
    validator = EnhancedTokenValidator()
    
    # 1. 토큰 상태 리포트 생성
    print("\n📊 1단계: 토큰 상태 종합 분석")
    validator.generate_token_health_report()
    
    # 2. 만료된 토큰 갱신
    print("\n🔄 2단계: 만료된 토큰 일괄 갱신")
    validator.refresh_expired_tokens()
    
    # 3. 샘플 토큰 검증 (테스트용)
    print("\n🧪 3단계: 샘플 토큰 백그라운드 푸시 능력 검증")
    sample_member_id = 1186  # 테스트용 회원 ID
    
    # 현재 토큰 조회
    try:
        url = f"{validator.base_url}/member-fcm-token/status/{sample_member_id}"
        response = validator.session.get(url, timeout=10)
        
        if response.status_code == 200:
            token_data = response.json()
            if token_data.get('has_token'):
                fcm_token = token_data.get('full_token', '')
                if fcm_token:
                    is_valid, reason = validator.validate_token_background_capability(sample_member_id, fcm_token)
                    print(f"📋 검증 결과: {'✅ 성공' if is_valid else '❌ 실패'} - {reason}")
                else:
                    print("❌ FCM 토큰을 가져올 수 없습니다")
            else:
                print("❌ 해당 회원의 FCM 토큰이 없습니다")
        else:
            print(f"❌ 토큰 조회 실패: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ 샘플 토큰 검증 실패: {e}")
    
    print("\n✅ FCM 토큰 유효성 검증 완료!")
    print("📖 상세 가이드: ios_background_push_fix_guide.md 참조")

if __name__ == "__main__":
    main()
