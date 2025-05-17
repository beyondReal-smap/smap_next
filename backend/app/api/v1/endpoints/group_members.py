from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api import deps
from app.models.member import Member
from app.models.group_detail import GroupDetail
from app.schemas.member import MemberResponse
from app.models.enums import StatusEnum, ShowEnum

router = APIRouter()

@router.get("/member/{group_id}", response_model=List[MemberResponse])
def get_group_members(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹에 속한 멤버 목록을 조회합니다.
    """
    # 그룹 상세 테이블에서 그룹 ID로 멤버 ID 목록 조회
    group_details = db.query(GroupDetail).filter(
        GroupDetail.sgt_idx == group_id,
        GroupDetail.sgdt_show == ShowEnum.Y
    ).all()
    
    if not group_details:
        return []
    
    # 멤버 ID 목록 추출
    member_ids = [gd.mt_idx for gd in group_details]
    
    # 멤버 ID 목록으로 멤버 정보 조회
    db_members = db.query(Member).filter(
        Member.mt_idx.in_(member_ids),
        Member.mt_status == 1  # StatusEnum은 문자열 enum이지만 mt_status는 정수 필드로 보임
    ).all()
    
    # mt_weather_pop 전처리 로직 추가
    processed_members = []
    for member_model in db_members:
        # MemberResponse 스키마에 맞게 데이터를 변환할 준비
        # SQLAlchemy 모델 객체의 속성을 직접 수정하거나, 새로운 딕셔너리를 만듭니다.
        # 여기서는 FastAPI가 response_model을 사용하여 자동으로 변환할 때
        # SQLAlchemy 모델 객체를 직접 사용하므로, 모델 객체의 속성을 직접 수정합니다.
        # (주의: 이 방식은 모델 객체 자체를 변경하므로, 상황에 따라 부작용이 있을 수 있습니다.
        #  더 안전한 방법은 MemberResponse 객체를 직접 생성하여 리스트에 담는 것입니다.)

        current_pop = getattr(member_model, "mt_weather_pop", None)
        if current_pop is not None and isinstance(current_pop, str):
            try:
                # '%' 제거 후 정수 변환 시도
                setattr(member_model, "mt_weather_pop", int(current_pop.replace('%', '')))
            except ValueError:
                # 변환 실패 시 None 또는 기본값 처리 (예: 0)
                setattr(member_model, "mt_weather_pop", None) # 또는 0, 또는 오류 로깅
        elif current_pop is not None and not isinstance(current_pop, int):
            # 이미 정수가 아니거나 문자열도 아닌 경우 (예: float 등) None 처리
            setattr(member_model, "mt_weather_pop", None)
            
        processed_members.append(member_model) # 수정된 모델 객체를 리스트에 추가

    return processed_members

@router.post("/add")
def add_member_to_group(
    group_id: int,
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹에 멤버를 추가합니다.
    """
    # 그룹과 멤버가 존재하는지 확인
    member = db.query(Member).filter(Member.mt_idx == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # 이미 그룹에 멤버가 존재하는지 확인
    exists = db.query(GroupDetail).filter(
        GroupDetail.sgt_idx == group_id,
        GroupDetail.mt_idx == member_id,
        GroupDetail.sgdt_show == ShowEnum.Y
    ).first()
    
    if exists:
        return {"success": False, "message": "Member is already in the group"}
    
    # 이전에 삭제된 멤버인 경우 상태만 업데이트
    deleted_member = db.query(GroupDetail).filter(
        GroupDetail.sgt_idx == group_id,
        GroupDetail.mt_idx == member_id,
        GroupDetail.sgdt_show == ShowEnum.N
    ).first()
    
    if deleted_member:
        deleted_member.sgdt_show = ShowEnum.Y
        db.add(deleted_member)
        db.commit()
    else:
        # 새 그룹 멤버 생성
        group_detail = GroupDetail(
            sgt_idx=group_id,
            mt_idx=member_id,
            sgdt_show=ShowEnum.Y
        )
        db.add(group_detail)
        db.commit()
    
    return {"success": True, "message": "Member added to group successfully"}

@router.delete("/remove")
def remove_member_from_group(
    group_id: int,
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹에서 멤버를 제거합니다.
    """
    group_detail = db.query(GroupDetail).filter(
        GroupDetail.sgt_idx == group_id,
        GroupDetail.mt_idx == member_id,
        GroupDetail.sgdt_show == ShowEnum.Y
    ).first()
    
    if not group_detail:
        raise HTTPException(status_code=404, detail="Member not found in the group")
    
    group_detail.sgdt_show = ShowEnum.N
    db.add(group_detail)
    db.commit()
    
    return {"success": True, "message": "Member removed from group successfully"} 