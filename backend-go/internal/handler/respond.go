package handler

import (
	"bytes"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
)

// writeJSON은 FastAPI(JSONResponse)와 동일하게 HTML 이스케이프 없이 JSON을 응답한다.
// gin 기본 c.JSON은 <, >, & 를 < 등으로 이스케이프하지만 FastAPI는 원문을 유지하므로,
// 응답 바이트 동등성을 위해 SetEscapeHTML(false)로 통일한다.
func writeJSON(c *gin.Context, status int, obj interface{}) {
	b, err := marshalNoEscape(obj)
	if err != nil {
		c.Data(http.StatusInternalServerError, "application/json; charset=utf-8",
			[]byte(`{"detail":"Internal Server Error"}`))
		return
	}
	c.Data(status, "application/json; charset=utf-8", b)
}

// marshalNoEscape는 HTML 이스케이프를 끈 JSON 바이트를 반환한다(캐시 저장/응답 공용).
// Encoder.Encode가 덧붙이는 말미 개행은 제거해 JSONResponse와 바이트를 맞춘다.
func marshalNoEscape(obj interface{}) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(obj); err != nil {
		return nil, err
	}
	return bytes.TrimRight(buf.Bytes(), "\n"), nil
}
