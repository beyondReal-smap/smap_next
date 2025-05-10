from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.member import Member
from app.schemas.member import MemberCreate, MemberUpdate, MemberResponse
from typing import List
from datetime import datetime

router = APIRouter()

@router.get("/", response_model=List[MemberResponse])
def get_users(db: Session = Depends(deps.get_db), skip: int = 0, limit: int = 100):
    users = db.query(Member).offset(skip).limit(limit).all()
    return users

@router.post("/", response_model=MemberResponse)
def create_user(user: MemberCreate, db: Session = Depends(deps.get_db)):
    db_user = Member(**user.dict())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/{user_id}", response_model=MemberResponse)
def get_user(user_id: int, db: Session = Depends(deps.get_db)):
    user = db.query(Member).filter(Member.mt_idx == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}", response_model=MemberResponse)
def update_user(user_id: int, user: MemberUpdate, db: Session = Depends(deps.get_db)):
    db_user = db.query(Member).filter(Member.mt_idx == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    for key, value in user.dict(exclude_unset=True).items():
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.delete("/{user_id}", response_model=MemberResponse)
def delete_user(user_id: int, db: Session = Depends(deps.get_db)):
    db_user = db.query(Member).filter(Member.mt_idx == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(db_user)
    db.commit()
    return db_user

@router.get("/email/{email}")
async def get_user_by_email(email: str, db: Session = Depends(deps.get_db)):
    try:
        user = Member.find_by_email(db, email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/token/{token}")
async def get_user_by_token(token: str, db: Session = Depends(deps.get_db)):
    try:
        user = Member.find_by_token(db, token)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recent/signin/3h")
async def get_recent_signin_3h(db: Session = Depends(deps.get_db)):
    try:
        users = Member.get_sign_in_3(db)
        return {"users": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recent/signin/24h")
async def get_recent_signin_24h(db: Session = Depends(deps.get_db)):
    try:
        users = Member.get_sign_in_24(db)
        return {"users": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/not-joined/11days")
async def get_not_joined_11days(db: Session = Depends(deps.get_db)):
    try:
        users = Member.get_not_join_group_11(db)
        return {"users": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 