import os
import aiohttp
import json
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

class SMSService:
    def __init__(self):
        self.aligo_user_id = settings.ALIGO_USER_ID
        self.aligo_key = settings.ALIGO_KEY
        self.aligo_sender = settings.ALIGO_SENDER
        self.aligo_url = 'https://apis.aligo.in/send/'
        
        # Fixie 프록시 설정 (고정 IP 사용)
        self.fixie_url = os.getenv('FIXIE_URL')  # 예: http://fixie:PASSWORD@velodrome.usefixie.com:80
        self.use_proxy = bool(self.fixie_url)
        
        if self.use_proxy:
            logger.info(f"🔒 Fixie 프록시 사용: {self.fixie_url.split('@')[1] if '@' in self.fixie_url else 'enabled'}")

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

            # 프록시 설정
            connector = None
            if self.use_proxy:
                connector = aiohttp.TCPConnector()
                logger.info(f"🔒 프록시를 통해 SMS 발송")

            async with aiohttp.ClientSession(connector=connector) as session:
                # 프록시 URL 설정
                request_kwargs = {'data': data}
                if self.use_proxy:
                    request_kwargs['proxy'] = self.fixie_url
                
                async with session.post(self.aligo_url, **request_kwargs) as response:
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
        message = f"[SMAP] 비밀번호 재설정 링크\n{reset_url}\n1분 내에 사용해주세요."
        
        return await self.send_sms(
            phone_number=phone_number,
            message=message,
            subject="SMAP 비밀번호 재설정"
        )

# 싱글톤 인스턴스
sms_service = SMSService() 