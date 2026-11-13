package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// unmatchedLogPath는 어떤 라우트에도 맞지 않은 요청(404 등)의 경로 대신 기록하는 고정 문자열이다.
// 임의 경로에는 이메일·전화번호·토큰이 섞여 있을 수 있어 원경로를 남기지 않는다.
const unmatchedLogPath = "(unmatched)"

// logPath는 로그에 남길 경로다. 라우트 패턴(/members/check/email/:email)을 쓰므로 경로 매개변수 값
// (이메일·전화번호·FCM 토큰 등)이 로그에 남지 않는다. 패턴이 없으면 고정 문자열이다. 쿼리 문자열은 포함하지 않는다.
func logPath(c *gin.Context) string {
	if p := c.FullPath(); p != "" {
		return p
	}
	return unmatchedLogPath
}

// AccessLog는 Python의 `log_requests` 미들웨어와 동등한 액세스 로그를 slog로 출력한다.
// /api/v1/logs/member-location-logs 는 Python과 동일하게 정상 응답은 로그 생략.
func AccessLog(logger *slog.Logger) gin.HandlerFunc {
	const suppressedPath = "/api/v1/logs/member-location-logs"
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		status := c.Writer.Status()
		path := logPath(c)

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
