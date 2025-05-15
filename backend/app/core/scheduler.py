from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from datetime import datetime, timedelta
import logging
from typing import Dict, List
import random
from apscheduler.triggers.interval import IntervalTrigger
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

class BackgroundTasks:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.scheduler.add_job(
            self._run_background_task,
            trigger=IntervalTrigger(seconds=60),
            id='background_task',
            replace_existing=True
        )

    def start(self):
        self.scheduler.start()

    def shutdown(self):
        self.scheduler.shutdown()

    def _run_background_task(self):
        db = SessionLocal()
        try:
            # 여기에 백그라운드 작업 로직 추가
            logger.info("Background task running...")
        except Exception as e:
            logger.error(f"Error in background task: {e}")
        finally:
            db.close()

    def _schedule_all_jobs(self):
        """모든 백그라운드 작업을 스케줄링합니다."""
        # 30초마다 실행되는 작업들
        self.scheduler.add_job(
            self.location_entry_alert_schedule,
            'interval',
            seconds=30,
            id='location_entry_alert_schedule'
        )
        self.scheduler.add_job(
            self.location_exit_alert_schedule,
            'interval',
            seconds=30,
            id='location_exit_alert_schedule'
        )
        self.scheduler.add_job(
            self.my_location_entry_alert_schedule,
            'interval',
            seconds=30,
            id='my_location_entry_alert_schedule'
        )
        self.scheduler.add_job(
            self.my_location_exit_alert_schedule,
            'interval',
            seconds=30,
            id='my_location_exit_alert_schedule'
        )
        self.scheduler.add_job(
            self.sync_member_locations_recently,
            'interval',
            seconds=30,
            id='sync_member_locations_recently'
        )

        # 1분마다 실행되는 작업들
        self.scheduler.add_job(
            self.schedule_notification,
            'interval',
            minutes=1,
            id='schedule_notification'
        )

        # 5분마다 실행되는 작업들
        self.scheduler.add_job(
            self.schedule_movement_alert,
            'cron',
            minute='*/5',
            id='schedule_movement_alert'
        )

        # 20분마다 실행되는 작업들 (8AM-7PM)
        self.scheduler.add_job(
            self.update_user_locations_every_20_minutes,
            'cron',
            minute='*/20',
            hour='8-19',
            id='update_user_locations_every_20_minutes'
        )

        # 매시간 실행되는 작업들
        self.scheduler.add_job(
            self.send_reserved_push_notifications,
            'cron',
            hour='*/1',
            id='send_reserved_push_notifications'
        )

        # 매일 특정 시간에 실행되는 작업들
        self.scheduler.add_job(
            self.force_update_internal_locations_midnight,
            'cron',
            hour='0',
            minute='0',
            id='force_update_internal_locations_midnight'
        )
        self.scheduler.add_job(
            self.send_daily_log_notifications,
            'cron',
            hour='18',
            minute='00',
            id='send_daily_log_notifications'
        )
        self.scheduler.add_job(
            self.send_my_location_push_notifications,
            'cron', 
            hour='14',
            minute='00',
            id='send_my_location_push_notifications'
        )
        self.scheduler.add_job(
            self.trigger_app_execution_at_7_30pm,
            'cron',
            hour='19',
            minute='30',
            id='trigger_app_execution_at_7_30pm'
        )
        self.scheduler.add_job(
            self.notify_low_battery_at_9pm,
            'cron',
            hour='21',
            minute='00',
            id='notify_low_battery_at_9pm'
        )

        # 평일/주말 날씨 알림
        self.scheduler.add_job(
            self.send_daily_weather_notifications,
            'cron',
            day_of_week='mon-fri',
            hour=8,
            minute=10,
            id='send_daily_weather_notifications_weekdays'
        )
        self.scheduler.add_job(
            self.send_daily_weather_notifications,
            'cron',
            day_of_week='sat,sun',
            hour=9,
            minute=0,
            id='send_daily_weather_notifications_weekends'
        )

    # 여기에 각각의 작업 메서드들을 구현
    def location_entry_alert_schedule(self):
        """일정 장소 진입 알림"""
        from app.models.schedule import Schedule
        from app.models.member import Member
        from app.models.group_detail import GroupDetail
        from app.models.member_location_log import MemberLocationLog
        from app.services.push_service import send_push, push_log_add
        from app.core.utils import kmTom
        
        try:
            plt_condition = "30초 - 장소알림"
            plt_memo = "일정에 입력한 장소의 100미터 반경에 들어왔을때"
            
            # 일정이 있는 100M 진입 전인 스케쥴 리스트
            schedules = Schedule.get_now_schedule_in_members(self.db)
            
            for schedule in schedules:
                mt_idx = None
                sst_idx = schedule.sst_idx

                if schedule.sgt_idx is not None and schedule.sgdt_idx != 0:
                    sgt_idx = str(schedule.sgt_idx)
                    
                    # 그룹에서 해당 회원의 mt_idx 가져오기
                    group_member = GroupDetail.get_one_member(self.db, str(schedule.sgdt_idx))
                    if group_member:
                        mt_idx = str(group_member.mt_idx)

                if mt_idx and int(schedule.mt_idx) != int(mt_idx):
                    # 해당 회원의 마지막 위치값과 장소의 위치값 비교
                    member_location = MemberLocationLog.getDistance(
                        self.db,
                        str(schedule.sst_location_lat),
                        str(schedule.sst_location_long),
                        mt_idx
                    )

                    if member_location:
                        distance = kmTom(member_location.distance)
                        formatted_distance = "{:,.1f}".format(distance)
                        push_json = {
                            "lat": "{:.7f}".format(float(schedule.sst_location_lat)),
                            "lng": "{:.7f}".format(float(schedule.sst_location_long)),
                            "distance": formatted_distance
                        }

                        if distance <= 100.0 and int(schedule.sst_entry_cnt) == 0:
                            group_data = self._get_group_member_data(sgt_idx, mt_idx)
                            
                            # 푸시 알림 메시지 생성 및 전송
                            self._send_entry_notifications(
                                group_data,
                                schedule,
                                plt_condition,
                                plt_memo,
                                push_json
                            )

                            # 진입 상태 업데이트
                            self._update_entry_status(schedule.sst_idx)

            logger.info("Location entry alert executed successfully")
            
        except Exception as e:
            logger.error(f"Error in location entry alert: {e}")

    def _get_group_member_data(self, sgt_idx: str, mt_idx: str) -> Dict:
        """그룹 멤버 데이터를 가져옵니다."""
        from app.models.group_detail import GroupDetail
        from app.models.member import Member
        
        try:
            group_data = {
                "owner": {},
                "leader": {},
                "member": {}
            }
            
            # 그룹 소유자 정보
            owner = GroupDetail.find_owner(self.db, sgt_idx)
            if owner:
                group_data["owner"] = owner
            
            # 그룹 리더 정보
            leader = GroupDetail.find_leader(self.db, sgt_idx)
            if leader:
                group_data["leader"] = leader
            
            # 멤버 정보
            member = Member.find_by_idx(self.db, mt_idx)
            if member:
                group_data["member"] = {
                    "mt_idx": member.mt_idx,
                    "mt_name": member.mt_nickname or member.mt_name,
                    "mt_lang": member.mt_lang,
                    "mt_token_id": member.mt_token_id
                }
            
            return group_data
            
        except Exception as e:
            logger.error(f"Error getting group member data: {e}")
            return {"owner": {}, "leader": {}, "member": {}}

    def _send_entry_notifications(
        self,
        group_data: Dict,
        schedule: 'Schedule',
        plt_condition: str,
        plt_memo: str,
        push_json: Dict
    ) -> None:
        """진입 알림을 전송합니다."""
        from app.services.push_service import send_push, push_log_add
        
        try:
            messages = {
                "ko": {
                    "title": "일정장소 도착알림 📍",
                    "content": "{name_prefix}님이 '{title}' 장소에 도착했어요! 🎉"
                },
                "en": {
                    "title": "Arrival at scheduled location 📍",
                    "content": "{name_prefix} has arrived at '{title}'! 🎉"
                },
                # 다른 언어 메시지 추가...
            }

            # 소유자에게 알림
            if group_data["owner"] and group_data["owner"]["mt_idx"] != group_data["member"]["mt_idx"]:
                lang = group_data["owner"]["mt_lang"]
                push_title = messages[lang]["title"]
                push_content = messages[lang]["content"].format(
                    name_prefix=group_data["member"]["mt_name"],
                    title=schedule.sst_title
                )
                
                push_result = send_push(
                    group_data["owner"]["mt_token_id"],
                    push_title,
                    push_content
                )
                
                push_log_add(
                    self.db,
                    group_data["owner"]["mt_idx"],
                    schedule.sst_idx,
                    plt_condition,
                    plt_memo,
                    push_title,
                    push_content,
                    push_result,
                    push_json
                )

            # 리더에게 알림
            if group_data["leader"] and group_data["leader"]["mt_idx"] != group_data["member"]["mt_idx"]:
                lang = group_data["leader"]["mt_lang"]
                push_title = messages[lang]["title"]
                push_content = messages[lang]["content"].format(
                    name_prefix=group_data["member"]["mt_name"],
                    title=schedule.sst_title
                )
                
                push_result = send_push(
                    group_data["leader"]["mt_token_id"],
                    push_title,
                    push_content
                )
                
                push_log_add(
                    self.db,
                    group_data["leader"]["mt_idx"],
                    schedule.sst_idx,
                    plt_condition,
                    plt_memo,
                    push_title,
                    push_content,
                    push_result,
                    push_json
                )

        except Exception as e:
            logger.error(f"Error sending entry notifications: {e}")

    def _update_entry_status(self, sst_idx: int) -> None:
        """진입 상태를 업데이트합니다."""
        from app.models.schedule import Schedule
        
        try:
            schedule = Schedule.find_by_idx(self.db, sst_idx)
            if schedule:
                schedule.sst_in_chk = "Y"
                schedule.sst_entry_cnt = (schedule.sst_entry_cnt or 0) + 1
                self.db.commit()
                
        except Exception as e:
            logger.error(f"Error updating entry status: {e}")
            self.db.rollback()

    def location_exit_alert_schedule(self):
        """일정 장소 이탈 알림"""
        from app.models.schedule import Schedule
        from app.models.member import Member
        from app.models.group_detail import GroupDetail
        from app.models.member_location_log import MemberLocationLog
        from app.services.push_service import send_push, push_log_add
        from app.core.utils import kmTom

        try:
            plt_condition = "30초 - 장소알림"
            plt_memo = "일정에 입력한 장소의 100미터 반경에서 이탈했을때"

            # 일정이 있는 100M 진입 후인 스케쥴 리스트
            schedules = Schedule.get_now_schedule_out_members(self.db)

            for schedule in schedules:
                mt_idx = None
                sst_idx = schedule.sst_idx

                if schedule.sgt_idx is not None and schedule.sgdt_idx != 0:
                    sgt_idx = str(schedule.sgt_idx)

                    # 그룹에서 해당 회원의 mt_idx 가져오기
                    group_member = GroupDetail.get_one_member(self.db, str(schedule.sgdt_idx))
                    if group_member:
                        mt_idx = str(group_member.mt_idx)

                if mt_idx and int(schedule.mt_idx) != int(mt_idx):
                    # 해당 회원의 마지막 위치값과 장소의 위치값 비교
                    member_location = MemberLocationLog.getDistance(
                        self.db,
                        str(schedule.sst_location_lat),
                        str(schedule.sst_location_long),
                        mt_idx
                    )

                    if member_location:
                        distance = kmTom(member_location.distance)
                        formatted_distance = "{:,.1f}".format(distance)
                        push_json = {
                            "lat": "{:.7f}".format(float(schedule.sst_location_lat)),
                            "lng": "{:.7f}".format(float(schedule.sst_location_long)),
                            "distance": formatted_distance
                        }

                        if distance >= 100.0 and int(schedule.sst_exit_cnt) == 0:
                            group_data = self._get_group_member_data(sgt_idx, mt_idx)
                            
                            # 푸시 알림 메시지 생성 및 전송
                            self._send_exit_notifications(
                                group_data,
                                schedule,
                                plt_condition,
                                plt_memo,
                                push_json
                            )

                            # 이탈 상태 업데이트
                            self._update_exit_status(schedule.sst_idx)

            logger.info("Location exit alert executed successfully")

        except Exception as e:
            logger.error(f"Error in location exit alert: {e}")

    def _send_exit_notifications(
        self,
        group_data: Dict,
        schedule: 'Schedule',
        plt_condition: str,
        plt_memo: str,
        push_json: Dict
    ) -> None:
        """이탈 알림을 전송합니다."""
        from app.services.push_service import send_push, push_log_add
        
        try:
            messages = {
                "ko": {
                    "title": "일정장소 출발알림 👋",
                    "content": "{name_prefix}님이 '{title}' 장소에서 출발했어요!"
                },
                "en": {
                    "title": "Departure from scheduled location 👋",
                    "content": "{name_prefix} has departed from '{title}'!"
                },
                # 다른 언어 메시지 추가...
            }

            # 소유자에게 알림
            if group_data["owner"] and group_data["owner"]["mt_idx"] != group_data["member"]["mt_idx"]:
                lang = group_data["owner"]["mt_lang"]
                push_title = messages[lang]["title"]
                push_content = messages[lang]["content"].format(
                    name_prefix=group_data["member"]["mt_name"],
                    title=schedule.sst_title
                )
                
                push_result = send_push(
                    group_data["owner"]["mt_token_id"],
                    push_title,
                    push_content
                )
                
                push_log_add(
                    self.db,
                    group_data["owner"]["mt_idx"],
                    schedule.sst_idx,
                    plt_condition,
                    plt_memo,
                    push_title,
                    push_content,
                    push_result,
                    push_json
                )

            # 리더에게 알림
            if group_data["leader"] and group_data["leader"]["mt_idx"] != group_data["member"]["mt_idx"]:
                lang = group_data["leader"]["mt_lang"]
                push_title = messages[lang]["title"]
                push_content = messages[lang]["content"].format(
                    name_prefix=group_data["member"]["mt_name"],
                    title=schedule.sst_title
                )
                
                push_result = send_push(
                    group_data["leader"]["mt_token_id"],
                    push_title,
                    push_content
                )
                
                push_log_add(
                    self.db,
                    group_data["leader"]["mt_idx"],
                    schedule.sst_idx,
                    plt_condition,
                    plt_memo,
                    push_title,
                    push_content,
                    push_result,
                    push_json
                )

        except Exception as e:
            logger.error(f"Error sending exit notifications: {e}")

    def _update_exit_status(self, sst_idx: int) -> None:
        """이탈 상태를 업데이트합니다."""
        from app.models.schedule import Schedule
        
        try:
            schedule = Schedule.find_by_idx(self.db, sst_idx)
            if schedule:
                schedule.sst_in_chk = "N"
                schedule.sst_exit_cnt = (schedule.sst_exit_cnt or 0) + 1
                self.db.commit()
                
        except Exception as e:
            logger.error(f"Error updating exit status: {e}")
            self.db.rollback()

    def my_location_entry_alert_schedule(self):
        """내 장소 진입 알림"""
        from app.models.my_location import MyLocation
        from app.models.member import Member
        from app.models.member_location_log import MemberLocationLog
        from app.services.push_service import send_push, push_log_add
        from app.core.utils import kmTom

        try:
            plt_condition = "30초 - 내장소알림"
            plt_memo = "내가 등록한 장소의 100미터 반경에 들어왔을때"

            # 내 장소 목록 가져오기
            my_locations = MyLocation.get_all_active(self.db)

            for my_location in my_locations:
                mt_idx = str(my_location.mt_idx)
                ml_idx = my_location.ml_idx

                # 해당 회원의 마지막 위치값과 장소의 위치값 비교
                member_location = MemberLocationLog.getDistance(
                    self.db,
                    str(my_location.ml_location_lat),
                    str(my_location.ml_location_long),
                    mt_idx
                )

                if member_location:
                    distance = kmTom(member_location.distance)
                    formatted_distance = "{:,.1f}".format(distance)
                    push_json = {
                        "lat": "{:.7f}".format(float(my_location.ml_location_lat)),
                        "lng": "{:.7f}".format(float(my_location.ml_location_long)),
                        "distance": formatted_distance
                    }

                    if distance <= 100.0 and int(my_location.ml_entry_cnt) == 0:
                        # 회원 정보 가져오기
                        member = Member.find_by_idx(self.db, mt_idx)
                        if member:
                            # 푸시 알림 메시지 생성 및 전송
                            messages = {
                                "ko": {
                                    "title": "내 장소 도착알림 📍",
                                    "content": "'{title}' 장소에 도착했어요! 🎉"
                                },
                                "en": {
                                    "title": "Arrival at my location 📍",
                                    "content": "You have arrived at '{title}'! 🎉"
                                }
                            }

                            lang = member.mt_lang
                            push_title = messages[lang]["title"]
                            push_content = messages[lang]["content"].format(
                                title=my_location.ml_title
                            )

                            push_result = send_push(
                                member.mt_token_id,
                                push_title,
                                push_content
                            )

                            push_log_add(
                                self.db,
                                mt_idx,
                                ml_idx,
                                plt_condition,
                                plt_memo,
                                push_title,
                                push_content,
                                push_result,
                                push_json
                            )

                            # 진입 상태 업데이트
                            my_location.ml_in_chk = "Y"
                            my_location.ml_entry_cnt = (my_location.ml_entry_cnt or 0) + 1
                            self.db.commit()

            logger.info("My location entry alert executed successfully")

        except Exception as e:
            logger.error(f"Error in my location entry alert: {e}")
            self.db.rollback()

    def my_location_exit_alert_schedule(self):
        """내 장소 이탈 알림"""
        from app.models.my_location import MyLocation
        from app.models.member import Member
        from app.models.member_location_log import MemberLocationLog
        from app.services.push_service import send_push, push_log_add
        from app.core.utils import kmTom

        try:
            plt_condition = "30초 - 내장소알림"
            plt_memo = "내가 등록한 장소의 100미터 반경에서 이탈했을때"

            # 내 장소 목록 가져오기 (진입 상태인 것만)
            my_locations = MyLocation.get_all_active_in(self.db)

            for my_location in my_locations:
                mt_idx = str(my_location.mt_idx)
                ml_idx = my_location.ml_idx

                # 해당 회원의 마지막 위치값과 장소의 위치값 비교
                member_location = MemberLocationLog.getDistance(
                    self.db,
                    str(my_location.ml_location_lat),
                    str(my_location.ml_location_long),
                    mt_idx
                )

                if member_location:
                    distance = kmTom(member_location.distance)
                    formatted_distance = "{:,.1f}".format(distance)
                    push_json = {
                        "lat": "{:.7f}".format(float(my_location.ml_location_lat)),
                        "lng": "{:.7f}".format(float(my_location.ml_location_long)),
                        "distance": formatted_distance
                    }

                    if distance >= 100.0 and int(my_location.ml_exit_cnt) == 0:
                        # 회원 정보 가져오기
                        member = Member.find_by_idx(self.db, mt_idx)
                        if member:
                            # 푸시 알림 메시지 생성 및 전송
                            messages = {
                                "ko": {
                                    "title": "내 장소 출발알림 👋",
                                    "content": "'{title}' 장소에서 출발했어요!"
                                },
                                "en": {
                                    "title": "Departure from my location 👋",
                                    "content": "You have departed from '{title}'!"
                                }
                            }

                            lang = member.mt_lang
                            push_title = messages[lang]["title"]
                            push_content = messages[lang]["content"].format(
                                title=my_location.ml_title
                            )

                            push_result = send_push(
                                member.mt_token_id,
                                push_title,
                                push_content
                            )

                            push_log_add(
                                self.db,
                                mt_idx,
                                ml_idx,
                                plt_condition,
                                plt_memo,
                                push_title,
                                push_content,
                                push_result,
                                push_json
                            )

                            # 이탈 상태 업데이트
                            my_location.ml_in_chk = "N"
                            my_location.ml_exit_cnt = (my_location.ml_exit_cnt or 0) + 1
                            self.db.commit()

            logger.info("My location exit alert executed successfully")

        except Exception as e:
            logger.error(f"Error in my location exit alert: {e}")
            self.db.rollback()

    def sync_member_locations_recently(self):
        """최근 위치 동기화"""
        from app.models.member import Member
        from app.models.member_location_log import MemberLocationLog
        from datetime import datetime, timedelta

        try:
            # 현재 시간
            now = datetime.now()
            # 30분 전 시간
            thirty_minutes_ago = now - timedelta(minutes=30)

            # 활성화된 모든 회원 가져오기
            members = Member.get_all_active(self.db)

            for member in members:
                mt_idx = str(member.mt_idx)
                
                # 회원의 최근 위치 로그 가져오기
                recent_location = MemberLocationLog.get_recent_location(
                    self.db,
                    mt_idx,
                    thirty_minutes_ago
                )

                if recent_location:
                    # 위치 정보 업데이트
                    member.mt_location_lat = recent_location.mll_location_lat
                    member.mt_location_long = recent_location.mll_location_long
                    member.mt_location_updated_at = recent_location.mll_created_at
                    self.db.commit()

            logger.info("Member locations sync executed successfully")

        except Exception as e:
            logger.error(f"Error in member locations sync: {e}")
            self.db.rollback()

    def schedule_notification(self):
        """일정 알림"""
        from app.models.schedule import Schedule
        from app.models.member import Member
        from app.models.group_detail import GroupDetail
        from app.services.push_service import send_push, push_log_add
        from datetime import datetime, timedelta

        try:
            plt_condition = "1분 - 일정알림"
            plt_memo = "일정 시작 30분 전 알림"

            # 현재 시간
            now = datetime.now()
            # 30분 후 시간
            thirty_minutes_later = now + timedelta(minutes=30)

            # 30분 후에 시작하는 일정 가져오기
            schedules = Schedule.get_upcoming_schedules(
                self.db,
                thirty_minutes_later
            )

            for schedule in schedules:
                sst_idx = schedule.sst_idx
                mt_idx = str(schedule.mt_idx)

                # 일정 소유자 정보 가져오기
                owner = Member.find_by_idx(self.db, mt_idx)
                if not owner:
                    continue

                # 푸시 알림 메시지 생성 및 전송
                messages = {
                    "ko": {
                        "title": "일정 시작 알림 ⏰",
                        "content": "'{title}' 일정이 30분 후에 시작해요!"
                    },
                    "en": {
                        "title": "Schedule Start Alert ⏰",
                        "content": "Schedule '{title}' starts in 30 minutes!"
                    }
                }

                lang = owner.mt_lang
                push_title = messages[lang]["title"]
                push_content = messages[lang]["content"].format(
                    title=schedule.sst_title
                )

                push_result = send_push(
                    owner.mt_token_id,
                    push_title,
                    push_content
                )

                push_log_add(
                    self.db,
                    mt_idx,
                    sst_idx,
                    plt_condition,
                    plt_memo,
                    push_title,
                    push_content,
                    push_result,
                    {}
                )

                # 그룹 일정인 경우 그룹 멤버들에게도 알림
                if schedule.sgt_idx is not None:
                    group_members = GroupDetail.get_all_members(
                        self.db,
                        str(schedule.sgt_idx)
                    )

                    for group_member in group_members:
                        if str(group_member.mt_idx) != mt_idx:  # 소유자 제외
                            member = Member.find_by_idx(
                                self.db,
                                str(group_member.mt_idx)
                            )
                            if member:
                                push_result = send_push(
                                    member.mt_token_id,
                                    push_title,
                                    push_content
                                )

                                push_log_add(
                                    self.db,
                                    str(member.mt_idx),
                                    sst_idx,
                                    plt_condition,
                                    plt_memo,
                                    push_title,
                                    push_content,
                                    push_result,
                                    {}
                                )

            logger.info("Schedule notifications executed successfully")

        except Exception as e:
            logger.error(f"Error in schedule notifications: {e}")
            self.db.rollback()

    def schedule_movement_alert(self):
        """일정 이동 알림"""
        from app.models.schedule import Schedule
        from app.models.member import Member
        from app.models.group_detail import GroupDetail
        from app.models.member_location_log import MemberLocationLog
        from app.services.push_service import send_push, push_log_add
        from app.core.utils import kmTom
        from datetime import datetime, timedelta

        try:
            plt_condition = "5분 - 이동알림"
            plt_memo = "일정 장소로 이동 중인지 확인"

            # 현재 시간
            now = datetime.now()
            # 1시간 후 시간
            one_hour_later = now + timedelta(hours=1)

            # 1시간 이내에 시작하는 일정 가져오기
            schedules = Schedule.get_upcoming_schedules(
                self.db,
                one_hour_later
            )

            for schedule in schedules:
                sst_idx = schedule.sst_idx
                mt_idx = str(schedule.mt_idx)

                # 일정 소유자 정보 가져오기
                owner = Member.find_by_idx(self.db, mt_idx)
                if not owner:
                    continue

                # 회원의 최근 위치와 일정 장소 사이의 거리 계산
                member_location = MemberLocationLog.getDistance(
                    self.db,
                    str(schedule.sst_location_lat),
                    str(schedule.sst_location_long),
                    mt_idx
                )

                if member_location:
                    distance = kmTom(member_location.distance)
                    formatted_distance = "{:,.1f}".format(distance)
                    push_json = {
                        "lat": "{:.7f}".format(float(schedule.sst_location_lat)),
                        "lng": "{:.7f}".format(float(schedule.sst_location_long)),
                        "distance": formatted_distance
                    }

                    # 1km 이상 떨어져 있고, 아직 이동 중 알림을 받지 않은 경우
                    if distance >= 1000.0 and not schedule.sst_movement_alert_sent:
                        # 푸시 알림 메시지 생성 및 전송
                        messages = {
                            "ko": {
                                "title": "일정 이동 알림 🚶",
                                "content": "'{title}' 일정 장소까지 {distance}m 남았어요!"
                            },
                            "en": {
                                "title": "Schedule Movement Alert 🚶",
                                "content": "You are {distance}m away from '{title}' schedule location!"
                            }
                        }

                        lang = owner.mt_lang
                        push_title = messages[lang]["title"]
                        push_content = messages[lang]["content"].format(
                            title=schedule.sst_title,
                            distance=formatted_distance
                        )

                        push_result = send_push(
                            owner.mt_token_id,
                            push_title,
                            push_content
                        )

                        push_log_add(
                            self.db,
                            mt_idx,
                            sst_idx,
                            plt_condition,
                            plt_memo,
                            push_title,
                            push_content,
                            push_result,
                            push_json
                        )

                        # 이동 중 알림 상태 업데이트
                        schedule.sst_movement_alert_sent = True
                        self.db.commit()

            logger.info("Schedule movement alerts executed successfully")

        except Exception as e:
            logger.error(f"Error in schedule movement alerts: {e}")
            self.db.rollback()

    def update_user_locations_every_20_minutes(self):
        """사용자 위치 업데이트"""
        from app.models.member import Member
        from app.models.member_location_log import MemberLocationLog
        from datetime import datetime, timedelta

        try:
            # 현재 시간
            now = datetime.now()
            # 20분 전 시간
            twenty_minutes_ago = now - timedelta(minutes=20)

            # 활성화된 모든 회원 가져오기
            members = Member.get_all_active(self.db)

            for member in members:
                mt_idx = str(member.mt_idx)
                
                # 회원의 최근 위치 로그 가져오기
                recent_location = MemberLocationLog.get_recent_location(
                    self.db,
                    mt_idx,
                    twenty_minutes_ago
                )

                if recent_location:
                    # 위치 정보 업데이트
                    member.mt_location_lat = recent_location.mll_location_lat
                    member.mt_location_long = recent_location.mll_location_long
                    member.mt_location_updated_at = recent_location.mll_created_at
                    self.db.commit()

            logger.info("User locations update executed successfully")

        except Exception as e:
            logger.error(f"Error in user locations update: {e}")
            self.db.rollback()

    def send_reserved_push_notifications(self):
        """예약된 푸시 알림 발송"""
        from app.models.push_log import PushLog
        from app.models.member import Member
        from app.services.push_service import send_push
        from datetime import datetime

        try:
            # 현재 시간
            now = datetime.now()

            # 예약된 푸시 알림 가져오기
            reserved_pushes = PushLog.get_reserved_pushes(
                self.db,
                now
            )

            for push in reserved_pushes:
                # 회원 정보 가져오기
                member = Member.find_by_idx(self.db, str(push.mt_idx))
                if not member:
                    continue

                # 푸시 알림 전송
                push_result = send_push(
                    member.mt_token_id,
                    push.plt_title,
                    push.plt_content
                )

                # 푸시 로그 상태 업데이트
                push.plt_status = "SENT" if push_result else "FAILED"
                push.plt_sent_at = now
                self.db.commit()

            logger.info("Reserved push notifications executed successfully")

        except Exception as e:
            logger.error(f"Error in reserved push notifications: {e}")
            self.db.rollback()

    def force_update_internal_locations_midnight(self):
        """자정 내부 위치 강제 업데이트"""
        from app.models.member import Member
        from app.models.member_location_log import MemberLocationLog
        from datetime import datetime, timedelta

        try:
            # 현재 시간
            now = datetime.now()
            # 1시간 전 시간
            one_hour_ago = now - timedelta(hours=1)

            # 활성화된 모든 회원 가져오기
            members = Member.get_all_active(self.db)

            for member in members:
                mt_idx = str(member.mt_idx)
                
                # 회원의 최근 위치 로그 가져오기
                recent_location = MemberLocationLog.get_recent_location(
                    self.db,
                    mt_idx,
                    one_hour_ago
                )

                if recent_location:
                    # 위치 정보 강제 업데이트
                    member.mt_location_lat = recent_location.mll_location_lat
                    member.mt_location_long = recent_location.mll_location_long
                    member.mt_location_updated_at = recent_location.mll_created_at
                    member.mt_location_force_updated = True
                    self.db.commit()

            logger.info("Internal locations force update executed successfully")

        except Exception as e:
            logger.error(f"Error in internal locations force update: {e}")
            self.db.rollback()

    def send_daily_log_notifications(self):
        """일일 로그 알림"""
        from app.models.member import Member
        from app.models.member_location_log import MemberLocationLog
        from app.services.push_service import send_push, push_log_add
        from datetime import datetime, timedelta

        try:
            plt_condition = "일일 - 로그알림"
            plt_memo = "오늘의 위치 이동 기록 요약"

            # 현재 시간
            now = datetime.now()
            # 오늘 자정
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

            # 활성화된 모든 회원 가져오기
            members = Member.get_all_active(self.db)

            for member in members:
                mt_idx = str(member.mt_idx)
                
                # 오늘의 위치 로그 가져오기
                today_logs = MemberLocationLog.get_daily_logs(
                    self.db,
                    mt_idx,
                    today_start
                )

                if today_logs:
                    # 이동 거리 계산
                    total_distance = sum(log.mll_distance for log in today_logs)
                    formatted_distance = "{:,.1f}".format(total_distance)

                    # 푸시 알림 메시지 생성 및 전송
                    messages = {
                        "ko": {
                            "title": "오늘의 이동 기록 📊",
                            "content": "오늘 총 {distance}m를 이동했어요!"
                        },
                        "en": {
                            "title": "Today's Movement Record 📊",
                            "content": "You moved {distance}m today!"
                        }
                    }

                    lang = member.mt_lang
                    push_title = messages[lang]["title"]
                    push_content = messages[lang]["content"].format(
                        distance=formatted_distance
                    )

                    push_result = send_push(
                        member.mt_token_id,
                        push_title,
                        push_content
                    )

                    push_log_add(
                        self.db,
                        mt_idx,
                        None,  # 일일 로그는 특정 일정과 연관 없음
                        plt_condition,
                        plt_memo,
                        push_title,
                        push_content,
                        push_result,
                        {"distance": formatted_distance}
                    )

            logger.info("Daily log notifications executed successfully")

        except Exception as e:
            logger.error(f"Error in daily log notifications: {e}")
            self.db.rollback()

    def send_my_location_push_notifications(self):
        """내 위치 푸시 알림"""
        from app.models.my_location import MyLocation
        from app.models.member import Member
        from app.models.member_location_log import MemberLocationLog
        from app.services.push_service import send_push, push_log_add
        from app.core.utils import kmTom

        try:
            plt_condition = "일일 - 내위치알림"
            plt_memo = "내가 등록한 장소 근처에 있는지 확인"

            # 활성화된 모든 내 장소 가져오기
            my_locations = MyLocation.get_all_active(self.db)

            for my_location in my_locations:
                mt_idx = str(my_location.mt_idx)
                ml_idx = my_location.ml_idx

                # 회원 정보 가져오기
                member = Member.find_by_idx(self.db, mt_idx)
                if not member:
                    continue

                # 회원의 최근 위치와 장소 사이의 거리 계산
                member_location = MemberLocationLog.getDistance(
                    self.db,
                    str(my_location.ml_location_lat),
                    str(my_location.ml_location_long),
                    mt_idx
                )

                if member_location:
                    distance = kmTom(member_location.distance)
                    formatted_distance = "{:,.1f}".format(distance)
                    push_json = {
                        "lat": "{:.7f}".format(float(my_location.ml_location_lat)),
                        "lng": "{:.7f}".format(float(my_location.ml_location_long)),
                        "distance": formatted_distance
                    }

                    # 1km 이내에 있는 경우
                    if distance <= 1000.0:
                        # 푸시 알림 메시지 생성 및 전송
                        messages = {
                            "ko": {
                                "title": "내 장소 근처 알림 📍",
                                "content": "'{title}' 장소에서 {distance}m 거리에 있어요!"
                            },
                            "en": {
                                "title": "Near My Location Alert 📍",
                                "content": "You are {distance}m away from '{title}'!"
                            }
                        }

                        lang = member.mt_lang
                        push_title = messages[lang]["title"]
                        push_content = messages[lang]["content"].format(
                            title=my_location.ml_title,
                            distance=formatted_distance
                        )

                        push_result = send_push(
                            member.mt_token_id,
                            push_title,
                            push_content
                        )

                        push_log_add(
                            self.db,
                            mt_idx,
                            ml_idx,
                            plt_condition,
                            plt_memo,
                            push_title,
                            push_content,
                            push_result,
                            push_json
                        )

            logger.info("My location push notifications executed successfully")

        except Exception as e:
            logger.error(f"Error in my location push notifications: {e}")
            self.db.rollback()

    def trigger_app_execution_at_7_30pm(self):
        """앱 실행 트리거"""
        from app.models.member import Member
        from app.services.push_service import send_push, push_log_add

        try:
            plt_condition = "일일 - 앱실행알림"
            plt_memo = "저녁 7시 30분 앱 실행 알림"

            # 활성화된 모든 회원 가져오기
            members = Member.get_all_active(self.db)

            for member in members:
                mt_idx = str(member.mt_idx)

                # 푸시 알림 메시지 생성 및 전송
                messages = {
                    "ko": {
                        "title": "오늘 하루는 어떠셨나요? 🌙",
                        "content": "오늘의 일정과 위치 기록을 확인해보세요!"
                    },
                    "en": {
                        "title": "How was your day? 🌙",
                        "content": "Check your today's schedule and location records!"
                    }
                }

                lang = member.mt_lang
                push_title = messages[lang]["title"]
                push_content = messages[lang]["content"]

                push_result = send_push(
                    member.mt_token_id,
                    push_title,
                    push_content
                )

                push_log_add(
                    self.db,
                    mt_idx,
                    None,  # 앱 실행 알림은 특정 일정과 연관 없음
                    plt_condition,
                    plt_memo,
                    push_title,
                    push_content,
                    push_result,
                    {}
                )

            logger.info("App execution trigger executed successfully")

        except Exception as e:
            logger.error(f"Error in app execution trigger: {e}")
            self.db.rollback()

    def notify_low_battery_at_9pm(self):
        """배터리 부족 알림"""
        from app.models.member import Member
        from app.services.push_service import send_push, push_log_add

        try:
            plt_condition = "일일 - 배터리알림"
            plt_memo = "저녁 9시 배터리 부족 알림"

            # 활성화된 모든 회원 가져오기
            members = Member.get_all_active(self.db)

            for member in members:
                mt_idx = str(member.mt_idx)

                # 푸시 알림 메시지 생성 및 전송
                messages = {
                    "ko": {
                        "title": "배터리 부족 알림 🔋",
                        "content": "배터리가 부족해요! 충전해주세요."
                    },
                    "en": {
                        "title": "Low Battery Alert 🔋",
                        "content": "Your battery is low! Please charge your device."
                    }
                }

                lang = member.mt_lang
                push_title = messages[lang]["title"]
                push_content = messages[lang]["content"]

                push_result = send_push(
                    member.mt_token_id,
                    push_title,
                    push_content
                )

                push_log_add(
                    self.db,
                    mt_idx,
                    None,  # 배터리 알림은 특정 일정과 연관 없음
                    plt_condition,
                    plt_memo,
                    push_title,
                    push_content,
                    push_result,
                    {}
                )

            logger.info("Low battery notifications executed successfully")

        except Exception as e:
            logger.error(f"Error in low battery notifications: {e}")
            self.db.rollback()

    def send_daily_weather_notifications(self):
        """일일 날씨 알림"""
        from app.models.member import Member
        from app.services.push_service import send_push, push_log_add
        from app.services.weather_service import get_weather_info

        try:
            plt_condition = "일일 - 날씨알림"
            plt_memo = "오늘의 날씨 정보 알림"

            # 활성화된 모든 회원 가져오기
            members = Member.get_all_active(self.db)

            for member in members:
                mt_idx = str(member.mt_idx)

                # 회원의 위치 기반으로 날씨 정보 가져오기
                weather_info = get_weather_info(
                    self.db,
                    member.mt_location_lat,
                    member.mt_location_long
                )

                if weather_info:
                    # 푸시 알림 메시지 생성 및 전송
                    messages = {
                        "ko": {
                            "title": "오늘의 날씨 ☀️",
                            "content": "현재 기온: {temp}°C\n날씨: {weather}\n습도: {humidity}%"
                        },
                        "en": {
                            "title": "Today's Weather ☀️",
                            "content": "Current Temperature: {temp}°C\nWeather: {weather}\nHumidity: {humidity}%"
                        }
                    }

                    lang = member.mt_lang
                    push_title = messages[lang]["title"]
                    push_content = messages[lang]["content"].format(
                        temp=weather_info["temperature"],
                        weather=weather_info["weather"],
                        humidity=weather_info["humidity"]
                    )

                    push_result = send_push(
                        member.mt_token_id,
                        push_title,
                        push_content
                    )

                    push_log_add(
                        self.db,
                        mt_idx,
                        None,  # 날씨 알림은 특정 일정과 연관 없음
                        plt_condition,
                        plt_memo,
                        push_title,
                        push_content,
                        push_result,
                        weather_info
                    )

            logger.info("Daily weather notifications executed successfully")

        except Exception as e:
            logger.error(f"Error sending daily weather notification: {e}")
        finally:
            db.close()

# scheduler 인스턴스 생성
scheduler = BackgroundTasks() 