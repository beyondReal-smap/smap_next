import traceback
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from ....db.session import get_db
from ....schemas.location import LocationCreate, LocationUpdate, LocationResponse
from ....crud import location as location_crud

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/location")
async def handle_location_request(
    request: Request,
    db: Session = Depends(get_db)
):
    print("==== FastAPI /api/location 진입 ====")
    try:
        body = await request.json()
        logger.info(f"Received location request: {body}")
        act = body.get("act")
        
        if not act:
            logger.error("No 'act' parameter provided in request")
            raise HTTPException(status_code=400, detail="'act' parameter is required")
        
        if act == "location_add":
            try:
                location_data = LocationCreate(**body)
                result = await location_crud.create_location(db, location_data)
                logger.info(f"Location added successfully: {result}")
                return {"result": "Y", "data": result}
            except Exception as e:
                logger.error(f"Error adding location: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
            
        elif act == "location_update":
            try:
                location_data = LocationUpdate(**body)
                result = await location_crud.update_location(db, location_data)
                logger.info(f"Location updated successfully: {result}")
                return {"result": "Y", "data": result}
            except Exception as e:
                logger.error(f"Error updating location: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
            
        elif act == "location_delete":
            try:
                location_id = body.get("id")
                if not location_id:
                    raise HTTPException(status_code=400, detail="Location ID is required")
                result = await location_crud.delete_location(db, location_id)
                logger.info(f"Location deleted successfully: {result}")
                return {"result": "Y", "data": result}
            except Exception as e:
                logger.error(f"Error deleting location: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
            
        elif act == "my_location_list":
            try:
                result = await location_crud.get_user_locations(db)
                logger.info(f"Retrieved user locations: {result}")
                return {"result": "Y", "data": result}
            except Exception as e:
                logger.error(f"Error getting user locations: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
            
        elif act == "group_member_list":
            try:
                result = await location_crud.get_group_members(db)
                logger.info(f"Retrieved group members: {result}")
                return {"result": "Y", "data": result}
            except Exception as e:
                logger.error(f"Error getting group members: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(status_code=500, detail=str(e))
            
        else:
            logger.error(f"Invalid act value: {act}")
            raise HTTPException(status_code=400, detail=f"Invalid act value: {act}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in location request: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e)) 