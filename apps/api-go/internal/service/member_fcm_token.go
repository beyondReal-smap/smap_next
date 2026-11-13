package service

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// memberFCMRepo는 MemberFCMTokenService가 의존하는 회원 조회/갱신 + 집계.
type memberFCMRepo interface {
	GetByID(mtIdx int) (*model.Member, error)
	UpdateColumns(mtIdx int, fields map[string]interface{}) error
	CountExpiredTokens(now time.Time) (int64, int64, error)
	CountMembersWithToken() (int64, error)
}

// MemberFCMTokenService는 Python app/api/v1/endpoints/member_fcm_token.py(/member-fcm-token)를 이식한다.
type MemberFCMTokenService struct {
	members memberFCMRepo
}

func NewMemberFCMToken(members memberFCMRepo) *MemberFCMTokenService {
	return &MemberFCMTokenService{members: members}
}

// fcmHTTPError는 서비스가 핸들러에 전달하는 HTTP 에러(상태+detail). nil이면 성공.
type FCMErr struct {
	Status int
	Detail string
}

const (
	memberNotFoundMsgFmt = "회원 ID %d을 찾을 수 없습니다. 앱을 재시작하여 최신 회원 정보를 동기화해주세요."
	invalidTokenFmtMsg   = "잘못된 FCM 토큰 형식입니다. 올바른 FCM 토큰을 제공해주세요."
)

// GetByID는 수평인가 검증(핸들러)에서 user_id 회원을 로드할 때 사용.
func (s *MemberFCMTokenService) GetByID(mtIdx int) (*model.Member, error) {
	return s.members.GetByID(mtIdx)
}

// --- 헬퍼 ---

// maskToken은 Python app.core.utils.mask_token: len<16면 "***", 아니면 token[:8]+"..."+token[-4:].
func maskToken(token string) string {
	r := []rune(token)
	if token == "" || len(r) < 16 {
		return "***"
	}
	return string(r[:8]) + "..." + string(r[len(r)-4:])
}

var fcmAlnumRe = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
var iosTokenRe = regexp.MustCompile(`^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$`)

// validateFCMTokenFormat은 Python validate_fcm_token_format을 이식한다.
func validateFCMTokenFormat(token string) bool {
	if token == "" {
		return false
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return false
	}
	switch strings.ToLower(token) {
	case "null", "none", "undefined", "nan", "":
		return false
	}
	n := len([]rune(token))
	if n < 20 || n > 500 {
		return false
	}
	if strings.Contains(token, ":") {
		parts := strings.SplitN(token, ":", 2)
		if len(parts) == 2 {
			projectID, tokenPart := parts[0], parts[1]
			if projectID == "" || len([]rune(projectID)) > 100 {
				return false
			}
			if strings.HasPrefix(tokenPart, "APA91b") && len([]rune(tokenPart)) < 100 {
				return false
			}
		} else {
			return false
		}
	}
	if !fcmAlnumRe.MatchString(strings.ReplaceAll(token, ":", "")) {
		return false
	}
	return true
}

// validateIOSToken은 Python firebase_service.validate_ios_token(포맷전용, 네트워크 없음)을 이식한다.
// len 100-200 + 정확히 콜론 1개(양쪽 alnum/-/_). validate-and-refresh의 server_validation에 사용.
func validateIOSToken(token string) bool {
	if strings.TrimSpace(token) == "" {
		return false
	}
	n := len([]rune(token))
	if n < 100 || n > 200 {
		return false
	}
	return iosTokenRe.MatchString(token)
}

// daysBetween은 Python (a - b).days(양수 timedelta의 일수, floor)와 동등하다.
func daysBetween(a, b time.Time) int {
	return int(a.Sub(b).Hours() / 24)
}

func okResp(message string, mtIdx int, hasToken bool, preview *string) (*dto.MemberFCMTokenResponse, *FCMErr) {
	return &dto.MemberFCMTokenResponse{Success: true, Message: message, MtIdx: mtIdx, HasToken: hasToken, TokenPreview: preview}, nil
}

// --- 8 코어 엔드포인트 ---

