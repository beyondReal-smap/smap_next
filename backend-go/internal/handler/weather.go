package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/cache"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/service"
)

type WeatherHandler struct {
	svc   *service.WeatherService
	cfg   *config.Config
	cache *cache.Store
}

func NewWeather(svc *service.WeatherService, cfg *config.Config, store *cache.Store) *WeatherHandler {
	return &WeatherHandler{svc: svc, cfg: cfg, cache: store}
}

// parseFloatQuery는 optional float 쿼리를 검증한다. 빈 값이면 무시, 파싱 실패 시
// FastAPI float_parsing 422 detail을 errs에 추가한다.
func parseFloatQuery(c *gin.Context, errs *[]valErr, key string) {
	v := c.Query(key)
	if v == "" {
		return
	}
	if _, err := strconv.ParseFloat(v, 64); err != nil {
		*errs = append(*errs, qErr("float_parsing", key,
			"Input should be a valid number, unable to parse string as a number", v))
	}
}

// Current는 GET /api/v1/weather/current — optional JWT. lat/lng는 받지만 미사용
// (Python TODO). 내부 예외는 Python처럼 200 + success:false로 응답한다.
func (h *WeatherHandler) Current(c *gin.Context) {
	errs := make([]valErr, 0)
	parseFloatQuery(c, &errs, "lat")
	parseFloatQuery(c, &errs, "lng")
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}

	uid, hasUser := auth.ParseOptionalUserID(c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	resp, err := h.svc.GetCurrent(uid, hasUser)
	if err != nil {
		// Python: try 블록 전체를 except로 감싸 success:false 반환(상태코드 200).
		writeJSON(c, http.StatusOK, h.svc.CurrentError())
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Member는 GET /api/v1/weather/member/:member_id — 무인증 + 캐시(ttl 180s).
// 캐시 키는 Python @cached("weather:member") 포맷과 동일하여 양 스택이 공유 가능하다.
func (h *WeatherHandler) Member(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}

	ctx := c.Request.Context()
	// Python: f"{prefix}:{json.dumps({'member_id': id}, sort_keys=True)}" 와 동일한 키.
	cacheKey := fmt.Sprintf(`weather:member:{"member_id": %d}`, id)
	if raw, ok := h.cache.GetRaw(ctx, cacheKey); ok {
		c.Data(http.StatusOK, "application/json; charset=utf-8", raw)
		return
	}

	resp, found, err := h.svc.GetMember(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "날씨 정보를 가져올 수 없습니다."})
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Member not found"})
		return
	}

	// writeJSON과 동일한 직렬화(HTML escape off)로 캐시 hit/miss 응답 바이트를 일치시킨다.
	b, err := marshalNoEscape(resp)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "날씨 정보를 가져올 수 없습니다."})
		return
	}
	h.cache.SetRaw(ctx, cacheKey, b, 180*time.Second)
	c.Data(http.StatusOK, "application/json; charset=utf-8", b)
}

// UpdateMember는 PUT /api/v1/weather/member/:member_id — 무인증. 존재 키만 갱신 + 캐시 무효화.
// body는 Python `weather_data: dict`(필수). 갱신 성공 시 GET 캐시 키를 무효화한다.
func (h *WeatherHandler) UpdateMember(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	body, ok := parseGSMCreateBody(c) // 필수 JSON 객체(UseNumber, 비객체→422)
	if !ok {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": []valErr{{
			Type: "dict_type", Loc: []string{"body"}, Msg: "Input should be a valid dictionary",
		}}})
		return
	}

	resp, found, sok := h.svc.UpdateMember(id, body)
	if !sok {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "날씨 정보 업데이트에 실패했습니다."})
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Member not found"})
		return
	}
	// Python cache_delete(f'weather:member:{{"member_id": {id}}}')와 동일 키 무효화.
	h.cache.Delete(c.Request.Context(), fmt.Sprintf(`weather:member:{"member_id": %d}`, id))
	writeJSON(c, http.StatusOK, resp)
}
