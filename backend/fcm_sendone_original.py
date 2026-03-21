from flask import Flask, jsonify, session, g
from flask_restx import Namespace, Resource, fields, reqparse, inputs
from smap.models import member_t, push_log_t
import datetime
import firebase_admin
from firebase_admin import credentials, messaging
from smap.configs import Config
from typing import Dict, Any
import logging

# 로거 설정
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

ns = Namespace(
    'fcm_sendone',
    description = '푸시발송(단건)'
)

parser = reqparse.RequestParser()
parser.add_argument('plt_type', required=True, help='전송구분')
parser.add_argument('sst_idx', required=True, help='일정idx')
parser.add_argument('plt_condition', required=True, help='전송조건')
parser.add_argument('plt_memo', required=True, help='전송조건설명')
parser.add_argument('mt_id', required=False, help='아이디')
parser.add_argument('mt_idx', required=False, help='회원 인덱스')
parser.add_argument('mt_token_id', required=False, help='FCM 토큰')
parser.add_argument('plt_title', required=True, help='제목')
parser.add_argument('plt_content', required=True, help='내용')

SUCCESS = "true"
FAILURE = "false"

def create_response(success: str, title: str, message: str, data: Any = None) -> Dict[str, Any]:
    return {"success": success, "title": title, "message": message, "data": data}

def initialize_firebase():
    cred_path = Config.FCM_JSON_PATH
    cred = credentials.Certificate(cred_path)
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred)

def send_fcm_message(token: str, title: str, content: str) -> str:
    message = messaging.Message(
        data={'title': title, 'body': content},
        notification=messaging.Notification(title=title, body=content),
        android=messaging.AndroidConfig(
            priority='high',
            notification=messaging.AndroidNotification(sound='default')
        ),
        apns=messaging.APNSConfig(
            headers={
                'apns-push-type': 'alert',
                'apns-priority': '10',
                'apns-topic': Config.IOS_BUNDLE_ID,
            },
            payload=messaging.APNSPayload(
                aps=messaging.Aps(
                    sound='default',
                    badge=1,
                    content_available=False,
                    mutable_content=True,
                )
            )
        ),
        token=token,
    )
    return messaging.send(message)

def create_push_log(args: Dict[str, Any], mt_idx: int, status: int) -> push_log_t.Push_log_t:
    now = datetime.datetime.now()
    return push_log_t.Push_log_t(
        plt_type=args['plt_type'],
        mt_idx=mt_idx,
        sst_idx=args['sst_idx'],
        plt_condition=args['plt_condition'],
        plt_memo=args['plt_memo'],
        plt_title=args['plt_title'],
        plt_content=args['plt_content'],
        plt_sdate=now.strftime('%Y-%m-%d %H:%M:%S'),
        plt_status=status,
        plt_read_chk='N',
        plt_show='Y',
        plt_wdate=now.strftime('%Y-%m-%d %H:%M:%S')
    )

@ns.route('/')
class fcm_sendone(Resource):
    @ns.expect(parser)
    def post(self):
        try:
            logger.debug("푸시 발송 요청 파라미터 파싱 중")
            args = parser.parse_args()
            logger.debug(f"파싱된 파라미터: {args}")

            logger.debug("회원 정보 조회 중")

            # mt_token_id가 있으면 직접 사용, 없으면 mt_id 또는 mt_idx로 회원 조회
            token = None
            mt_idx = None

            if args.get('mt_token_id'):
                # 토큰이 직접 제공된 경우
                token = args['mt_token_id']
                logger.debug(f"직접 제공된 토큰 사용: {token[:20]}...")
                # mt_idx가 제공되지 않은 경우 기본값 설정
                mt_idx = args.get('mt_idx', 0)
            else:
                # mt_id 또는 mt_idx 중 하나는 필수
                if not args.get('mt_id') and not args.get('mt_idx'):
                    logger.debug("mt_id, mt_idx, mt_token_id 중 하나는 필요합니다")
                    return jsonify(create_response(FAILURE, "푸시발송(단건) 실패", "mt_id, mt_idx, mt_token_id 중 하나는 필요합니다."))

                row_mt = None
                if args.get('mt_id'):
                    row_mt = member_t.find_one_email(args['mt_id']) or member_t.find_one_mt_id(args['mt_id'])
                elif args.get('mt_idx'):
                    row_mt = member_t.find_one_idx(args['mt_idx'])

                logger.debug(f"조회된 회원 정보: {row_mt}")

                if not row_mt:
                    logger.debug("존재하지 않는 회원으로 푸시 발송 실패")
                    return jsonify(create_response(FAILURE, "푸시발송(단건) 실패", "존재하지 않는 회원입니다."))

                if not row_mt.mt_token_id:
                    logger.debug("앱 토큰이 존재하지 않아 푸시 발송 실패")
                    push_log = create_push_log(args, row_mt.mt_idx, 4)
                    g.db.add(push_log)
                    g.db.commit()
                    return jsonify(create_response(FAILURE, "푸시발송(단건) 실패", "앱토큰이 존재하지 않습니다."))

                token = row_mt.mt_token_id
                mt_idx = row_mt.mt_idx

            logger.debug("파이어베이스 초기화 중")
            initialize_firebase()
            logger.debug("푸시 메시지 전송 중")
            response = send_fcm_message(token, args['plt_title'], args['plt_content'])

            logger.debug("푸시 로그 생성 중")
            # mt_token_id로 직접 호출된 경우 push_log는 생성하지 않음 (선택사항)
            if mt_idx and mt_idx != 0:
                push_log = create_push_log(args, mt_idx, 2)
                g.db.add(push_log)
                g.db.commit()
            else:
                logger.debug("mt_idx가 없어서 push_log 생성 생략")

            logger.debug("푸시 발송 성공")
            return jsonify(create_response(SUCCESS, "푸시발송(단건) 성공", "푸시발송(단건) 성공했습니다."))

        except Exception as e:
            logger.error(f"푸시 발송 중 오류 발생: {str(e)}")
            return jsonify(create_response(FAILURE, "푸시발송(단건) 실패", str(e)))

@ns.route('/test')
class fcm_sendone(Resource):
    @ns.expect(parser)
    def post(self):
        args = parser.parse_args()
        return jsonify(create_response(SUCCESS, "푸시발송(단건) 성공", "푸시발송(단건) 성공했습니다.", args))