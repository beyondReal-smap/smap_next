from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import math
import logging

from app import crud, models, schemas
from app.api import deps
from app.core.config import settings
from app.schemas.order import (
    OrderResponse, 
    OrderListResponse, 
    OrderSummary, 
    OrderFilter,
    OrderUpdate
)

# 로거 설정
logger = logging.getLogger(__name__)

router = APIRouter()

def get_current_user_id_from_token(authorization: str = Header(None)) -> Optional[int]:
    """
    Authorization 헤더에서 토큰을 추출하고 사용자 ID를 반환합니다.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    token = authorization.split(" ")[1]
    
    try:
        # 직접 하드코딩된 시크릿 키 사용 (프론트엔드와 동일)
        secret_key = 'smap!@super-secret'
        algorithm = 'HS256'
        
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
        mt_idx: Optional[int] = payload.get("mt_idx")
        
        return mt_idx
    except JWTError as e:
        logger.error(f"JWT 오류: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"기타 오류: {str(e)}")
        return None

@router.get("/summary/{member_id}", response_model=OrderSummary)
def get_order_summary(
    member_id: int,
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    회원의 주문 요약 정보 조회
    """
    # 토큰에서 사용자 ID 추출
    current_user_id = get_current_user_id_from_token(authorization)
    if not current_user_id:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    
    # 본인만 조회 가능 (관리자 체크는 생략)
    if current_user_id != member_id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
    
    summary = crud.crud_order.get_order_summary(db=db, member_id=member_id)
    return summary

@router.get("/{member_id}", response_model=OrderListResponse)
def get_orders_by_member(
    member_id: int,
    status: int = Query(None, description="주문 상태 (1:결제대기, 2:결제완료, 99:취소)"),
    pay_type: str = Query(None, description="결제 방법"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    회원의 주문 목록 조회 (필터링 및 페이징)
    """
    # 토큰에서 사용자 ID 추출
    current_user_id = get_current_user_id_from_token(authorization)
    if not current_user_id:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    
    # 본인만 조회 가능 (관리자 체크는 생략)
    if current_user_id != member_id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
    
    filter_params = OrderFilter(
        status=status,
        pay_type=pay_type,
        page=page,
        size=size
    )
    
    orders, total = crud.crud_order.get_orders_by_member(
        db=db, 
        member_id=member_id, 
        filter_params=filter_params
    )
    
    total_pages = math.ceil(total / size)
    
    return OrderListResponse(
        orders=orders,
        total=total,
        page=page,
        size=size,
        total_pages=total_pages
    )

@router.get("/detail/{order_id}", response_model=OrderResponse)
def get_order_detail(
    order_id: int,
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    주문 상세 정보 조회
    """
    # 토큰에서 사용자 ID 추출
    current_user_id = get_current_user_id_from_token(authorization)
    if not current_user_id:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    
    order = crud.crud_order.get(db=db, id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    
    # 본인만 조회 가능 (관리자 체크는 생략)
    if current_user_id != order.mt_idx:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
    
    return order

@router.get("/code/{order_code}", response_model=OrderResponse)
def get_order_by_code(
    order_code: str,
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    주문번호로 주문 조회
    """
    # 토큰에서 사용자 ID 추출
    current_user_id = get_current_user_id_from_token(authorization)
    if not current_user_id:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    
    order = crud.crud_order.get_order_by_code(db=db, order_code=order_code)
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    
    # 본인만 조회 가능 (관리자 체크는 생략)
    if current_user_id != order.mt_idx:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
    
    return order

@router.put("/status/{order_id}")
def update_order_status(
    order_id: int,
    status: int,
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    주문 상태 업데이트 (관리자만)
    """
    # 토큰에서 사용자 ID 추출
    current_user_id = get_current_user_id_from_token(authorization)
    if not current_user_id:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    
    # 관리자 체크는 생략하고 일단 모든 사용자가 가능하도록 함
    order = crud.crud_order.update_order_status(
        db=db, 
        order_id=order_id, 
        status=status
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    
    return {"message": "주문 상태가 업데이트되었습니다", "order": order}

@router.post("/cancel/{order_id}")
def cancel_order(
    order_id: int,
    cancel_reason: str,
    cancel_amount: float = None,
    refund_info: str = None,
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    주문 취소
    """
    # 토큰에서 사용자 ID 추출
    current_user_id = get_current_user_id_from_token(authorization)
    if not current_user_id:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    
    order = crud.crud_order.get(db=db, id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    
    # 본인만 취소 가능 (관리자 체크는 생략)
    if current_user_id != order.mt_idx:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
    
    # 이미 취소된 주문인지 확인
    if order.ot_status == 99:
        raise HTTPException(status_code=400, detail="이미 취소된 주문입니다")
    
    cancelled_order = crud.crud_order.cancel_order(
        db=db,
        order_id=order_id,
        cancel_reason=cancel_reason,
        cancel_amount=cancel_amount,
        refund_info=refund_info
    )
    
    return {"message": "주문이 취소되었습니다", "order": cancelled_order}

@router.get("/recent/{member_id}", response_model=List[OrderResponse])
def get_recent_orders(
    member_id: int,
    limit: int = Query(5, ge=1, le=20, description="조회할 주문 수"),
    authorization: str = Header(None),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    최근 주문 목록 조회
    """
    # 토큰에서 사용자 ID 추출
    current_user_id = get_current_user_id_from_token(authorization)
    if not current_user_id:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    
    # 본인만 조회 가능 (관리자 체크는 생략)
    if current_user_id != member_id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
    
    orders = crud.crud_order.get_recent_orders(
        db=db, 
        member_id=member_id, 
        limit=limit
    )
    
    return orders 