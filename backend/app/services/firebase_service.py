import firebase_admin
from firebase_admin import credentials, messaging
from typing import Optional
import logging
import os
from app.config import Config

logger = logging.getLogger(__name__)

class FirebaseService:
    _instance = None
    _initialized = False
    _firebase_available = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FirebaseService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self._firebase_available = self._initialize_firebase()
            FirebaseService._initialized = True

    def _initialize_firebase(self) -> bool:
        """Firebase Admin SDK 초기화"""
        try:
            # 이미 초기화된 경우 패스
            firebase_admin.get_app()
            logger.info("Firebase Admin SDK already initialized")
            return True
        except ValueError:
            # 초기화되지 않은 경우 새로 초기화
            try:
                cred_path = Config.FIREBASE_CREDENTIALS_PATH
                if os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred)
                    logger.info(f"Firebase Admin SDK initialized with credentials from {cred_path}")
                    return True
                else:
                    logger.warning(f"Firebase credentials file not found: {cred_path}")
                    logger.warning("Firebase 푸시 알림 기능이 비활성화됩니다.")
                    return False
            except Exception as e:
                logger.warning(f"Failed to initialize Firebase: {e}")
                logger.warning("Firebase 푸시 알림 기능이 비활성화됩니다.")
                return False

    def send_push_notification(self, token: str, title: str, content: str) -> str:
        """FCM 푸시 알림 전송"""
        if not self._firebase_available:
            raise Exception("Firebase가 초기화되지 않았습니다. 인증서 파일을 확인해주세요.")
            
        try:
            message = messaging.Message(
                data={
                    'title': title,
                    'body': content
                },
                notification=messaging.Notification(
                    title=title,
                    body=content
                ),
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default'
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound='default'
                        )
                    )
                ),
                token=token,
            )
            
            response = messaging.send(message)
            logger.info(f"Successfully sent FCM message: {response}")
            return response
            
        except Exception as e:
            logger.error(f"Failed to send FCM message: {e}")
            raise

    def is_available(self) -> bool:
        """Firebase 서비스 사용 가능 여부 확인"""
        return self._firebase_available

# 싱글톤 인스턴스 생성
firebase_service = FirebaseService() 