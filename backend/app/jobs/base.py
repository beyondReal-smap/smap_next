"""
스케줄러 작업 공통 헬퍼

DB 세션을 파라미터로 받는 순수 함수들로 구성됩니다.
각 job 모듈에서 import하여 사용합니다.
"""
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def normalize_lang(lang: Optional[str]) -> str:
    """언어 코드를 정규화합니다."""
    value = (lang or "ko").strip().lower()
    if value.startswith("en"):
        return "en"
    return "ko"


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """두 좌표 간 거리를 미터 단위로 반환합니다 (utils 위임)."""
    from app.core.utils import haversine_distance
    return haversine_distance(lat1, lon1, lat2, lon2)


def record_value(record: Any, key: str, default=None):
    """레코드에서 값을 추출합니다 (dict 또는 ORM 객체 모두 지원)."""
    if isinstance(record, dict):
        return record.get(key, default)
    return getattr(record, key, default)


def prefetch_members(db, mt_idx_list: list) -> Dict:
    """mt_idx 리스트로 Member를 배치 조회하여 dict로 반환합니다."""
    from app.models.member import Member
    if not mt_idx_list:
        return {}
    result = {}
    for i in range(0, len(mt_idx_list), 500):
        chunk = [int(x) for x in mt_idx_list[i:i + 500]]
        for m in db.query(Member).filter(Member.mt_idx.in_(chunk)).all():
            result[m.mt_idx] = m
    return result


def member_payload(member: Any) -> Dict:
    """회원 정보를 dict로 변환합니다."""
    if not member:
        return {}
    return {
        "mt_idx": member.mt_idx,
        "mt_name": member.mt_nickname or member.mt_name or "회원",
        "mt_lang": normalize_lang(getattr(member, "mt_lang", None)),
        "mt_token_id": getattr(member, "mt_token_id", None),
    }


def merge_group_target(db, group_target: Dict) -> Dict:
    """그룹 타겟에 회원 정보를 병합합니다."""
    from app.models.member import Member

    if not group_target or not group_target.get("mt_idx"):
        return {}

    member = Member.find_by_idx(db, int(group_target["mt_idx"]))
    if not member:
        return {}

    merged = dict(group_target)
    merged.update(member_payload(member))
    return merged


def group_notification_targets(db, sgt_idx: str, exclude_mt_idx: int) -> List[Dict]:
    """그룹의 알림 대상자 목록을 반환합니다 (자기 자신 제외)."""
    from app.models.group_detail import GroupDetail

    raw_targets = []
    seen = set()
    targets = []

    owner = GroupDetail.find_owner(db, sgt_idx)
    leader = GroupDetail.find_leader(db, sgt_idx)
    members = GroupDetail.get_member_list(db, sgt_idx)

    if owner:
        raw_targets.append(owner)
    if leader:
        raw_targets.append(leader)
    raw_targets.extend(members)

    for raw_target in raw_targets:
        target = merge_group_target(db, raw_target)
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


def get_group_member_data(db, sgt_idx: str, mt_idx: str) -> Dict:
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
        owner = GroupDetail.find_owner(db, sgt_idx)
        if owner:
            group_data["owner"] = merge_group_target(db, owner)

        # 그룹 리더 정보
        leader = GroupDetail.find_leader(db, sgt_idx)
        if leader:
            group_data["leader"] = merge_group_target(db, leader)

        # 멤버 정보
        member = Member.find_by_idx(db, mt_idx)
        if member:
            group_data["member"] = member_payload(member)

        return group_data

    except Exception as e:
        logger.exception(f"Error getting group member data: {e}")
        return {"owner": {}, "leader": {}, "member": {}}


def render_push_message(
    event_type: str,
    lang: str,
    variables: Dict[str, str],
    fallback_template: Dict[str, str],
) -> tuple:
    """AI 메시지 서비스를 통해 푸시 메시지를 렌더링합니다."""
    from app.services.ai_message_service import ai_message_service

    return ai_message_service.render_message(
        event_type=event_type,
        lang=lang,
        variables=variables,
        fallback_template=fallback_template,
    )
