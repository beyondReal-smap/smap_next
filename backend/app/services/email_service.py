import smtplib
import ssl
import os
import aiohttp
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 465  # SSL 포트로 변경
        self.sender_email = settings.EMAIL_SENDER
        self.sender_password = settings.EMAIL_PASSWORD
        
        # 네이버웍스 설정
        self.naverworks_client_id = os.getenv('NAVERWORKS_CLIENT_ID')
        self.naverworks_client_secret = os.getenv('NAVERWORKS_CLIENT_SECRET')
        self.naverworks_domain = os.getenv('NAVERWORKS_DOMAIN')
        self.naverworks_access_token = None
        
    async def get_naverworks_access_token(self) -> str:
        """
        네이버웍스 액세스 토큰 획득 (OAuth2 구성원 계정 인증)
        """
        if not self.naverworks_client_id or not self.naverworks_client_secret:
            raise Exception("네이버웍스 클라이언트 정보가 설정되지 않았습니다.")
            
        try:
            import aiohttp
            import urllib.parse
            async with aiohttp.ClientSession() as session:
                token_url = "https://auth.worksmobile.com/oauth2/v2.0/token"
                
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
                
                # OAuth2 구성원 계정 인증 방식
                data = urllib.parse.urlencode({
                    'grant_type': 'client_credentials',
                    'client_id': self.naverworks_client_id,
                    'client_secret': self.naverworks_client_secret,
                    'scope': 'mail mail.read'
                })
                
                logger.info(f"🔑 네이버웍스 토큰 요청 URL: {token_url}")
                logger.info(f"🔑 네이버웍스 클라이언트 ID: {self.naverworks_client_id}")
                
                async with session.post(token_url, data=data, headers=headers) as response:
                    logger.info(f"🔑 네이버웍스 토큰 응답 상태: {response.status}")
                    
                    if response.status == 200:
                        result = await response.json()
                        self.naverworks_access_token = result.get('access_token')
                        logger.info("✅ 네이버웍스 액세스 토큰 획득 성공")
                        return self.naverworks_access_token
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ 네이버웍스 토큰 획득 실패: {error_text}")
                        raise Exception(f"토큰 획득 실패: {response.status}")
                        
        except Exception as e:
            logger.error(f"❌ 네이버웍스 토큰 획득 중 오류: {str(e)}")
            raise e
    
    async def send_naverworks_email(self, to_email: str, subject: str, html_content: str, text_content: str = None) -> Dict[str, Any]:
        """
        네이버웍스 메일 API를 사용하여 이메일 발송
        """
        try:
            # 액세스 토큰 획득
            if not self.naverworks_access_token:
                await self.get_naverworks_access_token()
            
            # 네이버웍스 메일 API 호출
            mail_url = f"https://www.worksapis.com/v1.0/domains/{self.naverworks_domain}/mail"
            
            mail_data = {
                "senderAddress": "admin@smap.site",
                "senderName": "SMAP",
                "title": subject,
                "body": html_content,
                "recipients": [
                    {
                        "address": to_email,
                        "name": to_email.split('@')[0]
                    }
                ]
            }
            
            headers = {
                'Authorization': f'Bearer {self.naverworks_access_token}',
                'Content-Type': 'application/json'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(mail_url, json=mail_data, headers=headers) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"✅ 네이버웍스 이메일 발송 성공: {to_email}")
                        return {
                            "success": True,
                            "message": "이메일이 성공적으로 발송되었습니다.",
                            "email": to_email,
                            "provider": "naverworks"
                        }
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ 네이버웍스 이메일 발송 실패: {error_text}")
                        return {
                            "success": False,
                            "message": f"이메일 발송에 실패했습니다: {error_text}",
                            "email": to_email,
                            "provider": "naverworks"
                        }
                        
        except Exception as e:
            logger.error(f"❌ 네이버웍스 이메일 발송 중 오류: {str(e)}")
            return {
                "success": False,
                "message": f"이메일 발송 중 오류가 발생했습니다: {str(e)}",
                "email": to_email,
                "provider": "naverworks"
            }
        
    async def send_password_reset_email(self, email: str, reset_url: str) -> Dict[str, Any]:
        """
        비밀번호 재설정 이메일 발송 (네이버웍스 우선, Gmail 폴백)
        """
        try:
            # 네이버웍스 설정이 있으면 네이버웍스 사용
            if self.naverworks_client_id and self.naverworks_client_secret and self.naverworks_domain:
                logger.info(f"📧 네이버웍스 이메일 발송 시도: {email}")
                
                try:
                    # 이메일 메시지 생성
                    subject = "[SMAP] 비밀번호 재설정 링크"
                    html_content = f"""
                    <!DOCTYPE html>
                    <html lang="ko">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>SMAP 비밀번호 재설정</title>
                        <style>
                            body {{
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                line-height: 1.6;
                                color: #333;
                                margin: 0;
                                padding: 0;
                                background-color: #f4f4f4;
                            }}
                            .container {{
                                max-width: 600px;
                                margin: 0 auto;
                                background-color: #ffffff;
                                border-radius: 12px;
                                overflow: hidden;
                                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                            }}
                            .header {{
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                padding: 30px 40px;
                                text-align: center;
                            }}
                            .header h1 {{
                                margin: 0;
                                font-size: 28px;
                                font-weight: 600;
                                letter-spacing: -0.5px;
                            }}
                            .header .subtitle {{
                                margin-top: 8px;
                                opacity: 0.9;
                                font-size: 16px;
                            }}
                            .content {{
                                padding: 40px;
                            }}
                            .greeting {{
                                font-size: 18px;
                                color: #555;
                                margin-bottom: 20px;
                            }}
                            .description {{
                                font-size: 16px;
                                color: #666;
                                margin-bottom: 30px;
                                line-height: 1.7;
                            }}
                            .button-container {{
                                text-align: center;
                                margin: 40px 0;
                            }}
                            .reset-button {{
                                display: inline-block;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                padding: 16px 32px;
                                text-decoration: none;
                                border-radius: 50px;
                                font-weight: 600;
                                font-size: 16px;
                                transition: all 0.3s ease;
                                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                            }}
                            .reset-button:hover {{
                                transform: translateY(-2px);
                                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
                            }}
                            .warning-section {{
                                background-color: #fff3cd;
                                border-left: 4px solid #ffc107;
                                padding: 20px;
                                margin: 30px 0;
                                border-radius: 8px;
                            }}
                            .warning-title {{
                                font-weight: 600;
                                color: #856404;
                                margin-bottom: 10px;
                                font-size: 16px;
                            }}
                            .warning-list {{
                                margin: 0;
                                padding-left: 20px;
                                color: #856404;
                            }}
                            .warning-list li {{
                                margin-bottom: 8px;
                                line-height: 1.5;
                            }}
                            .footer {{
                                background-color: #f8f9fa;
                                padding: 30px 40px;
                                text-align: center;
                                border-top: 1px solid #e9ecef;
                            }}
                            .footer-text {{
                                color: #6c757d;
                                font-size: 14px;
                                margin: 0;
                            }}
                            .logo {{
                                font-size: 24px;
                                font-weight: bold;
                                color: white;
                                margin-bottom: 10px;
                            }}
                            .divider {{
                                height: 1px;
                                background: linear-gradient(90deg, transparent, #e9ecef, transparent);
                                margin: 30px 0;
                            }}
                            @media only screen and (max-width: 600px) {{
                                .container {{
                                    margin: 10px;
                                    border-radius: 8px;
                                }}
                                .header, .content, .footer {{
                                    padding: 20px;
                                }}
                                .header h1 {{
                                    font-size: 24px;
                                }}
                            }}
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <div class="logo">🚀 SMAP</div>
                                <h1>비밀번호 재설정</h1>
                                <div class="subtitle">안전한 계정 관리를 위한 링크</div>
                            </div>
                            
                            <div class="content">
                                <div class="greeting">안녕하세요! 👋</div>
                                
                                <div class="description">
                                    비밀번호 재설정을 요청하셨습니다. 아래 버튼을 클릭하여 새로운 비밀번호를 설정해주세요.
                                </div>
                                
                                <div class="button-container">
                                    <a href="{reset_url}" class="reset-button">
                                        🔐 비밀번호 재설정
                                    </a>
                                </div>
                                
                                <div class="divider"></div>
                                
                                <div class="warning-section">
                                    <div class="warning-title">⚠️ 주의사항</div>
                                    <ul class="warning-list">
                                        <li>이 링크는 <strong>10분 동안만</strong> 유효합니다</li>
                                        <li>본인이 요청하지 않았다면 이 이메일을 무시하세요</li>
                                        <li>보안을 위해 비밀번호 재설정 후에는 이 링크가 무효화됩니다</li>
                                        <li>링크를 다른 사람과 공유하지 마세요</li>
                                    </ul>
                                </div>
                                
                                <div style="text-align: center; margin-top: 30px; color: #6c757d; font-size: 14px;">
                                    링크가 작동하지 않는다면 아래 주소를 브라우저에 복사하세요:<br>
                                    <a href="{reset_url}" style="color: #667eea; word-break: break-all;">{reset_url}</a>
                                </div>
                            </div>
                            
                            <div class="footer">
                                <p class="footer-text">
                                    이 이메일은 SMAP 시스템에서 자동으로 발송되었습니다.<br>
                                    문의사항이 있으시면 고객센터로 연락해주세요.
                                </p>
                            </div>
                        </div>
                    </body>
                    </html>
                    """
                    
                    text_content = f"""
                    🚀 SMAP 비밀번호 재설정

                    안녕하세요! 👋

                    비밀번호 재설정을 요청하셨습니다. 아래 링크를 클릭하여 새로운 비밀번호를 설정해주세요.

                    🔐 비밀번호 재설정 링크:
                    {reset_url}

                    ⚠️ 주의사항:
                    • 이 링크는 10분 동안만 유효합니다
                    • 본인이 요청하지 않았다면 이 이메일을 무시하세요
                    • 보안을 위해 비밀번호 재설정 후에는 이 링크가 무효화됩니다
                    • 링크를 다른 사람과 공유하지 마세요

                    감사합니다.
                    SMAP 팀

                    ---
                    이 이메일은 SMAP 시스템에서 자동으로 발송되었습니다.
                    """
                    
                    result = await self.send_naverworks_email(email, subject, html_content, text_content)
                    
                    # 네이버웍스 발송 성공 시
                    if result.get('success'):
                        return result
                    else:
                        # 네이버웍스 실패 시 Gmail로 폴백
                        logger.warning(f"⚠️ 네이버웍스 이메일 발송 실패, Gmail SMTP로 폴백: {email}")
                        
                except Exception as e:
                    logger.error(f"❌ 네이버웍스 이메일 발송 중 오류: {str(e)}")
                    logger.warning(f"⚠️ Gmail SMTP로 폴백: {email}")
            
            # 개발 환경에서는 Mock 처리 (네이버웍스 설정이 없을 때만)
            if os.getenv('NODE_ENV') == 'development':
                logger.info(f"📧 [개발환경] 이메일 발송 Mock: {email}")
                logger.info(f"📧 [개발환경] 재설정 링크: {reset_url}")
                
                return {
                    "success": True,
                    "message": "이메일이 성공적으로 발송되었습니다. (개발환경 Mock)",
                    "email": email,
                    "dev": True
                }
            
            # 네이버웍스 설정이 없거나 실패했으면 Gmail SMTP 사용
            logger.info(f"📧 Gmail SMTP 이메일 발송 시도: {email}")
            
            # 이메일 메시지 생성
            subject = "[SMAP] 비밀번호 재설정 링크"
            html_content = f"""
            <!DOCTYPE html>
            <html lang="ko">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>SMAP 비밀번호 재설정</title>
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        margin: 0;
                        padding: 0;
                        background-color: #f4f4f4;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 0 auto;
                        background-color: #ffffff;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    }}
                    .header {{
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 30px 40px;
                        text-align: center;
                    }}
                    .header h1 {{
                        margin: 0;
                        font-size: 28px;
                        font-weight: 600;
                        letter-spacing: -0.5px;
                    }}
                    .header .subtitle {{
                        margin-top: 8px;
                        opacity: 0.9;
                        font-size: 16px;
                    }}
                    .content {{
                        padding: 40px;
                    }}
                    .greeting {{
                        font-size: 18px;
                        color: #555;
                        margin-bottom: 20px;
                    }}
                    .description {{
                        font-size: 16px;
                        color: #666;
                        margin-bottom: 30px;
                        line-height: 1.7;
                    }}
                    .button-container {{
                        text-align: center;
                        margin: 40px 0;
                    }}
                    .reset-button {{
                        display: inline-block;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 16px 32px;
                        text-decoration: none;
                        border-radius: 50px;
                        font-weight: 600;
                        font-size: 16px;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                    }}
                    .reset-button:hover {{
                        transform: translateY(-2px);
                        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
                    }}
                    .warning-section {{
                        background-color: #fff3cd;
                        border-left: 4px solid #ffc107;
                        padding: 20px;
                        margin: 30px 0;
                        border-radius: 8px;
                    }}
                    .warning-title {{
                        font-weight: 600;
                        color: #856404;
                        margin-bottom: 10px;
                        font-size: 16px;
                    }}
                    .warning-list {{
                        margin: 0;
                        padding-left: 20px;
                        color: #856404;
                    }}
                    .warning-list li {{
                        margin-bottom: 8px;
                        line-height: 1.5;
                    }}
                    .footer {{
                        background-color: #f8f9fa;
                        padding: 30px 40px;
                        text-align: center;
                        border-top: 1px solid #e9ecef;
                    }}
                    .footer-text {{
                        color: #6c757d;
                        font-size: 14px;
                        margin: 0;
                    }}
                    .logo {{
                        font-size: 24px;
                        font-weight: bold;
                        color: white;
                        margin-bottom: 10px;
                    }}
                    .divider {{
                        height: 1px;
                        background: linear-gradient(90deg, transparent, #e9ecef, transparent);
                        margin: 30px 0;
                    }}
                    @media only screen and (max-width: 600px) {{
                        .container {{
                            margin: 10px;
                            border-radius: 8px;
                        }}
                        .header, .content, .footer {{
                            padding: 20px;
                        }}
                        .header h1 {{
                            font-size: 24px;
                        }}
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🚀 SMAP</div>
                        <h1>비밀번호 재설정</h1>
                        <div class="subtitle">안전한 계정 관리를 위한 링크</div>
                    </div>
                    
                    <div class="content">
                        <div class="greeting">안녕하세요! 👋</div>
                        
                        <div class="description">
                            비밀번호 재설정을 요청하셨습니다. 아래 버튼을 클릭하여 새로운 비밀번호를 설정해주세요.
                        </div>
                        
                        <div class="button-container">
                            <a href="{reset_url}" class="reset-button">
                                🔐 비밀번호 재설정
                            </a>
                        </div>
                        
                        <div class="divider"></div>
                        
                        <div class="warning-section">
                            <div class="warning-title">⚠️ 주의사항</div>
                            <ul class="warning-list">
                                <li>이 링크는 <strong>10분 동안만</strong> 유효합니다</li>
                                <li>본인이 요청하지 않았다면 이 이메일을 무시하세요</li>
                                <li>보안을 위해 비밀번호 재설정 후에는 이 링크가 무효화됩니다</li>
                                <li>링크를 다른 사람과 공유하지 마세요</li>
                </ul>
                        </div>
                        
                        <div style="text-align: center; margin-top: 30px; color: #6c757d; font-size: 14px;">
                            링크가 작동하지 않는다면 아래 주소를 브라우저에 복사하세요:<br>
                            <a href="{reset_url}" style="color: #667eea; word-break: break-all;">{reset_url}</a>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p class="footer-text">
                            이 이메일은 SMAP 시스템에서 자동으로 발송되었습니다.<br>
                            문의사항이 있으시면 고객센터로 연락해주세요.
                        </p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            text_content = f"""
            🚀 SMAP 비밀번호 재설정
            
            안녕하세요! 👋
            
            비밀번호 재설정을 요청하셨습니다. 아래 링크를 클릭하여 새로운 비밀번호를 설정해주세요.
            
            🔐 비밀번호 재설정 링크:
            {reset_url}
            
            ⚠️ 주의사항:
            • 이 링크는 10분 동안만 유효합니다
            • 본인이 요청하지 않았다면 이 이메일을 무시하세요
            • 보안을 위해 비밀번호 재설정 후에는 이 링크가 무효화됩니다
            • 링크를 다른 사람과 공유하지 마세요
            
            감사합니다.
            SMAP 팀

            ---
            이 이메일은 SMAP 시스템에서 자동으로 발송되었습니다.
            """
            
            # Gmail SMTP 연결 및 발송
            context = ssl.create_default_context()
            
            with smtplib.SMTP_SSL(self.smtp_server, self.smtp_port, context=context) as server:
                server.login(self.sender_email, self.sender_password)
            
            # 이메일 메시지 생성
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = self.sender_email
            message["To"] = email
            
            # HTML 및 텍스트 버전 추가
            html_part = MIMEText(html_content, "html")
            text_part = MIMEText(text_content, "plain")
            
            message.attach(text_part)
            message.attach(html_part)
            
            # 이메일 발송
            server.send_message(message)
            
            logger.info(f"✅ Gmail 이메일 발송 성공: {email}")
            
            return {
                "success": True,
                "message": "이메일이 성공적으로 발송되었습니다.",
                "email": email,
                "provider": "gmail"
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