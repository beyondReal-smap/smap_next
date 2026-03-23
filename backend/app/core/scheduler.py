"""
스케줄러 오케스트레이터

APScheduler를 사용하여 백그라운드 작업을 관리합니다.
실제 비즈니스 로직은 app.jobs 패키지의 각 모듈에 위임합니다.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from threading import local
import logging

from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# job 이름 -> 실제 함수 매핑 (지연 import로 순환 방지)
# ---------------------------------------------------------------------------
_JOB_REGISTRY: dict = {}


def _get_job_func(job_name: str):
    """job 이름에 해당하는 함수를 반환합니다 (최초 호출 시 import)."""
    if not _JOB_REGISTRY:
        from app.jobs.location_alerts import (
            run_location_entry_alert,
            run_location_exit_alert,
            run_my_location_entry_alert,
            run_my_location_exit_alert,
        )
        from app.jobs.location_sync import (
            run_sync_member_locations_recently,
            run_update_user_locations_every_20_minutes,
            run_force_update_internal_locations_midnight,
        )
        from app.jobs.push_jobs import (
            run_send_reserved_push_notifications,
            run_schedule_notification,
            run_send_silent_push_to_all_users,
            run_trigger_app_execution_at_7_30pm,
        )
        from app.jobs.daily_jobs import (
            run_notify_low_battery_at_9pm,
            run_send_daily_log_notifications,
            run_send_daily_weather_notifications,
            run_send_my_location_push_notifications,
            run_schedule_movement_alert,
        )

        _JOB_REGISTRY.update({
            # 위치 알림 (30초 주기)
            "location_entry_alert_schedule": run_location_entry_alert,
            "location_exit_alert_schedule": run_location_exit_alert,
            "my_location_entry_alert_schedule": run_my_location_entry_alert,
            "my_location_exit_alert_schedule": run_my_location_exit_alert,
            # 위치 동기화
            "sync_member_locations_recently": run_sync_member_locations_recently,
            "update_user_locations_every_20_minutes": run_update_user_locations_every_20_minutes,
            "force_update_internal_locations_midnight": run_force_update_internal_locations_midnight,
            # 푸시 알림
            "send_reserved_push_notifications": run_send_reserved_push_notifications,
            "schedule_notification": run_schedule_notification,
            "send_silent_push_to_all_users": run_send_silent_push_to_all_users,
            "trigger_app_execution_at_7_30pm": run_trigger_app_execution_at_7_30pm,
            # 일일 알림
            "notify_low_battery_at_9pm": run_notify_low_battery_at_9pm,
            "send_daily_log_notifications": run_send_daily_log_notifications,
            "send_daily_weather_notifications": run_send_daily_weather_notifications,
            "send_my_location_push_notifications": run_send_my_location_push_notifications,
            "schedule_movement_alert": run_schedule_movement_alert,
        })

    return _JOB_REGISTRY.get(job_name)


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

    # ------------------------------------------------------------------
    # DB 세션 (thread-local)
    # ------------------------------------------------------------------
    @property
    def db(self):
        return getattr(self._db_local, "session", None)

    @db.setter
    def db(self, value):
        self._db_local.session = value

    # ------------------------------------------------------------------
    # 작업 스케줄링
    # ------------------------------------------------------------------
    def _schedule_all_jobs(self):
        """모든 백그라운드 작업을 스케줄링합니다."""
        _30s = dict(seconds=30, misfire_grace_time=25, max_instances=1, coalesce=True)
        _1m = dict(minutes=1, misfire_grace_time=50, max_instances=1, coalesce=True)

        for job_name in [
            'location_entry_alert_schedule',
            'location_exit_alert_schedule',
            'my_location_entry_alert_schedule',
            'my_location_exit_alert_schedule',
        ]:
            self.scheduler.add_job(
                self._run_job, 'interval', args=[job_name], id=job_name, **_30s
            )

        self.scheduler.add_job(
            self._run_job, 'interval', args=['schedule_notification'],
            id='schedule_notification', **_1m
        )
        self.scheduler.add_job(
            self._run_job, 'interval', args=['send_reserved_push_notifications'],
            id='send_reserved_push_notifications', **_1m
        )

        # 20분 주기: 회원 위치 동기화
        _20m = dict(minutes=20, misfire_grace_time=300, max_instances=1, coalesce=True)
        self.scheduler.add_job(
            self._run_job, 'interval', args=['update_user_locations_every_20_minutes'],
            id='update_user_locations_every_20_minutes', **_20m
        )

        # 일일 cron 작업
        from apscheduler.triggers.cron import CronTrigger
        _cron_opts = dict(misfire_grace_time=3600, max_instances=1, coalesce=True)

        self.scheduler.add_job(
            self._run_job, CronTrigger(hour=3, minute=0),
            args=['send_silent_push_to_all_users'],
            id='send_silent_push_to_all_users', **_cron_opts
        )
        self.scheduler.add_job(
            self._run_job, CronTrigger(hour=19, minute=30),
            args=['trigger_app_execution_at_7_30pm'],
            id='trigger_app_execution_at_7_30pm', **_cron_opts
        )
        self.scheduler.add_job(
            self._run_job, CronTrigger(hour=21, minute=0),
            args=['notify_low_battery_at_9pm'],
            id='notify_low_battery_at_9pm', **_cron_opts
        )
        self.scheduler.add_job(
            self._run_job, CronTrigger(hour=7, minute=0),
            args=['send_daily_weather_notifications'],
            id='send_daily_weather_notifications', **_cron_opts
        )

    # ------------------------------------------------------------------
    # 작업 실행
    # ------------------------------------------------------------------
    def _run_background_task(self):
        db = SessionLocal()
        try:
            logger.info("Background task running...")
        except Exception as e:
            logger.exception(f"Error in background task: {e}")
        finally:
            db.close()

    def _run_job(self, job_name: str):
        """DB 세션을 생성하고 해당 job 함수를 실행합니다."""
        job_func = _get_job_func(job_name)
        if not job_func:
            logger.error(f"Unknown job: {job_name}")
            return

        db = SessionLocal()
        previous_db = self.db
        self.db = db
        try:
            job_func(db)
        except Exception as e:
            logger.exception(f"Error running scheduled job {job_name}: {e}")
            db.rollback()
        finally:
            db.close()
            self.db = previous_db


# scheduler 인스턴스 생성
scheduler = BackgroundTasks()
