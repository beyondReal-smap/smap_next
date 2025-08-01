import os
import aiohttp
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class SMSService:
    def __init__(self):
        self.aligo_user_id = os.getenv('ALIGO_USER_ID', 'smap2023')
        self.aligo_key = os.getenv('ALIGO_KEY', '6uvw7alcd1v1u6dx5thv31lzic8mxfrt')
        self.aligo_sender = os.getenv('ALIGO_SENDER', '070-8065-2207')
        self.aligo_url = 'https://apis.aligo.in/send/'

    async def send_sms(self, phone_number: str, message: str, subject: str = "SMAP") -> dict:
        """
        SMS 발송 함수
        """
        try:
            # 전화번호 정리 (하이픈 제거)
            clean_phone = phone_number.replace('-', '').replace(' ', '')
            
            # FormData 형태로 데이터 준비
            data = {
                'user_id': self.aligo_user_id,
                'key': self.aligo_key,
                'msg': message,
                'receiver': clean_phone,
                'destination': '',
                'sender': self.aligo_sender,
                'rdate': '',
                'rtime': '',
                'testmode_yn': 'N',
                'title': subject,
                'msg_type': 'SMS'
            }

            logger.info(f"📱 SMS 발송 시도: {clean_phone[:3]}***")
            logger.info(f"📱 SMS API URL: {self.aligo_url}")

            async with aiohttp.ClientSession() as session:
                async with session.post(self.aligo_url, data=data) as response:
                    # 응답 상태 코드 확인
                    logger.info(f"📱 SMS API 응답 상태: {response.status}")
                    
                    # 응답 텍스트 먼저 확인
                    response_text = await response.text()
                    logger.info(f"📱 SMS API 응답 내용: {response_text}")
                    
                    # JSON 파싱 시도 (Content-Type에 관계없이)
                    try:
                        result = json.loads(response_text)
                        logger.info(f"📱 SMS API JSON 응답: {result}")
                    except Exception as json_error:
                        logger.warning(f"📱 SMS API JSON 파싱 실패: {json_error}")
                        # HTML 응답인 경우 기본 실패 응답 생성
                        result = {
                            'result_code': '0',
                            'message': f'API 응답 파싱 실패: {response_text[:100]}'
                        }
                    
                    if result.get('result_code') == '1':
                        logger.info(f"✅ SMS 발송 성공: {clean_phone[:3]}***")
                        return {
                            'success': True,
                            'message': 'SMS가 성공적으로 발송되었습니다.',
                            'msg_id': result.get('msg_id')
                        }
                    else:
                        error_msg = result.get('message', '알 수 없는 오류')
                        logger.error(f"❌ SMS 발송 실패: {error_msg}")
                        return {
                            'success': False,
                            'message': error_msg
                        }

        except Exception as e:
            logger.error(f"❌ SMS 발송 중 오류: {str(e)}")
            return {
                'success': False,
                'message': f'SMS 발송 중 오류가 발생했습니다: {str(e)}'
            }

    async def send_password_reset_sms(self, phone_number: str, reset_url: str) -> dict:
        """
        비밀번호 재설정 SMS 발송
        """
        message = f"[SMAP] 비밀번호 재설정 링크입니다.{reset_url}"
        
        return await self.send_sms(
            phone_number=phone_number,
            message=message,
            subject="SMAP 비밀번호 재설정"
        )

# 싱글톤 인스턴스
sms_service = SMSService() 