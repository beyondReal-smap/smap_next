package middleware

import (
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/gin-gonic/gin"
)

// Recovery는 panic을 구조화 로그로 남기고 500을 반환한다.
// Python의 lifespan 예외 핸들러와 동등한 역할.
func Recovery(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if rec := recover(); rec != nil {
				logger.Error("panic recovered",
					slog.Any("panic", rec),
					slog.String("path", c.Request.URL.Path),
					slog.String("method", c.Request.Method),
					slog.String("stack", string(debug.Stack())),
				)
				if !c.Writer.Written() {
					c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
						"detail": "Internal Server Error",
					})
				}
			}
		}()
		c.Next()
	}
}
