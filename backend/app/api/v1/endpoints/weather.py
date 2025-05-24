from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from app.api import deps
from app.models.member import Member
from app.core.config import settings
from datetime import datetime

router = APIRouter()

def get_current_user_id_from_token(authorization: str = Header(None)) -> Optional[int]:
    """
    Authorization 헤더에서 토큰을 추출하고 사용자 ID를 반환합니다.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        mt_idx: Optional[int] = payload.get("mt_idx")
        return mt_idx
    except JWTError:
        return None

@router.get("/current")
def get_current_weather(
    lat: Optional[float] = Query(None, description="위도"),
    lng: Optional[float] = Query(None, description="경도"),
    db: Session = Depends(deps.get_db),
    authorization: str = Header(None)
):
    """
    현재 날씨 정보를 조회합니다.
    home/page.tsx의 날씨 정보 가져오기에서 사용
    """
    try:
        # 토큰에서 사용자 ID 추출
        user_id = get_current_user_id_from_token(authorization)
        
        # 사용자 정보가 있으면 사용자의 날씨 정보 우선 사용
        if user_id:
            user = db.query(Member).filter(Member.mt_idx == user_id).first()
            if user and user.mt_weather_sky is not None and user.mt_weather_tmx is not None:
                return {
                    "success": True,
                    "data": {
                        "sky": str(user.mt_weather_sky),
                        "temp_max": user.mt_weather_tmx,
                        "temp_min": user.mt_weather_tmn or user.mt_weather_tmx - 5,
                        "pop": user.mt_weather_pop or "20",
                        "location": f"{user.mt_sido} {user.mt_gu}" if user.mt_sido and user.mt_gu else "현재 위치",
                        "updated_at": user.mt_weather_date.isoformat() if user.mt_weather_date else datetime.utcnow().isoformat()
                    }
                }
        
        # TODO: 실제 날씨 API 연동 (위도, 경도 기반)
        # 예: OpenWeatherMap, 기상청 API 등
        # if lat and lng:
        #     weather_data = call_weather_api(lat, lng)
        #     return weather_data
        
        # 기본 날씨 정보 반환 (임시 데이터)
        default_weather = {
            "success": True,
            "data": {
                "sky": "8",  # 맑음
                "temp_max": 25,
                "temp_min": 18,
                "pop": "20",  # 강수확률 20%
                "location": "현재 위치",
                "updated_at": datetime.utcnow().isoformat()
            }
        }
        
        return default_weather
        
    except Exception as e:
        return {
            "success": False,
            "message": "날씨 정보를 가져올 수 없습니다.",
            "data": {
                "sky": "default",
                "temp_max": None,
                "temp_min": None,
                "pop": "0",
                "location": "정보 없음",
                "updated_at": datetime.utcnow().isoformat()
            }
        }

@router.get("/member/{member_id}")
def get_member_weather(
    member_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    특정 멤버의 날씨 정보를 조회합니다.
    home/page.tsx의 멤버별 날씨 정보에서 사용
    """
    try:
        member = db.query(Member).filter(Member.mt_idx == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        weather_data = {
            "mt_idx": member.mt_idx,
            "mt_name": member.mt_name,
            "sky": str(member.mt_weather_sky) if member.mt_weather_sky is not None else "default",
            "temp_max": member.mt_weather_tmx,
            "temp_min": member.mt_weather_tmn,
            "pop": member.mt_weather_pop or "0",
            "location": f"{member.mt_sido} {member.mt_gu}" if member.mt_sido and member.mt_gu else "정보 없음",
            "updated_at": member.mt_weather_date.isoformat() if member.mt_weather_date else None
        }
        
        return weather_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="날씨 정보를 가져올 수 없습니다.")

@router.put("/member/{member_id}")
def update_member_weather(
    member_id: int,
    weather_data: dict,
    db: Session = Depends(deps.get_db)
):
    """
    특정 멤버의 날씨 정보를 업데이트합니다.
    """
    try:
        member = db.query(Member).filter(Member.mt_idx == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        # 날씨 정보 업데이트
        if "sky" in weather_data:
            member.mt_weather_sky = int(weather_data["sky"]) if weather_data["sky"].isdigit() else None
        if "temp_max" in weather_data:
            member.mt_weather_tmx = weather_data["temp_max"]
        if "temp_min" in weather_data:
            member.mt_weather_tmn = weather_data["temp_min"]
        if "pop" in weather_data:
            member.mt_weather_pop = weather_data["pop"]
        
        member.mt_weather_date = datetime.utcnow()
        
        db.add(member)
        db.commit()
        db.refresh(member)
        
        return {
            "success": True,
            "message": "날씨 정보가 업데이트되었습니다.",
            "data": {
                "mt_idx": member.mt_idx,
                "sky": str(member.mt_weather_sky) if member.mt_weather_sky is not None else "default",
                "temp_max": member.mt_weather_tmx,
                "temp_min": member.mt_weather_tmn,
                "pop": member.mt_weather_pop or "0",
                "updated_at": member.mt_weather_date.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="날씨 정보 업데이트에 실패했습니다.") 