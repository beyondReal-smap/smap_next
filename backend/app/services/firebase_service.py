import firebase_admin
from firebase_admin import credentials, messaging
from typing import Optional
import logging
import os
import json
import time
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
            logger.info(f"📤 [FCM] 푸시 메시지 전송 시작 - 토큰: {token[:30]}..., 제목: {title}")

            message = messaging.Message(
                data={
                    'title': title,
                    'body': content,
                    'custom_data': 'ios_push_test',  # iOS 푸시 수신 확인용
                    'timestamp': str(int(time.time() * 1000))
                },
                notification=messaging.Notification(
                    title=title,
                    body=content
                ),
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default',
                        channel_id='default'
                    )
                ),
                apns=messaging.APNSConfig(
                    headers={
                        "apns-push-type": "alert",
                        "apns-priority": "10",
                        "apns-topic": Config.IOS_BUNDLE_ID,  # iOS 앱 번들 ID
                        "apns-expiration": str(int(time.time()) + 300)  # 5분 후 만료
                    },
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            alert=messaging.ApsAlert(title=title, body=content),  # 명시적 알림 표시
                            sound='default',
                            badge=1,
                            content_available=True,  # 백그라운드에서도 앱 깨우기
                            mutable_content=True,  # iOS에서 콘텐츠 수정 가능
                            category="GENERAL"  # 알림 카테고리 설정
                        )
                    )
                ),
                token=token,
            )

            logger.info(f"📤 [FCM] 메시지 구성 완료 - iOS 푸시 수신을 위한 최적화 적용")
            
            response = messaging.send(message)
            logger.info(f"✅ [FCM POLICY 4] FCM 메시지 전송 성공: {response}")
            return response

        except messaging.UnregisteredError as e:
            # ✅ 4단계: 서버 측 비활성 토큰 처리 (리소스 관리)
            # NotRegistered 에러: 토큰이 더 이상 유효하지 않음 (앱 삭제 등)
            logger.warning(f"🚨 [FCM POLICY 4] 비활성 토큰 감지 (UnregisteredError): {token[:30]}...")
            logger.warning(f"🚨 [FCM POLICY 4] 토큰이 유효하지 않아 삭제 처리 필요: {e}")
            logger.warning(f"🚨 [FCM POLICY 4] FCM 푸시 메시지 전송 실패 - 토큰이 만료되었거나 앱이 삭제됨")

            # 토큰 삭제 처리를 위한 이벤트 발생 (나중에 구현)
            self._handle_inactive_token(token, "unregistered")
            raise

        except messaging.InvalidArgumentError as e:
            # InvalidRegistration 에러: 토큰 형식이 잘못됨
            logger.warning(f"🚨 [FCM POLICY 4] 잘못된 토큰 형식 (InvalidArgumentError): {token[:30]}...")
            logger.warning(f"🚨 [FCM POLICY 4] 토큰 형식이 잘못되어 삭제 처리 필요: {e}")
            logger.warning(f"🚨 [FCM POLICY 4] FCM 푸시 메시지 전송 실패 - 토큰 형식이 잘못됨")

            # 토큰 삭제 처리를 위한 이벤트 발생
            self._handle_inactive_token(token, "invalid_registration")
            raise

        except Exception as e:
            logger.error(f"❌ [FCM POLICY 4] FCM 메시지 전송 실패: {e}")
            raise

    def _handle_inactive_token(self, token: str, reason: str):
        """
        ✅ 4단계: 비활성 토큰 처리 함수
        FCM에서 NotRegistered/InvalidRegistration 에러가 발생한 토큰을 처리
        """
        logger.warning(f"🚨 [FCM POLICY 4] 비활성 토큰 처리 시작: {reason}")
        logger.warning(f"🚨 [FCM POLICY 4] 삭제 대상 토큰: {token[:30]}...")

        # TODO: 데이터베이스에서 해당 토큰을 찾아서 삭제하는 로직 구현 필요
        # 현재는 로그만 기록하고 추후 데이터베이스 정리 작업에서 사용
        self._schedule_token_cleanup(token, reason)

    def _schedule_token_cleanup(self, token: str, reason: str):
        """
        토큰 정리 작업을 예약 (비동기 처리)
        """
        logger.info(f"📋 [FCM POLICY 4] 토큰 정리 예약: {reason} - {token[:20]}...")
        # 추후: Redis 큐나 데이터베이스 테이블에 정리 작업을 기록하여
        # 배치 작업으로 비활성 토큰들을 정리할 수 있도록 함

        # 임시로 로그에 기록 (실제 구현 시 데이터베이스에 기록)
        cleanup_record = {
            "token_prefix": token[:50],
            "reason": reason,
            "timestamp": int(time.time()),
            "scheduled_for_cleanup": True
        }
        logger.info(f"📋 [FCM POLICY 4] 정리 기록: {cleanup_record}")

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
            # 백그라운드 푸시를 위한 데이터 구성 (원래 코드와 유사하게)
            data = {
                'title': title,
                'body': content,
                'content_available': '1' if content_available else '0',
                'priority': priority,
                'background_push': 'true',  # 백그라운드 푸시임을 명시
                'timestamp': str(int(time.time() * 1000)),  # 타임스탬프 추가
                'show_notification': 'false'  # 백그라운드에서는 기본적으로 알림 표시하지 않음
            }

            if event_url:
                data['event_url'] = event_url
            if schedule_id:
                data['schedule_id'] = schedule_id

            # 백그라운드 푸시에도 notification 객체를 포함하여 iOS가 무시하지 않도록 함
            message = messaging.Message(
                data=data,
                notification=messaging.Notification(
                    title=title,
                    body=content
                ),
                android=messaging.AndroidConfig(
                    priority='high',  # 무조건 high로 설정하여 푸시 수신 보장
                    notification=messaging.AndroidNotification(
                        sound='default'
                    )
                ),
                apns=messaging.APNSConfig(
                    headers={
                        "apns-push-type": "alert",  # alert로 설정하여 사용자에게 표시
                        "apns-priority": "10",  # 최고 우선순위로 설정
                        "apns-topic": Config.IOS_BUNDLE_ID  # iOS 앱 번들 ID
                    },
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound='default',
                            badge=1,
                            alert=messaging.ApsAlert(title=title, body=content),  # 알림 표시를 위해 alert 추가
                            content_available=True,  # 백그라운드에서도 앱이 깨어나도록 설정
                            mutable_content=True  # iOS에서 콘텐츠 수정 가능하도록 함
                        )
                    )
                ),
                token=token,
            )

            response = messaging.send(message)
            logger.info(f"✅ [FCM POLICY 4] 백그라운드 FCM 메시지 전송 성공: {response}")
            return response

        except messaging.UnregisteredError as e:
            # ✅ 4단계: 서버 측 비활성 토큰 처리 (리소스 관리)
            logger.warning(f"🚨 [FCM POLICY 4] 백그라운드 푸시에서 비활성 토큰 감지 (UnregisteredError): {token[:30]}...")
            logger.warning(f"🚨 [FCM POLICY 4] 토큰이 유효하지 않아 삭제 처리 필요: {e}")

            self._handle_inactive_token(token, "background_push_unregistered")
            raise

        except messaging.InvalidArgumentError as e:
            logger.warning(f"🚨 [FCM POLICY 4] 백그라운드 푸시에서 잘못된 토큰 형식 (InvalidArgumentError): {token[:30]}...")
            logger.warning(f"🚨 [FCM POLICY 4] 토큰 형식이 잘못되어 삭제 처리 필요: {e}")

            self._handle_inactive_token(token, "background_push_invalid")
            raise

        except Exception as e:
            logger.error(f"❌ [FCM POLICY 4] 백그라운드 FCM 메시지 전송 실패: {e}")
            raise

    def send_silent_push_notification(
        self,
        token: str,
        reason: str = "token_refresh",
        priority: str = "high"  # 백그라운드 앱 깨우기 위해 high로 변경
    ) -> str:
        """
        Silent FCM 푸시 알림 전송 (사용자에게 표시되지 않는 푸시)
        앱이 백그라운드에 오래 있어도 푸시 수신이 가능하도록 유지
        FCM 토큰 변경 시 백그라운드 앱을 깨우기 위해 사용

        Args:
            token: FCM 토큰
            reason: silent push 이유
            priority: 우선순위 (low, normal, high)
        """
        if not self._firebase_available:
            logger.warning("Firebase가 초기화되지 않아 silent 푸시 알림을 건너뜁니다.")
            return "firebase_disabled"

        try:
            logger.info(f"🤫 [FCM SILENT] Silent 푸시 전송 시작 - 토큰: {token[:30]}..., 이유: {reason}")

            # Silent 푸시를 위한 데이터 구성 (사용자에게 표시되지 않음)
            data = {
                'silent_push': 'true',
                'reason': reason,
                'timestamp': str(int(time.time() * 1000)),
                'token_refresh': 'true',  # 토큰 갱신 요청
                'background_wake': 'true',  # 백그라운드 앱 깨우기 플래그
                'force_token_update': 'true'  # 강제 토큰 업데이트 요청
            }

            # Silent 푸시는 notification을 포함하지 않지만, iOS가 무시하지 않도록 priority를 높임
            message = messaging.Message(
                data=data,
                android=messaging.AndroidConfig(
                    priority='high',  # Android에서도 high로 설정하여 푸시 수신 보장
                ),
                apns=messaging.APNSConfig(
                    headers={
                        "apns-push-type": "background",  # background 타입으로 설정하여 사용자에게 표시하지 않음
                        "apns-priority": "10",  # Silent 푸시라도 최고 우선순위로 설정하여 무시 방지
                        "apns-topic": Config.IOS_BUNDLE_ID,  # 올바른 번들 ID 설정
                        "apns-expiration": str(int(time.time()) + 600)  # 10분 후 만료 (충분한 시간 부여)
                    },
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            content_available=True,  # 백그라운드 앱 깨우기 필수
                            # Silent 푸시는 사용자에게 표시되지 않음
                            # badge, sound, alert 등 모두 제외
                        )
                    )
                ),
                token=token,
            )

            response = messaging.send(message)
            logger.info(f"✅ [FCM SILENT] Silent FCM 메시지 전송 성공 - 백그라운드 앱 깨우기 완료: {response}")
            return response

        except messaging.UnregisteredError as e:
            # ✅ 4단계: 서버 측 비활성 토큰 처리 (리소스 관리)
            logger.warning(f"🚨 [FCM POLICY 4] Silent 푸시에서 비활성 토큰 감지 (UnregisteredError): {token[:30]}...")
            logger.warning(f"🚨 [FCM POLICY 4] 토큰이 유효하지 않아 삭제 처리 필요: {e}")

            self._handle_inactive_token(token, "silent_push_unregistered")
            raise

        except messaging.InvalidArgumentError as e:
            logger.warning(f"🚨 [FCM POLICY 4] Silent 푸시에서 잘못된 토큰 형식 (InvalidArgumentError): {token[:30]}...")
            logger.warning(f"🚨 [FCM POLICY 4] 토큰 형식이 잘못되어 삭제 처리 필요: {e}")

            self._handle_inactive_token(token, "silent_push_invalid")
            raise

        except Exception as e:
            logger.error(f"❌ [FCM POLICY 4] Silent FCM 메시지 전송 실패: {e}")
            raise

    def is_available(self) -> bool:
        """Firebase 서비스 사용 가능 여부 확인"""
        return self._firebase_available

# 싱글톤 인스턴스 생성
firebase_service = FirebaseService() 