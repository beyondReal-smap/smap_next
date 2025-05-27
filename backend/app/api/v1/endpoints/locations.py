from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationUpdate, LocationResponse

router = APIRouter()

@router.get("/", response_model=List[LocationResponse])
def get_locations(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    위치 목록을 조회합니다.
    """
    locations = db.query(Location.__table__).offset(skip).limit(limit).all()
    return locations

@router.get("/{location_id}", response_model=LocationResponse)
def get_location(
    location_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 위치를 조회합니다.
    """
    location = db.query(Location).filter(Location.slt_idx == location_id).first()
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return location

@router.get("/member/{member_id}", response_model=List[LocationResponse])
def get_member_locations(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 회원의 위치 목록을 조회합니다.
    """
    locations = Location.find_by_member(db, member_id)
    return locations

@router.get("/group-detail/{group_detail_id}", response_model=List[LocationResponse])
def get_group_detail_locations(
    group_detail_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 그룹 상세의 위치 목록을 조회합니다.
    """
    locations = Location.find_by_group_detail(db, group_detail_id)
    return locations

@router.get("/myplays/in", response_model=List[LocationResponse])
def get_in_myplays_locations(
    db: Session = Depends(deps.get_db)
):
    """
    내 플레이스 내부 위치 목록을 조회합니다.
    """
    locations = Location.get_in_myplays_list(db)
    return locations

@router.get("/myplays/out", response_model=List[LocationResponse])
def get_out_myplays_locations(
    db: Session = Depends(deps.get_db)
):
    """
    내 플레이스 외부 위치 목록을 조회합니다.
    """
    locations = Location.get_out_myplays_list(db)
    return locations

@router.post("/")
def create_location(
    location_data: dict,
    db: Session = Depends(deps.get_db)
):
    """
    새로운 위치를 생성합니다.
    """
    try:
        from sqlalchemy import text
        from datetime import datetime
        import logging
        
        # 디버그 로깅
        logging.info(f"Received location data: {location_data}")
        
        # 필수 필드 검증
        required_fields = ['slt_title', 'slt_add']
        for field in required_fields:
            if field not in location_data or not location_data[field]:
                raise HTTPException(status_code=400, detail=f"Missing or empty required field: {field}")
        
        # 좌표 검증 및 기본값 설정
        slt_lat = location_data.get('slt_lat', 37.5665)
        slt_long = location_data.get('slt_long', 126.9780)
        
        # 숫자로 변환
        try:
            slt_lat = float(slt_lat)
            slt_long = float(slt_long)
        except (ValueError, TypeError):
            slt_lat = 37.5665
            slt_long = 126.9780
        
        # 현재 시간
        current_time = datetime.now()
        
        # 기존 DB 스키마에 맞는 간단한 INSERT
        sql = text("""
            INSERT INTO smap_location_t (
                mt_idx, slt_title, slt_add, slt_lat, slt_long, 
                slt_show, slt_enter_alarm, slt_enter_chk, slt_wdate
            ) VALUES (
                :mt_idx, :slt_title, :slt_add, :slt_lat, :slt_long,
                :slt_show, :slt_enter_alarm, :slt_enter_chk, :slt_wdate
            )
        """)
        
        params = {
            "mt_idx": location_data.get('mt_idx', 282),
            "slt_title": str(location_data['slt_title'])[:100],  # 길이 제한
            "slt_add": str(location_data['slt_add'])[:200],  # 길이 제한
            "slt_lat": slt_lat,
            "slt_long": slt_long,
            "slt_show": location_data.get('slt_show', 'Y'),
            "slt_enter_alarm": location_data.get('slt_enter_alarm', 'Y'),
            "slt_enter_chk": location_data.get('slt_enter_chk', 'N'),
            "slt_wdate": current_time
        }
        
        logging.info(f"SQL parameters: {params}")
        
        # SQL 실행
        result = db.execute(sql, params)
        db.commit()
        
        # 생성된 레코드 ID 가져오기 (MySQL/MariaDB 기준)
        if hasattr(result, 'lastrowid'):
            new_id = result.lastrowid
        else:
            # lastrowid가 없는 경우 직접 조회
            new_id_result = db.execute(text("SELECT LAST_INSERT_ID()")).fetchone()
            new_id = new_id_result[0] if new_id_result else None
        
        return {
            "success": True,
            "message": "Location created successfully",
            "slt_idx": new_id,
            "data": {
                "slt_idx": new_id,
                "slt_title": params["slt_title"],
                "slt_add": params["slt_add"],
                "slt_lat": params["slt_lat"],
                "slt_long": params["slt_long"],
                "slt_show": params["slt_show"],
                "slt_enter_alarm": params["slt_enter_alarm"],
                "slt_enter_chk": params["slt_enter_chk"],
                "slt_wdate": current_time.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logging.error(f"Location creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Location creation failed: {str(e)}")

@router.put("/{location_id}/notification")
def update_location_notification(
    location_id: int,
    notification_data: dict,
    db: Session = Depends(deps.get_db)
):
    """
    위치의 알림 설정을 업데이트합니다.
    """
    try:
        from sqlalchemy import text
        from datetime import datetime
        
        # 알림 설정 업데이트를 위한 SQL
        if 'slt_enter_alarm' not in notification_data:
            raise HTTPException(status_code=400, detail="slt_enter_alarm field is required")
        
        alarm_value = notification_data['slt_enter_alarm']
        if alarm_value not in ['Y', 'N']:
            raise HTTPException(status_code=400, detail="slt_enter_alarm must be 'Y' or 'N'")
        
        # 직접 SQL 업데이트 실행
        sql = text("""
            UPDATE smap_location_t 
            SET slt_enter_alarm = :alarm_value, slt_udate = :update_time 
            WHERE slt_idx = :location_id
        """)
        
        result = db.execute(sql, {
            "alarm_value": alarm_value,
            "update_time": datetime.now(),
            "location_id": location_id
        })
        db.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Location not found")
        
        return {
            "success": True,
            "message": "Notification setting updated successfully",
            "slt_idx": location_id,
            "slt_enter_alarm": alarm_value
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")

@router.put("/{location_id}")
def update_location(
    location_id: int,
    location_data: dict,
    db: Session = Depends(deps.get_db)
):
    """
    위치 정보를 업데이트합니다.
    """
    try:
        from sqlalchemy import text
        from datetime import datetime
        
        # 직접 SQL 쿼리를 사용하여 업데이트
        update_fields = []
        params = {"location_id": location_id}
        
        # 업데이트할 필드들 처리
        if 'slt_enter_alarm' in location_data:
            update_fields.append("slt_enter_alarm = :slt_enter_alarm")
            params['slt_enter_alarm'] = location_data['slt_enter_alarm']
        
        if 'slt_show' in location_data:
            update_fields.append("slt_show = :slt_show")
            params['slt_show'] = location_data['slt_show']
            
        # 업데이트 시간 추가
        update_fields.append("slt_udate = :slt_udate")
        params['slt_udate'] = datetime.now()
        
        if not update_fields:
            return {"success": False, "message": "No fields to update"}
        
        # SQL 업데이트 실행
        sql = f"UPDATE smap_location_t SET {', '.join(update_fields)} WHERE slt_idx = :location_id"
        result = db.execute(text(sql), params)
        db.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Location not found")
        
        return {
            "success": True,
            "message": "Location updated successfully",
            "updated_fields": list(location_data.keys()),
            "slt_idx": location_id
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")

@router.delete("/{location_id}", response_model=LocationResponse)
def delete_location(
    location_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    위치를 삭제합니다.
    """
    location = db.query(Location).filter(Location.slt_idx == location_id).first()
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    
    db.delete(location)
    db.commit()
    return location

@router.get("/other-members/{member_id}", response_model=List[LocationResponse])
def get_other_members_locations(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    다른 멤버의 위치 목록을 조회합니다.
    """
    locations = Location.find_by_member(db, member_id)
    return locations

@router.post("/members/{member_id}/locations")
def create_member_location(
    member_id: int,
    location_data: dict,
    db: Session = Depends(deps.get_db)
):
    """
    특정 멤버의 새로운 위치를 생성합니다.
    """
    try:
        from sqlalchemy import text
        from datetime import datetime
        import logging
        
        # 디버그 로깅
        logging.info(f"Creating location for member {member_id}: {location_data}")
        
        # 멤버 ID 검증
        member_check_sql = text("SELECT COUNT(*) FROM member_t WHERE mt_idx = :member_id")
        member_result = db.execute(member_check_sql, {"member_id": member_id}).fetchone()
        if not member_result or member_result[0] == 0:
            raise HTTPException(status_code=404, detail=f"Member {member_id} not found")
        
        # 필수 필드 검증
        if not location_data.get('slt_title') or not location_data.get('slt_title').strip():
            raise HTTPException(status_code=400, detail="Location title (slt_title) is required")
        
        if not location_data.get('slt_add') or not location_data.get('slt_add').strip():
            raise HTTPException(status_code=400, detail="Location address (slt_add) is required")
        
        # 좌표 검증 및 기본값 설정
        try:
            slt_lat = float(location_data.get('slt_lat', 37.5665))
            slt_long = float(location_data.get('slt_long', 126.9780))
        except (ValueError, TypeError):
            slt_lat = 37.5665  # 서울시청 기본 좌표
            slt_long = 126.9780
        
        # 현재 시간
        current_time = datetime.now()
        
        # 그룹 정보 조회 (멤버가 속한 그룹 중 첫 번째)
        group_sql = text("""
            SELECT sgdt_idx, sgt_idx 
            FROM smap_group_detail_t 
            WHERE mt_idx = :member_id AND sgdt_show = 'Y' 
            ORDER BY sgdt_idx 
            LIMIT 1
        """)
        group_result = db.execute(group_sql, {"member_id": member_id}).fetchone()
        
        # 그룹 정보가 없으면 기본값 사용
        if group_result:
            sgdt_idx = group_result[0]
            sgt_idx = group_result[1]
        else:
            # 기본 그룹 정보 (필요시 수정)
            sgdt_idx = location_data.get('sgdt_idx', 641)
            sgt_idx = location_data.get('sgt_idx', 641)
        
        # SQL INSERT 실행
        sql = text("""
            INSERT INTO smap_location_t (
                insert_mt_idx, mt_idx, sgt_idx, sgdt_idx, 
                slt_title, slt_add, slt_lat, slt_long, 
                slt_show, slt_enter_alarm, slt_enter_chk, slt_wdate
            ) VALUES (
                :insert_mt_idx, :mt_idx, :sgt_idx, :sgdt_idx,
                :slt_title, :slt_add, :slt_lat, :slt_long,
                :slt_show, :slt_enter_alarm, :slt_enter_chk, :slt_wdate
            )
        """)
        
        params = {
            "insert_mt_idx": member_id,  # 생성한 멤버
            "mt_idx": member_id,         # 소유한 멤버
            "sgt_idx": sgt_idx,
            "sgdt_idx": sgdt_idx,
            "slt_title": str(location_data['slt_title']).strip()[:50],  # DB 컬럼 크기에 맞게 제한
            "slt_add": str(location_data['slt_add']).strip()[:100],     # DB 컬럼 크기에 맞게 제한
            "slt_lat": slt_lat,
            "slt_long": slt_long,
            "slt_show": location_data.get('slt_show', 'Y'),
            "slt_enter_alarm": location_data.get('slt_enter_alarm', 'Y'),
            "slt_enter_chk": location_data.get('slt_enter_chk', 'N'),
            "slt_wdate": current_time
        }
        
        logging.info(f"SQL parameters for member {member_id}: {params}")
        
        # SQL 실행
        result = db.execute(sql, params)
        db.commit()
        
        # 생성된 레코드 ID 가져오기
        if hasattr(result, 'lastrowid') and result.lastrowid:
            new_id = result.lastrowid
        else:
            # lastrowid가 없는 경우 직접 조회
            new_id_result = db.execute(text("SELECT LAST_INSERT_ID()")).fetchone()
            new_id = new_id_result[0] if new_id_result else None
        
        # 생성된 데이터 조회하여 반환
        if new_id:
            created_location_sql = text("""
                SELECT slt_idx, insert_mt_idx, mt_idx, sgt_idx, sgdt_idx,
                       slt_title, slt_add, slt_lat, slt_long, 
                       slt_show, slt_enter_alarm, slt_enter_chk, slt_wdate
                FROM smap_location_t 
                WHERE slt_idx = :new_id
            """)
            created_location = db.execute(created_location_sql, {"new_id": new_id}).fetchone()
            
            if created_location:
                return {
                    "success": True,
                    "message": f"Location created successfully for member {member_id}",
                    "member_id": member_id,
                    "slt_idx": new_id,
                    "data": {
                        "slt_idx": created_location[0],
                        "insert_mt_idx": created_location[1],
                        "mt_idx": created_location[2],
                        "sgt_idx": created_location[3],
                        "sgdt_idx": created_location[4],
                        "slt_title": created_location[5],
                        "slt_add": created_location[6],
                        "slt_lat": float(created_location[7]) if created_location[7] else None,
                        "slt_long": float(created_location[8]) if created_location[8] else None,
                        "slt_show": created_location[9],
                        "slt_enter_alarm": created_location[10],
                        "slt_enter_chk": created_location[11],
                        "slt_wdate": created_location[12].isoformat() if created_location[12] else None
                    }
                }
        
        # 기본 응답 (조회 실패 시)
        return {
            "success": True,
            "message": f"Location created successfully for member {member_id}",
            "member_id": member_id,
            "slt_idx": new_id,
            "data": params
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logging.error(f"Member location creation error for member {member_id}: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Location creation failed for member {member_id}: {str(e)}"
        )

 