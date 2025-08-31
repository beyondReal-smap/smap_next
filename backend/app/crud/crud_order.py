from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, extract
from datetime import datetime, timedelta
import math

from app.models.order import Order
from app.schemas.order import OrderCreate, OrderUpdate, OrderFilter, OrderSummary

class CRUDOrder:
    def __init__(self, model: type[Order]):
        self.model = model

    def get(self, db: Session, id: int) -> Optional[Order]:
        """ID로 주문 조회"""
        return db.query(self.model).filter(self.model.ot_idx == id).first()

    def get_multi(
        self, 
        db: Session, 
        *, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[Order]:
        """주문 목록 조회"""
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: OrderCreate) -> Order:
        """주문 생성"""
        db_obj = self.model(**obj_in.dict())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, 
        db: Session, 
        *, 
        db_obj: Order, 
        obj_in: OrderUpdate
    ) -> Order:
        """주문 정보 수정"""
        update_data = obj_in.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        db_obj.ot_udate = datetime.now()
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, *, id: int) -> Order:
        """주문 삭제"""
        obj = db.query(self.model).get(id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj

    def get_orders_by_member(
        self, 
        db: Session, 
        member_id: int,
        filter_params: OrderFilter
    ) -> tuple[List[Order], int]:
        """회원의 주문 목록 조회 (필터링 및 페이징)"""
        query = db.query(Order).filter(Order.mt_idx == member_id)
        
        # 필터 적용
        if filter_params.status is not None:
            query = query.filter(Order.ot_status == filter_params.status)
        
        if filter_params.pay_type:
            query = query.filter(Order.ot_pay_type == filter_params.pay_type)
        
        if filter_params.start_date:
            query = query.filter(Order.ot_wdate >= filter_params.start_date)
        
        if filter_params.end_date:
            query = query.filter(Order.ot_wdate <= filter_params.end_date)
        
        # 노출 여부 필터 (Y인 것만)
        query = query.filter(Order.ot_show == 'Y')
        
        # 총 개수
        total = query.count()
        
        # 페이징 및 정렬
        orders = query.order_by(Order.ot_wdate.desc()).offset(
            (filter_params.page - 1) * filter_params.size
        ).limit(filter_params.size).all()
        
        return orders, total
    
    def get_order_summary(self, db: Session, member_id: int) -> OrderSummary:
        """회원의 주문 요약 정보 조회"""
        # 기본 쿼리
        base_query = db.query(Order).filter(
            and_(Order.mt_idx == member_id, Order.ot_show == 'Y')
        )
        
        # 전체 주문 수
        total_orders = base_query.count()
        
        # 상태별 주문 수
        completed_orders = base_query.filter(Order.ot_status == 2).count()
        pending_orders = base_query.filter(Order.ot_status == 1).count()
        cancelled_orders = base_query.filter(Order.ot_status == 99).count()
        
        # 총 결제 금액 (완료된 주문만)
        total_amount_result = base_query.filter(Order.ot_status == 2).with_entities(
            func.sum(Order.ot_price)
        ).scalar()
        total_amount = float(total_amount_result) if total_amount_result else 0.0
        
        # 이번 달 결제 금액
        now = datetime.now()
        start_of_month = datetime(now.year, now.month, 1)
        this_month_result = base_query.filter(
            and_(
                Order.ot_status == 2,
                Order.ot_pdate >= start_of_month
            )
        ).with_entities(func.sum(Order.ot_price)).scalar()
        this_month_amount = float(this_month_result) if this_month_result else 0.0
        
        # 평균 결제 금액
        average_amount = total_amount / completed_orders if completed_orders > 0 else 0.0
        
        return OrderSummary(
            total_orders=total_orders,
            total_amount=total_amount,
            completed_orders=completed_orders,
            pending_orders=pending_orders,
            cancelled_orders=cancelled_orders,
            this_month_amount=this_month_amount,
            average_amount=average_amount
        )
    
    def get_order_by_code(self, db: Session, order_code: str) -> Optional[Order]:
        """주문번호로 주문 조회"""
        return db.query(Order).filter(Order.ot_code == order_code).first()
    
    def get_order_by_imp_uid(self, db: Session, imp_uid: str) -> Optional[Order]:
        """포트원 고유번호로 주문 조회"""
        return db.query(Order).filter(Order.ot_rsp_imp_uid == imp_uid).first()
    
    def update_order_status(
        self, 
        db: Session, 
        order_id: int, 
        status: int,
        update_date: Optional[datetime] = None
    ) -> Optional[Order]:
        """주문 상태 업데이트"""
        order = db.query(Order).filter(Order.ot_idx == order_id).first()
        if order:
            order.ot_status = status
            if update_date:
                if status == 2:  # 결제완료
                    order.ot_pdate = update_date
                elif status == 99:  # 취소
                    order.ot_ccdate = update_date
            order.ot_udate = datetime.now()
            db.commit()
            db.refresh(order)
        return order
    
    def cancel_order(
        self, 
        db: Session, 
        order_id: int,
        cancel_reason: str,
        cancel_amount: Optional[float] = None,
        refund_info: Optional[str] = None
    ) -> Optional[Order]:
        """주문 취소"""
        order = db.query(Order).filter(Order.ot_idx == order_id).first()
        if order:
            order.ot_status = 99  # 취소 상태
            order.ct_cancel_reson = cancel_reason
            if cancel_amount:
                order.ct_cancel_amount = cancel_amount
            if refund_info:
                order.ot_refund_info = refund_info
            order.ot_ccdate = datetime.now()
            order.ot_udate = datetime.now()
            db.commit()
            db.refresh(order)
        return order
    
    def get_recent_orders(
        self, 
        db: Session, 
        member_id: int, 
        limit: int = 5
    ) -> List[Order]:
        """최근 주문 목록 조회"""
        return db.query(Order).filter(
            and_(Order.mt_idx == member_id, Order.ot_show == 'Y')
        ).order_by(Order.ot_wdate.desc()).limit(limit).all()

crud_order = CRUDOrder(Order) 