from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, text
from app.api import deps
from app.models.schedule import Schedule
from app.models.member import Member
from app.models.group import Group
from app.models.group_detail import GroupDetail
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate, ScheduleResponse
from app.schemas.fcm_notification import FCMSendRequest
from app.services.firebase_service import firebase_service
from app.models.push_log import PushLog
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class GroupScheduleManager:
    """그룹 스케줄 관리 클래스"""
    
    @staticmethod
    def check_group_permission(db: Session, user_id: int, group_id: int) -> Optional[Dict[str, Any]]:
        """그룹 권한 확인"""
        try:
            query = text("""
                SELECT 
                    m.mt_idx,
                    m.mt_name,
                    sgd.sgt_idx,
                    sgd.sgdt_idx,
                    sgd.sgdt_owner_chk,
                    sgd.sgdt_leader_chk,
                    sgd.sgdt_discharge,
                    sgd.sgdt_exit
                FROM member_t m
                JOIN smap_group_detail_t sgd ON m.mt_idx = sgd.mt_idx
                JOIN smap_group_t sg ON sgd.sgt_idx = sg.sgt_idx
                WHERE m.mt_idx = :user_id 
                    AND sgd.sgt_idx = :group_id 
                    AND sgd.sgdt_discharge = 'N' 
                    AND sgd.sgdt_exit = 'N'
                    AND sg.sgt_show = 'Y'
            """)
            
            result = db.execute(query, {"user_id": user_id, "group_id": group_id}).fetchone()
            
            if result:
                return {
                    "mt_idx": result.mt_idx,
                    "mt_name": result.mt_name,
                    "sgt_idx": result.sgt_idx,
                    "sgdt_idx": result.sgdt_idx,
                    "sgdt_owner_chk": result.sgdt_owner_chk,
                    "sgdt_leader_chk": result.sgdt_leader_chk,
                    "sgdt_discharge": result.sgdt_discharge,
                    "sgdt_exit": result.sgdt_exit
                }
            return None
        except Exception as e:
            logger.error(f"그룹 권한 확인 오류: {e}")
            return None
    
    @staticmethod
    def has_manage_permission(member_auth: Dict[str, Any]) -> bool:
        """관리 권한 확인"""
        return member_auth.get("sgdt_owner_chk") == "Y" or member_auth.get("sgdt_leader_chk") == "Y"
    
    @staticmethod
    def get_group_members(db: Session, group_id: int) -> List[Dict[str, Any]]:
        """그룹 멤버 목록 조회"""
        try:
            members_query = text("""
                SELECT 
                    mt.mt_idx,
                    mt.mt_name,
                    COALESCE(mt.mt_file1, '') as mt_file1,
                    sgdt.sgt_idx,
                    sgdt.sgdt_idx,
                    sgdt.sgdt_owner_chk,
                    sgdt.sgdt_leader_chk
                FROM smap_group_detail_t sgdt
                JOIN member_t mt ON sgdt.mt_idx = mt.mt_idx
                WHERE sgdt.sgt_idx = :group_id 
                AND sgdt.sgdt_discharge = 'N' 
                AND sgdt.sgdt_exit = 'N'
                AND sgdt.sgdt_show = 'Y'
                ORDER BY 
                    CASE sgdt.sgdt_owner_chk WHEN 'Y' THEN 1 ELSE 2 END,
                    CASE sgdt.sgdt_leader_chk WHEN 'Y' THEN 1 ELSE 2 END,
                    mt.mt_name
            """)
            
            result = db.execute(members_query, {"group_id": group_id})
            members = []
            
            for row in result:
                member_data = {
                    "mt_idx": row.mt_idx,
                    "mt_name": row.mt_name,
                    "mt_file1": row.mt_file1,
                    "sgt_idx": row.sgt_idx,
                    "sgdt_idx": row.sgdt_idx,
                    "sgdt_owner_chk": row.sgdt_owner_chk,
                    "sgdt_leader_chk": row.sgdt_leader_chk
                }
                members.append(member_data)
            
            return members
            
        except Exception as e:
            logger.error(f"그룹 멤버 조회 오류: {e}")
            return []
    
    @staticmethod
    def send_schedule_notification(
        db: Session, 
        action: str,  # 'create', 'update', 'delete'
        schedule_id: int,
        schedule_title: str,
        target_member_id: int,
        editor_id: Optional[int] = None,
        editor_name: Optional[str] = None
    ) -> bool:
        """
        일정 생성/수정/삭제 시 푸시 알림 전송
        
        Args:
            db: 데이터베이스 세션
            action: 액션 유형 ('create', 'update', 'delete')
            schedule_id: 일정 ID
            schedule_title: 일정 제목
            target_member_id: 일정 대상자 ID
            editor_id: 실제 작업자 ID
            editor_name: 실제 작업자 이름
        
        Returns:
            푸시 알림 전송 성공 여부
        """
        try:
            logger.info(f"🔔 [PUSH_NOTIFICATION] 함수 호출됨 - action: {action}, editor_id: {editor_id}, editor_name: {editor_name}, target_member_id: {target_member_id}")

            # 실제 작업자가 없으면 알림을 보내지 않음
            if not editor_id:
                logger.warning(f"⚠️ [PUSH_NOTIFICATION] editor_id가 없어 알림 전송 생략")
                return False
            if not editor_name:
                # 에디터 이름 조회
                editor_member = Member.find_by_idx(db, str(editor_id))
                editor_name = editor_member.mt_name if editor_member else "알 수 없음"

            logger.info(f"🔔 [PUSH_NOTIFICATION] 알림 전송 준비 완료 - editor: {editor_name}({editor_id}), target: {target_member_id}, action: {action}")
            
            # 액션에 따른 메시지 설정
            action_messages = {
                'create': {
                    'title': '🆕 새 일정이 생성되었습니다',
                    'content': f'{editor_name}님이 일정 "{schedule_title}"을(를) 생성했습니다.',
                    'condition': '일정 생성 알림',
                    'memo': '다른 멤버가 회원의 일정을 생성했을 때 전송'
                },
                'update': {
                    'title': '✏️ 일정이 수정되었습니다',
                    'content': f'{editor_name}님이 일정 "{schedule_title}"을(를) 수정했습니다.',
                    'condition': '일정 수정 알림',
                    'memo': '다른 멤버가 회원의 일정을 수정했을 때 전송'
                },
                'delete': {
                    'title': '🗑️ 일정이 삭제되었습니다',
                    'content': f'{editor_name}님이 일정 "{schedule_title}"을(를) 삭제했습니다.',
                    'condition': '일정 삭제 알림',
                    'memo': '다른 멤버가 회원의 일정을 삭제했을 때 전송'
                }
            }

            # 본인이 본인 일정을 작업하는 경우에도 알림을 보냄 (사용자 요청에 따라 수정)
            if editor_id == target_member_id:
                logger.info(f"🔔 [PUSH_NOTIFICATION] 본인 일정 {action} - 알림 전송 진행 (editor_id: {editor_id}, target_member_id: {target_member_id})")
                # 본인 작업인 경우 메시지를 약간 다르게 구성
                if action == 'update':
                    action_messages[action]['content'] = f'회원님의 일정 "{schedule_title}"이(가) 수정되었습니다.'
                elif action == 'create':
                    action_messages[action]['content'] = f'회원님의 일정 "{schedule_title}"이(가) 생성되었습니다.'
                elif action == 'delete':
                    action_messages[action]['content'] = f'회원님의 일정 "{schedule_title}"이(가) 삭제되었습니다.'
            
            if action not in action_messages:
                logger.error(f"❌ [PUSH_NOTIFICATION] 지원하지 않는 액션: {action}")
                return False
            
            message_info = action_messages[action]
            
            logger.info(f"🔔 [PUSH_NOTIFICATION] {action} 알림 전송 시작 - target: {target_member.mt_name}, editor: {editor_name}")

            # FCM 토큰 존재 여부 확인
            if not target_member.mt_token_id or target_member.mt_token_id.strip() == "":
                logger.warning(f"🚨 [FCM] FCM 토큰이 없음 - 회원: {target_member.mt_idx}({target_member.mt_name}), 토큰: '{target_member.mt_token_id}', FCM 전송 생략")
                return True

            # FCM 푸시 알림 전송
            logger.info(f"📤 [FCM] 푸시 알림 전송 시도 - 토큰: {target_member.mt_token_id[:20]}..., 제목: {message_info['title']}")
            response = firebase_service.send_push_notification(
                target_member.mt_token_id,
                message_info['title'],
                message_info['content'],
                member_id=target_member.mt_idx
            )
            logger.info(f"📥 [FCM] 푸시 알림 전송 결과 - response: {response}")
            
            # 푸시 로그 저장
            push_log = PushLog(
                plt_type="2",  # 일정 관련 타입
                mt_idx=target_member_id,
                sst_idx=schedule_id,
                plt_condition=message_info['condition'],
                plt_memo=message_info['memo'],
                plt_title=message_info['title'],
                plt_content=message_info['content'],
                plt_sdate=datetime.now(),
                plt_status=2 if response else 3,  # 2: 성공, 3: 실패
                plt_read_chk='N',
                plt_show='Y',
                plt_wdate=datetime.now()
            )
            
            db.add(push_log)
            db.commit()
            
            logger.info(f"✅ [PUSH_NOTIFICATION] {action} 알림 전송 성공 - target: {target_member.mt_name}")
            return True
            
        except Exception as e:
            logger.error(f"💥 [PUSH_NOTIFICATION] {action} 알림 전송 실패: {e}")
            return False

