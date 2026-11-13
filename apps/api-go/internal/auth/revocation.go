package auth

import (
	"context"
	"log/slog"
	"strings"
	"sync/atomic"
	"time"
)

// AccessRevocationChecker는 "이 회원의 이 시각 이전 access token은 무효" 기준을 조회한다.
// 구현은 cache.AccessRevocation(Redis). 기준이 없으면 (false, nil), 조회 실패는 에러로 돌려준다.
type AccessRevocationChecker interface {
	IsAccessRevoked(ctx context.Context, mtIdx int, iat int64, hasIAT bool) (bool, error)
}

const revocationCheckTimeout = 300 * time.Millisecond

var lastRevocationWarn atomic.Int64

// AccessRevoked는 미들웨어와 핸들러가 공유하는 판정 함수다.
// 정책: Redis 조회가 실패하면 "통과 + 경고 로그"(장애 때 로그인된 전 사용자가 튕기는 것을 막는다).
// 경고는 프로세스당 10초에 한 번만 남긴다(요청마다 로그가 쏟아지는 것 방지). checker가 nil이면 판정하지 않는다.
func AccessRevoked(checker AccessRevocationChecker, logger *slog.Logger, id AccessIdentity) bool {
	if checker == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), revocationCheckTimeout)
	defer cancel()
	revoked, err := checker.IsAccessRevoked(ctx, id.MtIdx, id.IAT, id.HasIAT)
	if err != nil {
		now := time.Now().Unix()
		if last := lastRevocationWarn.Load(); now-last >= 10 && lastRevocationWarn.CompareAndSwap(last, now) {
			if logger == nil {
				logger = slog.Default()
			}
			logger.Warn("access_revocation_check_failed_allowing", slog.String("err", err.Error()))
		}
		return false
	}
	return revoked
}

// ---------------------------------------------------------------------------
// 핸들러가 토큰을 직접 파싱하는 경로용 공통 진입점.
// 기존 Parse*(ParseOptionalUserID/ParseChatUserID/ParseUserMtID/ParseWSToken)의 결과가 "성공"일 때만
// 추가로 "비밀번호 변경 이전 토큰 무효" 기준을 본다. 각 핸들러의 무토큰 처리·응답 형식은 그대로이고,
// 무효 판정은 해당 Parse*의 실패 결과와 똑같이 돌아간다(= 이미 있던 인증 실패 분기를 탄다).
// checker가 nil이면 기준을 보지 않는다. Redis 조회 실패는 AccessRevoked 정책(통과 + 경고 로그)을 따른다.
// ---------------------------------------------------------------------------

// tokenRevoked는 rawToken의 iat를 읽어 mtIdx의 무효 기준과 비교한다.
func tokenRevoked(checker AccessRevocationChecker, logger *slog.Logger, mtIdx int, rawToken, secret, algorithm string) bool {
	if checker == nil {
		return false
	}
	claims, ok := DecodeAccessClaims(rawToken, secret, algorithm)
	if !ok {
		return false // 호출부가 이미 같은 토큰을 검증했으므로 도달하지 않는다.
	}
	return AccessRevoked(checker, logger, AccessIdentity{MtIdx: mtIdx, IAT: claims.IAT, HasIAT: claims.HasIAT})
}

// ParseOptionalUserIDChecked는 ParseOptionalUserID + 무효 기준 검사다(무효면 (0, false)).
func ParseOptionalUserIDChecked(checker AccessRevocationChecker, logger *slog.Logger, authHeader, secret, algorithm string) (int, bool) {
	uid, ok := ParseOptionalUserID(authHeader, secret, algorithm)
	if !ok {
		return 0, false
	}
	if tokenRevoked(checker, logger, uid, authHeader[len("Bearer "):], secret, algorithm) {
		return 0, false
	}
	return uid, true
}

// ParseChatUserIDChecked는 ParseChatUserID + 무효 기준 검사다. 무효면 "토큰 인증에 실패했습니다."(기존 서명·만료 실패와 같은 문구).
func ParseChatUserIDChecked(checker AccessRevocationChecker, logger *slog.Logger, authHeader, secret, algorithm string) (int, string, bool) {
	uid, msg, ok := ParseChatUserID(authHeader, secret, algorithm)
	if !ok {
		return 0, msg, false
	}
	if tokenRevoked(checker, logger, uid, strings.Split(authHeader, " ")[1], secret, algorithm) {
		return 0, "토큰 인증에 실패했습니다.", false
	}
	return uid, "", true
}

// ParseUserMtIDChecked는 ParseUserMtID(auth/me) + 무효 기준 검사다.
// 토큰에 mt_idx/sub가 없으면 회원 번호를 알 수 없어 기준을 볼 수 없다(로그인이 발급한 토큰에는 항상 mt_idx가 있다).
func ParseUserMtIDChecked(checker AccessRevocationChecker, logger *slog.Logger, authHeader, secret, algorithm string) (string, bool) {
	mtID, ok := ParseUserMtID(authHeader, secret, algorithm)
	if !ok {
		return "", false
	}
	if checker == nil {
		return mtID, true
	}
	claims, decoded := DecodeAccessClaims(authHeader[len("Bearer "):], secret, algorithm)
	if decoded && claims.HasMtIdx &&
		AccessRevoked(checker, logger, AccessIdentity{MtIdx: claims.MtIdx, IAT: claims.IAT, HasIAT: claims.HasIAT}) {
		return "", false
	}
	return mtID, true
}

// ParseWSTokenChecked는 ParseWSToken(WebSocket 핸드셰이크, "Bearer " 제거된 raw 토큰) + 무효 기준 검사다.
func ParseWSTokenChecked(checker AccessRevocationChecker, logger *slog.Logger, tokenStr, secret, algorithm string) (int, bool) {
	uid, ok := ParseWSToken(tokenStr, secret, algorithm)
	if !ok {
		return 0, false
	}
	if tokenRevoked(checker, logger, uid, tokenStr, secret, algorithm) {
		return 0, false
	}
	return uid, true
}