// Register는 POST /register(register_member_fcm_token).
func (s *MemberFCMTokenService) Register(mtIdx int, fcmToken string) (*dto.MemberFCMTokenResponse, *FCMErr) {
	member, err := s.members.GetByID(mtIdx)
	if err != nil {
		return nil, &FCMErr{500, "FCM 토큰 등록/업데이트 중 서버 오류가 발생했습니다."}
	}
	if member == nil {
		return nil, &FCMErr{404, fmt.Sprintf(memberNotFoundMsgFmt, mtIdx)}
	}
	if derefIntOr(member.MtLevel, 0) == 1 {
		return nil, &FCMErr{400, "탈퇴한 회원은 FCM 토큰을 등록할 수 없습니다."}
	}
	if derefIntOr(member.MtStatus, 0) != 1 {
		return nil, &FCMErr{400, "정상 상태가 아닌 회원은 FCM 토큰을 등록할 수 없습니다."}
	}
	oldToken := member.MtTokenID
	isNewToken := derefStr(oldToken) != fcmToken || oldToken == nil

	// 동일 토큰 + 2시간 이내 업데이트 → DB 변경 없이 조기 반환(중복 방지).
	if !isNewToken && oldToken != nil && member.MtTokenUpdatedAt != nil {
		sec := time.Now().Sub(*member.MtTokenUpdatedAt).Seconds()
		if sec < 7200 {
			msg := fmt.Sprintf("FCM 토큰이 이미 최신 상태입니다. (중복 업데이트 방지 - %.1f초 전 업데이트)", sec)
			return okResp(msg, member.MtIdx, true, strPtr(maskToken(fcmToken)))
		}
	}

	if !validateFCMTokenFormat(fcmToken) {
		return nil, &FCMErr{400, "잘못된 FCM 토큰 형식입니다. 앱을 재시작하여 새로운 FCM 토큰을 받은 후 다시 시도해주세요."}
	}

	if e := s.applyTokenUpdate(member, fcmToken, isNewToken); e != nil {
		return nil, e
	}
	message := "FCM 토큰이 확인되었습니다. (동일 토큰)"
	if isNewToken {
		message = "FCM 토큰이 성공적으로 등록/업데이트되었습니다."
	}
	return okResp(message, member.MtIdx, true, strPtr(maskToken(fcmToken)))
}

// CheckAndUpdate는 POST /check-and-update.
func (s *MemberFCMTokenService) CheckAndUpdate(mtIdx int, fcmToken string) (*dto.MemberFCMTokenResponse, *FCMErr) {
	member, err := s.members.GetByID(mtIdx)
	if err != nil {
		return nil, &FCMErr{500, "FCM 토큰 체크/업데이트 중 서버 오류가 발생했습니다."}
	}
	if member == nil {
		return nil, &FCMErr{404, fmt.Sprintf(memberNotFoundMsgFmt, mtIdx)}
	}
	if derefIntOr(member.MtLevel, 0) == 1 {
		return nil, &FCMErr{400, "탈퇴한 회원은 FCM 토큰을 사용할 수 없습니다."}
	}
	current := member.MtTokenID
	needsUpdate := false
	message := ""
	switch {
	case derefStr(current) == "" || current == nil:
		needsUpdate = true
		message = "FCM 토큰이 새로 등록되었습니다."
	case derefStr(current) != fcmToken:
		if member.MtTokenUpdatedAt != nil && time.Now().Sub(*member.MtTokenUpdatedAt).Seconds() < 3600 {
			message = "기존 FCM 토큰이 최근에 업데이트되어 보호됩니다."
		} else {
			needsUpdate = true
			message = "FCM 토큰이 업데이트되었습니다."
		}
	default: // 동일 토큰
		if member.MtTokenUpdatedAt != nil && time.Now().Sub(*member.MtTokenUpdatedAt).Seconds() < 300 {
			message = "FCM 토큰이 이미 최신 상태입니다. (중복 체크 방지)"
		} else {
			message = "FCM 토큰이 이미 최신 상태입니다."
		}
	}
	if needsUpdate {
		if !validateFCMTokenFormat(fcmToken) {
			return nil, &FCMErr{400, invalidTokenFmtMsg}
		}
		if e := s.applyTokenUpdate(member, fcmToken, derefStr(current) != fcmToken); e != nil {
			return nil, e
		}
	}
	return okResp(message, member.MtIdx, true, strPtr(maskToken(fcmToken)))
}

