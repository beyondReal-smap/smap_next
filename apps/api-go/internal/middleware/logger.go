package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// AccessLog는 Python의 `log_requests` 미들웨어와 동등한 액세스 로그를 slog로 출력한다.
// /api/v1/logs/member-location-logs 는 Python과 동일하게 정상 응답은 로그 생략.
func AccessLog(logger *slog.Logger) gin.HandlerFunc {
	const suppressedPath = "/api/v1/logs/member-location-logs"
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		status := c.Writer.Status()
		path := c.Request.URL.Path

		if status < 400 && path == suppressedPath {
			return
		}
		attrs := []slog.Attr{
			slog.String("method", c.Request.Method),
			slog.String("path", path),
			slog.Int("status", status),
			slog.Duration("dur", time.Since(start)),
			slog.String("client_ip", c.ClientIP()),
		}
		level := slog.LevelInfo
		if status >= 500 {
			level = slog.LevelError
		} else if status >= 400 {
			level = slog.LevelWarn
		}
		logger.LogAttrs(c.Request.Context(), level, "http_request", attrs...)
	}
}
