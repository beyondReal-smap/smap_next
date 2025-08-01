from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db.session import get_db
from ..crud.notice import get_notice_crud
from ..schemas.notice import (
    NoticeResponse, 
    NoticeListResponse, 
    NoticeListWithPagination,
    NoticeCreate, 
    NoticeUpdate
)

router = APIRouter(prefix="/api/notices", tags=["notices"])

@router.get("/", response_model=NoticeListWithPagination)
async def get_notices(
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    show_only: bool = Query(True, description="노출된 공지사항만 조회"),
    db: Session = Depends(get_db)
):
    """
    공지사항 목록 조회 (페이지네이션)
    
    - **page**: 페이지 번호 (1부터 시작)
    - **size**: 페이지 크기 (1-100)
    - **show_only**: 노출된 공지사항만 조회할지 여부
    """
    crud = get_notice_crud(db)
    result = crud.get_notices_with_pagination(
        page=page, 
        size=size, 
        show_only=show_only
    )
    
    return NoticeListWithPagination(
        notices=[NoticeListResponse.model_validate(notice) for notice in result["notices"]],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        total_pages=result["total_pages"]
    )

@router.get("/search", response_model=List[NoticeListResponse])
async def search_notices(
    keyword: str = Query(..., min_length=1, description="검색 키워드"),
    skip: int = Query(0, ge=0, description="건너뛸 개수"),
    limit: int = Query(20, ge=1, le=100, description="조회할 개수"),
    show_only: bool = Query(True, description="노출된 공지사항만 조회"),
    db: Session = Depends(get_db)
):
    """
    공지사항 검색
    
    - **keyword**: 제목 또는 내용에서 검색할 키워드
    - **skip**: 건너뛸 개수
    - **limit**: 조회할 개수
    - **show_only**: 노출된 공지사항만 조회할지 여부
    """
    crud = get_notice_crud(db)
    notices = crud.search_notices(
        keyword=keyword,
        skip=skip,
        limit=limit,
        show_only=show_only
    )
    
    return [NoticeListResponse.model_validate(notice) for notice in notices]

@router.get("/{notice_id}", response_model=NoticeResponse)
async def get_notice(
    notice_id: int,
    increment_hit: bool = Query(True, description="조회수 증가 여부"),
    db: Session = Depends(get_db)
):
    """
    공지사항 상세 조회
    
    - **notice_id**: 공지사항 ID
    - **increment_hit**: 조회수를 증가시킬지 여부
    """
    crud = get_notice_crud(db)
    
    if increment_hit:
        notice = crud.get_notice_and_increment_hit(notice_id)
    else:
        notice = crud.get_notice(notice_id)
    
    if not notice:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    
    return NoticeResponse.model_validate(notice)

@router.post("/", response_model=NoticeResponse)
async def create_notice(
    notice: NoticeCreate,
    db: Session = Depends(get_db)
):
    """
    공지사항 생성 (관리자 전용)
    
    - **notice**: 생성할 공지사항 정보
    """
    crud = get_notice_crud(db)
    db_notice = crud.create_notice(notice)
    return NoticeResponse.model_validate(db_notice)

@router.put("/{notice_id}", response_model=NoticeResponse)
async def update_notice(
    notice_id: int,
    notice: NoticeUpdate,
    db: Session = Depends(get_db)
):
    """
    공지사항 수정 (관리자 전용)
    
    - **notice_id**: 수정할 공지사항 ID
    - **notice**: 수정할 공지사항 정보
    """
    crud = get_notice_crud(db)
    db_notice = crud.update_notice(notice_id, notice)
    
    if not db_notice:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    
    return NoticeResponse.model_validate(db_notice)

@router.delete("/{notice_id}")
async def delete_notice(
    notice_id: int,
    db: Session = Depends(get_db)
):
    """
    공지사항 삭제 (관리자 전용)
    
    - **notice_id**: 삭제할 공지사항 ID
    """
    crud = get_notice_crud(db)
    success = crud.delete_notice(notice_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    
    return {"message": "공지사항이 삭제되었습니다."}

@router.patch("/{notice_id}/hide", response_model=NoticeResponse)
async def hide_notice(
    notice_id: int,
    db: Session = Depends(get_db)
):
    """
    공지사항 숨김 처리 (관리자 전용)
    
    - **notice_id**: 숨길 공지사항 ID
    """
    crud = get_notice_crud(db)
    db_notice = crud.hide_notice(notice_id)
    
    if not db_notice:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    
    return NoticeResponse.model_validate(db_notice)

@router.patch("/{notice_id}/show", response_model=NoticeResponse)
async def show_notice(
    notice_id: int,
    db: Session = Depends(get_db)
):
    """
    공지사항 노출 처리 (관리자 전용)
    
    - **notice_id**: 노출할 공지사항 ID
    """
    crud = get_notice_crud(db)
    db_notice = crud.show_notice(notice_id)
    
    if not db_notice:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    
    return NoticeResponse.model_validate(db_notice) 