// ValidateAndRefresh는 POST /validate-and-refresh.
func (s *MemberFCMTokenService) ValidateAndRefresh(mtIdx int, fcmToken string, forceRefresh bool) (*dto.MemberFCMTokenResponse, *FCMErr) {
	member, err := s.members.GetByID(mtIdx)
	if err != nil {
		return nil, &FCMErr{500, "FCM 토큰 유효성 검증 중 서버 오류가 발생했습니다."}
	}
	if member == nil {
		return nil, &FCMErr{404, fmt.Sprintf(memberNotFoundMsgFmt, mtIdx)}
	}
	if derefIntOr(member.MtLevel, 0) == 1 {
		return nil, &FCMErr{400, "탈퇴한 회원은 FCM 토큰을 사용할 수 없습니다."}
	}
	now := time.Now()
	needsRefresh := false
	reason := ""
	exp := member.MtTokenExpiryDate
	switch {
	case derefStr(member.MtTokenID) == "" || member.MtTokenID == nil:
		needsRefresh, reason = true, "FCM 토큰이 존재하지 않습니다."
	case derefStr(member.MtTokenID) != fcmToken:
		needsRefresh, reason = true, "FCM 토큰이 변경되었습니다."
	case exp != nil && now.After(*exp):
		needsRefresh, reason = true, "FCM 토큰이 만료되었습니다."
	case exp != nil && daysBetween(*exp, now) <= 7:
		needsRefresh, reason = true, "FCM 토큰이 곧 만료됩니다."
	case exp != nil && now.Before(*exp) && member.MtTokenUpdatedAt == nil:
		needsRefresh, reason = true, "FCM 토큰 업데이트 일시가 없습니다."
	case exp != nil && now.Before(*exp) && member.MtTokenUpdatedAt != nil && daysBetween(now, *member.MtTokenUpdatedAt) >= 30:
		needsRefresh, reason = true, "FCM 토큰이 30일 이상 업데이트되지 않았습니다."
	}

	serverValidationPassed := true
	if forceRefresh || needsRefresh {
		if !validateIOSToken(fcmToken) {
			serverValidationPassed = false
			needsRefresh = true
			reason = "FCM 서버에서 토큰을 인식하지 못합니다."
		}
	}

	if needsRefresh {
		if !validateFCMTokenFormat(fcmToken) {
			return nil, &FCMErr{400, invalidTokenFmtMsg}
		}
		if e := s.applyTokenUpdate(member, fcmToken, derefStr(member.MtTokenID) != fcmToken); e != nil {
			return nil, e
		}
		status := "서버 검증 통과"
		if !serverValidationPassed {
			status = "기본 검증만 통과"
		}
		return okResp(fmt.Sprintf("FCM 토큰이 갱신되었습니다. 사유: %s (%s)", reason, status), member.MtIdx, true, strPtr(maskToken(fcmToken)))
	}
	status := "서버 검증 통과"
	if !serverValidationPassed {
		status = "기본 검증 통과"
	}
	return okResp(fmt.Sprintf("FCM 토큰이 유효합니다. (%s)", status), member.MtIdx, true, strPtr(maskToken(fcmToken)))
}

