import firebase_admin
from firebase_admin import credentials, messaging
from typing import Optional, Dict, Any
import logging
import os
import json
import time
import ssl
from datetime import datetime
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

            # Firebase 프로젝트 정보 디버깅
            if self._firebase_available:
                try:
                    app = firebase_admin.get_app()
                    logger.info(f"🔍 [FCM DEBUG] Firebase 프로젝트 ID: {app.project_id}")
                    logger.info(f"🔍 [FCM DEBUG] Firebase 앱 이름: {app.name}")
                except Exception as e:
                    logger.warning(f"🔍 [FCM DEBUG] Firebase 프로젝트 정보 조회 실패: {e}")

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

    def send_push_notification(self, token: str, title: str, content: str, max_retries: int = 2, member_id: int = None, enable_fallback: bool = True) -> str:
        """FCM 푸시 알림 전송 (iOS 최적화 포함) - 토큰 검증 및 자동 정리 기능 포함

        Args:
            token: FCM 토큰
            title: 푸시 제목
            content: 푸시 내용
            max_retries: 최대 재시도 횟수
            member_id: 회원 ID (폴백 알림용)
            enable_fallback: 폴백 알림 사용 여부

        Returns:
            str: 전송 결과 또는 실패 사유
        """
        if not self._firebase_available:
            logger.warning("Firebase가 초기화되지 않아 푸시 알림을 건너뜁니다.")
            if enable_fallback and member_id:
                import asyncio
                asyncio.create_task(self._trigger_fallback_notification(member_id, title, content, "firebase_disabled"))
            return "firebase_disabled"

        last_error = None

        # 재시도 로직 적용 (iOS 푸시 수신율 향상)
        for attempt in range(max_retries + 1):
            try:
                if attempt > 0:
                    logger.info(f"🔄 [FCM] 푸시 재시도 {attempt}/{max_retries} - 토큰: {token[:30]}...")

                logger.info(f"📤 [FCM] 푸시 메시지 전송 시작 - 토큰: {token[:30]}..., 제목: {title}")

                # 메시지 데이터 검증
                if not token or not title or not content:
                    raise ValueError(f"필수 FCM 데이터가 누락됨: token={token[:10] if token else None}, title={title[:10] if title else None}, content={content[:10] if content else None}")

                # FCM 토큰 형식 검증 (개선된 버전)
                logger.info(f"🔍 [FCM] 토큰 형식 검증 시작: {token[:30]}...")
                if not self._validate_fcm_token(token):
                    logger.error(f"❌ [FCM] 토큰 형식 검증 실패: {token[:50]}...")
                    
                    # 토큰 무효화 처리
                    if member_id:
                        self._handle_token_invalidation(token, "invalid_token_format", title, content)
                    
                    raise ValueError(f"FCM 토큰 형식이 잘못되었습니다. 새로운 토큰을 요청해주세요.")

                # FCM 메시지 구성 (FCM v1 API 형식 준수)
                logger.info(f"📤 [FCM] 메시지 구성 시작")

                # Firebase Admin SDK의 send() 메소드에 맞게 Message 객체 생성
                # iOS 최적화: 토큰에 콜론(:)이 있으면 iOS로 판단하여 APNs 설정 추가
                is_ios_token = ':' in token

                if is_ios_token:
                    # iOS 토큰인 경우 APNs 설정 포함
                    logger.info(f"📱 [FCM iOS] iOS 토큰 감지됨 - APNs 설정 적용: {token[:30]}...")
                    message = messaging.Message(
                        token=token,
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
                                "apns-priority": "10",
                                "apns-topic": Config.IOS_BUNDLE_ID,
                                "apns-expiration": str(int(time.time()) + 600),
                                "apns-collapse-id": f"alert_{int(time.time())}",
                                "apns-thread-id": "alert"
                            },
                            payload=messaging.APNSPayload(
                                aps=messaging.Aps(
                                    sound='default',
                                    badge=1,
                                    alert=messaging.ApsAlert(
                                        title=title,
                                        body=content
                                    ),
                                    mutable_content=True,
                                    thread_id="alert"
                                )
                            )
                        )
                    )
                else:
                    # Android 토큰인 경우 Android 전용 설정만
                    logger.info(f"🤖 [FCM Android] Android 토큰 감지됨 - Android 설정만 적용: {token[:30]}...")
                    message = messaging.Message(
                        token=token,
                        notification=messaging.Notification(
                            title=title,
                            body=content
                        ),
                        android=messaging.AndroidConfig(
                            priority='high',
                            notification=messaging.AndroidNotification(
                                sound='default'
                            )
                        )
                    )

                logger.info(f"📤 [FCM] 메시지 구성 완료 - 토큰: {token[:30]}..., 제목: {title}")

                # FCM 메시지 전송 시도
                logger.info(f"🚀 [FCM] FCM 메시지 전송 시작...")
                logger.info(f"🚀 [FCM] 메시지 데이터: token={token[:20]}..., title={title}, content={content[:20]}...")

                try:
                    # 메시지 객체 상세 정보 로깅
                    logger.info(f"🚀 [FCM] 메시지 객체 검증:")
                    logger.info(f"   - 타입: {type(message)}")
                    logger.info(f"   - token: {getattr(message, 'token', 'MISSING')}")
                    logger.info(f"   - notification: {getattr(message, 'notification', 'MISSING')}")
                    if hasattr(message, 'notification') and message.notification:
                        logger.info(f"   - title: {getattr(message.notification, 'title', 'MISSING')}")
                        logger.info(f"   - body: {getattr(message.notification, 'body', 'MISSING')}")

                    # 메시지 객체의 전체 구조 로깅 (디버깅용)
                    try:
                        import json
                        message_dict = {
                            'token': message.token,
                            'notification': {
                                'title': message.notification.title if message.notification else None,
                                'body': message.notification.body if message.notification else None
                            } if message.notification else None
                        }
                        logger.info(f"🔍 [FCM DEBUG] 메시지 구조: {json.dumps(message_dict, ensure_ascii=False, indent=2)}")
                    except Exception as debug_error:
                        logger.warning(f"🔍 [FCM DEBUG] 메시지 구조 로깅 실패: {debug_error}")

                    # FCM 전송 시도
                    response = messaging.send(message)
                    logger.info(f"✅ [FCM] FCM 전송 성공: {response}")
                except Exception as send_error:
                    logger.error(f"🚨 [FCM] messaging.send() 호출 실패: {send_error}")
                    logger.error(f"🚨 [FCM] 오류 타입: {type(send_error)}")
                    logger.error(f"🚨 [FCM] 오류 상세: {str(send_error)}")

                    # 스택 트레이스 로깅
                    import traceback
                    logger.error(f"🚨 [FCM] 스택 트레이스:\n{traceback.format_exc()}")

                    raise send_error
                logger.info(f"✅ [FCM POLICY 4] FCM 메시지 전송 성공: {response}")
                logger.info(f"📊 [FCM] 전송 성공 - 메시지 ID: {response}")
                return response

            except messaging.UnregisteredError as e:
                # ✅ 4단계: 서버 측 비활성 토큰 처리 (리소스 관리)
                # NotRegistered 에러: 토큰이 더 이상 유효하지 않음 (앱 삭제 등)
                logger.warning(f"🚨 [FCM POLICY 4] 비활성 토큰 감지 (UnregisteredError): {token[:30]}...")
                logger.warning(f"🚨 [FCM POLICY 4] 토큰이 유효하지 않아 삭제 처리 필요: {e}")
                logger.warning(f"🚨 [FCM POLICY 4] FCM 푸시 메시지 전송 실패 - 토큰이 만료되었거나 앱이 삭제됨")

                # 🔥 FCM 전송 실패 시 DB 토큰 자동 정리
                if member_id:
                    self._cleanup_invalid_token_from_db(token, member_id, "fcm_send_failure")
                    # 폴백 알림 트리거
                    if enable_fallback:
                        import asyncio
                        asyncio.create_task(self._trigger_fallback_notification(member_id, title, content, "token_expired"))

                # 토큰 무효화 처리 - 즉시 DB에서 제거 및 사용자 알림
                self._handle_token_invalidation(token, "unregistered", title, content)
                if attempt == max_retries:  # 마지막 시도에서도 실패한 경우
                    raise
                last_error = e
                continue  # 재시도

            except messaging.ThirdPartyAuthError as e:
                # ThirdPartyAuthError: 토큰 형식이 잘못되었거나 인증 오류
                logger.warning(f"🚨 [FCM POLICY 4] 잘못된 토큰 형식 (ThirdPartyAuthError): {token[:30]}...")
                logger.warning(f"🚨 [FCM POLICY 4] 토큰 형식이 잘못되어 삭제 처리 필요: {e}")
                logger.warning(f"🚨 [FCM POLICY 4] FCM 푸시 메시지 전송 실패 - 토큰 형식이 잘못됨")

                # 토큰 무효화 처리 - 즉시 DB에서 제거 및 사용자 알림
                self._handle_token_invalidation(token, "invalid_registration", title, content)
                # 폴백 알림 트리거
                if enable_fallback and member_id:
                    import asyncio
                    asyncio.create_task(self._trigger_fallback_notification(member_id, title, content, "token_invalid"))
                if attempt == max_retries:  # 마지막 시도에서도 실패한 경우
                    raise
                last_error = e
                continue  # 재시도

            except Exception as e:
                logger.error(f"❌ [FCM POLICY 4] FCM 메시지 전송 실패 (시도 {attempt + 1}/{max_retries + 1}): {e}")
                # 일반 오류 발생 시 폴백 알림 (중요한 메시지에만)
                if enable_fallback and member_id and attempt == max_retries:
                    import asyncio
                    asyncio.create_task(self._trigger_fallback_notification(member_id, title, content, "fcm_error"))
                if attempt == max_retries:  # 마지막 시도에서도 실패한 경우
                    raise
                last_error = e
                continue  # 재시도

        # 모든 재시도가 실패한 경우
        logger.error(f"❌ [FCM POLICY 4] 모든 재시도 실패 - 최종 에러: {last_error}")
        raise last_error

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
                        "apns-topic": Config.IOS_BUNDLE_ID,  # iOS 앱 번들 ID
                        "apns-expiration": str(int(time.time()) + 600),  # 10분 후 만료 (충분한 시간)
                        "apns-collapse-id": f"bg_push_{int(time.time())}",  # 백그라운드 푸시 그룹화 ID
                        "apns-thread-id": "background"  # 백그라운드 스레드
                    },
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound='default',
                            badge=1,
                            alert=messaging.ApsAlert(
                                title=title,
                                body=content
                            ),
                            content_available=True,  # 백그라운드에서도 앱 깨우기 필수
                            mutable_content=True,  # iOS에서 콘텐츠 수정 가능
                            category="BACKGROUND",  # 백그라운드 카테고리
                            thread_id="background"  # 백그라운드 스레드 ID
                        ),
                        custom_data={
                            "background_push": "true",
                            "ios_background": "true",
                            "wake_app": "true",  # 앱 깨우기 플래그
                            "schedule_id": schedule_id if schedule_id else "",
                            "event_url": event_url if event_url else "",
                            "push_timestamp": str(int(time.time() * 1000))
                        }
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

            self._handle_token_invalidation(token, "background_push_unregistered", title, content)
            raise

        except messaging.ThirdPartyAuthError as e:
            logger.warning(f"🚨 [FCM POLICY 4] 백그라운드 푸시에서 잘못된 토큰 형식 (ThirdPartyAuthError): {token[:30]}...")
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
                        "apns-expiration": str(int(time.time()) + 600),  # 10분 후 만료 (충분한 시간 부여)
                        "apns-collapse-id": f"silent_{reason}_{int(time.time())}",  # Silent 푸시 그룹화 ID
                        "apns-thread-id": "silent"  # Silent 스레드
                    },
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            content_available=True,  # 백그라운드 앱 깨우기 필수
                            # Silent 푸시는 사용자에게 표시되지 않음
                            # badge, sound, alert 등 모두 제외
                            thread_id="silent"  # Silent 스레드 ID
                        ),
                        custom_data={
                            "silent_push": "true",
                            "ios_silent": "true",
                            "reason": reason,
                            "token_refresh_required": "true",
                            "background_wake_only": "true",  # 알림 표시 없이 앱 깨우기만
                            "timestamp": str(int(time.time() * 1000)),
                            "silent_id": f"silent_{int(time.time())}"
                        }
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

            self._handle_token_invalidation(token, "silent_push_unregistered", "", "")
            raise

        except messaging.ThirdPartyAuthError as e:
            logger.warning(f"🚨 [FCM POLICY 4] Silent 푸시에서 잘못된 토큰 형식 (ThirdPartyAuthError): {token[:30]}...")
            logger.warning(f"🚨 [FCM POLICY 4] 토큰 형식이 잘못되어 삭제 처리 필요: {e}")

            self._handle_token_invalidation(token, "silent_push_invalid", "", "")
            raise

        except Exception as e:
            logger.error(f"❌ [FCM POLICY 4] Silent FCM 메시지 전송 실패: {e}")
            raise

    def _cleanup_invalid_token_from_db(self, token: str, member_id: int, reason: str):
        """
        FCM 전송 실패 시 DB에서 무효화된 토큰 자동 정리
        """
        try:
            logger.info(f"🧹 [FCM CLEANUP] DB 토큰 정리 시작 - 회원: {member_id}, 이유: {reason}")

            # DB 연결 및 토큰 정리
            from app.db.session import get_db
            from app.models.member import Member
            from sqlalchemy.orm import Session

            db: Session = next(get_db())

            # 회원 조회 및 토큰 초기화
            member = db.query(Member).filter(Member.mt_idx == member_id).first()
            if member and member.mt_token_id == token:
                logger.warning(f"🗑️ [FCM CLEANUP] 무효화된 토큰 DB에서 제거 - 회원: {member_id}")

                # 토큰 정보 초기화
                member.mt_token_id = None
                member.mt_token_updated_at = None
                member.mt_token_expiry_date = None
                member.mt_udate = datetime.now()

                db.commit()
                logger.info(f"✅ [FCM CLEANUP] 토큰 정리 완료 - 회원: {member_id}")
            else:
                logger.info(f"ℹ️ [FCM CLEANUP] 정리할 토큰 없음 - 회원: {member_id}")

            db.close()

        except Exception as e:
            logger.error(f"❌ [FCM CLEANUP] 토큰 정리 실패: {e}")

    async def _trigger_fallback_notification(self, member_id: int, title: str, content: str, reason: str):
        """
        FCM 전송 실패 시 폴백 알림 트리거
        SMS 또는 이메일로 중요 알림을 전송

        Args:
            member_id: 회원 ID
            title: 원본 푸시 제목
            content: 원본 푸시 내용
            reason: 실패 사유 (token_expired, token_invalid, fcm_error, firebase_disabled)
        """
        try:
            logger.info(f"🔄 [FALLBACK] 폴백 알림 트리거 시작 - 회원: {member_id}, 사유: {reason}")

            # DB에서 회원 정보 조회
            from app.db.session import get_db
            from app.models.member import Member
            from sqlalchemy.orm import Session

            db: Session = next(get_db())

            try:
                member = db.query(Member).filter(Member.mt_idx == member_id).first()
                if not member:
                    logger.warning(f"🔄 [FALLBACK] 회원 정보를 찾을 수 없음: {member_id}")
                    return

                # 폴백 알림이 필요한 중요 메시지인지 확인
                is_important = self._is_important_notification(title, content)

                if not is_important:
                    logger.info(f"🔄 [FALLBACK] 중요하지 않은 메시지로 폴백 생략: {title[:20]}...")
                    return

                # 폴백 알림 내용 구성
                fallback_title = f"[SMAP 알림] {title}"
                fallback_content = self._build_fallback_content(content, reason)

                                # EmailService를 활용한 폴백 이메일 발송
                email_sent = False
                if member.mt_email and member.mt_push1 == 'Y':
                    try:
                        from app.services.email_service import email_service

                        # FCM 폴백용 이메일 발송 메소드 호출
                        result = await self._send_fcm_fallback_email(
                            member.mt_email,
                            title,
                            content,
                            reason
                        )

                        if result.get('success'):
                            logger.info(f"✅ [FALLBACK] 이메일 폴백 성공: {member.mt_email} (제공자: {result.get('provider', 'unknown')})")
                            email_sent = True
                        else:
                            logger.warning(f"⚠️ [FALLBACK] 이메일 폴백 실패: {result.get('message')}")

                    except Exception as email_error:
                        logger.error(f"❌ [FALLBACK] 이메일 서비스 호출 실패: {email_error}")

                # 폴백 시도 결과 로깅
                if email_sent:
                    logger.info(f"✅ [FALLBACK] 폴백 알림 성공 - 회원: {member_id}")
                else:
                    logger.info(f"ℹ️ [FALLBACK] 폴백 알림 시도 완료 - 회원: {member_id}")

            finally:
                db.close()

        except Exception as e:
            logger.error(f"❌ [FALLBACK] 폴백 알림 트리거 실패: {e}")

    def _is_important_notification(self, title: str, content: str) -> bool:
        """
        중요 알림인지 판단 (폴백 대상 선별)
        """
        important_keywords = [
            '중요', '긴급', '알림', '공지', '예약', '취소', '변경',
            '결제', '환불', '승인', '거절', '만료', '종료'
        ]

        title_lower = title.lower()
        content_lower = content.lower()

        for keyword in important_keywords:
            if keyword in title_lower or keyword in content_lower:
                return True

        return False

    async def _send_fcm_fallback_email(self, email: str, title: str, content: str, reason: str) -> Dict[str, Any]:
        """
        FCM 폴백용 이메일 발송 (EmailService 구조 참고)
        네이버웍스 우선, Gmail SMTP 폴백
        """
        try:
            from app.services.email_service import email_service
            import os

            # FCM 폴백용 이메일 제목
            subject = f"[SMAP 알림] {title}"

            # 실패 사유에 따른 메시지
            reason_messages = {
                'token_expired': '푸시 토큰이 만료되어',
                'token_invalid': '푸시 토큰이 유효하지 않아',
                'fcm_error': '푸시 서버 오류로',
                'firebase_disabled': '푸시 서비스가 일시적으로 중단되어'
            }
            reason_text = reason_messages.get(reason, '시스템 오류로')

            # HTML 이메일 템플릿 (EmailService 구조 참고, 향상된 디자인)
            html_content = f"""
            <!DOCTYPE html>
            <html lang="ko">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>SMAP FCM 폴백 알림</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');

                    * {{
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }}

                    body {{
                        font-family: 'Noto Sans KR', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #2c3e50;
                        margin: 0;
                        padding: 0;
                        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                        min-height: 100vh;
                    }}

                    .container {{
                        max-width: 650px;
                        margin: 20px auto;
                        background: #ffffff;
                        border-radius: 20px;
                        overflow: hidden;
                        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                    }}

                    .header {{
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
                        color: white;
                        padding: 50px 40px;
                        text-align: center;
                        position: relative;
                        overflow: hidden;
                    }}

                    .header::before {{
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="75" cy="75" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="50" cy="10" r="0.5" fill="rgba(255,255,255,0.1)"/><circle cx="10" cy="50" r="0.5" fill="rgba(255,255,255,0.1)"/><circle cx="90" cy="50" r="0.5" fill="rgba(255,255,255,0.1)"/><circle cx="50" cy="90" r="0.5" fill="rgba(255,255,255,0.1)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
                        opacity: 0.3;
                    }}

                    .header-content {{
                        position: relative;
                        z-index: 1;
                    }}

                    .logo {{
                        font-size: 32px;
                        font-weight: 700;
                        margin-bottom: 15px;
                        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                        letter-spacing: 2px;
                    }}

                    .header h1 {{
                        font-size: 28px;
                        font-weight: 600;
                        margin-bottom: 10px;
                        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                        letter-spacing: -0.5px;
                    }}

                    .header .subtitle {{
                        font-size: 16px;
                        opacity: 0.95;
                        font-weight: 300;
                    }}

                    .content {{
                        padding: 50px 40px;
                    }}

                    .status-card {{
                        background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
                        border: 2px solid #feb2b2;
                        border-radius: 16px;
                        padding: 30px;
                        margin-bottom: 30px;
                        position: relative;
                        overflow: hidden;
                    }}

                    .status-card::before {{
                        content: '🚨';
                        position: absolute;
                        top: 20px;
                        right: 20px;
                        font-size: 24px;
                        opacity: 0.7;
                    }}

                    .status-title {{
                        font-size: 18px;
                        font-weight: 600;
                        color: #c53030;
                        margin-bottom: 10px;
                        display: flex;
                        align-items: center;
                    }}

                    .status-title::before {{
                        content: '⚠️';
                        margin-right: 10px;
                    }}

                    .status-message {{
                        color: #742a2a;
                        font-size: 15px;
                        line-height: 1.7;
                    }}

                    .notification-card {{
                        background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%);
                        border: 2px solid #9ae6b4;
                        border-radius: 16px;
                        padding: 30px;
                        margin-bottom: 30px;
                        position: relative;
                    }}

                    .notification-card::before {{
                        content: '📢';
                        position: absolute;
                        top: 20px;
                        right: 20px;
                        font-size: 24px;
                        opacity: 0.7;
                    }}

                    .notification-title {{
                        font-size: 20px;
                        font-weight: 600;
                        color: #2f855a;
                        margin-bottom: 20px;
                        display: flex;
                        align-items: center;
                    }}

                    .notification-title::before {{
                        content: '📱';
                        margin-right: 10px;
                    }}

                    .notification-content {{
                        background: rgba(255, 255, 255, 0.7);
                        border-radius: 12px;
                        padding: 20px;
                        margin-bottom: 15px;
                        border-left: 4px solid #48bb78;
                    }}

                    .content-label {{
                        font-weight: 600;
                        color: #2d3748;
                        margin-bottom: 8px;
                        font-size: 14px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }}

                    .content-text {{
                        color: #4a5568;
                        font-size: 16px;
                        line-height: 1.6;
                    }}

                    .action-card {{
                        background: linear-gradient(135deg, #ebf8ff 0%, #bee3f8 100%);
                        border: 2px solid #90cdf4;
                        border-radius: 16px;
                        padding: 25px;
                        margin-bottom: 30px;
                        text-align: center;
                    }}

                    .action-title {{
                        font-size: 18px;
                        font-weight: 600;
                        color: #2b6cb0;
                        margin-bottom: 15px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }}

                    .action-title::before {{
                        content: '💡';
                        margin-right: 10px;
                    }}

                    .action-button {{
                        display: inline-block;
                        background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%);
                        color: white;
                        padding: 15px 30px;
                        text-decoration: none;
                        border-radius: 50px;
                        font-weight: 600;
                        font-size: 16px;
                        box-shadow: 0 4px 15px rgba(49, 130, 206, 0.4);
                        transition: all 0.3s ease;
                        margin-top: 10px;
                    }}

                    .action-button:hover {{
                        transform: translateY(-2px);
                        box-shadow: 0 6px 20px rgba(49, 130, 206, 0.6);
                    }}

                    .footer {{
                        background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
                        color: white;
                        padding: 40px;
                        text-align: center;
                        position: relative;
                    }}

                    .footer::before {{
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 4px;
                        background: linear-gradient(90deg, #667eea, #764ba2, #f093fb);
                    }}

                    .footer-content {{
                        position: relative;
                        z-index: 1;
                    }}

                    .footer-title {{
                        font-size: 18px;
                        font-weight: 600;
                        margin-bottom: 10px;
                        opacity: 0.9;
                    }}

                    .footer-text {{
                        font-size: 14px;
                        opacity: 0.8;
                        line-height: 1.6;
                        margin-bottom: 20px;
                    }}

                    .footer-contact {{
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 12px;
                        padding: 20px;
                        margin-top: 20px;
                        border: 1px solid rgba(255, 255, 255, 0.2);
                    }}

                    .contact-info {{
                        font-size: 13px;
                        opacity: 0.9;
                    }}

                    .divider {{
                        height: 1px;
                        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                        margin: 20px 0;
                    }}

                    @media only screen and (max-width: 600px) {{
                        .container {{
                            margin: 10px;
                            border-radius: 12px;
                        }}

                        .header, .content, .footer {{
                            padding: 30px 20px;
                        }}

                        .header h1 {{
                            font-size: 24px;
                        }}

                        .logo {{
                            font-size: 28px;
                        }}

                        .status-card, .notification-card, .action-card {{
                            padding: 20px;
                            margin-bottom: 20px;
                        }}

                        .notification-title {{
                            font-size: 18px;
                        }}

                        .action-button {{
                            padding: 12px 24px;
                            font-size: 15px;
                        }}
                    }}

                    @keyframes pulse {{
                        0% {{ transform: scale(1); }}
                        50% {{ transform: scale(1.05); }}
                        100% {{ transform: scale(1); }}
                    }}

                    .status-card {{
                        animation: pulse 2s infinite;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="header-content">
                            <div class="logo">🚀 SMAP</div>
                            <h1>푸시 알림 실패 안내</h1>
                            <div class="subtitle">이메일로 안내드립니다</div>
                        </div>
                    </div>

                    <div class="content">
                        <div class="status-card">
                            <div class="status-title">알림 전송 실패</div>
                            <div class="status-message">
                                {reason_text} 푸시 알림을 보내지 못했습니다.<br>
                                이메일로 대신 안내드립니다.
                            </div>
                        </div>

                        <div class="notification-card">
                            <div class="notification-title">원본 알림 내용</div>
                            <div class="notification-content">
                                <div class="content-label">📋 제목</div>
                                <div class="content-text">{title}</div>
                            </div>
                            <div class="notification-content">
                                <div class="content-label">📝 내용</div>
                                <div class="content-text">{content}</div>
                            </div>
                        </div>

                        <div class="action-card">
                            <div class="action-title">확인 방법</div>
                            <div style="color: #2b6cb0; font-size: 15px; margin-bottom: 15px;">
                                앱을 실행하여 최신 알림을 확인해주세요.
                            </div>
                            <a href="#" class="action-button">📱 앱 실행하기</a>
                        </div>

                        <div style="text-align: center; color: #718096; font-size: 13px; margin-top: 30px;">
                            이 알림은 SMAP 시스템에서 FCM 전송 실패 시 자동으로 발송되었습니다.
                        </div>
                    </div>

                    <div class="footer">
                        <div class="footer-content">
                            <div class="footer-title">SMAP 팀</div>
                            <div class="footer-text">
                                언제나 최고의 서비스를 제공하기 위해 노력하겠습니다.
                            </div>

                            <div class="divider"></div>

                            <div class="footer-contact">
                                <div class="contact-info">
                                    📞 문의사항이 있으시면 고객센터로 연락해주세요.<br>
                                    💌 support@smap.site
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """

            # 텍스트 버전 (향상된 디자인)
            text_content = f"""
╔══════════════════════════════════════════════╗
║              🚀 SMAP 알림 시스템              ║
╠══════════════════════════════════════════════╣
║                                              ║
║  🚨   푸시 알림 전송 실패 안내                ║
║                                              ║
║  ⚠️  안내사항                                  ║
║     {reason_text} 푸시 알림을 보내지 못했습니다.    ║
║     이메일로 대신 안내드립니다.                   ║
║                                              ║
╠══════════════════════════════════════════════╣
║                                              ║
║  📢   원본 알림 내용                          ║
║                                              ║
║  📋 제목:                                     ║
║     {title}                                   ║
║                                              ║
║  📝 내용:                                     ║
║     {content}                                 ║
║                                              ║
╠══════════════════════════════════════════════╣
║                                              ║
║  💡   확인 방법                               ║
║     📱 앱을 실행하여 최신 알림을 확인해주세요.   ║
║                                              ║
╠══════════════════════════════════════════════╣
║                                              ║
║  📞   문의사항                                ║
║     고객센터: support@smap.site              ║
║                                              ║
║  🔄   이 알림은 SMAP 시스템에서               ║
║       FCM 전송 실패 시 자동으로 발송됩니다.     ║
║                                              ║
╚══════════════════════════════════════════════╝

SMAP 팀 드림 - 언제나 최고의 서비스를 제공하기 위해 노력하겠습니다.
"""

            # EmailService의 send_password_reset_email 구조를 참고하여 FCM 폴백 이메일 발송
            result = await self._send_fallback_email_via_service(email, subject, html_content, text_content)
            return result

        except Exception as e:
            logger.error(f"❌ FCM 폴백 이메일 발송 실패: {str(e)}")
            return {
                "success": False,
                "message": f"FCM 폴백 이메일 발송 실패: {str(e)}",
                "email": email
            }

    async def _send_fallback_email_via_service(self, email: str, subject: str, html_content: str, text_content: str) -> Dict[str, Any]:
        """
        EmailService를 활용한 FCM 폴백 이메일 발송
        EmailService의 구조를 참고하여 네이버웍스 우선, Gmail 폴백 방식 적용
        """
        try:
            from app.services.email_service import email_service
            import os

            # 네이버웍스 설정 확인 및 우선 사용 (EmailService 구조 참고)
            if (os.getenv('NAVERWORKS_CLIENT_ID') and
                os.getenv('NAVERWORKS_CLIENT_SECRET') and
                os.getenv('NAVERWORKS_DOMAIN')):

                logger.info(f"📧 네이버웍스 이메일 폴백 시도: {email}")

                try:
                    # 네이버웍스 이메일 발송 시도
                    result = await email_service.send_naverworks_email(email, subject, html_content, text_content)

                    # 네이버웍스 발송 성공 시
                    if result.get('success'):
                        return result
                    else:
                        # 네이버웍스 실패 시 Gmail로 폴백
                        logger.warning(f"⚠️ 네이버웍스 이메일 폴백 실패, Gmail SMTP로 폴백: {email}")

                except Exception as e:
                    logger.error(f"❌ 네이버웍스 이메일 폴백 중 오류: {str(e)}")
                    logger.warning(f"⚠️ Gmail SMTP로 폴백: {email}")

            # 개발 환경에서는 Mock 처리
            if os.getenv('NODE_ENV') == 'development':
                logger.info(f"📧 [개발환경] FCM 폴백 이메일 Mock: {email}")
                logger.info(f"📧 [개발환경] 제목: {subject}")

                return {
                    "success": True,
                    "message": "FCM 폴백 이메일이 성공적으로 발송되었습니다. (개발환경 Mock)",
                    "email": email,
                    "provider": "mock",
                    "dev": True
                }

            # 네이버웍스 설정이 없거나 실패했으면 Gmail SMTP 사용
            logger.info(f"📧 Gmail SMTP FCM 폴백 이메일 발송 시도: {email}")

            # Gmail SMTP 직접 발송 (EmailService 구조 참고)
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            from app.config import settings

            # 이메일 메시지 생성
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = settings.EMAIL_SENDER
            message["To"] = email

            # HTML 및 텍스트 버전 추가
            html_part = MIMEText(html_content, "html")
            text_part = MIMEText(text_content, "plain")

            message.attach(text_part)
            message.attach(html_part)

            # Gmail SMTP 연결 및 발송
            context = ssl.create_default_context()

            with smtplib.SMTP_SSL(settings.EMAIL_SMTP_SERVER or "smtp.gmail.com",
                                 settings.EMAIL_SMTP_PORT or 465,
                                 context=context) as server:
                server.login(settings.EMAIL_SENDER, settings.EMAIL_PASSWORD)
                server.send_message(message)

            logger.info(f"✅ Gmail FCM 폴백 이메일 발송 성공: {email}")

            return {
                "success": True,
                "message": "FCM 폴백 이메일이 성공적으로 발송되었습니다.",
                "email": email,
                "provider": "gmail"
            }

        except Exception as e:
            logger.error(f"❌ FCM 폴백 이메일 발송 실패: {str(e)}")
            return {
                "success": False,
                "message": f"FCM 폴백 이메일 발송에 실패했습니다: {str(e)}",
                "email": email
            }

    def _build_fallback_content(self, original_content: str, reason: str) -> str:
        """
        폴백 알림 내용 구성 (텍스트 버전용)
        """
        reason_messages = {
            'token_expired': '푸시 토큰이 만료되어',
            'token_invalid': '푸시 토큰이 유효하지 않아',
            'fcm_error': '푸시 서버 오류로',
            'firebase_disabled': '푸시 서비스가 일시적으로 중단되어'
        }

        reason_text = reason_messages.get(reason, '시스템 오류로')

        return f"""[SMAP]
{reason_text} 푸시 알림을 보내지 못했습니다.

📢 알림 내용:
{original_content}

앱을 실행하여 자세한 내용을 확인해주세요."""

    def _validate_fcm_token(self, token: str) -> bool:
        """
        FCM 토큰 형식 검증 (개선된 버전)
        Firebase 표준에 맞는 토큰 형식인지 검증합니다.
        """
        if not token or len(token.strip()) == 0:
            logger.warning("🚨 [FCM TOKEN VALIDATION] 빈 토큰")
            return False

        # FCM 토큰 길이 검증 (현실적인 범위로 조정)
        # 기존 문서에서는 140-200자였지만, 실제로는 다양한 길이가 존재
        if len(token) < 20 or len(token) > 500:
            logger.warning(f"🚨 [FCM TOKEN VALIDATION] 토큰 길이 이상: {len(token)}자 (정상 범위: 20-500자)")
            return False

        # FCM 토큰 기본 형식 검증 (현실적이고 유연한 검증)
        import re
        
        # FCM 토큰의 다양한 형식을 지원
        # 1. 전통적인 형태: 프로젝트ID:APA91b...
        # 2. 현대적인 형태: 직접적인 토큰 문자열 (콜론 없음)
        
        if ':' in token:
            # 콜론이 있는 경우: 프로젝트ID:토큰 형태
            parts = token.split(':', 1)
            if len(parts) == 2:
                project_id, token_part = parts
                
                # 프로젝트 ID 검증
                if not project_id or len(project_id) == 0 or len(project_id) > 100:
                    logger.warning(f"🚨 [FCM TOKEN VALIDATION] 잘못된 프로젝트 ID: '{project_id}'")
                    return False
                
                # 토큰 파트가 APA91b로 시작하는지 확인 (선택사항)
                if token_part.startswith('APA91b') and len(token_part) < 100:
                    logger.warning(f"🚨 [FCM TOKEN VALIDATION] 토큰 파트가 너무 짧음: {len(token_part)}자")
                    return False
                    
                # 프로젝트 ID와 토큰 파트에 허용되는 문자 검증
                if not re.match(r'^[a-zA-Z0-9_-]+$', project_id):
                    logger.warning(f"🚨 [FCM TOKEN VALIDATION] 프로젝트 ID에 허용되지 않는 문자: {project_id}")
                    return False
                
                if not re.match(r'^[a-zA-Z0-9_-]+$', token_part):
                    logger.warning(f"🚨 [FCM TOKEN VALIDATION] 토큰 파트에 허용되지 않는 문자: {token_part[:30]}...")
                    return False
                    
            else:
                logger.warning(f"🚨 [FCM TOKEN VALIDATION] 잘못된 토큰 구조: {token[:30]}...")
                return False
        else:
            # 콜론이 없는 경우: 직접적인 토큰 문자열
            # 현재 DB에 저장된 토큰 형태 (fR8nxUvlA0znuI4IoO5h... 등)
            logger.info(f"✅ [FCM TOKEN VALIDATION] 직접 토큰 문자열 형식: {token[:30]}...")
            
            # 기본 문자 검증 - 영숫자, 하이픈, 언더스코어만 허용
            if not re.match(r'^[a-zA-Z0-9_-]+$', token):
                logger.warning(f"🚨 [FCM TOKEN VALIDATION] 토큰에 허용되지 않는 문자: {token[:30]}...")
                return False

        logger.info(f"✅ [FCM TOKEN VALIDATION] 토큰 형식 검증 통과: {token[:30]}...")
        return True

    def send_silent_push_for_token_refresh(self, token: str, member_id: int = None) -> str:
        """
        토큰 갱신을 위한 Silent Push 전송 (iOS 백그라운드 푸시 개선)
        
        iOS 앱이 백그라운드에 있을 때 토큰 갱신을 유도하기 위해 조용한 푸시를 보냅니다.
        사용자에게는 알림이 표시되지 않고, 앱에서만 토큰 갱신 로직이 실행됩니다.
        
        Args:
            token: FCM 토큰
            member_id: 회원 ID (선택사항)
            
        Returns:
            str: 전송 결과
        """
        if not self._firebase_available:
            logger.warning("🚨 [Silent Push] Firebase가 초기화되지 않음")
            return "firebase_disabled"
            
        try:
            logger.info(f"🔇 [Silent Push] 토큰 갱신용 Silent Push 전송 시작 - 토큰: {token[:30]}...")
            
            # Silent Push 메시지 생성 (iOS 최적화)
            message = messaging.Message(
                token=token,
                data={
                    "action": "token_refresh",
                    "type": "silent_push",
                    "timestamp": str(int(time.time())),
                    "force_token_update": "true",
                    "background_refresh": "true"
                },
                apns=messaging.APNSConfig(
                    headers={
                        "apns-priority": "5",  # 낮은 우선순위 (Silent Push)
                        "apns-push-type": "background"  # 백그라운드 푸시
                    },
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            content_available=True,  # Silent Push 핵심 설정
                            mutable_content=True
                        ),
                        custom_data={
                            "action": "token_refresh",
                            "force_update": "true"
                        }
                    )
                ),
                android=messaging.AndroidConfig(
                    priority="high",
                    data={
                        "action": "token_refresh",
                        "force_update": "true"
                    }
                )
            )
            
            # Silent Push 전송
            response = messaging.send(message)
            logger.info(f"✅ [Silent Push] 토큰 갱신용 Silent Push 전송 성공 - 응답: {response}")
            
            # 성공 기록
            self._log_token_refresh_attempt(token, member_id, "silent_push_sent", True)
            
            return "silent_push_sent"
            
        except messaging.UnregisteredError:
            logger.warning(f"🚨 [Silent Push] 토큰이 등록되지 않음 - 토큰 무효화 처리: {token[:30]}...")
            self._handle_token_invalidation(token, "unregistered_silent_push")
            return "token_unregistered"
            
        except messaging.ThirdPartyAuthError as e:
            logger.error(f"🚨 [Silent Push] 인증 오류: {e}")
            return "auth_error"
            
        except Exception as e:
            logger.error(f"🚨 [Silent Push] 예상치 못한 오류: {e}")
            self._log_token_refresh_attempt(token, member_id, "silent_push_error", False, str(e))
            return f"error: {str(e)}"

    def _log_token_refresh_attempt(self, token: str, member_id: int = None, action: str = "", success: bool = True, error_msg: str = ""):
        """
        토큰 갱신 시도 기록
        """
        try:
            log_entry = {
                "timestamp": int(time.time()),
                "token_preview": f"{token[:20]}..." if token else "none",
                "member_id": member_id,
                "action": action,
                "success": success,
                "error": error_msg
            }
            
            logger.info(f"📊 [Token Refresh Log] {log_entry}")
            
            # 필요시 파일에도 기록
            with open("token_refresh_attempts.log", "a", encoding="utf-8") as f:
                import json
                f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
                
        except Exception as e:
            logger.warning(f"⚠️ [Token Refresh Log] 기록 실패: {e}")

    def is_available(self) -> bool:
        """Firebase 서비스 사용 가능 여부 확인"""
        return self._firebase_available

    def validate_ios_token(self, token: str) -> bool:
        """
        iOS FCM 토큰 유효성 검증
        APNS 토큰 형식 검증 및 기본적인 유효성 확인
        """
        if not token or len(token.strip()) == 0:
            logger.warning("🚨 [FCM iOS] 빈 토큰 감지")
            return False

        # FCM 토큰은 일반적으로 152자 또는 162자의 base64url 형식
        if len(token) < 100 or len(token) > 200:
            logger.warning(f"🚨 [FCM iOS] 토큰 길이 이상: {len(token)}자")
            return False

        # FCM 토큰에 허용되지 않는 문자 확인 (콜론 허용)
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$', token):
            logger.warning(f"🚨 [FCM iOS] 토큰 형식이 올바르지 않음: {token[:20]}...")
            return False

        logger.info(f"✅ [FCM iOS] 토큰 유효성 검증 통과: {token[:20]}...")
        return True

    def send_ios_optimized_push(self, token: str, title: str, content: str, is_background: bool = False) -> str:
        """
        iOS 최적화된 푸시 전송 메소드
        iOS 푸시 수신율을 높이기 위한 특화된 설정 적용
        """
        logger.info(f"📱 [FCM iOS] iOS 최적화 푸시 시작 - 토큰: {token[:30]}..., 백그라운드: {is_background}")

        # iOS 토큰 검증
        if not self.validate_ios_token(token):
            logger.error(f"📱 [FCM iOS] iOS 토큰 검증 실패: {token[:30]}...")
            raise ValueError("iOS FCM 토큰이 유효하지 않습니다")

        logger.info(f"📱 [FCM iOS] 토큰 검증 통과")

        # iOS 푸시 타입에 따른 전송 메소드 선택
        if is_background:
            logger.info(f"📱 [FCM iOS] 백그라운드 푸시 전송")
            return self.send_background_push_notification(
                token=token,
                title=title,
                content=content,
                content_available=True,
                priority="high",
                event_url=None,
                schedule_id=None
            )
        else:
            logger.info(f"📱 [FCM iOS] 일반 푸시 전송 (재시도: {Config.IOS_PUSH_RETRY_COUNT})")
            return self.send_push_notification(
                token=token,
                title=title,
                content=content,
                max_retries=Config.IOS_PUSH_RETRY_COUNT  # 설정된 재시도 횟수 사용
            )

    def _handle_token_invalidation(self, token: str, reason: str, title: str = None, content: str = None):
        """
        FCM 토큰 무효화 처리 메소드 (개선된 버전)
        토큰이 무효화된 경우 DB에서 제거하고 사용자 알림 처리

        Args:
            token: 무효화된 FCM 토큰
            reason: 무효화 이유 (unregistered, invalid_registration, invalid_token_format 등)
            title: 원래 전송하려던 푸시 제목
            content: 원래 전송하려던 푸시 내용
        """
        try:
            logger.info(f"🔄 [FCM TOKEN MANAGEMENT] 토큰 무효화 처리 시작 - 토큰: {token[:30]}..., 이유: {reason}")

            # 데이터베이스 연결
            from app.db.session import get_db
            from app.models.member import Member
            from sqlalchemy.orm import Session
            from datetime import datetime

            db: Session = next(get_db())

            try:
                # 토큰으로 사용자 조회
                member = db.query(Member).filter(Member.mt_token_id == token).first()

                if member:
                    logger.warning(f"🚨 [FCM TOKEN MANAGEMENT] 무효화된 토큰 발견 - 사용자: {member.mt_id} ({member.mt_idx})")
                    logger.info(f"📋 [FCM TOKEN MANAGEMENT] 토큰 제거 전 정보: 업데이트={member.mt_token_updated_at}, 만료={member.mt_token_expiry_date}")

                    # 토큰 무효화 기록을 위한 백업 정보
                    backup_info = {
                        'member_id': member.mt_idx,
                        'member_name': member.mt_name,
                        'old_token': token[:50] + "...",
                        'reason': reason,
                        'invalidated_at': datetime.now().isoformat()
                    }

                    # FCM 토큰 정보 초기화
                    member.mt_token_id = None
                    member.mt_token_updated_at = None
                    member.mt_token_expiry_date = None
                    member.mt_udate = datetime.now()

                    # 변경사항 저장
                    db.commit()

                    logger.info(f"✅ [FCM TOKEN MANAGEMENT] 토큰 제거 완료 - 사용자: {member.mt_idx}")
                    logger.info(f"📊 [FCM TOKEN MANAGEMENT] 정리 기록: 이유={reason}, 토큰_접두사={token[:30]}..., 타임스탬프={int(time.time())}")

                    # 무효화 기록을 파일에 저장 (디버깅 및 추적용)
                    try:
                        import json
                        import os
                        log_file = "invalid_tokens.log"
                        with open(log_file, "a", encoding="utf-8") as f:
                            f.write(f"{json.dumps(backup_info, ensure_ascii=False)}\n")
                        logger.info(f"📝 [FCM TOKEN MANAGEMENT] 무효화 기록이 {log_file}에 저장됨")
                    except Exception as log_error:
                        logger.warning(f"⚠️ [FCM TOKEN MANAGEMENT] 무효화 기록 저장 실패: {log_error}")

                    # 폴백 알림 트리거 (중요한 메시지인 경우)
                    if title and content and self._is_important_notification(title, content):
                        logger.info(f"🔔 [FCM TOKEN MANAGEMENT] 중요 메시지로 판단 - 폴백 알림 시도")
                        try:
                            import asyncio
                            asyncio.create_task(self._trigger_fallback_notification(
                                member.mt_idx, title, content, f"token_invalidated_{reason}"
                            ))
                        except Exception as fallback_error:
                            logger.warning(f"⚠️ [FCM TOKEN MANAGEMENT] 폴백 알림 실패: {fallback_error}")

                    # 사용자에게 토큰 갱신 알림 전송 시도 (가능한 경우)
                    try:
                        if member.mt_push1 == 'Y':  # 푸시 알림 동의한 경우
                            logger.info(f"🔔 [FCM TOKEN MANAGEMENT] 토큰 갱신 알림 전송 시도 - 사용자: {member.mt_idx}")
                            
                            # 토큰 갱신 필요 메시지 생성
                            refresh_message = self._build_token_refresh_message(reason)
                            logger.info(f"📢 [FCM TOKEN MANAGEMENT] {refresh_message}")

                    except Exception as e:
                        logger.warning(f"⚠️ [FCM TOKEN MANAGEMENT] 토큰 갱신 알림 전송 실패: {e}")

                else:
                    logger.warning(f"⚠️ [FCM TOKEN MANAGEMENT] 무효화된 토큰에 해당하는 사용자를 찾을 수 없음: {token[:30]}...")
                    logger.info(f"📊 [FCM TOKEN MANAGEMENT] 정리 기록 (사용자 미발견): 이유={reason}, 토큰_접두사={token[:30]}..., 타임스탬프={int(time.time())}")
                    
                    # 사용자 미발견 기록도 로그에 저장
                    try:
                        import json
                        orphan_info = {
                            'token': token[:50] + "...",
                            'reason': reason,
                            'status': 'user_not_found',
                            'invalidated_at': datetime.now().isoformat()
                        }
                        log_file = "invalid_tokens.log"
                        with open(log_file, "a", encoding="utf-8") as f:
                            f.write(f"{json.dumps(orphan_info, ensure_ascii=False)}\n")
                    except:
                        pass

            finally:
                db.close()

            # 정리 작업 완료
            logger.info(f"✅ [FCM TOKEN MANAGEMENT] 토큰 무효화 처리 완료 - 이유: {reason}")

        except Exception as e:
            logger.error(f"❌ [FCM TOKEN MANAGEMENT] 토큰 무효화 처리 중 오류: {e}")
            logger.error(f"   토큰: {token[:30]}..., 이유: {reason}")
            
            # 에러 정보도 로그에 기록
            try:
                import json
                from datetime import datetime
                error_info = {
                    'token': token[:50] + "...",
                    'reason': reason,
                    'status': 'error',
                    'error_message': str(e),
                    'error_at': datetime.now().isoformat()
                }
                log_file = "invalid_tokens.log"
                with open(log_file, "a", encoding="utf-8") as f:
                    f.write(f"{json.dumps(error_info, ensure_ascii=False)}\n")
            except:
                pass

    def _build_token_refresh_message(self, reason: str) -> str:
        """토큰 갱신 이유에 따른 메시지 생성"""
        reason_messages = {
            'unregistered': 'FCM 토큰이 Firebase 서버에서 무효화되었습니다',
            'invalid_registration': 'FCM 토큰 등록 정보가 유효하지 않습니다',
            'invalid_token_format': 'FCM 토큰 형식이 올바르지 않습니다',
            'third_party_auth_error': 'FCM 토큰 인증에 문제가 발생했습니다'
        }
        
        base_message = reason_messages.get(reason, 'FCM 토큰에 문제가 발생했습니다')
        return f"{base_message}. 앱을 완전히 종료하고 재시작하여 새로운 토큰을 받아주세요."

    def _send_token_refresh_notification(self, member_idx: int, reason: str):
        """
        토큰 갱신 요청 알림 전송 (토큰이 없는 경우에만 사용)

        Args:
            member_idx: 사용자 ID
            reason: 토큰 갱신 필요 이유
        """
        try:
            logger.info(f"🔔 [FCM TOKEN REFRESH] 토큰 갱신 알림 전송 - 사용자: {member_idx}, 이유: {reason}")

            # 여기서는 실제 알림 전송 대신 로그 기록
            # 실제 구현에서는 SMS, 이메일, 다른 푸시 채널 등을 사용할 수 있음
            logger.info(f"📢 [FCM TOKEN REFRESH] FCM 토큰 갱신 필요 - 사용자 {member_idx}: {reason}")

        except Exception as e:
            logger.error(f"❌ [FCM TOKEN REFRESH] 토큰 갱신 알림 전송 실패: {e}")

# 싱글톤 인스턴스 생성
firebase_service = FirebaseService() 