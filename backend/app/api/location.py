from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models import location as location_model
from app.models import member as member_model
from app.schemas import location as location_schema
from datetime import datetime
import traceback

router = APIRouter()

def map_location_data(data: dict) -> dict:
    """클라이언트 데이터를 Location 모델 형식으로 변환"""
    mapping = {
        'id': 'slt_idx',
        'name': 'slt_title',
        'address': 'slt_add',
        'notifications': 'slt_enter_alarm',
        'favorite': 'slt_show'
    }
    
    mapped_data = {}
    for client_key, model_key in mapping.items():
        if client_key in data:
            mapped_data[model_key] = data[client_key]
    
    # coordinates 처리
    if 'coordinates' in data:
        mapped_data['slt_long'] = data['coordinates'][0]
        mapped_data['slt_lat'] = data['coordinates'][1]
    
    return mapped_data

@router.post("/api/location")
async def location_handler(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        act = data.get("act")
        print(f"[API CALL] /api/location act={act} data={data}")
        
        if act == "my_location_list":
            try:
                locations = db.query(location_model.Location).all()
                return {"result": "Y", "data": [{
                    "id": str(loc.slt_idx),
                    "name": loc.slt_title,
                    "address": loc.slt_add,
                    "coordinates": [float(loc.slt_long), float(loc.slt_lat)],
                    "notifications": loc.slt_enter_alarm == 'Y',
                    "favorite": loc.slt_show == 'Y'
                } for loc in locations]}
            except Exception as e:
                print(f"Error in my_location_list: {str(e)}")
                traceback.print_exc()
                return {"result": "E", "error": str(e)}

        elif act == "location_add":
            try:
                new_location = location_model.Location(
                    slt_title=data.get("name"),
                    slt_add=data.get("address"),
                    slt_long=str(data.get("coordinates")[0]),
                    slt_lat=str(data.get("coordinates")[1]),
                    slt_enter_alarm='Y' if data.get("notifications") else 'N',
                    slt_show='Y' if data.get("favorite") else 'N'
                )
                db.add(new_location)
                db.commit()
                db.refresh(new_location)
                return {"result": "Y", "data": {"id": str(new_location.slt_idx)}}
            except Exception as e:
                db.rollback()
                print(f"Error in location_add: {str(e)}")
                traceback.print_exc()
                return {"result": "E", "error": str(e)}

        elif act == "location_update":
            try:
                location = db.query(location_model.Location).filter(location_model.Location.slt_idx == data.get("id")).first()
                if location:
                    location.slt_title = data.get("name")
                    location.slt_add = data.get("address")
                    location.slt_long = str(data.get("coordinates")[0])
                    location.slt_lat = str(data.get("coordinates")[1])
                    location.slt_enter_alarm = 'Y' if data.get("notifications") else 'N'
                    location.slt_show = 'Y' if data.get("favorite") else 'N'
                    db.commit()
                    return {"result": "Y"}
                return {"result": "E", "error": "Location not found"}
            except Exception as e:
                db.rollback()
                print(f"Error in location_update: {str(e)}")
                traceback.print_exc()
                return {"result": "E", "error": str(e)}

        elif act == "location_delete":
            try:
                location = db.query(location_model.Location).filter(location_model.Location.slt_idx == data.get("id")).first()
                if location:
                    db.delete(location)
                    db.commit()
                    return {"result": "Y"}
                return {"result": "E", "error": "Location not found"}
            except Exception as e:
                db.rollback()
                print(f"Error in location_delete: {str(e)}")
                traceback.print_exc()
                return {"result": "E", "error": str(e)}

        elif act == "group_member_list":
            try:
                members = db.query(member_model.Member).all()
                return {"result": "Y", "data": [{
                    "id": str(member.mem_idx),
                    "name": member.mem_name,
                    "profile": member.mem_profile,
                    "isSelected": False,
                    "photo": member.mem_photo,
                    "location": [float(member.mem_long), float(member.mem_lat)] if member.mem_long and member.mem_lat else None,
                    "schedules": [],
                    "savedLocations": []
                } for member in members]}
            except Exception as e:
                print(f"Error in group_member_list: {str(e)}")
                traceback.print_exc()
                return {"result": "E", "error": str(e)}

        return {"result": "E", "error": "Invalid action"}
    except Exception as e:
        print(f"Error in location_handler: {str(e)}")
        traceback.print_exc()
        return {"result": "E", "error": str(e)} 