// BackgroundCheck는 POST /background-check.
func (s *MemberFCMTokenService) BackgroundCheck(mtIdx int, fcmToken, checkType string, forceRefresh bool) (*dto.MemberFCMTokenResponse, *FCMErr) {
	member, err := s.members.GetByID(mtIdx)
	if err != nil {
		return nil, &FCMErr{500, "FCM 토큰 백그라운드 검증 중 서버 오류가 발생했습니다."}
	}
	if member == nil {
		return nil, &FCMErr{404, fmt.Sprintf(memberNotFoundMsgFmt, mtIdx)}
	}
	if derefIntOr(member.MtLevel, 0) == 1 {
		return nil, &FCMErr{400, "탈퇴한 회원은 FCM 토큰을 사용할 수 없습니다."}
	}
	current := time.Now()
	needsRefresh := false
	reason := ""
	isPreview := len([]rune(fcmToken)) < 100 || strings.HasSuffix(fcmToken, "...") || !validateFCMTokenFormat(fcmToken)
	var actualToken string
	if isPreview {
		actualToken = derefStr(member.MtTokenID)
		if actualToken == "" {
			return nil, &FCMErr{400, "DB에 저장된 FCM 토큰이 없습니다. 앱에서 새로운 토큰을 등록해주세요."}
		}
	} else {
		actualToken = fcmToken
	}
	exp := member.MtTokenExpiryDate
	switch {
	case derefStr(member.MtTokenID) == "" || member.MtTokenID == nil:
		needsRefresh, reason = true, "FCM 토큰이 존재하지 않습니다."
	case !isPreview && derefStr(member.MtTokenID) != fcmToken:
		needsRefresh, reason = true, "FCM 토큰이 변경되었습니다."
	case !isPreview && derefStr(member.MtTokenID) == fcmToken:
		if member.MtTokenUpdatedAt != nil && time.Now().Sub(*member.MtTokenUpdatedAt).Seconds() < 7200 {
			return okResp("백그라운드 토큰 체크 건너뛰기 (중복 방지)", member.MtIdx, true, strPtr(maskToken(fcmToken)))
		}
	case exp != nil && current.After(*exp):
		needsRefresh, reason = true, "FCM 토큰이 만료되었습니다."
	case forceRefresh:
		needsRefresh, reason = true, "강제 토큰 갱신 요청"
	case checkType == "background" && exp != nil:
		if daysBetween(*exp, current) <= 7 {
			needsRefresh, reason = true, "백그라운드 검증: 토큰이 곧 만료됩니다."
		}
	case exp != nil && current.Before(*exp) && member.MtTokenUpdatedAt != nil && daysBetween(current, *member.MtTokenUpdatedAt) >= 85:
		needsRefresh, reason = true, "토큰이 아직 유효하지만 85일 이상 업데이트되지 않았습니다. (만료 5일 전)"
	}

	previewPtr := func() *string {
		if actualToken == "" {
			return nil
		}
		return strPtr(maskToken(actualToken))
	}

	if needsRefresh {
		if !isPreview && !validateFCMTokenFormat(actualToken) {
			return nil, &FCMErr{400, invalidTokenFmtMsg}
		}
		fields := map[string]interface{}{
			"mt_token_updated_at":  current,
			"mt_token_expiry_date": current.Add(90 * 24 * time.Hour),
			"mt_udate":             current,
		}
		if !isPreview {
			fields["mt_token_id"] = actualToken
		}
		if e := s.update(member.MtIdx, fields, "FCM 토큰 백그라운드 검증 중 서버 오류가 발생했습니다."); e != nil {
			return nil, e
		}
		return okResp(fmt.Sprintf("FCM 토큰이 백그라운드에서 갱신되었습니다. 사유: %s", reason), member.MtIdx, true, previewPtr())
	}
	return okResp("FCM 토큰이 백그라운드에서 유효합니다.", member.MtIdx, true, previewPtr())
}

// CleanupExpiredTokens는 POST /cleanup-expired-tokens(무인증). 삭제 no-op, 카운트만 집계.
func (s *MemberFCMTokenService) CleanupExpiredTokens() (*dto.MemberFCMTokenResponse, *FCMErr) {
	total, withPush1, err := s.members.CountExpiredTokens(time.Now())
	if err != nil {
		return nil, &FCMErr{500, "FCM 토큰 정리 중 내부 서버 오류가 발생했습니다."}
	}
	msg := fmt.Sprintf("만료된 FCM 토큰 정리 완료 (정리: %d개, 알림: %d명)", total, withPush1)
	return &dto.MemberFCMTokenResponse{Success: true, Message: msg, MtIdx: 0, HasToken: false, TokenPreview: strPtr("")}, nil
}

