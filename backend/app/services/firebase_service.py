import firebase_admin
from firebase_admin import credentials, messaging
from typing import Optional
import logging
import os
import json
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
                # 방법 1: 환경변수에서 JSON 문자열로 인증서 정보 가져오기
                firebase_credentials_json = os.getenv('FIREBASE_CREDENTIALS_JSON')
                if firebase_credentials_json:
                    try:
                        cred_dict = json.loads(firebase_credentials_json)
                        cred = credentials.Certificate(cred_dict)
                        firebase_admin.initialize_app(cred)
                        logger.info("Firebase Admin SDK initialized with credentials from environment variable")
                        return True
                    except json.JSONDecodeError as e:
                        logger.warning(f"Invalid JSON in FIREBASE_CREDENTIALS_JSON: {e}")
                
                # 방법 2: 파일 경로에서 인증서 파일 읽기
                cred_path = Config.FIREBASE_CREDENTIALS_PATH
                if os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred)
                    logger.info(f"Firebase Admin SDK initialized with credentials from {cred_path}")
                    return True
                else:
                    logger.warning(f"Firebase credentials file not found: {cred_path}")
                
                # 방법 3: 개별 환경변수로 인증서 정보 구성
                project_id = os.getenv('FIREBASE_PROJECT_ID')
                private_key = os.getenv('FIREBASE_PRIVATE_KEY')
                client_email = os.getenv('FIREBASE_CLIENT_EMAIL')
                
                if project_id and private_key and client_email:
                    # 개행 문자 처리
                    private_key = private_key.replace('\\n', '\n')
                    
                    cred_dict = {
                        "type": "service_account",
                        "project_id": project_id,
                        "private_key": private_key,
                        "client_email": client_email,
                        "client_id": os.getenv('FIREBASE_CLIENT_ID', ''),
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                        "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{client_email}"
                    }
                    
                    cred = credentials.Certificate(cred_dict)
                    firebase_admin.initialize_app(cred)
                    logger.info("Firebase Admin SDK initialized with individual environment variables")
                    return True
                
                logger.warning("Firebase 인증 정보를 찾을 수 없습니다.")
                logger.warning("다음 중 하나의 방법으로 Firebase를 설정해주세요:")
                logger.warning("1. FIREBASE_CREDENTIALS_JSON 환경변수에 서비스 계정 JSON 설정")
                logger.warning("2. Firebase 인증서 파일을 지정된 경로에 배치")
                logger.warning("3. FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL 환경변수 설정")
                logger.warning("Firebase 푸시 알림 기능이 비활성화됩니다.")
                return False
                
            except Exception as e:
                logger.warning(f"Failed to initialize Firebase: {e}")
                logger.warning("Firebase 푸시 알림 기능이 비활성화됩니다.")
                return False

    def send_push_notification(self, token: str, title: str, content: str) -> str:
        """FCM 푸시 알림 전송"""
        if not self._firebase_available:
            logger.warning("Firebase가 초기화되지 않아 푸시 알림을 건너뜁니다.")
            return "firebase_disabled"
            
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
                    headers={
                        "apns-push-type": "alert",
                        "apns-priority": "10"
                    },
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

    def send_background_push_notification(
        self,
        token: str,
        title: str,
        content: str,
        content_available: bool = True,
        priority: str = "normal",
        event_url: Optional[str] = None,
        schedule_id: Optional[str] = None
    ) -> str:
        """
        백그라운드 푸시 알림 전송
        content-available 플래그를 사용하여 앱이 백그라운드에서 데이터를 처리할 수 있도록 함
        """
        if not self._firebase_available:
            logger.warning("Firebase가 초기화되지 않아 백그라운드 푸시 알림을 건너뜁니다.")
            return "firebase_disabled"

        try:
            # 백그라운드 푸시를 위한 데이터 구성
            data = {
                'title': title,
                'body': content,
                'content-available': '1' if content_available else '0',
                'priority': priority
            }

            if event_url:
                data['event_url'] = event_url
            if schedule_id:
                data['schedule_id'] = schedule_id

            # 백그라운드 푸시의 경우 알림을 표시하지 않음
            message = messaging.Message(
                data=data,
                android=messaging.AndroidConfig(
                    priority='normal' if priority == 'normal' else 'high',
                ),
                apns=messaging.APNSConfig(
                    headers={
                        "apns-push-type": "background",
                        "apns-priority": "5" if priority == 'normal' else "10"
                    },
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            content_available=True,
                            # 백그라운드 푸시는 사용자에게 표시되지 않음
                        )
                    )
                ),
                token=token,
            )

            response = messaging.send(message)
            logger.info(f"Successfully sent background FCM message: {response}")
            return response

        except Exception as e:
            logger.error(f"Failed to send background FCM message: {e}")
            raise

    def is_available(self) -> bool:
        """Firebase 서비스 사용 가능 여부 확인"""
        return self._firebase_available

# 싱글톤 인스턴스 생성
firebase_service = FirebaseService() 