def create_recurring_schedules(db: Session, parent_schedule_id: int, base_params: Dict[str, Any], 
                             repeat_json: str, repeat_json_v: str) -> int:
    """
    반복 일정을 3년간 생성하는 함수
    
    Args:
        db: 데이터베이스 세션
        parent_schedule_id: 부모 스케줄 ID (sst_pidx로 사용)
        base_params: 기본 스케줄 파라미터
        repeat_json: 반복 설정 JSON (예: {"r1":"3","r2":"4"} 또는 {"r1":"3","r2":"1,2,3,4,5"})
        repeat_json_v: 반복 설정 텍스트 (예: "1주마다 목" 또는 "1주마다 월,화,수,목,금")
    
    Returns:
        생성된 반복 일정 개수
    """
    import json
    from datetime import datetime, timedelta
    
    try:
        logger.info(f"🔄 [RECURRING] 반복 일정 생성 시작 - parent_id: {parent_schedule_id}")
        
        # 반복 설정 파싱
        repeat_config = json.loads(repeat_json) if repeat_json else {}
        r1 = repeat_config.get("r1")  # 반복 주기 (1: 매일, 2: 매주, 3: 매월, 4: 매년)
        r2 = repeat_config.get("r2")  # 반복 값 (요일, 날짜 등)
        
        logger.info(f"🔄 [RECURRING] 반복 설정 파싱 - r1: {r1}, r2: {r2}")
        
        if not r1:
            logger.warning(f"⚠️ [RECURRING] 반복 주기가 없음")
            return 0
        
        # 기준 시작일/종료일
        base_start = datetime.fromisoformat(base_params["sst_sdate"].replace('T', ' '))
        base_end = datetime.fromisoformat(base_params["sst_edate"].replace('T', ' '))
        
        # 3년 후까지의 기간
        end_date = base_start + timedelta(days=365 * 3)
        
        logger.info(f"🔄 [RECURRING] 기간 설정 - 시작: {base_start}, 종료: {end_date}")
        
        created_count = 0
        
        # 매주 다중 요일 처리
        if r1 == "3" and r2 and "," in str(r2):  # 매주 다중 요일
            logger.info(f"🔄 [RECURRING] 매주 다중 요일 처리 시작 - r2: {r2}")
            
            # 요일 목록 파싱 (예: "1,2,3,4,5" -> [1,2,3,4,5])
            target_weekdays = [int(x.strip()) for x in str(r2).split(",") if x.strip().isdigit()]
            logger.info(f"🔄 [RECURRING] 대상 요일들: {target_weekdays}")
            
            # Python weekday 변환 (1=월요일 -> 0, 7=일요일 -> 6)
            python_weekdays = []
            for wd in target_weekdays:
                if wd == 7:  # 일요일
                    python_weekdays.append(6)
                else:  # 월요일(1) ~ 토요일(6)
                    python_weekdays.append(wd - 1)
            
            python_weekdays.sort()  # 요일 순서 정렬
            logger.info(f"🔄 [RECURRING] Python 요일들: {python_weekdays}")
            
            # 현재 날짜의 요일
            base_weekday = base_start.weekday()
            logger.info(f"🔄 [RECURRING] 기준 날짜 요일: {base_weekday} ({['월','화','수','목','금','토','일'][base_weekday]})")
            
            current_week_start = base_start - timedelta(days=base_weekday)  # 해당 주의 월요일
            logger.info(f"🔄 [RECURRING] 현재 주 시작(월요일): {current_week_start}")
            
            # 현재 주에서 기준 날짜 이후의 요일들부터 생성
            week_offset = 0
            while current_week_start + timedelta(weeks=week_offset) < end_date:
                week_monday = current_week_start + timedelta(weeks=week_offset)
                
                for python_weekday in python_weekdays:
                    schedule_date = week_monday + timedelta(days=python_weekday)
                    
                    # 첫 번째 주에서는 기준 날짜 이후의 요일만 생성
                    if week_offset == 0 and schedule_date <= base_start:
                        continue
                    
                    if schedule_date >= end_date:
                        break
                    
                    # 시간 정보 유지하면서 날짜만 변경
                    schedule_start = schedule_date.replace(
                        hour=base_start.hour,
                        minute=base_start.minute,
                        second=base_start.second
                    )
                    
                    # 종료시간 계산
                    duration = base_end - base_start
                    schedule_end = schedule_start + duration
                    
                    # 알림시간 계산
                    alarm_time = None
                    if base_params.get("sst_schedule_alarm_chk") == "Y":
                        try:
                            pick_type = base_params.get("sst_pick_type")
                            pick_result = base_params.get("sst_pick_result")
                            
                            if pick_type and pick_result:
                                pick_result_int = int(pick_result)
                                
                                if pick_type == 'minute':
                                    alarm_time = schedule_start - timedelta(minutes=pick_result_int)
                                elif pick_type == 'hour':
                                    alarm_time = schedule_start - timedelta(hours=pick_result_int)
                                elif pick_type == 'day':
                                    alarm_time = schedule_start - timedelta(days=pick_result_int)
                                
                                logger.info(f"🔔 [RECURRING] 반복 일정 알림 시간 계산 - pick_type: {pick_type}, pick_result: {pick_result}, alarm_time: {alarm_time}")
                        except Exception as recalc_error:
                            logger.warning(f"⚠️ [RECURRING] 알림 시간 계산 실패: {recalc_error}")
                            alarm_time = None
                    
                    # 새로운 반복 일정 파라미터 구성
                    recurring_params = base_params.copy()
                    recurring_params.update({
                        "sst_pidx": parent_schedule_id,  # 부모 스케줄 ID
                        "sst_sdate": schedule_start.strftime('%Y-%m-%d %H:%M:%S'),
                        "sst_edate": schedule_end.strftime('%Y-%m-%d %H:%M:%S'),
                        "sst_sedate": f"{schedule_start.strftime('%Y-%m-%d %H:%M:%S')} ~ {schedule_end.strftime('%Y-%m-%d %H:%M:%S')}",
                        "sst_schedule_alarm": alarm_time.strftime('%Y-%m-%d %H:%M:%S') if alarm_time else None
                    })
                    
                    # 반복 일정 삽입
                    insert_query = text("""
                        INSERT INTO smap_schedule_t (
                            sst_pidx, mt_idx, sst_title, sst_sdate, sst_edate, sst_sedate, sst_all_day,
                            sgt_idx, sgdt_idx, sgdt_idx_t,
                            sst_location_title, sst_location_add, sst_location_lat, sst_location_long,
                            sst_location_alarm,
                            sst_memo, sst_supplies,
                            sst_alram, sst_alram_t, sst_schedule_alarm_chk, 
                            sst_pick_type, sst_pick_result, sst_schedule_alarm,
                            sst_repeat_json, sst_repeat_json_v,
                            slt_idx, slt_idx_t, sst_update_chk,
                            sst_show, sst_wdate, sst_adate
                        ) VALUES (
                            :sst_pidx, :mt_idx, :sst_title, :sst_sdate, :sst_edate, :sst_sedate, :sst_all_day,
                            :sgt_idx, :sgdt_idx, :sgdt_idx_t,
                            :sst_location_title, :sst_location_add, :sst_location_lat, :sst_location_long,
                            :sst_location_alarm,
                            :sst_memo, :sst_supplies,
                            :sst_alram, :sst_alram_t, :sst_schedule_alarm_chk,
                            :sst_pick_type, :sst_pick_result, :sst_schedule_alarm,
                            :sst_repeat_json, :sst_repeat_json_v,
                            :slt_idx, :slt_idx_t, :sst_update_chk,
                            'Y', NOW(), :sst_adate
                        )
                    """)
                    
                    db.execute(insert_query, recurring_params)
                    created_count += 1
                    
                    logger.info(f"✅ [RECURRING] 반복 일정 생성: {schedule_start.strftime('%Y-%m-%d (%a)')} - {created_count}번째")
                    
                    # 너무 많은 일정 생성 방지 (최대 500개)
                    if created_count >= 500:
                        logger.warning(f"⚠️ [RECURRING] 최대 생성 개수 제한에 도달: {created_count}")
                        break
                
                if created_count >= 500:
                    break
                    
                week_offset += 1
            
            db.commit()
            logger.info(f"✅ [RECURRING] 매주 다중 요일 반복 일정 생성 완료 - 총 {created_count}개 생성")
            return created_count
        
        # 기존 단일 요일 및 기타 반복 처리
        current_date = base_start
        
        # 반복 주기별 처리
        if r1 == "2":  # 매일
            delta = timedelta(days=1)
        elif r1 == "3":  # 매주 (단일 요일)
            delta = timedelta(weeks=1)
        elif r1 == "4":  # 매월
            # 월간 반복은 특별 처리 필요 (dateutil 사용)
            delta = None
        elif r1 == "5":  # 매년
            delta = timedelta(days=365)
        else:
            logger.warning(f"⚠️ [RECURRING] 지원하지 않는 반복 주기: {r1}")
            return 0
        
        # 반복 일정 생성 (기존 로직)
        while current_date < end_date:
            # 첫 번째 반복 일정은 다음 주기부터 생성
            if r1 == "2":  # 매일
                current_date += timedelta(days=1)
            elif r1 == "3":  # 매주 (단일 요일)
                current_date += timedelta(weeks=1)
                
                # 특정 요일이 지정된 경우 해당 요일로 조정
                if r2 and str(r2).isdigit():
                    target_weekday = int(r2)
                    # r2 값: 1=월요일, 2=화요일, 3=수요일, 4=목요일, 5=금요일, 6=토요일, 7=일요일
                    # Python weekday(): 월요일=0, 화요일=1, 수요일=2, 목요일=3, 금요일=4, 토요일=5, 일요일=6
                    
                    if target_weekday == 7:  # 일요일
                        python_weekday = 6
                    else:  # 월요일(1) ~ 토요일(6)
                        python_weekday = target_weekday - 1
                    
                    # 현재 날짜의 요일과 목표 요일이 다른 경우에만 조정
                    current_weekday = current_date.weekday()
                    if current_weekday != python_weekday:
                        # 다음 주의 해당 요일로 이동
                        days_to_add = (python_weekday - current_weekday) % 7
                        if days_to_add == 0:  # 같은 요일이면 다음 주
                            days_to_add = 7
                        current_date += timedelta(days=days_to_add)
            elif r1 == "4":  # 매월
                # 월 단위 계산을 위해 직접 계산
                try:
                    if current_date.month == 12:
                        current_date = current_date.replace(year=current_date.year + 1, month=1)
                    else:
                        current_date = current_date.replace(month=current_date.month + 1)
                except ValueError:
                    # 2월 29일 등의 경우 처리
                    if current_date.month == 12:
                        current_date = current_date.replace(year=current_date.year + 1, month=1, day=28)
                    else:
                        current_date = current_date.replace(month=current_date.month + 1, day=28)
            elif r1 == "5":  # 매년
                current_date += timedelta(days=365)
            
            if current_date >= end_date:
                break
                
            # 종료시간 계산
            duration = base_end - base_start
            next_end = current_date + duration
            
            # 알림시간 계산
            alarm_time = None
            if base_params.get("sst_schedule_alarm"):
                try:
                    # base_params의 sst_schedule_alarm이 문자열인지 확인
                    base_alarm_str = base_params["sst_schedule_alarm"]
                    if isinstance(base_alarm_str, str):
                        base_alarm = datetime.strptime(base_alarm_str, '%Y-%m-%d %H:%M:%S')
                        alarm_duration = base_start - base_alarm
                        alarm_time = current_date - alarm_duration
                        logger.info(f"🔔 [RECURRING] 반복 일정 알림 시간 계산 - base_alarm: {base_alarm}, alarm_time: {alarm_time}")
                    else:
                        logger.warning(f"⚠️ [RECURRING] base_params의 sst_schedule_alarm이 문자열이 아님: {type(base_alarm_str)}")
                except Exception as alarm_error:
                    logger.warning(f"⚠️ [RECURRING] 알림 시간 계산 실패: {alarm_error}")
                    alarm_time = None
            
            # 알림 시간이 없는 경우 원본 스케줄의 알림 설정을 기반으로 재계산
            if not alarm_time and base_params.get("sst_schedule_alarm_chk") == "Y":
                try:
                    pick_type = base_params.get("sst_pick_type")
                    pick_result = base_params.get("sst_pick_result")
                    
                    if pick_type and pick_result:
                        pick_result_int = int(pick_result)
                        
                        if pick_type == 'minute':
                            alarm_time = current_date - timedelta(minutes=pick_result_int)
                        elif pick_type == 'hour':
                            alarm_time = current_date - timedelta(hours=pick_result_int)
                        elif pick_type == 'day':
                            alarm_time = current_date - timedelta(days=pick_result_int)
                        
                        logger.info(f"🔔 [RECURRING] 반복 일정 알림 시간 재계산 - pick_type: {pick_type}, pick_result: {pick_result}, alarm_time: {alarm_time}")
                except Exception as recalc_error:
                    logger.warning(f"⚠️ [RECURRING] 알림 시간 재계산 실패: {recalc_error}")
                    alarm_time = None
            
            # 새로운 반복 일정 파라미터 구성
            recurring_params = base_params.copy()
            recurring_params.update({
                "sst_pidx": parent_schedule_id,  # 부모 스케줄 ID
                "sst_sdate": current_date.strftime('%Y-%m-%d %H:%M:%S'),  # T 제거
                "sst_edate": next_end.strftime('%Y-%m-%d %H:%M:%S'),  # T 제거
                "sst_sedate": f"{current_date.strftime('%Y-%m-%d %H:%M:%S')} ~ {next_end.strftime('%Y-%m-%d %H:%M:%S')}",  # T 제거
                "sst_schedule_alarm": alarm_time.strftime('%Y-%m-%d %H:%M:%S') if alarm_time else None
            })
            
            # 반복 일정 삽입
            insert_query = text("""
                INSERT INTO smap_schedule_t (
                    sst_pidx, mt_idx, sst_title, sst_sdate, sst_edate, sst_sedate, sst_all_day,
                    sgt_idx, sgdt_idx, sgdt_idx_t,
                    sst_location_title, sst_location_add, sst_location_lat, sst_location_long,
                    sst_location_alarm,
                    sst_memo, sst_supplies,
                    sst_alram, sst_alram_t, sst_schedule_alarm_chk, 
                    sst_pick_type, sst_pick_result, sst_schedule_alarm,
                    sst_repeat_json, sst_repeat_json_v,
                    slt_idx, slt_idx_t, sst_update_chk,
                    sst_show, sst_wdate, sst_adate
                ) VALUES (
                    :sst_pidx, :mt_idx, :sst_title, :sst_sdate, :sst_edate, :sst_sedate, :sst_all_day,
                    :sgt_idx, :sgdt_idx, :sgdt_idx_t,
                    :sst_location_title, :sst_location_add, :sst_location_lat, :sst_location_long,
                    :sst_location_alarm,
                    :sst_memo, :sst_supplies,
                    :sst_alram, :sst_alram_t, :sst_schedule_alarm_chk,
                    :sst_pick_type, :sst_pick_result, :sst_schedule_alarm,
                    :sst_repeat_json, :sst_repeat_json_v,
                    :slt_idx, :slt_idx_t, :sst_update_chk,
                    'Y', NOW(), :sst_adate
                )
            """)
            
            db.execute(insert_query, recurring_params)
            created_count += 1
            
            # 너무 많은 일정 생성 방지 (최대 500개)
            if created_count >= 500:
                logger.warning(f"⚠️ [RECURRING] 최대 생성 개수 제한에 도달: {created_count}")
                break
        
        db.commit()
        logger.info(f"✅ [RECURRING] 반복 일정 생성 완료 - 총 {created_count}개 생성")
        return created_count
        
    except Exception as e:
        logger.error(f"💥 [RECURRING] 반복 일정 생성 오류: {e}")
        db.rollback()
        raise e