// ResetInvalidTokens는 POST /reset-invalid-tokens. cleaned_count 항상 0, total_checked=토큰보유수.
func (s *MemberFCMTokenService) ResetInvalidTokens() (*dto.MemberFCMTokenResponse, *FCMErr) {
	total, err := s.members.CountMembersWithToken()
	if err != nil {
		return nil, &FCMErr{500, "잘못된 FCM 토큰 정리 중 내부 서버 오류가 발생했습니다."}
	}
	msg := fmt.Sprintf("잘못된 FCM 토큰 정리 완료 (정리: 0개, 확인: %d개)", total)
	return &dto.MemberFCMTokenResponse{Success: true, Message: msg, MtIdx: 0, HasToken: false, TokenPreview: strPtr("")}, nil
}

// NotifyTokenRefresh는 POST /notify-token-refresh?mt_idx=. _send_token_refresh_notification은 log-only no-op.
func (s *MemberFCMTokenService) NotifyTokenRefresh(mtIdx int) (*dto.MemberFCMTokenResponse, *FCMErr) {
	member, err := s.members.GetByID(mtIdx)
	if err != nil {
		return nil, &FCMErr{500, "토큰 갱신 알림 전송 중 내부 서버 오류가 발생했습니다."}
	}
	if member == nil {
		return nil, &FCMErr{404, fmt.Sprintf(memberNotFoundMsgFmt, mtIdx)}
	}
	hasToken := member.MtTokenID != nil
	preview := ""
	if hasToken {
		preview = maskToken(derefStr(member.MtTokenID))
	}
	return okResp("토큰 갱신 알림이 전송되었습니다.", member.MtIdx, hasToken, strPtr(preview))
}

// StatusOf는 GET /status/{mt_idx}.
func (s *MemberFCMTokenService) StatusOf(mtIdx int) (*dto.MemberFCMTokenStatusResponse, *FCMErr) {
	member, err := s.members.GetByID(mtIdx)
	if err != nil {
		return nil, &FCMErr{500, "FCM 토큰 상태 조회 중 서버 오류가 발생했습니다."}
	}
	if member == nil {
		return nil, &FCMErr{404, fmt.Sprintf(memberNotFoundMsgFmt, mtIdx)}
	}
	tok := derefStr(member.MtTokenID)
	hasToken := tok != ""
	var preview *string
	if hasToken {
		preview = strPtr(maskToken(tok))
	}
	isExpired := false
	isNear := false
	if member.MtTokenExpiryDate != nil {
		now := time.Now()
		if now.After(*member.MtTokenExpiryDate) {
			isExpired = true
		} else if daysBetween(*member.MtTokenExpiryDate, now) <= 7 {
			isNear = true
		}
	}
	return &dto.MemberFCMTokenStatusResponse{
		MtIdx: member.MtIdx, HasToken: hasToken, TokenPreview: preview,
		MtLevel: member.MtLevel, MtStatus: member.MtStatus,
		LastUpdated: pyISOPtr(member.MtUdate), TokenUpdatedAt: pyISOPtr(member.MtTokenUpdatedAt),
		TokenExpiryDate: pyISOPtr(member.MtTokenExpiryDate),
		IsTokenExpired:  isExpired, IsTokenNearExpiry: isNear,
	}, nil
}

// applyTokenUpdate는 mt_token_id 설정 + (isNewToken 시) updated_at/expiry +90d + 항상 mt_udate.
func (s *MemberFCMTokenService) applyTokenUpdate(member *model.Member, fcmToken string, isNewToken bool) *FCMErr {
	now := time.Now()
	fields := map[string]interface{}{"mt_token_id": fcmToken, "mt_udate": now}
	if isNewToken {
		fields["mt_token_updated_at"] = now
		fields["mt_token_expiry_date"] = now.Add(90 * 24 * time.Hour)
	}
	return s.update(member.MtIdx, fields, "FCM 토큰 등록/업데이트 중 서버 오류가 발생했습니다.")
}

func (s *MemberFCMTokenService) update(mtIdx int, fields map[string]interface{}, errMsg string) *FCMErr {
	if err := s.members.UpdateColumns(mtIdx, fields); err != nil {
		return &FCMErr{500, errMsg}
	}
	return nil
}

// RestoreToken은 DEBUG trigger-update에서 원래 토큰으로 복원할 때 사용한다(mt_token_id만 UPDATE).
func (s *MemberFCMTokenService) RestoreToken(mtIdx int, token string) error {
	return s.members.UpdateColumns(mtIdx, map[string]interface{}{"mt_token_id": token})
}
