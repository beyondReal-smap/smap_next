package service

import (
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// fcmTokenMemberRepo는 FCMTokenService가 의존하는 회원 조회/갱신(GetByID 무필터 + mt_token_id UPDATE).
type fcmTokenMemberRepo interface {
	GetByID(mtIdx int) (*model.Member, error)
	UpdateColumns(mtIdx int, fields map[string]interface{}) error
}

// FCMTokenService는 Python app/api/v1/endpoints/fcm_token.py를 이식한다.
// ⚠️ Python 원본은 firebase_service를 import하지 않아 silent push 호출이 NameError다 — 충실 이식상
//
//	/update의 silent push는 no-op(미발송), /notify-token-change는 항상 500(핸들러에서 처리).
type FCMTokenService struct {
	members fcmTokenMemberRepo
}

func NewFCMToken(members fcmTokenMemberRepo) *FCMTokenService {
	return &FCMTokenService{members: members}
}

// GetMember는 get_current_member의 mt_idx 회원 로드(무필터). 없으면 (nil, nil).
func (s *FCMTokenService) GetMember(mtIdx int) (*model.Member, error) {
	return s.members.GetByID(mtIdx)
}

// Status는 /fcm-token/status. has_token=토큰 truthy, token_preview=토큰[:20]+"..." 또는 null.
func (s *FCMTokenService) Status(m *model.Member) dto.FCMTokenResponse {
	tok := derefStr(m.MtTokenID)
	hasToken := tok != ""
	var preview *string
	if hasToken {
		p := firstRunes(tok, 20) + "..."
		preview = &p
	}
	return dto.FCMTokenResponse{
		ResultCode: 200, ResultMsg: "FCM 토큰 상태 조회 성공",
		ResultData: dto.FCMTokenStatusData{MtIdx: m.MtIdx, HasToken: hasToken, TokenPreview: preview},
	}
}

// Update는 /fcm-token/update. mt_token_id를 갱신하고 변경/발송 플래그를 응답한다.
// ⚠️ 실제 silent push는 하지 않는다(Python firebase_service NameError가 swallow되어 미발송).
// silent_push_sent = token_changed AND old_token is not None(빈문자열은 not None=true, Python 동일).
// DB 갱신 실패 시 ok=false → 핸들러가 500(Python resultData=str → ResponseValidationError).
func (s *FCMTokenService) Update(m *model.Member, newToken string) (dto.FCMTokenResponse, bool) {
	tokenChanged := m.MtTokenID == nil || *m.MtTokenID != newToken
	oldNotNil := m.MtTokenID != nil
	if err := s.members.UpdateColumns(m.MtIdx, map[string]interface{}{"mt_token_id": newToken}); err != nil {
		return dto.FCMTokenResponse{}, false
	}
	return dto.FCMTokenResponse{
		ResultCode: 200, ResultMsg: "FCM 토큰 업데이트 성공",
		ResultData: dto.FCMTokenUpdateData{MtIdx: m.MtIdx, TokenUpdated: true, TokenChanged: tokenChanged, SilentPushSent: tokenChanged && oldNotNil},
	}, true
}

// firstRunes는 Python s[:n](문자 단위 앞 n개)와 동등하다.
func firstRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}
