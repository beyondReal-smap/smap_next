from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import math

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

router = APIRouter()

@router.get("/summary/{member_id}", response_model=OrderSummary)
def get_order_summary(
    member_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.Member = Depends(deps.get_current_active_user),
) -> Any:
    """
    회원의 주문 요약 정보 조회
    """
    # 본인 또는 관리자만 조회 가능
    if current_user.mt_idx != member_id and not current_user.mt_level == 'admin':
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
    db: Session = Depends(deps.get_db),
    current_user: models.Member = Depends(deps.get_current_active_user),
) -> Any:
    """
    회원의 주문 목록 조회 (필터링 및 페이징)
    """
    # 본인 또는 관리자만 조회 가능
    if current_user.mt_idx != member_id and not current_user.mt_level == 'admin':
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
    db: Session = Depends(deps.get_db),
    current_user: models.Member = Depends(deps.get_current_active_user),
) -> Any:
    """
    주문 상세 정보 조회
    """
    order = crud.crud_order.get(db=db, id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    
    # 본인 또는 관리자만 조회 가능
    if current_user.mt_idx != order.mt_idx and not current_user.mt_level == 'admin':
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
    
    return order

@router.get("/code/{order_code}", response_model=OrderResponse)
def get_order_by_code(
    order_code: str,
    db: Session = Depends(deps.get_db),
    current_user: models.Member = Depends(deps.get_current_active_user),
) -> Any:
    """
    주문번호로 주문 조회
    """
    order = crud.crud_order.get_order_by_code(db=db, order_code=order_code)
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    
    # 본인 또는 관리자만 조회 가능
    if current_user.mt_idx != order.mt_idx and not current_user.mt_level == 'admin':
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
    
    return order

@router.put("/status/{order_id}")
def update_order_status(
    order_id: int,
    status: int,
    db: Session = Depends(deps.get_db),
    current_user: models.Member = Depends(deps.get_current_active_user),
) -> Any:
    """
    주문 상태 업데이트 (관리자만)
    """
    if not current_user.mt_level == 'admin':
        raise HTTPException(status_code=403, detail="관리자만 접근 가능합니다")
    
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
    db: Session = Depends(deps.get_db),
    current_user: models.Member = Depends(deps.get_current_active_user),
) -> Any:
    """
    주문 취소
    """
    order = crud.crud_order.get(db=db, id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다")
    
    # 본인 또는 관리자만 취소 가능
    if current_user.mt_idx != order.mt_idx and not current_user.mt_level == 'admin':
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
    db: Session = Depends(deps.get_db),
    current_user: models.Member = Depends(deps.get_current_active_user),
) -> Any:
    """
    최근 주문 목록 조회
    """
    # 본인 또는 관리자만 조회 가능
    if current_user.mt_idx != member_id and not current_user.mt_level == 'admin':
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
    
    orders = crud.crud_order.get_recent_orders(
        db=db, 
        member_id=member_id, 
        limit=limit
    )
    
    return orders 