import smtplib
import ssl
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any
import logging
from app.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        self.sender_email = settings.EMAIL_SENDER
        self.sender_password = settings.EMAIL_PASSWORD
        
    async def send_password_reset_email(self, email: str, reset_url: str) -> Dict[str, Any]:
        """
        비밀번호 재설정 이메일 발송
        """
        try:
            # 개발 환경에서는 Mock 처리
            if os.getenv('NODE_ENV') == 'development' or not self.sender_email or self.sender_email == 'your-email@gmail.com':
                logger.info(f"📧 [개발환경] 이메일 발송 Mock: {email}")
                logger.info(f"📧 [개발환경] 재설정 링크: {reset_url}")
                
                return {
                    "success": True,
                    "message": "이메일이 성공적으로 발송되었습니다. (개발환경 Mock)",
                    "email": email,
                    "dev": True
                }
            
            # 이메일 메시지 생성
            subject = "[SMAP] 비밀번호 재설정 링크"
            
            html_content = f"""
            <html>
            <body>
                <h2>SMAP 비밀번호 재설정</h2>
                <p>안녕하세요!</p>
                <p>비밀번호 재설정을 요청하셨습니다.</p>
                <p>아래 링크를 클릭하여 비밀번호를 재설정해주세요:</p>
                <p><a href="{reset_url}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;">비밀번호 재설정</a></p>
                <p>또는 아래 링크를 복사하여 브라우저에 붙여넣기 하세요:</p>
                <p>{reset_url}</p>
                <p><strong>주의사항:</strong></p>
                <ul>
                    <li>이 링크는 1분 후에 만료됩니다.</li>
                    <li>본인이 요청하지 않았다면 이 이메일을 무시하세요.</li>
                    <li>보안을 위해 링크를 다른 사람과 공유하지 마세요.</li>
                </ul>
                <p>감사합니다.</p>
                <p>SMAP 팀</p>
            </body>
            </html>
            """
            
            text_content = f"""
            SMAP 비밀번호 재설정
            
            안녕하세요!
            
            비밀번호 재설정을 요청하셨습니다.
            아래 링크를 클릭하여 비밀번호를 재설정해주세요:
            
            {reset_url}
            
            주의사항:
            - 이 링크는 1분 후에 만료됩니다.
            - 본인이 요청하지 않았다면 이 이메일을 무시하세요.
            - 보안을 위해 링크를 다른 사람과 공유하지 마세요.
            
            감사합니다.
            SMAP 팀
            """
            
            # 이메일 메시지 생성
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = self.sender_email
            message["To"] = email
            
            # HTML과 텍스트 버전 추가
            text_part = MIMEText(text_content, "plain", "utf-8")
            html_part = MIMEText(html_content, "html", "utf-8")
            
            message.attach(text_part)
            message.attach(html_part)
            
            # SMTP 서버 연결 및 이메일 발송
            context = ssl.create_default_context()
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls(context=context)
                server.login(self.sender_email, self.sender_password)
                server.send_message(message)
            
            logger.info(f"✅ 이메일 발송 성공: {email}")
            
            return {
                "success": True,
                "message": "이메일이 성공적으로 발송되었습니다.",
                "email": email
            }
            
        except Exception as e:
            logger.error(f"❌ 이메일 발송 실패: {str(e)}")
            return {
                "success": False,
                "message": f"이메일 발송에 실패했습니다: {str(e)}",
                "email": email
            }

# 이메일 서비스 인스턴스 생성
email_service = EmailService() 