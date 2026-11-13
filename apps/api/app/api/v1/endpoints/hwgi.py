"""
한화 디지털화상창구 방문 점검 시스템 API
- GET  /all-data             전체 점검 데이터 조회
- POST /bulk-save            점검 데이터 일괄 저장
- POST /upload-photo         점검 사진 업로드
- DELETE /delete-photo/{id}  점검 사진 삭제
- POST /generate-report      AI 보고서 생성 (OpenAI 프록시)
"""

import base64
import logging
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# 경로 설정
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent  # backend/
UPLOAD_BASE = BACKEND_DIR / "storage" / "uploads" / "hwgi"
UPLOAD_BASE.mkdir(parents=True, exist_ok=True)


def _absolutize_photo_url(url: Optional[str]) -> Optional[str]:
    """DB에 저장된 상대 경로 이미지 URL에 공개 API base를 prefix로 붙여 절대 URL로 만든다.
    Vercel 등 외부 도메인 프론트엔드에서 <img src>로 바로 쓰기 위함.
    이미 http(s)://로 시작하거나 base가 비어있으면 원본을 그대로 반환한다."""
    if not url:
        return url
    if url.startswith(("http://", "https://")):
        return url
    base = (settings.PUBLIC_API_BASE_URL or "").rstrip("/")
    if not base:
        return url
    return f"{base}{url if url.startswith('/') else '/' + url}"

# ---------------------------------------------------------------------------
# Pydantic 스키마
# ---------------------------------------------------------------------------

class InspectionItem(BaseModel):
    item_id: str
    category: str
    status: Optional[str] = None
    memo: Optional[str] = None

class BulkSaveRequest(BaseModel):
    bt_idx: int
    inspector: Optional[str] = None
    visitor: Optional[str] = None
    fp_interviewee: Optional[str] = None
    opinion_interviewee: Optional[str] = None
    items: list[InspectionItem] = []

class UploadPhotoRequest(BaseModel):
    bt_idx: int
    item_id: str
    image_base64: str

class GenerateReportRequest(BaseModel):
    branch_name: str
    branch_address: str
    prompt_data: str


