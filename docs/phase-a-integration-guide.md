# Phase A — Backend Refresh Token 통합 가이드

> 본 PR로 들어간 신규 파일 4개와, 별도 정리 후 적용해야 하는 4개 수정 파일의 변경 내역을 정리합니다. 신규 파일만으로는 동작하지 않으니 **수정 파일도 함께 적용해야 백엔드가 작동**합니다.

## 0. 본 커밋에 포함된 신규 파일

| 파일 | 역할 |
|------|------|
| `backend/app/models/refresh_token.py` | SQLAlchemy 모델 |
| `backend/migrations/2026-04-14_add_refresh_tokens.sql` | DDL — prod DB에 수동 실행 |
| `backend/app/crud/crud_refresh_token.py` | issue / rotate / revoke / reuse detection |
| `backend/app/api/v1/endpoints/app_version.py` | `GET /app/version-check` |

## 1. 본 커밋에서 stage하지 않은 4개 수정 파일

`backend/` worktree에 다른 진행 작업이 다수 섞여 있어 안전을 위해 stage하지 않았습니다. 아래 변경을 **본인 worktree 작업과 충돌 없이 합친 뒤 별도 커밋**으로 올려주세요. 현재 working copy에는 이미 적용되어 있으므로 `git diff` 출력으로 직접 확인 가능합니다.

### 1.1 `backend/app/api/v1/api.py`

```python
# import 라인에 app_version 추가
from app.api.v1.endpoints import (
    health, auth, ..., chats, app_version,   # ← app_version 추가
)

# 라우터 등록 추가 (chats 다음 줄 권장)
api_router.include_router(app_version.router, prefix="/app", tags=["app-version"])
```

### 1.2 `backend/app/core/config.py`

```python
# 기존 ACCESS_TOKEN_EXPIRE_MINUTES 정의 아래에 추가
# ACCESS_TOKEN_EXPIRE_MINUTES 자체는 Phase D 롤아웃까지 변경하지 말 것.
REFRESH_TOKEN_EXPIRE_DAYS: int = 30
REFRESH_TOKEN_BYTES: int = 48  # secrets.token_urlsafe(48) → 64자

# 클라이언트 최소 지원 버전 — 구버전 즉시 강제 업데이트
# 배포 직전에 실제 신버전 번호로 변경
MIN_APP_VERSION_ANDROID: str = "3.1.0"
MIN_APP_VERSION_IOS: str = "3.1.0"
```

> 만약 본인 worktree에 `Field(... validation_alias=AliasChoices(...))` 패턴이 있다면 동일 패턴으로 `validation_alias=AliasChoices("MIN_APP_VERSION_ANDROID")` 같은 형태로 추가.

### 1.3 `backend/app/api/v1/endpoints/auth.py`

#### (a) import 추가
```python
import hashlib
from typing import Optional, Tuple
from app.crud import crud_auth, crud_refresh_token   # ← crud_refresh_token 추가
```

#### (b) `create_access_token` 함수 직후에 helper 3개 추가
```python
def _client_ip_hash(request: Optional[Request]) -> Optional[str]:
    if request is None or request.client is None:
        return None
    client_ip = request.client.host or ""
    if not client_ip:
        return None
    return hashlib.sha256(client_ip.encode("utf-8")).hexdigest()


def _issue_refresh_for(db: Session, mt_idx: int, request: Optional[Request]) -> str:
    ua = request.headers.get("user-agent") if request else None
    ip = _client_ip_hash(request)
    raw, _chain = crud_refresh_token.issue(db, mt_idx, user_agent=ua, ip_hash=ip)
    return raw


def _access_expires_in_seconds() -> int:
    return int(settings.ACCESS_TOKEN_EXPIRE_MINUTES) * 60
```

#### (c) `/auth/login` (`login_for_home_page`)
- signature에 `request: Request` 추가
- 성공 응답 직전에 `refresh_raw = _issue_refresh_for(db, user.mt_idx, request)` 호출
- 응답 `data` dict에 `"refresh_token": refresh_raw, "expires_in": _access_expires_in_seconds()` 추가

#### (d) `/auth/kakao-login` (`kakao_login`)
- signature에 `request: Request` 추가
- 성공 응답 직전에 `refresh_raw = _issue_refresh_for(db, user.mt_idx, request)` 호출
- 응답 `data` dict에 `"refresh_token": refresh_raw, "expires_in": _access_expires_in_seconds()` 추가

