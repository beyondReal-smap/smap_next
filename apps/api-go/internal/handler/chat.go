package handler

import (
	"math"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// coerceJSONInt는 FastAPI(Pydantic v2) body 정수 coercion을 따른다.
// JSON number는 정수값이면 허용(5.0→5, 1.5→거부), JSON string은 coerceInt 재사용("5"→5, "x"→거부).
func coerceJSONInt(v interface{}) (int, bool) {
	switch n := v.(type) {
	case float64:
		if n == math.Trunc(n) {
			return int(n), true
		}
		return 0, false
	case string:
		return coerceInt(n)
	}
	return 0, false
}

// ChatHandler는 Python `app/api/v1/endpoints/chats.py`의 REST 3종을 이식한다.
// 인증은 chat 전용 경로(SECRET_KEY + mt_idx claim, sub 폴백 없음).
type ChatHandler struct {
	svc *service.ChatService
	cfg *config.Config
}

func NewChat(svc *service.ChatService, cfg *config.Config) *ChatHandler {
	return &ChatHandler{svc: svc, cfg: cfg}
}

const msgFieldRequired = "Field required"

// chatAuth는 chats.py get_current_user_id를 적용한다. 실패 시 401 응답 후 (0, false).
// ⚠️Python settings.SECRET_KEY/ALGORITHM은 config.py에서 @property로 JWT_SECRET_KEY/JWT_ALGORITHM을
// 그대로 반환한다(SECRET_KEY/ALGORITHM env는 미사용 — 둘은 항상 동일 값). 따라서 Go도
// cfg.JWTSecretKey/JWTAlgorithm을 사용해야 토큰 시크릿이 일치한다.
func (h *ChatHandler) chatAuth(c *gin.Context) (int, bool) {
	mtIdx, msg, ok := auth.ParseChatUserID(c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": msg})
		return 0, false
	}
	return mtIdx, true
}

// Rooms는 GET /api/v1/chats/rooms (Python get_chat_rooms). 인증 → 방 목록.
func (h *ChatHandler) Rooms(c *gin.Context) {
	mtIdx, ok := h.chatAuth(c)
	if !ok {
		return
	}
	res, err := h.svc.GetRoomsForMember(mtIdx)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// CreateDM은 POST /api/v1/chats/rooms/dm (Python create_dm_room).
// 검증 순서: 인증 401 → body 422 → self 400 → 생성.
func (h *ChatHandler) CreateDM(c *gin.Context) {
	mtIdx, ok := h.chatAuth(c)
	if !ok {
		return
	}

	// CreateDMRequest(target_mt_idx: int). body를 map으로 받아 FastAPI 422 detail
	// (missing / int_parsing + 실제 input 값)을 재현한다.
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	raw, exists := body["target_mt_idx"]
	if !exists {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": []valErr{{
			Type: "missing", Loc: []string{"body", "target_mt_idx"}, Msg: msgFieldRequired, Input: body,
		}}})
		return
	}
	target, okv := coerceJSONInt(raw)
	if !okv {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": []valErr{{
			Type: "int_parsing", Loc: []string{"body", "target_mt_idx"}, Msg: msgIntParse, Input: raw,
		}}})
		return
	}

	if target == mtIdx {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "자기 자신에게는 DM을 보낼 수 없습니다."})
		return
	}

	res, err := h.svc.CreateDMRoom(mtIdx, target)
	if err != nil {
		// Python: create_dm_room이 None이면 500 "채팅방 생성에 실패했습니다."(실제론 dead 경로).
		// DB 에러를 동일 500으로 매핑한다.
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "채팅방 생성에 실패했습니다."})
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Messages는 GET /api/v1/chats/rooms/:scr_idx/messages (Python get_messages).
// 검증 순서: param(scr_idx/before/limit) 422 → 인증 401 → membership 403.
// before는 0(미존재/명시 0)이면 필터 미적용(Python `if before_idx:` falsy), limit는 min(limit,100).
func (h *ChatHandler) Messages(c *gin.Context) {
	errs := make([]valErr, 0)
	scrIdxStr := c.Param("scr_idx")
	scrIdx, sok := coerceInt(scrIdxStr)
	if !sok {
		errs = append(errs, valErr{Type: "int_parsing", Loc: []string{"path", "scr_idx"}, Msg: msgIntParse, Input: scrIdxStr})
	}
	beforeIdx := parseIntQuery(c, &errs, "before", 0, false, 0, false, 0)
	limit := parseIntQuery(c, &errs, "limit", 50, false, 0, false, 0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}

	mtIdx, ok := h.chatAuth(c)
	if !ok {
		return
	}

	if limit > 100 {
		limit = 100 // Python min(limit, 100)
	}
	items, found, err := h.svc.GetMessages(scrIdx, mtIdx, beforeIdx, limit)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	if !found {
		writeJSON(c, http.StatusForbidden, gin.H{"detail": "채팅방 접근 권한이 없습니다."})
		return
	}
	writeJSON(c, http.StatusOK, items)
}