# ---------------------------------------------------------------------------
# 1) GET /all-data
# ---------------------------------------------------------------------------
@router.get("/all-data")
def get_all_data(db: Session = Depends(get_db)):
    """전체 점검 데이터를 지점별로 조회"""
    try:
        # 점검 기록
        inspections = db.execute(text(
            "SELECT it_idx, bt_idx, it_inspector, it_visitor, "
            "it_fp_interviewee, it_opinion_interviewee "
            "FROM hwgi_inspection_t"
        )).fetchall()

        # 점검 항목
        items = db.execute(text(
            "SELECT ii_idx, it_idx, bt_idx, ii_category, ii_item_id, ii_status, ii_memo "
            "FROM hwgi_inspection_item_t"
        )).fetchall()

        # 사진
        photos = db.execute(text(
            "SELECT ip_idx, ii_item_id, bt_idx, ip_file_path "
            "FROM hwgi_inspection_photo_t"
        )).fetchall()

        # 지점별로 데이터 조립
        data: dict = {}

        for insp in inspections:
            bid = str(insp[1])  # bt_idx
            data.setdefault(bid, {})
            if insp[2]:
                data[bid]["inspectorName"] = insp[2]
            if insp[3]:
                data[bid]["visitorName"] = insp[3]
            if insp[4]:
                data[bid]["fpInterviewee"] = insp[4]
            if insp[5]:
                data[bid]["opinionInterviewee"] = insp[5]

        for item in items:
            bid = str(item[2])  # bt_idx
            item_id = item[4]   # ii_item_id
            data.setdefault(bid, {})
            data[bid][item_id] = {
                "status": item[5],
                "memo": item[6],
            }

        # 사진을 해당 아이템에 추가
        for photo in photos:
            bid = str(photo[2])
            item_id = photo[1]
            data.setdefault(bid, {})
            data[bid].setdefault(item_id, {})
            data[bid][item_id].setdefault("photos", [])
            data[bid][item_id]["photos"].append({
                "ip_idx": photo[0],
                "url": _absolutize_photo_url(photo[3]),
            })

        return {"success": True, "data": data}

    except Exception as e:
        logger.error(f"[hwgi] all-data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 2) POST /bulk-save
# ---------------------------------------------------------------------------
@router.post("/bulk-save")
def bulk_save(req: BulkSaveRequest, db: Session = Depends(get_db)):
    """점검 데이터를 일괄 저장 (upsert)"""
    try:
        # inspection 레코드 upsert
        existing = db.execute(
            text("SELECT it_idx FROM hwgi_inspection_t WHERE bt_idx = :bid"),
            {"bid": req.bt_idx},
        ).fetchone()

        if existing:
            it_idx = existing[0]
            db.execute(text(
                "UPDATE hwgi_inspection_t SET "
                "it_inspector = :inspector, it_visitor = :visitor, "
                "it_fp_interviewee = :fp, it_opinion_interviewee = :op, "
                "it_date = :today "
                "WHERE it_idx = :id"
            ), {
                "inspector": req.inspector,
                "visitor": req.visitor,
                "fp": req.fp_interviewee,
                "op": req.opinion_interviewee,
                "today": date.today(),
                "id": it_idx,
            })
        else:
            result = db.execute(text(
                "INSERT INTO hwgi_inspection_t "
                "(bt_idx, it_inspector, it_visitor, it_fp_interviewee, it_opinion_interviewee, it_date) "
                "VALUES (:bid, :inspector, :visitor, :fp, :op, :today)"
            ), {
                "bid": req.bt_idx,
                "inspector": req.inspector,
                "visitor": req.visitor,
                "fp": req.fp_interviewee,
                "op": req.opinion_interviewee,
                "today": date.today(),
            })
            it_idx = result.lastrowid

        # 항목별 upsert
        for item in req.items:
            existing_item = db.execute(text(
                "SELECT ii_idx FROM hwgi_inspection_item_t "
                "WHERE it_idx = :it_idx AND ii_item_id = :item_id"
            ), {"it_idx": it_idx, "item_id": item.item_id}).fetchone()

            if existing_item:
                db.execute(text(
                    "UPDATE hwgi_inspection_item_t SET "
                    "ii_status = :status, ii_memo = :memo, ii_category = :cat "
                    "WHERE ii_idx = :id"
                ), {
                    "status": item.status,
                    "memo": item.memo,
                    "cat": item.category,
                    "id": existing_item[0],
                })
            else:
                db.execute(text(
                    "INSERT INTO hwgi_inspection_item_t "
                    "(it_idx, bt_idx, ii_category, ii_item_id, ii_status, ii_memo) "
                    "VALUES (:it_idx, :bid, :cat, :item_id, :status, :memo)"
                ), {
                    "it_idx": it_idx,
                    "bid": req.bt_idx,
                    "cat": item.category,
                    "item_id": item.item_id,
                    "status": item.status,
                    "memo": item.memo,
                })

        db.commit()
        return {"success": True}

    except Exception as e:
        db.rollback()
        logger.error(f"[hwgi] bulk-save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 3) POST /upload-photo
# ---------------------------------------------------------------------------
@router.post("/upload-photo")
def upload_photo(req: UploadPhotoRequest, db: Session = Depends(get_db)):
    """Base64 이미지를 저장하고 DB에 기록"""
    try:
        # base64 디코딩
        image_data = req.image_base64
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]
        raw = base64.b64decode(image_data)

        # 파일 저장
        ts = int(datetime.now().timestamp() * 1000)
        short_uuid = uuid.uuid4().hex[:8]
        filename = f"{ts}_{short_uuid}.jpg"
        rel_dir = f"{req.bt_idx}/{req.item_id}"
        save_dir = UPLOAD_BASE / rel_dir
        save_dir.mkdir(parents=True, exist_ok=True)
        file_path = save_dir / filename
        file_path.write_bytes(raw)

        url_path = f"/uploads/hwgi/{rel_dir}/{filename}"

        # inspection 레코드 확인
        insp = db.execute(
            text("SELECT it_idx FROM hwgi_inspection_t WHERE bt_idx = :bid"),
            {"bid": req.bt_idx},
        ).fetchone()

        if not insp:
            result = db.execute(text(
                "INSERT INTO hwgi_inspection_t (bt_idx, it_date) VALUES (:bid, :today)"
            ), {"bid": req.bt_idx, "today": date.today()})
            it_idx = result.lastrowid
        else:
            it_idx = insp[0]

        # item 레코드 확인
        item = db.execute(text(
            "SELECT ii_idx FROM hwgi_inspection_item_t "
            "WHERE it_idx = :it_idx AND ii_item_id = :item_id"
        ), {"it_idx": it_idx, "item_id": req.item_id}).fetchone()

        if not item:
            result = db.execute(text(
                "INSERT INTO hwgi_inspection_item_t "
                "(it_idx, bt_idx, ii_category, ii_item_id) "
                "VALUES (:it_idx, :bid, :cat, :item_id)"
            ), {
                "it_idx": it_idx,
                "bid": req.bt_idx,
                "cat": "env",
                "item_id": req.item_id,
            })
            ii_idx = result.lastrowid
        else:
            ii_idx = item[0]

        # 정렬 순서
        sort_row = db.execute(text(
            "SELECT COALESCE(MAX(ip_sort_order), -1) + 1 "
            "FROM hwgi_inspection_photo_t WHERE ii_idx = :ii_idx"
        ), {"ii_idx": ii_idx}).fetchone()
        sort_order = sort_row[0] if sort_row else 0

        # 사진 레코드
        result = db.execute(text(
            "INSERT INTO hwgi_inspection_photo_t "
            "(ii_idx, ii_item_id, it_idx, bt_idx, ip_file_path, ip_file_name, ip_sort_order) "
            "VALUES (:ii_idx, :item_id, :it_idx, :bid, :path, :fname, :sort)"
        ), {
            "ii_idx": ii_idx,
            "item_id": req.item_id,
            "it_idx": it_idx,
            "bid": req.bt_idx,
            "path": url_path,
            "fname": filename,
            "sort": sort_order,
        })
        ip_idx = result.lastrowid
        db.commit()

        return {
            "success": True,
            "photo": {"ip_idx": ip_idx, "url": _absolutize_photo_url(url_path)},
        }

    except Exception as e:
        db.rollback()
        logger.error(f"[hwgi] upload-photo error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 4) DELETE /delete-photo/{photo_id}
# ---------------------------------------------------------------------------
@router.delete("/delete-photo/{photo_id}")
def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    """사진 삭제 (파일 + DB)"""
    try:
        row = db.execute(
            text("SELECT ip_file_path FROM hwgi_inspection_photo_t WHERE ip_idx = :id"),
            {"id": photo_id},
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Photo not found")

        # 파일 삭제
        file_path = BACKEND_DIR / "storage" / row[0].lstrip("/")
        if file_path.exists():
            file_path.unlink()

        db.execute(
            text("DELETE FROM hwgi_inspection_photo_t WHERE ip_idx = :id"),
            {"id": photo_id},
        )
        db.commit()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"[hwgi] delete-photo error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 5) POST /generate-report
# ---------------------------------------------------------------------------
@router.post("/generate-report")
async def generate_report(req: GenerateReportRequest):
    """OpenAI API를 통해 점검 보고서 생성"""
    api_key = settings.OPENAI_API_KEY
    model = settings.OPENAI_MODEL

    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    system_prompt = (
        "당신은 한화손해보험(한화손보) 디지털화상창구 점검 보고서를 작성하는 전문 컨설턴트입니다. "
        "주어진 점검 데이터를 분석하여 종합적이고 전문적인 보고서를 작성해주세요. "
        "반드시 마크다운 형식으로 작성하되, 다음 구조를 따라주세요:\n"
        "1. 📌 점검 개요\n"
        "2. 📊 종합 평가 요약\n"
        "3. 💡 주요 점검 결과\n"
        "4. 🚀 개선 및 제언\n\n"
        "※ 중요: 회사명은 반드시 '한화손해보험' 또는 '한화손보'로 표기하세요. "
        "'한화생명'이 포함된 주소는 건물명일 뿐이며 회사명이 아닙니다."
    )

    user_prompt = (
        f"다음은 {req.branch_name} (주소: {req.branch_address}) 지점의 점검 데이터입니다. "
        f"이 데이터를 기반으로 종합 보고서를 작성해주세요.\n\n{req.prompt_data}"
    )

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                    "max_tokens": 4000,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return {"content": content}

    except httpx.HTTPStatusError as e:
        logger.error(f"[hwgi] OpenAI API error: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="AI 서비스 오류")
    except Exception as e:
        logger.error(f"[hwgi] generate-report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