@router.get("/test-all-columns")
def test_all_columns(
    current_user_id: int = Query(1186, description="현재 사용자 ID"),
    db: Session = Depends(deps.get_db)
):
    """
    모든 컬럼 테스트용 엔드포인트
    """
    try:
        # 단일 스케줄만 조회하여 모든 컬럼 확인
        schedule_query = text("""
            SELECT sst.* 
            FROM smap_schedule_t sst
            WHERE sst.mt_idx = :current_user_id 
            AND sst.sst_show = 'Y'
            LIMIT 1
        """)
        
        result = db.execute(schedule_query, {"current_user_id": current_user_id}).fetchone()
        
        if not result:
            return {"success": False, "message": "No schedule found"}
        
        # 모든 컬럼을 딕셔너리로 변환
        schedule_data = {
            "sst_idx": result.sst_idx,
            "sst_pidx": result.sst_pidx,
            "mt_idx": result.mt_idx,
            "sst_title": result.sst_title,
            "sst_sdate": str(result.sst_sdate) if result.sst_sdate else None,
            "sst_edate": str(result.sst_edate) if result.sst_edate else None,
            "sst_sedate": result.sst_sedate,
            "sst_all_day": result.sst_all_day,
            "sst_repeat_json": result.sst_repeat_json,
            "sst_repeat_json_v": result.sst_repeat_json_v,
            "sgt_idx": result.sgt_idx,
            "sgdt_idx": result.sgdt_idx,
            "sgdt_idx_t": result.sgdt_idx_t,
            "sst_alram": result.sst_alram,
            "sst_alram_t": result.sst_alram_t,
            "sst_adate": str(result.sst_adate) if result.sst_adate else None,
            "slt_idx": result.slt_idx,
            "slt_idx_t": result.slt_idx_t,
            "sst_location_title": result.sst_location_title,
            "sst_location_add": result.sst_location_add,
            "sst_location_lat": float(result.sst_location_lat) if result.sst_location_lat else None,
            "sst_location_long": float(result.sst_location_long) if result.sst_location_long else None,
            "sst_supplies": result.sst_supplies,
            "sst_memo": result.sst_memo,
            "sst_show": result.sst_show,
            "sst_location_alarm": result.sst_location_alarm,
            "sst_schedule_alarm_chk": result.sst_schedule_alarm_chk,
            "sst_pick_type": result.sst_pick_type,
            "sst_pick_result": result.sst_pick_result,
            "sst_schedule_alarm": str(result.sst_schedule_alarm) if result.sst_schedule_alarm else None,
            "sst_update_chk": result.sst_update_chk,
            "sst_wdate": str(result.sst_wdate) if result.sst_wdate else None,
            "sst_udate": str(result.sst_udate) if result.sst_udate else None,
            "sst_ddate": str(result.sst_ddate) if result.sst_ddate else None,
            "sst_in_chk": result.sst_in_chk,
            "sst_schedule_chk": result.sst_schedule_chk,
            "sst_entry_cnt": result.sst_entry_cnt,
            "sst_exit_cnt": result.sst_exit_cnt,
        }
        
        return {
            "success": True,
            "data": schedule_data,
            "total_columns": len(schedule_data),
            "column_names": list(schedule_data.keys())
        }
        
    except Exception as e:
        logger.error(f"테스트 엔드포인트 오류: {e}")
        return {"success": False, "error": str(e)}

@router.get("/owner-groups/all-schedules")
def get_owner_groups_all_schedules(
    current_user_id: int = Query(..., description="현재 사용자 ID"),
    year: Optional[int] = Query(None, description="조회할 년도 (예: 2024)"),
    month: Optional[int] = Query(None, description="조회할 월 (1-12)"),
    db: Session = Depends(deps.get_db)
):
    """
    현재 사용자가 오너인 그룹들의 모든 멤버 스케줄을 월별로 조회합니다.
    사용자의 최근 위치와 각 스케줄 위치 간의 거리를 계산합니다.
    """
    try:
        # 기본값 설정 (현재 년월)
        from datetime import datetime
        now = datetime.now()
        
        # 요청 파라미터 로깅 및 안전한 복사
        request_year = year
        request_month = month
        print(f"[DEBUG] 원본 파라미터 - year: {request_year}, month: {request_month}")
        
        # 기본값 설정 (원본 파라미터를 변경하지 않고 새 변수 사용)
        final_year = request_year if request_year is not None else now.year
        final_month = request_month if request_month is not None else now.month
        
        print(f"[DEBUG] 처리 후 파라미터 - final_year: {final_year}, final_month: {final_month}")
        
        # 월의 시작일과 마지막일 계산
        if final_month == 12:
            next_year = final_year + 1
            next_month = 1
        else:
            next_year = final_year
            next_month = final_month + 1
            
        start_date = f"{final_year}-{final_month:02d}-01"
        end_date = f"{next_year}-{next_month:02d}-01"
        
        print(f"[DEBUG] 날짜 계산 결과 - start_date: {start_date}, end_date: {end_date}")
        print(f"[DEBUG] next_year: {next_year}, next_month: {next_month}")
        
        # 단계 0: 사용자의 최근 위치 조회
        user_location_query = text("""
            SELECT mlt_lat, mlt_long
            FROM member_location_log_t
            WHERE mt_idx = :current_user_id
            ORDER BY mlt_idx DESC
            LIMIT 1
        """)
        
        user_location = db.execute(user_location_query, {"current_user_id": current_user_id}).fetchone()
        user_lat = None
        user_lng = None
        
        if user_location:
            user_lat = float(user_location.mlt_lat) if user_location.mlt_lat else None
            user_lng = float(user_location.mlt_long) if user_location.mlt_long else None
            print(f"[DEBUG] 사용자 최근 위치: lat={user_lat}, lng={user_lng}")
        else:
            print(f"[DEBUG] 사용자 {current_user_id}의 위치 정보 없음")
        
        # 단계 1: 현재 사용자 그룹 목록 먼저 조회
        owner_groups_query = text("""
            SELECT sg.sgt_idx, sg.sgt_title, sgd.sgdt_idx, sgd.sgdt_owner_chk, sgd.sgdt_leader_chk, sgd.mt_idx
            FROM smap_group_t sg
            JOIN smap_group_detail_t sgd ON sg.sgt_idx = sgd.sgt_idx
            WHERE sgd.mt_idx = :current_user_id 
            AND sg.sgt_show = 'Y'
        """)
        
        owner_groups = db.execute(owner_groups_query, {"current_user_id": current_user_id}).fetchall()
        
        groups = [
            {
                "sgt_idx": group.sgt_idx,
                "sgt_title": group.sgt_title,
                "sgdt_idx": group.sgdt_idx,
                "sgdt_owner_chk": group.sgdt_owner_chk,
                "sgdt_leader_chk": group.sgdt_leader_chk,
                "mt_idx": group.mt_idx
            }
            for group in owner_groups
        ]
        
        # 단계 2: 오너 그룹이 있는 경우에만 스케줄 조회
        schedules = []
        if groups:
            # 그룹 ID 목록 생성
            group_ids = [str(group["sgt_idx"]) for group in groups]
            group_ids_str = ",".join(group_ids)
            
            # 거리 계산 포함 스케줄 조회 쿼리
            distance_calc = ""
            if user_lat is not None and user_lng is not None:
                distance_calc = f"""
                    CASE 
                        WHEN sst.sst_location_lat IS NOT NULL AND sst.sst_location_long IS NOT NULL THEN
                            6371 * acos(
                                cos(radians({user_lat})) * cos(radians(sst.sst_location_lat)) * 
                                cos(radians(sst.sst_location_long) - radians({user_lng})) + 
                                sin(radians({user_lat})) * sin(radians(sst.sst_location_lat))
                            )
                        ELSE NULL
                    END AS sch_calc_dist,
                """
            else:
                distance_calc = "NULL AS sch_calc_dist,"
            
            schedule_query = text(f"""
                SELECT
                    sst.*,
                    {distance_calc}
                    m.mt_name as member_name,
                    m.mt_file1 as member_photo,
                    sg.sgt_title as group_title,
                    sgd_target.mt_idx as tgt_mt_idx,
                    sgd_target.sgdt_owner_chk as tgt_sgdt_owner_chk,
                    sgd_target.sgdt_leader_chk as tgt_sgdt_leader_chk,
                    sgd_target.sgdt_idx as tgt_sgdt_idx
                FROM
                    smap_schedule_t sst
                JOIN member_t m ON sst.mt_idx = m.mt_idx
                JOIN smap_group_t sg ON sst.sgt_idx = sg.sgt_idx
                LEFT JOIN smap_group_detail_t sgd_target ON sst.sgdt_idx = sgd_target.sgdt_idx
                WHERE
                    sst.sgt_idx IN ({group_ids_str})
                    AND sst.sst_show = 'Y'
                    AND sst.sst_sdate >= :start_date
                    AND sst.sst_sdate < :end_date
                ORDER BY
                    sst.sst_sdate
                LIMIT 100
            """)
            
            schedule_results = db.execute(schedule_query, {
                "start_date": start_date,
                "end_date": end_date
            }).fetchall()
            
            # 스케줄 데이터 변환 (모든 컬럼 포함)
            for row in schedule_results:
                schedule_data = {
                    # 모든 smap_schedule_t 컬럼
                    "sst_idx": row.sst_idx,
                    "sst_pidx": row.sst_pidx,
                    "mt_idx": row.mt_idx,
                    "sst_title": row.sst_title,
                    "sst_sdate": str(row.sst_sdate) if row.sst_sdate else None,
                    "sst_edate": str(row.sst_edate) if row.sst_edate else None,
                    "sst_sedate": row.sst_sedate,
                    "sst_all_day": row.sst_all_day,
                    "sst_repeat_json": row.sst_repeat_json,
                    "sst_repeat_json_v": row.sst_repeat_json_v,
                    "sgt_idx": row.sgt_idx,
                    "sgdt_idx": row.sgdt_idx,
                    "sgdt_idx_t": row.sgdt_idx_t,
                    "sst_alram": row.sst_alram,
                    "sst_alram_t": row.sst_alram_t,
                    "sst_adate": row.sst_adate.isoformat() if row.sst_adate and hasattr(row.sst_adate, 'isoformat') else str(row.sst_adate) if row.sst_adate else None,
                    "slt_idx": row.slt_idx,
                    "slt_idx_t": row.slt_idx_t,
                    "sst_location_title": row.sst_location_title,
                    "sst_location_add": row.sst_location_add,
                    "sst_location_lat": float(row.sst_location_lat) if row.sst_location_lat else None,
                    "sst_location_long": float(row.sst_location_long) if row.sst_location_long else None,
                    "sst_supplies": row.sst_supplies,
                    "sst_memo": row.sst_memo,
                    "sst_show": row.sst_show,
                    "sst_location_alarm": row.sst_location_alarm,
                    "sst_schedule_alarm_chk": row.sst_schedule_alarm_chk,
                    "sst_pick_type": row.sst_pick_type,
                    "sst_pick_result": row.sst_pick_result,
                    "sst_schedule_alarm": row.sst_schedule_alarm.isoformat() if row.sst_schedule_alarm and hasattr(row.sst_schedule_alarm, 'isoformat') else str(row.sst_schedule_alarm) if row.sst_schedule_alarm else None,
                    "sst_update_chk": row.sst_update_chk,
                    "sst_wdate": row.sst_wdate.isoformat() if row.sst_wdate and hasattr(row.sst_wdate, 'isoformat') else str(row.sst_wdate) if row.sst_wdate else None,
                    "sst_udate": row.sst_udate.isoformat() if row.sst_udate and hasattr(row.sst_udate, 'isoformat') else str(row.sst_udate) if row.sst_udate else None,
                    "sst_ddate": row.sst_ddate.isoformat() if row.sst_ddate and hasattr(row.sst_ddate, 'isoformat') else str(row.sst_ddate) if row.sst_ddate else None,
                    "sst_in_chk": row.sst_in_chk,
                    "sst_schedule_chk": row.sst_schedule_chk,
                    "sst_entry_cnt": row.sst_entry_cnt,
                    "sst_exit_cnt": row.sst_exit_cnt,
                    # 거리 계산 결과
                    "sch_calc_dist": round(float(row.sch_calc_dist), 2) if row.sch_calc_dist is not None else None,
                    # JOIN된 추가 정보
                    "member_name": row.member_name,
                    "member_photo": row.member_photo,
                    "group_title": row.group_title,
                    # 타겟 멤버 ID 추가 (sgdt_idx로 조회한 mt_idx)
                    "tgt_mt_idx": row.tgt_mt_idx,
                    "tgt_sgdt_owner_chk": row.tgt_sgdt_owner_chk,
                    "tgt_sgdt_leader_chk": row.tgt_sgdt_leader_chk,
                    "tgt_sgdt_idx": row.tgt_sgdt_idx,
                    # 프론트엔드 호환성을 위한 추가 필드
                    "id": str(row.sst_idx),
                    "title": row.sst_title,
                    "date": str(row.sst_sdate) if row.sst_sdate else None,
                    "location": row.sst_location_title,
                    "memberId": str(row.mt_idx)
                }
                schedules.append(schedule_data)
        
        return {
            "success": True,
            "data": {
                "schedules": schedules,
                "ownerGroups": groups,
                "totalSchedules": len(schedules),
                "queryPeriod": {
                    "year": final_year,
                    "month": final_month,
                    "startDate": start_date,
                    "endDate": end_date
                },
                "debugInfo": {
                    "originalYear": request_year,
                    "originalMonth": request_month,
                    "finalYear": final_year,
                    "finalMonth": final_month,
                    "nextYear": next_year,
                    "nextMonth": next_month,
                    "calculatedStartDate": start_date,
                    "calculatedEndDate": end_date
                },
                "userLocation": {
                    "lat": user_lat,
                    "lng": user_lng
                } if user_lat is not None and user_lng is not None else None,
                "userPermission": {
                    "canManage": True,  # 오너이므로 모든 스케줄 관리 가능
                    "isOwner": True,
                    "isLeader": False
                }
            }
        }
        
    except Exception as e:
        logger.error(f"오너 그룹 전체 스케줄 조회 오류: {e}")
        import traceback
        logger.error(f"상세 오류: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/group/{group_id}/schedules")