#### (e) `/auth/logout` 재설계
```python
@router.post("/logout")
def logout(
    db: Session = Depends(get_db),
    body: Optional[dict] = Body(default=None),
):
    if body and isinstance(body, dict):
        raw = body.get("refresh_token")
        if isinstance(raw, str) and raw:
            crud_refresh_token.revoke_by_raw(db, raw)
    return {"success": True, "message": "로그아웃되었습니다."}
```

#### (f) `/auth/refresh` 재설계 — v2(body) + v1(Bearer) 분기
```python
@router.post("/refresh")
def refresh_token(
    request: Request,
    db: Session = Depends(get_db),
    body: Optional[dict] = Body(default=None),
):
    # v2: body {"refresh_token": "..."} → rotation
    if body and isinstance(body, dict):
        raw = body.get("refresh_token")
        if isinstance(raw, str) and raw:
            ua = request.headers.get("user-agent") if request else None
            ip = _client_ip_hash(request)
            result = crud_refresh_token.rotate(db, raw, user_agent=ua, ip_hash=ip)
            if result is None:
                raise HTTPException(401, detail="Refresh token이 유효하지 않습니다.")
            new_raw, mt_idx, _chain = result
            user = db.query(Member).filter(Member.mt_idx == mt_idx).first()
            if user is None:
                raise HTTPException(401, detail="사용자를 찾을 수 없습니다.")
            access_token = create_access_token(data={
                "mt_idx": user.mt_idx, "mt_id": user.mt_id, "mt_name": user.mt_name,
            })
            return {
                "success": True, "token": access_token,
                "refresh_token": new_raw,
                "expires_in": _access_expires_in_seconds(),
                "message": "토큰이 갱신되었습니다.",
            }

    # v1: Authorization: Bearer <access> → access만 재발급 (구 클라이언트 호환)
    auth_header = request.headers.get("authorization", "") if request else ""
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(401, detail="토큰이 필요합니다.")
    access = auth_header[7:].strip()
    try:
        payload = jwt.decode(access, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        mt_idx = payload.get("mt_idx") or payload.get("sub")
        if mt_idx is None:
            raise HTTPException(401, detail="토큰이 유효하지 않습니다.")
        new_token = create_access_token(data={
            "mt_idx": mt_idx,
            "mt_id": payload.get("mt_id"),
            "mt_name": payload.get("mt_name"),
        })
        return {"success": True, "token": new_token, "message": "토큰이 갱신되었습니다."}
    except JWTError:
        raise HTTPException(401, detail="토큰 갱신에 실패했습니다.")
```

### 1.4 `backend/app/services/member_service.py`

#### (a) import 추가
```python
from app.crud import crud_refresh_token
```

#### (b) `google_login` 기존 사용자 응답
- `return GoogleLoginResponse(...)` 직전에 `refresh_raw, _ = crud_refresh_token.issue(db, existing_member.mt_idx)` 추가
- 응답 `data` dict에 `"refresh_token": refresh_raw, "expires_in": int(settings.ACCESS_TOKEN_EXPIRE_MINUTES) * 60` 추가

#### (c) `apple_login` 기존 사용자 응답
- 위와 동일 패턴

## 2. 배포 절차

1. DB에 `migrations/2026-04-14_add_refresh_tokens.sql` 실행.
2. 위 4개 파일의 변경을 본인 작업과 합쳐 커밋·배포.
3. **ACCESS_TOKEN_EXPIRE_MINUTES는 변경하지 말 것** — Phase D에서 클라 배포 후 60분으로 전환.
4. `MIN_APP_VERSION_ANDROID` / `MIN_APP_VERSION_IOS` 상수는 신버전 빌드 번호 결정 후 업데이트하여 강제 업데이트 활성화.

## 3. 검증

배포 후 빠른 점검:
```bash
# 로그인 응답에 refresh_token 포함 확인
curl -X POST $BASE/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mt_id":"<phone>","mt_pwd":"<pw>"}' | jq '.data | keys'
# 기대 키: ["expires_in", "refresh_token", "token", "user", ...]

# 회전
curl -X POST $BASE/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<raw>"}' | jq

# 버전 체크
curl "$BASE/api/v1/app/version-check?platform=android&version=3.0.0" | jq
# {update_required:true, force_update:true, ...} 기대
```
