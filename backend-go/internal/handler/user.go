package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/service"
)

type UserHandler struct {
	svc *service.UserService
}

func NewUser(svc *service.UserService) *UserHandler {
	return &UserHandler{svc: svc}
}

// plainServerError는 FastAPI의 unhandled 예외(ResponseValidationError 등) 500 응답과 동일하게
// plain text "Internal Server Error"를 보낸다(JSON 아님).
func plainServerError(c *gin.Context) {
	c.Data(http.StatusInternalServerError, "text/plain; charset=utf-8", []byte("Internal Server Error"))
}

// List는 GET /api/v1/users/ — List[MemberResponse]. 필수필드(mt_id/name/nickname) null 멤버가
// 페이지에 있으면 Python처럼 500(plain text). skip(0)/limit(100), ge·le 없음.
func (h *UserHandler) List(c *gin.Context) {
	errs := make([]valErr, 0)
	skip := parseIntQuery(c, &errs, "skip", 0, false, 0, false, 0)
	limit := parseIntQuery(c, &errs, "limit", 100, false, 0, false, 0)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	res, ok := h.svc.ListUsers(skip, limit)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, res)
}

// Get은 GET /api/v1/users/:user_id — MemberResponse. 없으면 404, 필수필드 null이면 500(plain).
func (h *UserHandler) Get(c *gin.Context) {
	idStr := c.Param("user_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "user_id", idStr)
		return
	}
	resp, found, ok := h.svc.GetUser(id)
	if !ok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "User not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// ByEmail은 GET /api/v1/users/email/:email — 전체 ORM 덤프.
// ⚠️ Python 핸들러의 try/except가 404 HTTPException까지 잡아 str(e)로 재포장하므로,
// 없으면 404가 아니라 500 {"detail":"404: User not found"}로 응답한다(버그 그대로 이식).
func (h *UserHandler) ByEmail(c *gin.Context) {
	d, found, err := h.svc.GetUserByEmail(c.Param("email"))
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if !found {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "404: User not found"})
		return
	}
	writeJSON(c, http.StatusOK, d)
}

// ByToken은 GET /api/v1/users/token/:token — 전체 ORM 덤프(mt_token_id 매칭).
// ByEmail과 동일하게 없으면 500 {"detail":"404: User not found"}.
func (h *UserHandler) ByToken(c *gin.Context) {
	d, found, err := h.svc.GetUserByToken(c.Param("token"))
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if !found {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "404: User not found"})
		return
	}
	writeJSON(c, http.StatusOK, d)
}

// RecentSignin3h는 GET /api/v1/users/recent/signin/3h — {"users":[full dump,...]}.
func (h *UserHandler) RecentSignin3h(c *gin.Context) {
	h.recentSignin(c, 3)
}

// RecentSignin24h는 GET /api/v1/users/recent/signin/24h.
func (h *UserHandler) RecentSignin24h(c *gin.Context) {
	h.recentSignin(c, 24)
}

func (h *UserHandler) recentSignin(c *gin.Context, hoursAgo int) {
	res, err := h.svc.RecentSignin(hoursAgo)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, dto.UsersWrap{Users: res})
}

// NotJoined는 GET /api/v1/users/not-joined/11days. 매칭 행이 있으면 Python은 raw Row 직렬화
// 실패로 500(plain), 없으면 {"users":[]}. DB 에러는 500(detail=str(e)).
func (h *UserHandler) NotJoined(c *gin.Context) {
	count, err := h.svc.NotJoinedCount()
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if count > 0 {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, dto.UsersWrap{Users: make([]dto.UserFullDump, 0)})
}
