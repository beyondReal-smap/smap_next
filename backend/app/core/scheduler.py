from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from datetime import datetime, timedelta
import logging
from threading import local
from typing import Any, Dict, List, Optional
import random
from apscheduler.triggers.interval import IntervalTrigger
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

class BackgroundTasks:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self._db_local = local()
        self._jobs_scheduled = False
        self.scheduler.add_job(
            self._run_background_task,
            trigger=IntervalTrigger(seconds=60),
            id='background_task',
            replace_existing=True
        )

    def start(self):
        if not self._jobs_scheduled:
            self._schedule_all_jobs()
            self._jobs_scheduled = True
        self.scheduler.start()

    def shutdown(self):
        if self.scheduler.running:
            self.scheduler.shutdown()

    @property
    def db(self):
        return getattr(self._db_local, "session", None)

    @db.setter
    def db(self, value):
        self._db_local.session = value

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
        self.scheduler.add_job(
            self._run_job,
            'interval',
            seconds=30,
            args=['location_entry_alert_schedule'],
            id='location_entry_alert_schedule'
        )
        self.scheduler.add_job(
            self._run_job,
            'interval',
            seconds=30,
            args=['location_exit_alert_schedule'],
            id='location_exit_alert_schedule'
        )
        self.scheduler.add_job(
            self._run_job,
            'interval',
            minutes=1,
            args=['schedule_notification'],
            id='schedule_notification'
        )

    def _run_job(self, job_name: str):
        db = SessionLocal()
        previous_db = self.db
        self.db = db
        try:
            getattr(self, job_name)()
        except Exception as e:
            logger.exception(f"Error running scheduled job {job_name}: {e}")
            db.rollback()
        finally:
            db.close()
            self.db = previous_db

    def _normalize_lang(self, lang: Optional[str]) -> str:
        value = (lang or "ko").strip().lower()
        if value.startswith("en"):
            return "en"
        return "ko"

    def _member_payload(self, member: Any) -> Dict:
        if not member:
            return {}

        return {
            "mt_idx": member.mt_idx,
            "mt_name": member.mt_nickname or member.mt_name or "회원",
            "mt_lang": self._normalize_lang(getattr(member, "mt_lang", None)),
            "mt_token_id": getattr(member, "mt_token_id", None),
        }

    def _merge_group_target(self, group_target: Dict) -> Dict:
        from app.models.member import Member

        if not group_target or not group_target.get("mt_idx"):
            return {}

        member = Member.find_by_idx(self.db, int(group_target["mt_idx"]))
        if not member:
            return {}

        merged = dict(group_target)
        merged.update(self._member_payload(member))
        return merged

    def _group_notification_targets(self, sgt_idx: str, exclude_mt_idx: int) -> List[Dict]:
        from app.models.group_detail import GroupDetail

        raw_targets = []
        seen = set()
        targets = []

        owner = GroupDetail.find_owner(self.db, sgt_idx)
        leader = GroupDetail.find_leader(self.db, sgt_idx)
        members = GroupDetail.get_member_list(self.db, sgt_idx)

        if owner:
            raw_targets.append(owner)
        if leader:
            raw_targets.append(leader)
        raw_targets.extend(members)

        for raw_target in raw_targets:
            target = self._merge_group_target(raw_target)
            target_mt_idx = str(target.get("mt_idx") or "")
            if not target_mt_idx:
                continue
            if target_mt_idx == str(exclude_mt_idx):
                continue
            if target_mt_idx in seen:
                continue
            if not target.get("mt_token_id"):
                continue

            seen.add(target_mt_idx)
            targets.append(target)

        return targets

    def _render_push_message(
        self,
        event_type: str,
        lang: str,
        variables: Dict[str, str],
        fallback_template: Dict[str, str],
    ) -> tuple[str, str]:
        from app.services.ai_message_service import ai_message_service

        return ai_message_service.render_message(
            event_type=event_type,
            lang=lang,
            variables=variables,
            fallback_template=fallback_template,
        )

    def _record_value(self, record: Any, key: str, default=None):
        if isinstance(record, dict):
            return record.get(key, default)
        return getattr(record, key, default)

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
                sst_idx = self._record_value(schedule, "sst_idx")
                sgt_idx = None

                if self._record_value(schedule, "sgt_idx") is not None and self._record_value(schedule, "sgdt_idx") not in (None, 0):
                    sgt_idx = str(self._record_value(schedule, "sgt_idx"))
                    
                    # 그룹에서 해당 회원의 mt_idx 가져오기
                    group_member = GroupDetail.find_by_idx(
                        self.db,
                        int(self._record_value(schedule, "sgdt_idx"))
                    )
                    if group_member:
                        mt_idx = str(group_member.mt_idx)

                if mt_idx and int(self._record_value(schedule, "mt_idx") or 0) != int(mt_idx):
                    # 해당 회원의 마지막 위치값과 장소의 위치값 비교
                    member_location = MemberLocationLog.getDistance(
                        self.db,
                        str(self._record_value(schedule, "sst_location_lat")),
                        str(self._record_value(schedule, "sst_location_long")),
                        mt_idx
                    )

                    if member_location:
                        distance = kmTom(member_location.distance)
                        formatted_distance = "{:,.1f}".format(distance)
                        push_json = {
                            "lat": "{:.7f}".format(float(self._record_value(schedule, "sst_location_lat"))),
                            "lng": "{:.7f}".format(float(self._record_value(schedule, "sst_location_long"))),
                            "distance": formatted_distance
                        }

                        if distance <= 100.0 and int(self._record_value(schedule, "sst_entry_cnt") or 0) == 0:
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
                group_data["owner"] = self._merge_group_target(owner)
            
            # 그룹 리더 정보
            leader = GroupDetail.find_leader(self.db, sgt_idx)
            if leader:
                group_data["leader"] = self._merge_group_target(leader)
            
            # 멤버 정보
            member = Member.find_by_idx(self.db, mt_idx)
            if member:
                group_data["member"] = self._member_payload(member)
            
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
                    "content": "{name}님이 '{title}' 장소에 도착했어요! 🎉"
                },
                "en": {
                    "title": "Arrival at scheduled location 📍",
                    "content": "{name} has arrived at '{title}'! 🎉"
                }
            }

            actor_name = group_data["member"].get("mt_name", "회원")
            schedule_title = self._record_value(schedule, "sst_title") or "일정"

            for target in [group_data.get("owner", {}), group_data.get("leader", {})]:
                if not target:
                    continue
                if str(target.get("mt_idx")) == str(group_data["member"].get("mt_idx")):
                    continue

                lang = self._normalize_lang(target.get("mt_lang"))
                fallback_template = messages.get(lang, messages["ko"])
                push_title, push_content = self._render_push_message(
                    event_type="schedule_place_entry",
                    lang=lang,
                    variables={"name": actor_name, "title": schedule_title},
                    fallback_template=fallback_template,
                )

                push_result = send_push(
                    target.get("mt_token_id"),
                    push_title,
                    push_content
                )

                push_log_add(
                    self.db,
                    target.get("mt_idx"),
                    self._record_value(schedule, "sst_idx"),
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
                sst_idx = self._record_value(schedule, "sst_idx")
                sgt_idx = None

                if self._record_value(schedule, "sgt_idx") is not None and self._record_value(schedule, "sgdt_idx") not in (None, 0):
                    sgt_idx = str(self._record_value(schedule, "sgt_idx"))

                    # 그룹에서 해당 회원의 mt_idx 가져오기
                    group_member = GroupDetail.find_by_idx(
                        self.db,
                        int(self._record_value(schedule, "sgdt_idx"))
                    )
                    if group_member:
                        mt_idx = str(group_member.mt_idx)

                if mt_idx and int(self._record_value(schedule, "mt_idx") or 0) != int(mt_idx):
                    # 해당 회원의 마지막 위치값과 장소의 위치값 비교
                    member_location = MemberLocationLog.getDistance(
                        self.db,
                        str(self._record_value(schedule, "sst_location_lat")),
                        str(self._record_value(schedule, "sst_location_long")),
                        mt_idx
                    )

                    if member_location:
                        distance = kmTom(member_location.distance)
                        formatted_distance = "{:,.1f}".format(distance)
                        push_json = {
                            "lat": "{:.7f}".format(float(self._record_value(schedule, "sst_location_lat"))),
                            "lng": "{:.7f}".format(float(self._record_value(schedule, "sst_location_long"))),
                            "distance": formatted_distance
                        }

                        if distance >= 100.0 and int(self._record_value(schedule, "sst_exit_cnt") or 0) == 0:
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
                    "content": "{name}님이 '{title}' 장소에서 출발했어요!"
                },
                "en": {
                    "title": "Departure from scheduled location 👋",
                    "content": "{name} has departed from '{title}'!"
                }
            }

            actor_name = group_data["member"].get("mt_name", "회원")
            schedule_title = self._record_value(schedule, "sst_title") or "일정"

            for target in [group_data.get("owner", {}), group_data.get("leader", {})]:
                if not target:
                    continue
                if str(target.get("mt_idx")) == str(group_data["member"].get("mt_idx")):
                    continue

                lang = self._normalize_lang(target.get("mt_lang"))
                fallback_template = messages.get(lang, messages["ko"])
                push_title, push_content = self._render_push_message(
                    event_type="schedule_place_exit",
                    lang=lang,
                    variables={"name": actor_name, "title": schedule_title},
                    fallback_template=fallback_template,
                )

                push_result = send_push(
                    target.get("mt_token_id"),
                    push_title,
                    push_content
                )

                push_log_add(
                    self.db,
                    target.get("mt_idx"),
                    self._record_value(schedule, "sst_idx"),
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

            schedules = Schedule.get_now_schedule_push(self.db)

            for schedule in schedules:
                sst_idx = schedule.sst_idx
                mt_idx = str(schedule.mt_idx)
                schedule_title = schedule.sst_title or "일정"

                # 일정 소유자 정보 가져오기
                owner = Member.find_by_idx(self.db, mt_idx)
                if not owner or not owner.mt_token_id:
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

                owner_lang = self._normalize_lang(owner.mt_lang)
                owner_fallback = messages.get(owner_lang, messages["ko"])
                push_title, push_content = self._render_push_message(
                    event_type="schedule_start",
                    lang=owner_lang,
                    variables={"title": schedule_title},
                    fallback_template=owner_fallback,
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
                    group_targets = self._group_notification_targets(
                        str(schedule.sgt_idx),
                        exclude_mt_idx=owner.mt_idx,
                    )

                    for target in group_targets:
                        target_lang = self._normalize_lang(target.get("mt_lang"))
                        target_fallback = messages.get(target_lang, messages["ko"])
                        member_title, member_content = self._render_push_message(
                            event_type="schedule_start",
                            lang=target_lang,
                            variables={"title": schedule_title},
                            fallback_template=target_fallback,
                        )

                        push_result = send_push(
                            target.get("mt_token_id"),
                            member_title,
                            member_content
                        )

                        push_log_add(
                            self.db,
                            str(target.get("mt_idx")),
                            sst_idx,
                            plt_condition,
                            plt_memo,
                            member_title,
                            member_content,
                            push_result,
                            {}
                        )

                schedule.sst_schedule_chk = "Y"
                self.db.commit()

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

    def send_silent_push_to_all_users(self):
        """모든 FCM 토큰 보유 사용자에게 Silent 푸시 전송 (백그라운드 토큰 유지용)"""
        from app.models.member import Member
        from app.services.firebase_service import firebase_service
        from datetime import datetime, timedelta

        try:
            logger.info("백그라운드 FCM 토큰 유지용 Silent 푸시 배치 전송 시작")

            # FCM 토큰이 있는 모든 사용자 조회 (토큰 만료 임박 사용자 우선)
            current_time = datetime.now()
            expired_threshold = current_time + timedelta(days=30)  # 30일 이내 만료 예정인 토큰 우선

            # 우선순위 1: 토큰 만료 임박 사용자
            priority_members = Member.get_token_expiring_soon(self.db, expired_threshold)
            # 우선순위 2: 나머지 모든 토큰 보유 사용자
            all_members = Member.get_token_list(self.db)

            # 중복 제거를 위해 우선순위 멤버들을 제외한 나머지 멤버들
            priority_mt_idxs = {member.mt_idx for member in priority_members}
            remaining_members = [member for member in all_members if member.mt_idx not in priority_mt_idxs]

            # 우선순위 멤버 먼저, 나머지 멤버들 뒤에 추가
            target_members = priority_members + remaining_members

            logger.info(f"FCM 토큰 보유 사용자 수: {len(target_members)} (우선순위: {len(priority_members)}, 일반: {len(remaining_members)})")

            success_count = 0
            fail_count = 0
            priority_success_count = 0
            priority_fail_count = 0

            for i, member in enumerate(target_members):
                try:
                    is_priority = i < len(priority_members)
                    reason = "priority_token_refresh" if is_priority else "scheduled_token_refresh"
                    priority = "high" if is_priority else "high"  # 모두 high로 설정하여 푸시 수신 보장

                    # 각 사용자에게 silent push 전송 (priority를 높게 설정하여 iOS 무시 방지)
                    response = firebase_service.send_silent_push_notification(
                        member.mt_token_id,
                        reason,
                        priority  # 무조건 high로 설정하여 푸시 수신 보장
                    )

                    if is_priority:
                        priority_success_count += 1
                    success_count += 1

                    logger.debug(f"Silent 푸시 전송 성공 - mt_idx: {member.mt_idx}, 우선순위: {is_priority}, 토큰 만료일: {member.mt_token_expiry_date}")

                except Exception as e:
                    if i < len(priority_members):
                        priority_fail_count += 1
                    fail_count += 1
                    logger.error(f"Silent 푸시 전송 실패 - mt_idx: {member.mt_idx}, error: {str(e)}")

            logger.info(f"Silent 푸시 배치 전송 완료 - 전체: {success_count}/{len(target_members)} 성공")
            logger.info(f"우선순위 토큰: {priority_success_count}/{len(priority_members)} 성공, 일반 토큰: {success_count - priority_success_count}/{len(remaining_members)} 성공")

            if fail_count > 0:
                logger.warning(f"Silent 푸시 전송 실패: {fail_count}개 (우선순위 실패: {priority_fail_count})")

        except Exception as e:
            logger.error(f"Silent 푸시 배치 전송 중 오류 발생: {e}")
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