def get_group_schedules(
    group_id: int,
    start_date: Optional[str] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    days: Optional[int] = Query(None, description="오늘부터 며칠간의 스케줄 조회 (예: 7)"),
    member_id: Optional[int] = Query(None, description="특정 멤버 ID"),
    current_user_id: int = Query(..., description="현재 사용자 ID"),
    db: Session = Depends(deps.get_db)
):
    """
    그룹 스케줄 조회 (권한 기반)
    """
    try:
        logger.info(f"📅 [GET_SCHEDULES] 스케줄 조회 시작 - group_id: {group_id}, days: {days}, start_date: {start_date}, end_date: {end_date}")
        
        # days 파라미터가 있는 경우 자동으로 날짜 범위 계산
        if days is not None and not start_date and not end_date:
            from datetime import datetime, timedelta
            today = datetime.now().date()
            start_date = today.strftime('%Y-%m-%d')
            end_date = (today + timedelta(days=days)).strftime('%Y-%m-%d')
            logger.info(f"📅 [GET_SCHEDULES] days 파라미터로 날짜 범위 계산 - start: {start_date}, end: {end_date}")
        
        # 그룹 권한 확인
        member_auth = GroupScheduleManager.check_group_permission(db, current_user_id, group_id)
        if not member_auth:
            raise HTTPException(status_code=403, detail="Group access denied")
        
        # 그룹 멤버 목록 조회
        group_members = GroupScheduleManager.get_group_members(db, group_id)
        
        # 스케줄 조회 쿼리 구성
        query_params = {"group_id": group_id}
        where_conditions = ["s.sgt_idx = :group_id", "s.sst_show = 'Y'"]
        
        # 날짜 범위 조건 추가
        if start_date:
            where_conditions.append("s.sst_sdate >= :start_date")
            query_params["start_date"] = start_date
            logger.info(f"📅 [GET_SCHEDULES] start_date 조건 추가: {start_date}")
        
        if end_date:
            where_conditions.append("s.sst_sdate < :end_date")  # 종료일은 포함하지 않음
            query_params["end_date"] = end_date
            logger.info(f"📅 [GET_SCHEDULES] end_date 조건 추가: {end_date}")
        
        # 특정 멤버 조건 추가
        if member_id:
            where_conditions.append("s.mt_idx = :member_id")
            query_params["member_id"] = member_id
            logger.info(f"👤 [GET_SCHEDULES] member_id 조건 추가: {member_id}")
        
        logger.info(f"🔍 [GET_SCHEDULES] 쿼리 조건: {where_conditions}")
        logger.info(f"🔍 [GET_SCHEDULES] 쿼리 파라미터: {query_params}")
        
        schedule_query = text(f"""
            SELECT 
                s.*,
                m.mt_name as member_name,
                m.mt_file1 as member_photo
            FROM smap_schedule_t s
            JOIN member_t m ON s.mt_idx = m.mt_idx
            WHERE {' AND '.join(where_conditions)}
            ORDER BY s.sst_sdate ASC
            LIMIT 1000
        """)
        
        schedule_results = db.execute(schedule_query, query_params).fetchall()
        
        logger.info(f"📊 [GET_SCHEDULES] 조회된 스케줄 수: {len(schedule_results)}")
        
        # 스케줄 데이터 변환
        schedules = []
        for row in schedule_results:
            # sst_pidx 디버깅 로그 추가
            logger.info(f"🔍 [GET_SCHEDULES] 스케줄 {row.sst_idx} - sst_pidx: {row.sst_pidx}, repeat_json: {row.sst_repeat_json}")
            
            schedule_data = {
                "sst_idx": row.sst_idx,
                "sst_pidx": row.sst_pidx,
                "mt_idx": row.mt_idx,
                "sst_title": row.sst_title,
                "sst_sdate": str(row.sst_sdate) if row.sst_sdate else None,
                "sst_edate": str(row.sst_edate) if row.sst_edate else None,
                "sst_sedate": row.sst_sedate,
                "sst_all_day": row.sst_all_day,
                "sst_repeat_json": row.sst_repeat_json,
                "sst_repeat_json_v": row.sst_repeat_json_v,
                "sgt_idx": row.sgt_idx,
                "sgdt_idx": row.sgdt_idx,
                "sgdt_idx_t": row.sgdt_idx_t,
                "sst_alram": row.sst_alram,
                "sst_alram_t": row.sst_alram_t,
                "sst_adate": row.sst_adate.isoformat() if row.sst_adate and hasattr(row.sst_adate, 'isoformat') else str(row.sst_adate) if row.sst_adate else None,
                "slt_idx": row.slt_idx,
                "slt_idx_t": row.slt_idx_t,
                "sst_location_title": row.sst_location_title,
                "sst_location_add": row.sst_location_add,
                "sst_location_lat": float(row.sst_location_lat) if row.sst_location_lat else None,
                "sst_location_long": float(row.sst_location_long) if row.sst_location_long else None,
                "sst_supplies": row.sst_supplies,
                "sst_memo": row.sst_memo,
                "sst_show": row.sst_show,
                "sst_location_alarm": row.sst_location_alarm,
                "sst_schedule_alarm_chk": row.sst_schedule_alarm_chk,
                "sst_pick_type": row.sst_pick_type,
                "sst_pick_result": row.sst_pick_result,
                "sst_schedule_alarm": row.sst_schedule_alarm.isoformat() if row.sst_schedule_alarm and hasattr(row.sst_schedule_alarm, 'isoformat') else str(row.sst_schedule_alarm) if row.sst_schedule_alarm else None,
                "sst_update_chk": row.sst_update_chk,
                "sst_wdate": row.sst_wdate.isoformat() if row.sst_wdate and hasattr(row.sst_wdate, 'isoformat') else str(row.sst_wdate) if row.sst_wdate else None,
                "sst_udate": row.sst_udate.isoformat() if row.sst_udate and hasattr(row.sst_udate, 'isoformat') else str(row.sst_udate) if row.sst_udate else None,
                "sst_ddate": row.sst_ddate.isoformat() if row.sst_ddate and hasattr(row.sst_ddate, 'isoformat') else str(row.sst_ddate) if row.sst_ddate else None,
                "sst_in_chk": row.sst_in_chk,
                "sst_schedule_chk": row.sst_schedule_chk,
                "sst_entry_cnt": row.sst_entry_cnt,
                "sst_exit_cnt": row.sst_exit_cnt,
                "member_name": row.member_name,
                "member_photo": row.member_photo,
                # 프론트엔드 호환성을 위한 추가 필드
                "id": str(row.sst_idx),
                "title": row.sst_title,
                "date": str(row.sst_sdate) if row.sst_sdate else None,
                "location": row.sst_location_title,
                "memberId": str(row.mt_idx)
            }
            schedules.append(schedule_data)
        
        return {
            "success": True,
            "data": {
                "schedules": schedules,
                "groupMembers": group_members,
                "userPermission": {
                    "canManage": GroupScheduleManager.has_manage_permission(member_auth),
                    "isOwner": member_auth.get("sgdt_owner_chk") == "Y",
                    "isLeader": member_auth.get("sgdt_leader_chk") == "Y"
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"그룹 스케줄 조회 오류: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/group/{group_id}/schedules")
def create_group_schedule(
    group_id: int,
    schedule_data: Dict[str, Any],
    current_user_id: int = Query(..., description="현재 사용자 ID"),
    db: Session = Depends(deps.get_db)
):
    """
    그룹 스케줄 생성 (향상된 PHP 로직 기반)
    """
    try:
        logger.info(f"🔥 [CREATE_SCHEDULE] 스케줄 생성 시작 - group_id: {group_id}, user_id: {current_user_id}")
        logger.info(f"📝 [CREATE_SCHEDULE] 원본 요청 데이터: {schedule_data}")
        
        # 실제 작업자 정보 추출 (푸시 알림용)
        editor_id = schedule_data.get('editorId')
        editor_name = schedule_data.get('editorName')
        if editor_id and editor_name:
            logger.info(f"👤 [CREATE_SCHEDULE] 실제 작업자 정보 - editorId: {editor_id}, editorName: {editor_name}")
        else:
            # editor_id가 없으면 current_user_id를 사용
            editor_id = current_user_id
            # 에디터 이름 조회
            editor_member = Member.find_by_idx(db, str(editor_id))
            editor_name = editor_member.mt_name if editor_member else "알 수 없음"
            logger.info(f"👤 [CREATE_SCHEDULE] 실제 작업자 정보 없음 - current_user_id: {current_user_id} 사용, editorName: {editor_name}")
        
        # 그룹 권한 확인
        member_auth = GroupScheduleManager.check_group_permission(db, current_user_id, group_id)
        if not member_auth:
            logger.error(f"❌ [CREATE_SCHEDULE] 그룹 권한 없음 - group_id: {group_id}, user_id: {current_user_id}")
            raise HTTPException(status_code=403, detail="Group access denied")
        
        logger.info(f"✅ [CREATE_SCHEDULE] 그룹 권한 확인 완료 - member_auth: {member_auth}")
        
        # 대상 멤버 설정 (기본값: 현재 사용자)
        target_member_id = current_user_id
        
        # 타겟 멤버의 sgdt_idx 조회
        target_sgdt_idx = member_auth["sgdt_idx"]  # 기본값: 현재 사용자의 sgdt_idx
        
        # 다른 멤버의 스케줄을 생성하려는 경우
        if "targetMemberId" in schedule_data and schedule_data["targetMemberId"]:
            target_member_id = int(schedule_data["targetMemberId"])
            
            # 권한 확인: 오너/리더만 다른 멤버의 스케줄 생성 가능
            if not GroupScheduleManager.has_manage_permission(member_auth):
                logger.error(f"❌ [CREATE_SCHEDULE] 다른 멤버 스케줄 생성 권한 없음 - user_id: {current_user_id}")
                raise HTTPException(
                    status_code=403, 
                    detail="Only group owners or leaders can create schedules for other members"
                )
            
            # 타겟 멤버의 sgdt_idx 조회
            target_member_auth = GroupScheduleManager.check_group_permission(db, target_member_id, group_id)
            if target_member_auth:
                target_sgdt_idx = target_member_auth["sgdt_idx"]
                logger.info(f"🆕 [CREATE_NEW_SCHEDULE] 타겟 멤버의 sgdt_idx 조회 완료 - target_sgdt_idx: {target_sgdt_idx}")
            else:
                logger.warning(f"⚠️ [CREATE_NEW_SCHEDULE] 타겟 멤버의 sgdt_idx 조회 실패, 기본값 사용")
        
        logger.info(f"🆕 [CREATE_NEW_SCHEDULE] 사용할 sgdt_idx: {target_sgdt_idx}")
        
        # 필수 필드 검증 및 기본값 설정 (PHP 로직 참고)
        if not schedule_data.get('sst_title', '').strip():
            schedule_data['sst_title'] = '제목 없음'
            logger.warning(f"⚠️ [CREATE_SCHEDULE] 제목이 비어있어 기본값으로 설정")
            
        if not schedule_data.get('sst_sdate'):
            logger.error(f"❌ [CREATE_SCHEDULE] 시작 날짜가 없음")
            raise HTTPException(status_code=400, detail="Start date is required")
            
        if not schedule_data.get('sst_edate'):
            schedule_data['sst_edate'] = schedule_data['sst_sdate']
            logger.info(f"📅 [CREATE_SCHEDULE] 종료 날짜가 없어 시작 날짜로 설정")
        
        logger.info(f"📝 [CREATE_SCHEDULE] 필수 필드 검증 완료 - title: {schedule_data['sst_title']}")
        
        # 시작/종료 날짜/시간 처리 (PHP 로직 참고)
        sst_sdate = schedule_data['sst_sdate']
        sst_edate = schedule_data['sst_edate']
        
        logger.info(f"📅 [CREATE_SCHEDULE] 원본 날짜/시간 - sdate: {sst_sdate}, edate: {sst_edate}")
        
        # T를 공백으로 변경하여 MySQL 형식으로 변환
        if 'T' in sst_sdate:
            sst_sdate = sst_sdate.replace('T', ' ')
            logger.info(f"📅 [CREATE_SCHEDULE] 시작 날짜 형식 변환 - 결과: {sst_sdate}")
            
        if 'T' in sst_edate:
            sst_edate = sst_edate.replace('T', ' ')
            logger.info(f"📅 [CREATE_SCHEDULE] 종료 날짜 형식 변환 - 결과: {sst_edate}")
        
        # 시간이 포함되지 않은 경우 시간 추가
        if ':' not in sst_sdate:
            sst_stime = schedule_data.get('sst_stime', '00:00:00')
            sst_sdate = f"{sst_sdate} {sst_stime}"
            logger.info(f"⏰ [CREATE_SCHEDULE] 시작 시간 추가 - 결과: {sst_sdate}")
            
        if ':' not in sst_edate:
            sst_etime = schedule_data.get('sst_etime', '23:59:59')
            sst_edate = f"{sst_edate} {sst_etime}"
            logger.info(f"⏰ [CREATE_SCHEDULE] 종료 시간 추가 - 결과: {sst_edate}")
        
        # 하루종일 및 반복 설정 처리 (사용자 요구사항에 맞게)
        sst_all_day = schedule_data.get('sst_all_day', 'N')
        sst_repeat_json = schedule_data.get('sst_repeat_json', '')
        sst_repeat_json_v = schedule_data.get('sst_repeat_json_v', '')
        
        logger.info(f"🔄 [CREATE_SCHEDULE] 원본 반복 설정 - all_day: {sst_all_day}, repeat_json: {sst_repeat_json}, repeat_json_v: {sst_repeat_json_v}")
        
        # 하루종일인 경우 반복을 null로 설정
        if sst_all_day == 'Y':
            sst_repeat_json = ''
            sst_repeat_json_v = ''
            logger.info("🔄 [CREATE_SCHEDULE] 하루종일 이벤트: 반복 설정을 null로 변경")
        
        logger.info(f"🔄 [CREATE_SCHEDULE] 최종 반복 설정 - repeat_json: {sst_repeat_json}, repeat_json_v: {sst_repeat_json_v}")
        
        # 알림 시간 계산 (PHP 로직 참고)
        sst_schedule_alarm = None
        logger.info(f"🔔 [CREATE_SCHEDULE] 알림 설정 시작 - alarm_chk: {schedule_data.get('sst_schedule_alarm_chk')}, pick_type: {schedule_data.get('sst_pick_type')}, pick_result: {schedule_data.get('sst_pick_result')}")
        
        if (schedule_data.get('sst_schedule_alarm_chk') == 'Y' and 
            schedule_data.get('sst_pick_type') and 
            schedule_data.get('sst_pick_result')):
            
            try:
                from datetime import datetime, timedelta
                start_datetime = datetime.fromisoformat(sst_sdate.replace('T', ' '))
                pick_result = int(schedule_data['sst_pick_result'])
                pick_type = schedule_data['sst_pick_type']
                
                logger.info(f"🔔 [CREATE_SCHEDULE] 알림 시간 계산 - start_datetime: {start_datetime}, pick_result: {pick_result}, pick_type: {pick_type}")
                
                if pick_type == 'minute':
                    sst_schedule_alarm = start_datetime - timedelta(minutes=pick_result)
                elif pick_type == 'hour':
                    sst_schedule_alarm = start_datetime - timedelta(hours=pick_result)
                elif pick_type == 'day':
                    sst_schedule_alarm = start_datetime - timedelta(days=pick_result)
                
                logger.info(f"🔔 [CREATE_SCHEDULE] 계산된 알림 시간: {sst_schedule_alarm}")
                    
            except (ValueError, TypeError) as e:
                logger.warning(f"⚠️ [CREATE_SCHEDULE] 알림 시간 계산 실패: {e}")
                sst_schedule_alarm = None

        # 스케줄 생성 쿼리 (PHP의 모든 필드 지원)
        logger.info(f"💾 [CREATE_SCHEDULE] 데이터베이스 삽입 시작")
        
        insert_query = text("""
            INSERT INTO smap_schedule_t (
                mt_idx, sst_title, sst_sdate, sst_edate, sst_sedate, sst_all_day,
                sgt_idx, sgdt_idx, sgdt_idx_t,
                sst_location_title, sst_location_add, sst_location_lat, sst_location_long,
                sst_location_alarm,
                sst_memo, sst_supplies,
                sst_alram, sst_alram_t, sst_schedule_alarm_chk, 
                sst_pick_type, sst_pick_result, sst_schedule_alarm,
                sst_repeat_json, sst_repeat_json_v,
                slt_idx, slt_idx_t, sst_update_chk,
                sst_show, sst_wdate, sst_adate
            ) VALUES (
                :mt_idx, :sst_title, :sst_sdate, :sst_edate, :sst_sedate, :sst_all_day,
                :sgt_idx, :sgdt_idx, :sgdt_idx_t,
                :sst_location_title, :sst_location_add, :sst_location_lat, :sst_location_long,
                :sst_location_alarm,
                :sst_memo, :sst_supplies,
                :sst_alram, :sst_alram_t, :sst_schedule_alarm_chk,
                :sst_pick_type, :sst_pick_result, :sst_schedule_alarm,
                :sst_repeat_json, :sst_repeat_json_v,
                :slt_idx, :slt_idx_t, :sst_update_chk,
                'Y', NOW(), :sst_adate
            )
        """)
        
        insert_params = {
            "mt_idx": target_member_id,  # 타겟 멤버 ID로 변경
            "sst_title": schedule_data.get('sst_title'),
            "sst_sdate": sst_sdate,  # 변환된 날짜 형식 사용
            "sst_edate": sst_edate,  # 변환된 날짜 형식 사용
            "sst_sedate": f"{sst_sdate} ~ {sst_edate}",  # 변환된 날짜 형식 사용
            "sst_all_day": schedule_data.get("sst_all_day", "N"),
            "sgt_idx": group_id,
            "sgdt_idx": target_sgdt_idx,  # 타겟 멤버의 sgdt_idx 사용
            "sgdt_idx_t": schedule_data.get("sgdt_idx_t"),
            "sst_location_title": schedule_data.get("sst_location_title"),
            "sst_location_add": schedule_data.get("sst_location_add"),
            "sst_location_lat": schedule_data.get("sst_location_lat"),
            "sst_location_long": schedule_data.get("sst_location_long"),
            "sst_location_alarm": schedule_data.get("sst_location_alarm", "4"),
            "sst_memo": schedule_data.get("sst_memo"),
            "sst_supplies": schedule_data.get("sst_supplies"),
            "sst_alram": schedule_data.get("sst_alram", "N"),
            "sst_alram_t": schedule_data.get("sst_alram_t"),
            "sst_schedule_alarm_chk": schedule_data.get("sst_schedule_alarm_chk", "N"),
            "sst_pick_type": schedule_data.get("sst_pick_type"),
            "sst_pick_result": schedule_data.get("sst_pick_result"),
            "sst_schedule_alarm": sst_schedule_alarm.strftime('%Y-%m-%d %H:%M:%S') if sst_schedule_alarm else None,  # 계산된 알림 시간 사용
            "sst_repeat_json": sst_repeat_json,
            "sst_repeat_json_v": sst_repeat_json_v,
            "slt_idx": schedule_data.get("slt_idx"),
            "slt_idx_t": schedule_data.get("sst_location_add"),
            "sst_update_chk": schedule_data.get("sst_update_chk", "3"),
            "sst_adate": schedule_data.get("sst_adate")
        }
        
        logger.info(f"💾 [CREATE_SCHEDULE] 삽입 파라미터:")
        for key, value in insert_params.items():
            logger.info(f"    {key}: {value}")
        
        result = db.execute(insert_query, insert_params)
        db.commit()
        
        new_schedule_id = result.lastrowid
        logger.info(f"✅ [CREATE_SCHEDULE] 스케줄 생성 성공: schedule_id={new_schedule_id}, user_id={current_user_id}, target_user_id={target_member_id}")
        
        # 반복 일정이 있는 경우 3년간 자동 생성
        if sst_repeat_json and sst_repeat_json.strip() and sst_repeat_json != '':
            try:
                logger.info(f"🔄 [CREATE_SCHEDULE] 반복 일정 생성 시작 - repeat_json: {sst_repeat_json}")
                repeat_schedules_created = create_recurring_schedules(
                    db, new_schedule_id, insert_params, sst_repeat_json, sst_repeat_json_v
                )
                logger.info(f"✅ [CREATE_SCHEDULE] 반복 일정 생성 완료 - 생성된 개수: {repeat_schedules_created}")
            except Exception as e:
                logger.warning(f"⚠️ [CREATE_SCHEDULE] 반복 일정 생성 실패: {e}")
                # 반복 일정 생성 실패해도 메인 일정은 유지
        
        # 푸시 알림 전송 (생성자와 대상자가 다른 경우에만)
        try:
            logger.info(f"🔔 [CREATE_SCHEDULE] 푸시 알림 전송 시작 - editor_id: {editor_id}, editor_name: {editor_name}, target_member_id: {target_member_id}")
            
            GroupScheduleManager.send_schedule_notification(
                db=db,
                action='create',
                schedule_id=new_schedule_id,
                schedule_title=schedule_data.get('sst_title', ''),
                target_member_id=target_member_id,
                editor_id=editor_id,
                editor_name=editor_name
            )
        except Exception as push_error:
            logger.warning(f"⚠️ [CREATE_SCHEDULE] 푸시 알림 전송 실패: {push_error}")
            # 푸시 알림 실패해도 일정 생성은 유지
        
        return {
            "success": True,
            "data": {
                "sst_idx": new_schedule_id,
                "message": "Schedule created successfully",
                "target_member_id": target_member_id,
                "editor_id": editor_id,
                "editor_name": editor_name
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 [CREATE_SCHEDULE] 스케줄 생성 오류: {e}")
        logger.error(f"💥 [CREATE_SCHEDULE] 오류 타입: {type(e).__name__}")
        logger.error(f"💥 [CREATE_SCHEDULE] 오류 상세: {str(e)}")
        import traceback
        logger.error(f"💥 [CREATE_SCHEDULE] 스택 트레이스: {traceback.format_exc()}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.put("/group/{group_id}/schedules/{schedule_id}")
def update_group_schedule_with_repeat_option(
    group_id: int,
    schedule_id: int,
    schedule_data: Dict[str, Any],
    current_user_id: int = Query(..., description="현재 사용자 ID"),
    db: Session = Depends(deps.get_db)
):
    """
    그룹 스케줄 수정 (반복 일정 처리 옵션 지원)
    """
    try:
        logger.info(f"🔥 [UPDATE_REPEAT_SCHEDULE] 반복 일정 수정 시작 - group_id: {group_id}, schedule_id: {schedule_id}, user_id: {current_user_id}")
        logger.info(f"📝 [UPDATE_REPEAT_SCHEDULE] 요청 데이터: {schedule_data}")
        
        # 실제 작업자 정보 추출 (푸시 알림용)
        editor_id = schedule_data.get('editorId')
        editor_name = schedule_data.get('editorName')
        if editor_id and editor_name:
            logger.info(f"👤 [UPDATE_REPEAT_SCHEDULE] 실제 작업자 정보 - editorId: {editor_id}, editorName: {editor_name}")
        else:
            # editor_id가 없으면 current_user_id를 사용
            editor_id = current_user_id
            # 에디터 이름 조회
            editor_member = Member.find_by_idx(db, str(editor_id))
            editor_name = editor_member.mt_name if editor_member else "알 수 없음"
            logger.info(f"👤 [UPDATE_REPEAT_SCHEDULE] 실제 작업자 정보 없음 - current_user_id: {current_user_id} 사용, editorName: {editor_name}")
        
        # 그룹 권한 확인
        member_auth = GroupScheduleManager.check_group_permission(db, current_user_id, group_id)
        if not member_auth:
            logger.error(f"❌ [UPDATE_REPEAT_SCHEDULE] 그룹 권한 없음 - group_id: {group_id}, user_id: {current_user_id}")
            raise HTTPException(status_code=403, detail="Group access denied")
        
        # 기존 스케줄 조회
        schedule_query = text("""
            SELECT * FROM smap_schedule_t 
            WHERE sst_idx = :schedule_id AND sst_show = 'Y'
        """)
        
        schedule_result = db.execute(schedule_query, {"schedule_id": schedule_id}).fetchone()
        
        if not schedule_result:
            logger.error(f"❌ [UPDATE_REPEAT_SCHEDULE] 스케줄을 찾을 수 없음 - schedule_id: {schedule_id}")
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # 권한 확인: 본인 스케줄이거나 오너/리더인 경우만 수정 가능
        can_edit = (
            schedule_result.mt_idx == current_user_id or 
            GroupScheduleManager.has_manage_permission(member_auth)
        )
        
        if not can_edit:
            logger.error(f"❌ [UPDATE_REPEAT_SCHEDULE] 편집 권한 없음 - user_id: {current_user_id}")
            raise HTTPException(
                status_code=403, 
                detail="You can only edit your own schedules or you need owner/leader permission"
            )
        
        # 반복 일정 처리 옵션 확인
        edit_option = schedule_data.get('editOption', 'this')
        logger.info(f"🔄 [UPDATE_REPEAT_SCHEDULE] 편집 옵션: {edit_option}")
        
        # 반복 일정인지 확인
        is_repeat_schedule = (
            schedule_result.sst_repeat_json and 
            schedule_result.sst_repeat_json.strip() and 
            schedule_result.sst_repeat_json != ''
        ) or (
            schedule_result.sst_pidx and 
            schedule_result.sst_pidx > 0
        )
        
        logger.info(f"🔄 [UPDATE_REPEAT_SCHEDULE] 반복 일정 여부: {is_repeat_schedule}")
        logger.info(f"🔄 [UPDATE_REPEAT_SCHEDULE] sst_repeat_json: {schedule_result.sst_repeat_json}")
        logger.info(f"🔄 [UPDATE_REPEAT_SCHEDULE] sst_pidx: {schedule_result.sst_pidx}")
        
        if (is_repeat_schedule or schedule_data.get('sst_repeat_json')) and edit_option != 'this':
            # 반복 일정 처리 - 부모 ID 찾기
            parent_id = schedule_result.sst_pidx if schedule_result.sst_pidx and schedule_result.sst_pidx > 0 else schedule_id
            
            # 반복 설정 변경 여부 확인
            old_repeat_json = schedule_result.sst_repeat_json or ""
            new_repeat_json = schedule_data.get('sst_repeat_json', "")
            
            # 반복 설정 자체가 바뀐 경우 (예: 매주 -> 매일) 삭제 후 재생성 로직 유지
            # 그 외 (제목, 메모 등 내용만 바뀐 경우) 일괄 업데이트 수행
            if old_repeat_json != new_repeat_json and edit_option == 'all':
                logger.info(f"🔄 [UPDATE_REPEAT_SCHEDULE] 반복 패턴 변경 감지 - 삭제 후 재생성 수행")
                # 기존 삭제 로직
                delete_all_query = text("""
                    UPDATE smap_schedule_t 
                    SET sst_show = 'N', sst_udate = NOW()
                    WHERE (sst_pidx = :parent_id OR sst_idx = :parent_id) 
                    AND sst_show = 'Y'
                """)
                db.execute(delete_all_query, {"parent_id": parent_id})
                
                # 새 부모 생성 및 반복 생성
                new_parent_id = create_new_schedule(db, group_id, current_user_id, schedule_data, logger)
                created_count = create_recurring_schedules(db, new_parent_id, schedule_data, new_repeat_json, schedule_data.get('sst_repeat_json_v', ''))
                updated_count = created_count + 1
            else:
                # 내용만 변경된 경우 일괄 업데이트
                logger.info(f"🔄 [UPDATE_REPEAT_SCHEDULE] 반복 일정 일괄 업데이트 수행 - 옵션: {edit_option}")
                
                # 대상 일정 조회
                if edit_option == 'all':
                    target_query = text("""
                        SELECT sst_idx, sst_sdate FROM smap_schedule_t 
                        WHERE (sst_pidx = :parent_id OR sst_idx = :parent_id) 
                        AND sst_show = 'Y'
                    """)
                    target_params = {"parent_id": parent_id}
                else: # future
                    target_query = text("""
                        SELECT sst_idx, sst_sdate FROM smap_schedule_t 
                        WHERE (sst_pidx = :parent_id OR sst_idx = :parent_id) 
                        AND sst_sdate >= :current_start_date
                        AND sst_show = 'Y'
                    """)
                    target_params = {"parent_id": parent_id, "current_start_date": schedule_result.sst_sdate}
                
                targets = db.execute(target_query, target_params).fetchall()
                updated_count = 0
                
                for target in targets:
                    # 개별 일정의 시간 정보를 유지하면서 데이터 업데이트
                    target_data = schedule_data.copy()
                    
                    # 💡 중요: 날짜는 원래 날짜 유지 (시간이 바뀌었다면 시간만 반영)
                    if 'sst_sdate' in schedule_data and schedule_data['sst_sdate']:
                        try:
                            from datetime import datetime
                            new_time = datetime.fromisoformat(schedule_data['sst_sdate'].replace('T', ' '))
                            old_date = target.sst_sdate
                            
                            # old_date가 문자열인 경우 datetime 객체로 변환
                            if isinstance(old_date, str):
                                old_date = datetime.fromisoformat(old_date.replace('T', ' '))
                            
                            # 날짜는 유지, 시간만 교체
                            if hasattr(old_date, 'replace'):
                                target_sdate = old_date.replace(hour=new_time.hour, minute=new_time.minute, second=new_time.second)
                                target_data['sst_sdate'] = target_sdate.strftime('%Y-%m-%d %H:%M:%S')
                                
                                # edate도 sdate와의 차이만큼 유지
                                if 'sst_edate' in schedule_data and schedule_data['sst_edate']:
                                    new_etime = datetime.fromisoformat(schedule_data['sst_edate'].replace('T', ' '))
                                    duration = new_etime - new_time
                                    target_edate = target_sdate + duration
                                    target_data['sst_edate'] = target_edate.strftime('%Y-%m-%d %H:%M:%S')
                        except Exception as e:
                            logger.warning(f"⚠️ [UPDATE_REPEAT_SCHEDULE] 날짜 변환 실패 (idx: {target.sst_idx}): {e}")
                    
                    update_single_schedule(db, target.sst_idx, target_data, logger)
                    updated_count += 1
        else:
            # 일반 스케줄 또는 'this' 옵션
            logger.info(f"🔄 [UPDATE_REPEAT_SCHEDULE] 단일 스케줄 수정")
            update_single_schedule(db, schedule_id, schedule_data, logger)
            updated_count = 1
        
        db.commit()
        
        logger.info(f"✅ [UPDATE_REPEAT_SCHEDULE] 스케줄 수정 완료 - 수정된 개수: {updated_count}")
        
        # 푸시 알림 전송 (수정자와 대상자가 다른 경우에만)
        try:
            # 수정된 스케줄의 대상자 ID 조회
            target_member_id = schedule_result.mt_idx
            
            logger.info(f"🔔 [UPDATE_REPEAT_SCHEDULE] 푸시 알림 전송 시작 - editor_id: {editor_id}, editor_name: {editor_name}, target_member_id: {target_member_id}")
            
            GroupScheduleManager.send_schedule_notification(
                db=db,
                action='update',
                schedule_id=schedule_id,
                schedule_title=schedule_data.get('sst_title', schedule_result.sst_title),
                target_member_id=target_member_id,
                editor_id=editor_id,
                editor_name=editor_name
            )
        except Exception as push_error:
            logger.warning(f"⚠️ [UPDATE_REPEAT_SCHEDULE] 푸시 알림 전송 실패: {push_error}")
            # 푸시 알림 실패해도 일정 수정은 유지
        
        return {
            "success": True,
            "data": {
                "message": f"Successfully updated {updated_count} schedule(s)",
                "updated_count": updated_count,
                "edit_option": edit_option,
                "editor_id": editor_id,
                "editor_name": editor_name
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 [UPDATE_REPEAT_SCHEDULE] 스케줄 수정 오류: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

def update_single_schedule(db: Session, schedule_id: int, schedule_data: Dict[str, Any], logger):
    """
    단일 스케줄 업데이트 헬퍼 함수
    """
    try:
        logger.info(f"📝 [UPDATE_SINGLE] 스케줄 {schedule_id} 업데이트 시작")
        
        # 필수 필드 검증 및 기본값 설정
        if not schedule_data.get('sst_title', '').strip():
            schedule_data['sst_title'] = '제목 없음'
            
        if not schedule_data.get('sst_sdate'):
            logger.error(f"❌ [UPDATE_SINGLE] 시작 날짜가 없음")
            raise ValueError("Start date is required")
            
        if not schedule_data.get('sst_edate'):
            schedule_data['sst_edate'] = schedule_data['sst_sdate']
        
        # 시작/종료 날짜/시간 처리
        sst_sdate = schedule_data['sst_sdate']
        sst_edate = schedule_data['sst_edate']
        
        # T를 공백으로 변경하여 MySQL 형식으로 변환
        if 'T' in sst_sdate:
            sst_sdate = sst_sdate.replace('T', ' ')
            
        if 'T' in sst_edate:
            sst_edate = sst_edate.replace('T', ' ')
        
        # 시간이 포함되지 않은 경우 시간 추가
        if ':' not in sst_sdate:
            sst_stime = schedule_data.get('sst_stime', '00:00:00')
            sst_sdate = f"{sst_sdate} {sst_stime}"
            
        if ':' not in sst_edate:
            sst_etime = schedule_data.get('sst_etime', '23:59:59')
            sst_edate = f"{sst_edate} {sst_etime}"
        
        # 하루종일 및 반복 설정 처리
        sst_all_day = schedule_data.get('sst_all_day', 'N')
        sst_repeat_json = schedule_data.get('sst_repeat_json', '')
        sst_repeat_json_v = schedule_data.get('sst_repeat_json_v', '')
        
        # 하루종일인 경우 반복을 null로 설정
        if sst_all_day == 'Y':
            sst_repeat_json = ''
            sst_repeat_json_v = ''
        
        # 알림 시간 계산
        sst_schedule_alarm = None
        if (schedule_data.get('sst_schedule_alarm_chk') == 'Y' and 
            schedule_data.get('sst_pick_type') and 
            schedule_data.get('sst_pick_result')):
            
            try:
                from datetime import datetime, timedelta
                start_datetime = datetime.fromisoformat(sst_sdate.replace('T', ' '))
                pick_result = int(schedule_data['sst_pick_result'])
                pick_type = schedule_data['sst_pick_type']
                
                if pick_type == 'minute':
                    sst_schedule_alarm = start_datetime - timedelta(minutes=pick_result)
                elif pick_type == 'hour':
                    sst_schedule_alarm = start_datetime - timedelta(hours=pick_result)
                elif pick_type == 'day':
                    sst_schedule_alarm = start_datetime - timedelta(days=pick_result)
                    
            except (ValueError, TypeError) as e:
                logger.warning(f"⚠️ [UPDATE_SINGLE] 알림 시간 계산 실패: {e}")
                sst_schedule_alarm = None

        # 업데이트할 필드 구성
        update_fields = []
        update_params = {"schedule_id": schedule_id}
        
        # 기본 필드들
        basic_fields = {
            "sst_title": schedule_data.get('sst_title'),
            "sst_sdate": sst_sdate,  # 변환된 날짜 형식 사용
            "sst_edate": sst_edate,  # 변환된 날짜 형식 사용
            "sst_sedate": f"{sst_sdate} ~ {sst_edate}",  # 변환된 날짜 형식 사용
            "sst_all_day": schedule_data.get("sst_all_day", "N"),
        }
        
        # 위치 관련 필드들
        location_fields = {
            "sst_location_title": schedule_data.get('sst_location_title'),
            "sst_location_add": schedule_data.get('sst_location_add'),
            "sst_location_lat": schedule_data.get('sst_location_lat'),
            "sst_location_long": schedule_data.get('sst_location_long'),
            "sst_location_alarm": schedule_data.get('sst_location_alarm', 'N'),
        }
        
        # 알림 관련 필드들
        alarm_fields = {
            "sst_alram": schedule_data.get('sst_alram', 'N'),
            "sst_alram_t": schedule_data.get('sst_alram_t'),
            "sst_schedule_alarm_chk": schedule_data.get('sst_schedule_alarm_chk', 'N'),
            "sst_pick_type": schedule_data.get('sst_pick_type'),
            "sst_pick_result": schedule_data.get('sst_pick_result'),
            "sst_schedule_alarm": sst_schedule_alarm.strftime('%Y-%m-%d %H:%M:%S') if sst_schedule_alarm else None,  # 계산된 알림 시간 사용
        }
        
        # 반복 관련 필드들
        repeat_fields = {
            "sst_repeat_json": sst_repeat_json,
            "sst_repeat_json_v": sst_repeat_json_v,
        }
        
        # 기타 필드들
        other_fields = {
            "sst_memo": schedule_data.get('sst_memo'),
            "sst_supplies": schedule_data.get('sst_supplies'),
            "slt_idx": schedule_data.get('slt_idx'),
            "slt_idx_t": schedule_data.get('sst_location_add'),
            "sst_update_chk": schedule_data.get("sst_update_chk", "3"),
            "sst_adate": schedule_data.get("sst_adate")
        }
        
        # 대상 멤버 관련 필드들 (수정 시 대상 그룹원 유지)
        member_fields = {}
        if schedule_data.get('targetMemberId'):
            member_fields["mt_idx"] = schedule_data.get('targetMemberId')
            logger.info(f"📝 [UPDATE_SINGLE] 대상 멤버 ID 업데이트: {schedule_data.get('targetMemberId')}")
        if schedule_data.get('sgdt_idx'):
            member_fields["sgdt_idx"] = schedule_data.get('sgdt_idx')
            logger.info(f"📝 [UPDATE_SINGLE] 그룹 세부 ID 업데이트: {schedule_data.get('sgdt_idx')}")
        
        # 모든 필드 병합
        all_fields = {**basic_fields, **location_fields, **alarm_fields, **repeat_fields, **other_fields, **member_fields}
        
        # None이 아닌 값만 업데이트에 포함
        for field, value in all_fields.items():
            if value is not None:
                update_fields.append(f"{field} = :{field}")
                update_params[field] = value
        
        # 업데이트 시간 추가
        update_fields.append("sst_udate = NOW()")
        
        if update_fields:
            update_query = text(f"""
                UPDATE smap_schedule_t SET {', '.join(update_fields)}
                WHERE sst_idx = :schedule_id
            """)
            
            db.execute(update_query, update_params)
            logger.info(f"✅ [UPDATE_SINGLE] 스케줄 {schedule_id} 업데이트 완료")
        
    except Exception as e:
        logger.error(f"💥 [UPDATE_SINGLE] 스케줄 {schedule_id} 업데이트 실패: {e}")
        raise e

from fastapi import Body

@router.delete("/group/{group_id}/schedules/{schedule_id}")
def delete_group_schedule_with_repeat_option(
    group_id: int,
    schedule_id: int,
    delete_data: Optional[Dict[str, Any]] = Body(None),
    current_user_id: int = Query(..., description="현재 사용자 ID"),
    db: Session = Depends(deps.get_db)
):
    """
    그룹 스케줄 삭제 (반복 일정 처리 옵션 지원)
    """
    try:
        logger.info(f"🗑️ [DELETE_REPEAT_SCHEDULE] 반복 일정 삭제 시작 - group_id: {group_id}, schedule_id: {schedule_id}, user_id: {current_user_id}")
        
        # 실제 작업자 정보 추출 (푸시 알림용)
        editor_id = None
        editor_name = None
        if delete_data:
            editor_id = delete_data.get('editorId')
            editor_name = delete_data.get('editorName')

        if editor_id and editor_name:
            logger.info(f"👤 [DELETE_REPEAT_SCHEDULE] 실제 작업자 정보 - editorId: {editor_id}, editorName: {editor_name}")
        else:
            # editor_id가 없으면 current_user_id를 사용
            editor_id = current_user_id
            # 에디터 이름 조회
            editor_member = Member.find_by_idx(db, str(editor_id))
            editor_name = editor_member.mt_name if editor_member else "알 수 없음"
            logger.info(f"👤 [DELETE_REPEAT_SCHEDULE] 실제 작업자 정보 없음 - current_user_id: {current_user_id} 사용, editorName: {editor_name}")
        
        # 그룹 권한 확인
        member_auth = GroupScheduleManager.check_group_permission(db, current_user_id, group_id)
        if not member_auth:
            logger.error(f"❌ [DELETE_REPEAT_SCHEDULE] 그룹 권한 없음 - group_id: {group_id}, user_id: {current_user_id}")
            raise HTTPException(status_code=403, detail="Group access denied")
        
        # 기존 스케줄 조회
        schedule_query = text("""
            SELECT * FROM smap_schedule_t 
            WHERE sst_idx = :schedule_id AND sst_show = 'Y'
        """)
        
        schedule_result = db.execute(schedule_query, {"schedule_id": schedule_id}).fetchone()
        
        if not schedule_result:
            logger.error(f"❌ [DELETE_REPEAT_SCHEDULE] 스케줄을 찾을 수 없음 - schedule_id: {schedule_id}")
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # 권한 확인: 본인 스케줄이거나 오너/리더인 경우만 삭제 가능
        can_delete = (
            schedule_result.mt_idx == current_user_id or 
            GroupScheduleManager.has_manage_permission(member_auth)
        )
        
        if not can_delete:
            logger.error(f"❌ [DELETE_REPEAT_SCHEDULE] 삭제 권한 없음 - user_id: {current_user_id}")
            raise HTTPException(
                status_code=403, 
                detail="You can only delete your own schedules or you need owner/leader permission"
            )
        
        # 삭제 옵션 확인
        delete_option = 'this'  # 기본값
        if delete_data and 'deleteOption' in delete_data:
            delete_option = delete_data['deleteOption']
        
        logger.info(f"🗑️ [DELETE_REPEAT_SCHEDULE] 삭제 옵션: {delete_option}")
        
        # 반복 일정인지 확인
        is_repeat_schedule = (
            schedule_result.sst_repeat_json and 
            schedule_result.sst_repeat_json.strip() and 
            schedule_result.sst_repeat_json != ''
        ) or (
            schedule_result.sst_pidx and 
            schedule_result.sst_pidx > 0
        )
        
        logger.info(f"🗑️ [DELETE_REPEAT_SCHEDULE] 반복 일정 여부: {is_repeat_schedule}")
        
        deleted_count = 0
        
        if is_repeat_schedule and delete_option != 'this':
            # 반복 일정 처리
            parent_id = schedule_result.sst_pidx if schedule_result.sst_pidx and schedule_result.sst_pidx > 0 else schedule_id
            
            if delete_option == 'all':
                # 모든 반복 일정 삭제
                logger.info(f"🗑️ [DELETE_REPEAT_SCHEDULE] 모든 반복 일정 삭제 시작 (ID: {schedule_id}, Parent: {parent_id})")
                
                delete_all_query = text("""
                    UPDATE smap_schedule_t 
                    SET sst_show = 'N', sst_ddate = NOW() 
                    WHERE (sst_pidx = :parent_id OR sst_idx = :parent_id) 
                    AND sst_show = 'Y'
                """)
                
                result = db.execute(delete_all_query, {"parent_id": parent_id})
                deleted_count = result.rowcount
                
            elif delete_option == 'future':
                # 현재 이후의 반복 일정 삭제
                logger.info(f"🗑️ [DELETE_REPEAT_SCHEDULE] 현재 이후 반복 일정 삭제 시작 (ID: {schedule_id}, Parent: {parent_id})")
                
                # 현재 스케줄의 시작 날짜
                current_start_date = schedule_result.sst_sdate
                
                delete_future_query = text("""
                    UPDATE smap_schedule_t 
                    SET sst_show = 'N', sst_ddate = NOW() 
                    WHERE (sst_pidx = :parent_id OR sst_idx = :parent_id) 
                    AND sst_sdate >= :current_start_date
                    AND sst_show = 'Y'
                """)
                
                result = db.execute(delete_future_query, {
                    "parent_id": parent_id,
                    "current_start_date": current_start_date
                })
                deleted_count = result.rowcount
        else:
            # 일반 스케줄 또는 '이 일정만(this)' 삭제
            logger.info(f"🗑️ [DELETE_REPEAT_SCHEDULE] 단일 일정 삭제 시작 (ID: {schedule_id})")
            delete_single_query = text("""
                UPDATE smap_schedule_t 
                SET sst_show = 'N', sst_ddate = NOW() 
                WHERE sst_idx = :schedule_id
            """)
            
            result = db.execute(delete_single_query, {"schedule_id": schedule_id})
            deleted_count = result.rowcount
        
        db.commit()
        
        logger.info(f"✅ [DELETE_REPEAT_SCHEDULE] 스케줄 삭제 완료 - 삭제된 개수: {deleted_count}")
        
        # 푸시 알림 전송 (삭제자와 대상자가 다른 경우에만)
        try:
            # 삭제된 스케줄의 대상자 ID 조회
            target_member_id = schedule_result.mt_idx
            
            GroupScheduleManager.send_schedule_notification(
                db=db,
                action='delete',
                schedule_id=schedule_id,
                schedule_title=schedule_result.sst_title,
                target_member_id=target_member_id,
                editor_id=editor_id,
                editor_name=editor_name
            )
        except Exception as push_error:
            logger.warning(f"⚠️ [DELETE_REPEAT_SCHEDULE] 푸시 알림 전송 실패: {push_error}")
            # 푸시 알림 실패해도 일정 삭제는 유지
        
        return {
            "success": True,
            "data": {
                "message": f"Successfully deleted {deleted_count} schedule(s)",
                "deleted_count": deleted_count,
                "delete_option": delete_option,
                "editor_id": editor_id,
                "editor_name": editor_name
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 [DELETE_REPEAT_SCHEDULE] 스케줄 삭제 오류: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error") 

def create_new_schedule(db: Session, group_id: int, current_user_id: int, schedule_data: Dict[str, Any], logger) -> int:
    """
    새로운 스케줄 생성 헬퍼 함수
    
    Args:
        db: 데이터베이스 세션
        group_id: 그룹 ID
        current_user_id: 현재 사용자 ID
        schedule_data: 스케줄 데이터
        logger: 로거
    
    Returns:
        생성된 스케줄 ID
    """
    try:
        logger.info(f"🆕 [CREATE_NEW_SCHEDULE] 새 스케줄 생성 시작")
        
        # 그룹 권한 확인
        member_auth = GroupScheduleManager.check_group_permission(db, current_user_id, group_id)
        if not member_auth:
            raise ValueError(f"Group access denied for user {current_user_id} in group {group_id}")
        
        # 대상 멤버 설정 (기본값: 현재 사용자)
        target_member_id = current_user_id
        
        # 타겟 멤버의 sgdt_idx 조회
        target_sgdt_idx = member_auth["sgdt_idx"]  # 기본값: 현재 사용자의 sgdt_idx
        
        # 다른 멤버의 스케줄을 생성하려는 경우
        if "targetMemberId" in schedule_data and schedule_data["targetMemberId"]:
            target_member_id = int(schedule_data["targetMemberId"])
            
            # 권한 확인: 오너/리더만 다른 멤버의 스케줄 생성 가능
            if not GroupScheduleManager.has_manage_permission(member_auth):
                raise ValueError("Only group owners or leaders can create schedules for other members")
            
            # 타겟 멤버의 sgdt_idx 조회
            target_member_auth = GroupScheduleManager.check_group_permission(db, target_member_id, group_id)
            if target_member_auth:
                target_sgdt_idx = target_member_auth["sgdt_idx"]
                logger.info(f"🆕 [CREATE_NEW_SCHEDULE] 타겟 멤버의 sgdt_idx 조회 완료 - target_sgdt_idx: {target_sgdt_idx}")
            else:
                logger.warning(f"⚠️ [CREATE_NEW_SCHEDULE] 타겟 멤버의 sgdt_idx 조회 실패, 기본값 사용")
        
        logger.info(f"🆕 [CREATE_NEW_SCHEDULE] 사용할 sgdt_idx: {target_sgdt_idx}")
        
        # 필수 필드 검증 및 기본값 설정 (PHP 로직 참고)
        if not schedule_data.get('sst_title', '').strip():
            schedule_data['sst_title'] = '제목 없음'
            logger.warning(f"⚠️ [CREATE_SCHEDULE] 제목이 비어있어 기본값으로 설정")
            
        if not schedule_data.get('sst_sdate'):
            logger.error(f"❌ [CREATE_SCHEDULE] 시작 날짜가 없음")
            raise HTTPException(status_code=400, detail="Start date is required")
            
        if not schedule_data.get('sst_edate'):
            schedule_data['sst_edate'] = schedule_data['sst_sdate']
            logger.info(f"📅 [CREATE_SCHEDULE] 종료 날짜가 없어 시작 날짜로 설정")
        
        logger.info(f"📝 [CREATE_SCHEDULE] 필수 필드 검증 완료 - title: {schedule_data['sst_title']}")
        
        # 시작/종료 날짜/시간 처리 (PHP 로직 참고)
        sst_sdate = schedule_data['sst_sdate']
        sst_edate = schedule_data['sst_edate']
        
        logger.info(f"📅 [CREATE_SCHEDULE] 원본 날짜/시간 - sdate: {sst_sdate}, edate: {sst_edate}")
        
        # T를 공백으로 변경하여 MySQL 형식으로 변환
        if 'T' in sst_sdate:
            sst_sdate = sst_sdate.replace('T', ' ')
            logger.info(f"📅 [CREATE_SCHEDULE] 시작 날짜 형식 변환 - 결과: {sst_sdate}")
            
        if 'T' in sst_edate:
            sst_edate = sst_edate.replace('T', ' ')
            logger.info(f"📅 [CREATE_SCHEDULE] 종료 날짜 형식 변환 - 결과: {sst_edate}")
        
        # 시간이 포함되지 않은 경우 시간 추가
        if ':' not in sst_sdate:
            sst_stime = schedule_data.get('sst_stime', '00:00:00')
            sst_sdate = f"{sst_sdate} {sst_stime}"
            logger.info(f"⏰ [CREATE_SCHEDULE] 시작 시간 추가 - 결과: {sst_sdate}")
            
        if ':' not in sst_edate:
            sst_etime = schedule_data.get('sst_etime', '23:59:59')
            sst_edate = f"{sst_edate} {sst_etime}"
            logger.info(f"⏰ [CREATE_SCHEDULE] 종료 시간 추가 - 결과: {sst_edate}")
        
        # 하루종일 및 반복 설정 처리 (사용자 요구사항에 맞게)
        sst_all_day = schedule_data.get('sst_all_day', 'N')
        sst_repeat_json = schedule_data.get('sst_repeat_json', '')
        sst_repeat_json_v = schedule_data.get('sst_repeat_json_v', '')
        
        logger.info(f"🔄 [CREATE_SCHEDULE] 원본 반복 설정 - all_day: {sst_all_day}, repeat_json: {sst_repeat_json}, repeat_json_v: {sst_repeat_json_v}")
        
        # 하루종일인 경우 반복을 null로 설정
        if sst_all_day == 'Y':
            sst_repeat_json = ''
            sst_repeat_json_v = ''
            logger.info("🔄 [CREATE_SCHEDULE] 하루종일 이벤트: 반복 설정을 null로 변경")
        
        logger.info(f"🔄 [CREATE_SCHEDULE] 최종 반복 설정 - repeat_json: {sst_repeat_json}, repeat_json_v: {sst_repeat_json_v}")
        
        # 알림 시간 계산 (PHP 로직 참고)
        sst_schedule_alarm = None
        logger.info(f"🔔 [CREATE_SCHEDULE] 알림 설정 시작 - alarm_chk: {schedule_data.get('sst_schedule_alarm_chk')}, pick_type: {schedule_data.get('sst_pick_type')}, pick_result: {schedule_data.get('sst_pick_result')}")
        
        if (schedule_data.get('sst_schedule_alarm_chk') == 'Y' and 
            schedule_data.get('sst_pick_type') and 
            schedule_data.get('sst_pick_result')):
            
            try:
                from datetime import datetime, timedelta
                start_datetime = datetime.fromisoformat(sst_sdate.replace('T', ' '))
                pick_result = int(schedule_data['sst_pick_result'])
                pick_type = schedule_data['sst_pick_type']
                
                logger.info(f"🔔 [CREATE_SCHEDULE] 알림 시간 계산 - start_datetime: {start_datetime}, pick_result: {pick_result}, pick_type: {pick_type}")
                
                if pick_type == 'minute':
                    sst_schedule_alarm = start_datetime - timedelta(minutes=pick_result)
                elif pick_type == 'hour':
                    sst_schedule_alarm = start_datetime - timedelta(hours=pick_result)
                elif pick_type == 'day':
                    sst_schedule_alarm = start_datetime - timedelta(days=pick_result)
                
                logger.info(f"🔔 [CREATE_SCHEDULE] 계산된 알림 시간: {sst_schedule_alarm}")
                    
            except (ValueError, TypeError) as e:
                logger.warning(f"⚠️ [CREATE_SCHEDULE] 알림 시간 계산 실패: {e}")
                sst_schedule_alarm = None

        # 스케줄 생성 쿼리
        insert_query = text("""
            INSERT INTO smap_schedule_t (
                mt_idx, sst_title, sst_sdate, sst_edate, sst_sedate, sst_all_day,
                sgt_idx, sgdt_idx, sgdt_idx_t,
                sst_location_title, sst_location_add, sst_location_lat, sst_location_long,
                sst_location_alarm,
                sst_memo, sst_supplies,
                sst_alram, sst_alram_t, sst_schedule_alarm_chk, 
                sst_pick_type, sst_pick_result, sst_schedule_alarm,
                sst_repeat_json, sst_repeat_json_v,
                slt_idx, slt_idx_t, sst_update_chk,
                sst_pidx, sst_show, sst_wdate, sst_adate
            ) VALUES (
                :mt_idx, :sst_title, :sst_sdate, :sst_edate, :sst_sedate, :sst_all_day,
                :sgt_idx, :sgdt_idx, :sgdt_idx_t,
                :sst_location_title, :sst_location_add, :sst_location_lat, :sst_location_long,
                :sst_location_alarm,
                :sst_memo, :sst_supplies,
                :sst_alram, :sst_alram_t, :sst_schedule_alarm_chk,
                :sst_pick_type, :sst_pick_result, :sst_schedule_alarm,
                :sst_repeat_json, :sst_repeat_json_v,
                :slt_idx, :slt_idx_t, :sst_update_chk,
                :sst_pidx, 'Y', NOW(), :sst_adate
            )
        """)
        
        insert_params = {
            "mt_idx": target_member_id,  # 타겟 멤버 ID 사용
            "sst_title": schedule_data.get('sst_title'),
            "sst_sdate": sst_sdate,  # 변환된 날짜 형식 사용
            "sst_edate": sst_edate,  # 변환된 날짜 형식 사용
            "sst_sedate": f"{sst_sdate} ~ {sst_edate}",  # 변환된 날짜 형식 사용
            "sst_all_day": schedule_data.get("sst_all_day", "N"),
            "sgt_idx": group_id,
            "sgdt_idx": target_sgdt_idx,  # 타겟 멤버의 sgdt_idx 사용
            "sgdt_idx_t": schedule_data.get("sgdt_idx_t"),
            "sst_location_title": schedule_data.get("sst_location_title"),
            "sst_location_add": schedule_data.get("sst_location_add"),
            "sst_location_lat": schedule_data.get("sst_location_lat"),
            "sst_location_long": schedule_data.get("sst_location_long"),
            "sst_location_alarm": schedule_data.get("sst_location_alarm", "4"),
            "sst_memo": schedule_data.get("sst_memo"),
            "sst_supplies": schedule_data.get("sst_supplies"),
            "sst_alram": schedule_data.get("sst_alram", "N"),
            "sst_alram_t": schedule_data.get("sst_alram_t"),
            "sst_schedule_alarm_chk": schedule_data.get("sst_schedule_alarm_chk", "N"),
            "sst_pick_type": schedule_data.get("sst_pick_type"),
            "sst_pick_result": schedule_data.get("sst_pick_result"),
            "sst_schedule_alarm": sst_schedule_alarm.strftime('%Y-%m-%d %H:%M:%S') if sst_schedule_alarm else None,  # 계산된 알림 시간 사용
            "sst_repeat_json": sst_repeat_json,
            "sst_repeat_json_v": sst_repeat_json_v,
            "slt_idx": schedule_data.get("slt_idx"),
            "slt_idx_t": schedule_data.get("sst_location_add"),
            "sst_update_chk": schedule_data.get("sst_update_chk", "3"),
            "sst_pidx": schedule_data.get("sst_pidx"),
            "sst_adate": schedule_data.get("sst_adate")
        }
        
        result = db.execute(insert_query, insert_params)
        new_schedule_id = result.lastrowid
        
        logger.info(f"✅ [CREATE_NEW_SCHEDULE] 스케줄 생성 성공: schedule_id={new_schedule_id}")
        
        return new_schedule_id
        
    except Exception as e:
        logger.error(f"💥 [CREATE_NEW_SCHEDULE] 스케줄 생성 오류: {e}")
        raise

@router.get("/debug/schedule/{schedule_id}")
def debug_schedule_info(
    schedule_id: int,
    current_user_id: int = Query(1186, description="현재 사용자 ID"),
    db: Session = Depends(deps.get_db)
):
    """
    특정 스케줄의 상세 정보 디버깅용 엔드포인트
    """
    try:
        # 스케줄 정보 조회
        schedule_query = text("""
            SELECT * FROM smap_schedule_t 
            WHERE sst_idx = :schedule_id
        """)
        
        result = db.execute(schedule_query, {"schedule_id": schedule_id}).fetchone()
        
        if not result:
            return {"success": False, "message": "Schedule not found"}
        
        # 관련 반복 일정들도 조회
        related_query = text("""
            SELECT sst_idx, sst_pidx, sst_title, sst_sdate, sst_repeat_json
            FROM smap_schedule_t 
            WHERE (sst_pidx = :schedule_id OR sst_idx = :schedule_id OR 
                   (sst_pidx = :parent_id AND :parent_id IS NOT NULL))
            AND sst_show = 'Y'
            ORDER BY sst_sdate
        """)
        
        parent_id = result.sst_pidx if result.sst_pidx else schedule_id
        related_results = db.execute(related_query, {
            "schedule_id": schedule_id,
            "parent_id": parent_id
        }).fetchall()
        
        # 스케줄 데이터 변환
        schedule_data = {
            "sst_idx": result.sst_idx,
            "sst_pidx": result.sst_pidx,
            "mt_idx": result.mt_idx,
            "sst_title": result.sst_title,
            "sst_sdate": str(result.sst_sdate) if result.sst_sdate else None,
            "sst_edate": str(result.sst_edate) if result.sst_edate else None,
            "sst_repeat_json": result.sst_repeat_json,
            "sst_repeat_json_v": result.sst_repeat_json_v,
            "sst_show": result.sst_show,
            "sst_wdate": str(result.sst_wdate) if result.sst_wdate else None,
        }
        
        # 관련 스케줄들
        related_schedules = []
        for row in related_results:
            related_schedules.append({
                "sst_idx": row.sst_idx,
                "sst_pidx": row.sst_pidx,
                "sst_title": row.sst_title,
                "sst_sdate": str(row.sst_sdate) if row.sst_sdate else None,
                "sst_repeat_json": row.sst_repeat_json,
            })
        
        return {
            "success": True,
            "data": {
                "target_schedule": schedule_data,
                "related_schedules": related_schedules,
                "total_related": len(related_schedules),
                "parent_id": parent_id
            }
        }
        
    except Exception as e:
        logger.error(f"디버깅 엔드포인트 오류: {e}")
        return {"success": False, "error": str(e)}