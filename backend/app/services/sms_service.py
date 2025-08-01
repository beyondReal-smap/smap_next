import os
import aiohttp
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

            async with aiohttp.ClientSession() as session:
                async with session.post(self.aligo_url, data=data) as response:
                    result = await response.json()
                    
                    if result.get('result_code') == '1':
                        logger.info(f"✅ SMS 발송 성공: {clean_phone[:3]}***")
                        return {
                            'success': True,
                            'message': 'SMS가 성공적으로 발송되었습니다.',
                            'msg_id': result.get('msg_id')
                        }
                    else:
                        logger.error(f"❌ SMS 발송 실패: {result.get('message', '알 수 없는 오류')}")
                        return {
                            'success': False,
                            'message': result.get('message', 'SMS 발송에 실패했습니다.')
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