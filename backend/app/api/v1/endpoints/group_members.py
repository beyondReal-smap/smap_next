from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api import deps
from app.models.member import Member
from app.models.group_detail import GroupDetail
from app.schemas.member import MemberResponse
from app.models.enums import StatusEnum, ShowEnum

router = APIRouter()

@router.get("/member/{group_id}", response_model=List[dict])
def get_group_members(
    group_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    그룹에 속한 멤버 목록과 그룹 상세 정보를 조회합니다.
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
        Member.mt_status == 1
    ).all()
    
    # mt_idx를 키로 사용하여 그룹 상세 정보를 딕셔너리로 변환
    group_details_dict = {gd.mt_idx: gd for gd in group_details}
    
    # 결과 리스트 생성
    result = []
    for member in db_members:
        # 멤버 데이터를 딕셔너리로 변환
        member_dict = {c.name: getattr(member, c.name) for c in member.__table__.columns}
        
        # mt_weather_pop 처리
        if "mt_weather_pop" in member_dict and member_dict["mt_weather_pop"] is not None:
            if isinstance(member_dict["mt_weather_pop"], str):
                try:
                    member_dict["mt_weather_pop"] = int(member_dict["mt_weather_pop"].replace('%', ''))
                except ValueError:
                    member_dict["mt_weather_pop"] = None
            elif not isinstance(member_dict["mt_weather_pop"], int):
                member_dict["mt_weather_pop"] = None
        
        # 해당 멤버의 그룹 상세 정보 가져오기
        group_detail = group_details_dict.get(member.mt_idx)
        if group_detail:
            # 그룹 상세 정보를 딕셔너리로 변환하여 추가
            group_detail_dict = {c.name: getattr(group_detail, c.name) for c in group_detail.__table__.columns}
            
            # 멤버 정보와 그룹 상세 정보를 합쳐서 결과에 추가
            combined_dict = {**member_dict, **group_detail_dict}
            result.append(combined_dict)
    
    return result

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