package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/repository"
)

// RequireAdmin은 Python `get_required_admin_id` 의존성 체인과 동등한 게이트다.
//  1. Bearer JWT가 유효하지 않으면 401 "인증이 필요합니다." (+ WWW-Authenticate: Bearer)
//     — Python get_required_user_id의 401 응답과 동일.
//  2. 회원이 mt_status=1 & mt_level=9가 아니면 403 "관리자 권한이 필요합니다."
//
// 통과 시 user_id를 gin 컨텍스트에 저장한다.
func RequireAdmin(cfg *config.Config, memberRepo *repository.MemberRepository) gin.HandlerFunc {
	return RequireAdminChecked(cfg, memberRepo, nil)
}

// RequireAdminChecked는 RequireAdmin에 "비밀번호 변경 이전에 발급된 토큰 무효" 기준을 더한 것이다.
// 무효 토큰은 서명·만료 실패와 같은 401 "인증이 필요합니다."로 처리한다. checker가 nil이면 RequireAdmin과 같다.
// Redis 조회 실패는 통과 + 경고 로그(auth.AccessRevoked 정책).
func RequireAdminChecked(cfg *config.Config, memberRepo *repository.MemberRepository, checker auth.AccessRevocationChecker) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := auth.ParseOptionalUserIDChecked(checker, nil, c.GetHeader("Authorization"), cfg.JWTSecretKey, cfg.JWTAlgorithm)
		if !ok {
			c.Header("WWW-Authenticate", "Bearer")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
			return
		}
		member, err := memberRepo.GetActiveByID(uid)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
			return
		}
		// mt_level != 9 (nil 포함) → 403. Python: `not user or user.mt_level != 9`.
		if member == nil || member.MtLevel == nil || *member.MtLevel != 9 {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"detail": "관리자 권한이 필요합니다."})
			return
		}
		c.Set("user_id", uid)
		c.Next()
	}
}
