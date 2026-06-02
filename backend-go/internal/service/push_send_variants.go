package service

import (
	"context"
	"strconv"
	"time"

	"firebase.google.com/go/v4/messaging"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/fcm"
)

// pushErrKind는 발송 에러 분류(엔드포인트별 분기 매핑용).
type pushErrKind int

const (
	pushErrOther pushErrKind = iota
	pushErrUnregistered
	pushErrInvalidArg
)

// classifyKind는 Go firebase 에러를 분류한다. background/silent 엔드포인트는 Unregistered/InvalidArgument를
// 구분하고, ThirdPartyAuth 등 그 외는 other("Firebase 전송 실패")로 떨어진다(Python except 구조 동일).
func classifyKind(err error) pushErrKind {
	switch {
	case messaging.IsUnregistered(err):
		return pushErrUnregistered
	case messaging.IsInvalidArgument(err):
		return pushErrInvalidArg
	default:
		return pushErrOther
	}
}

// TestEcho는 Python /fcm_sendone/test를 이식한다(무발송·무DB, FCMSendRequest를 data에 그대로 반향).
func (s *PushSendService) TestEcho(echo dto.FCMTestEchoData) dto.FCMSendResponse {
	return dto.FCMSendResponse{
		Success: pushSUCCESS,
		Title:   "푸시발송(단건) 성공",
		Message: "푸시발송(단건) 성공했습니다.",
		Data:    echo,
	}
}

// TestSendToUser는 Python /fcm_sendone/test-send/{mt_idx}를 이식한다(테스트 푸시 실발송, push_log 미기록).
func (s *PushSendService) TestSendToUser(mtIdx int) dto.FCMSendResponse {
	member, err := s.members.GetByID(mtIdx)
	if err != nil {
		return pushResp(pushFAILURE, "테스트 푸시 실패", "테스트 푸시 전송 중 오류가 발생했습니다: "+err.Error())
	}
	if member == nil {
		return pushResp(pushFAILURE, "테스트 푸시 실패", "존재하지 않는 회원입니다.")
	}
	token := derefStr(member.MtTokenID)
	if token == "" {
		return pushResp(pushFAILURE, "테스트 푸시 실패", "FCM 토큰이 등록되지 않았습니다.")
	}
	if !s.fcm.Available() {
		return pushResp(pushFAILURE, "테스트 푸시 실패", "Firebase 서비스가 사용 불가능합니다.")
	}
	now := time.Now()
	title := "🧪 푸시 테스트 알림"
	content := "테스트 푸시 알림입니다. 수신 시간: " + now.Format("2006-01-02 15:04:05") + " | 회원 ID: " + strconv.Itoa(mtIdx)
	resp, sendErr := s.fcm.Send(context.Background(), buildPushMessage(token, title, content))
	if sendErr != nil {
		// Python: 모든 send 예외가 바깥 except로 흡수됨(특수분기 없음).
		return pushResp(pushFAILURE, "테스트 푸시 실패", "테스트 푸시 전송 중 오류가 발생했습니다: "+sendErr.Error())
	}
	return pushResp(pushSUCCESS, "테스트 푸시 전송 성공", "테스트 푸시가 성공적으로 전송되었습니다. (응답: "+resp+")")
}

// SendSilent는 Python /fcm_sendone/silent를 이식한다(Silent 푸시, push_log 미기록).
func (s *PushSendService) SendSilent(mtIdx int, reason string) dto.FCMSendResponse {
	member, err := s.members.GetByID(mtIdx)
	if err != nil {
		return pushResp(pushFAILURE, "Silent 푸시발송 실패", err.Error())
	}
	if member == nil {
		return pushResp(pushFAILURE, "Silent 푸시발송 실패", "존재하지 않는 회원입니다.")
	}
	token := derefStr(member.MtTokenID)
	if token == "" {
		return pushResp(pushFAILURE, "Silent 푸시발송 실패", "앱토큰이 존재하지 않습니다.")
	}
	if !s.fcm.Available() {
		return pushResp(pushFAILURE, "Silent 푸시발송 실패", "Firebase 서비스가 사용 불가능합니다. 관리자에게 문의하세요.")
	}
	if _, sendErr := s.fcm.Send(context.Background(), buildSilentMessage(token, reason)); sendErr != nil {
		switch classifyKind(sendErr) {
		case pushErrUnregistered:
			return pushResp(pushFAILURE, "Silent 푸시발송 실패 - 토큰 만료", "FCM 토큰이 만료되었습니다. 앱 재시작으로 토큰을 갱신해주세요.")
		case pushErrInvalidArg:
			return pushResp(pushFAILURE, "Silent 푸시발송 실패 - 잘못된 토큰", "FCM 토큰 형식이 잘못되었습니다. 앱 재시작으로 토큰을 갱신해주세요.")
		default:
			return pushResp(pushFAILURE, "Silent 푸시발송 실패", "Firebase 전송 실패: "+sendErr.Error())
		}
	}
	return pushResp(pushSUCCESS, "Silent 푸시발송 성공", "Silent 푸시발송 성공했습니다.")
}

// SendSilentBatch는 Python /fcm_sendone/silent-batch를 이식한다(전체 토큰 보유자 Silent 발송).
func (s *PushSendService) SendSilentBatch() dto.FCMSendResponse {
	members, err := s.members.GetTokenList()
	if err != nil {
		return pushResp(pushFAILURE, "Silent 푸시 배치 전송 실패", err.Error())
	}
	success := 0
	for i := range members {
		if _, e := s.fcm.Send(context.Background(), buildSilentMessage(derefStr(members[i].MtTokenID), "batch_token_refresh")); e == nil {
			success++
		}
	}
	return pushResp(pushSUCCESS, "Silent 푸시 배치 전송",
		"총 "+strconv.Itoa(len(members))+"명 중 "+strconv.Itoa(success)+"명에게 성공적으로 전송했습니다.")
}

// BackgroundInput은 BackgroundPushRequest(코어 7필드 + content_available/event_url/schedule_id).
type BackgroundInput struct {
	FCMSendInput
	ContentAvailable bool
	EventURL         string
	ScheduleID       string
}

// SendBackground는 Python /fcm_sendone/background를 이식한다.
// ⚠️ push_log를 모든 분기에 기록한다: 성공=2, 일반실패=3, 토큰없음=4, Firebase불가=5, 토큰만료=6, 잘못된토큰=7.
// plt_type은 'admin'→1 변환 없이 coerce(Python create_push_log(args) 직접).
func (s *PushSendService) SendBackground(in BackgroundInput) dto.FCMSendResponse {
	core := in.FCMSendInput
	pltType := mysqlCoerceInt(core.PltType)

	member, err := s.members.GetByID(core.MtIdx)
	if err != nil {
		return pushResp(pushFAILURE, "백그라운드 푸시발송 실패", err.Error())
	}
	if member == nil {
		return pushResp(pushFAILURE, "백그라운드 푸시발송 실패", "존재하지 않는 회원입니다.")
	}
	token := derefStr(member.MtTokenID)
	if token == "" {
		_ = s.writeLogPltType(core, member.MtIdx, 4, pltType)
		return pushResp(pushFAILURE, "백그라운드 푸시발송 실패", "앱토큰이 존재하지 않습니다.")
	}
	if !s.fcm.Available() {
		_ = s.writeLogPltType(core, member.MtIdx, 5, pltType)
		return pushResp(pushFAILURE, "백그라운드 푸시발송 실패", "Firebase 서비스가 사용 불가능합니다. 관리자에게 문의하세요.")
	}

	if _, sendErr := s.fcm.Send(context.Background(), buildBackgroundMessage(token, core.PltTitle, core.PltContent, in)); sendErr != nil {
		switch classifyKind(sendErr) {
		case pushErrUnregistered:
			_ = s.writeLogPltType(core, member.MtIdx, 6, pltType)
			return pushResp(pushFAILURE, "백그라운드 푸시발송 실패 - 토큰 만료", "FCM 토큰이 만료되었습니다. 앱 재시작으로 토큰을 갱신해주세요.")
		case pushErrInvalidArg:
			_ = s.writeLogPltType(core, member.MtIdx, 7, pltType)
			return pushResp(pushFAILURE, "백그라운드 푸시발송 실패 - 잘못된 토큰", "FCM 토큰 형식이 잘못되었습니다. 앱 재시작으로 토큰을 갱신해주세요.")
		default:
			_ = s.writeLogPltType(core, member.MtIdx, 3, pltType)
			return pushResp(pushFAILURE, "백그라운드 푸시발송 실패", "Firebase 전송 실패: "+sendErr.Error())
		}
	}
	_ = s.writeLogPltType(core, member.MtIdx, 2, pltType)
	return pushResp(pushSUCCESS, "백그라운드 푸시발송 성공", "백그라운드 푸시발송 성공했습니다.")
}

// buildSilentMessage는 Silent 푸시 메시지(content-available, 알림 미표시)를 만든다. Go fcm.buildSilent가
// notification 없이 content-available로 변환한다. data는 앱용(HTTP 응답 byte와 무관).
func buildSilentMessage(token, reason string) fcm.Message {
	data := map[string]string{
		"silent_push":        "true",
		"reason":             reason,
		"timestamp":          strconv.FormatInt(time.Now().UnixMilli(), 10),
		"token_refresh":      "true",
		"background_wake":    "true",
		"force_token_update": "true",
	}
	return fcm.Message{Token: token, Silent: true, Data: data}
}

// buildBackgroundMessage는 백그라운드 푸시 메시지(notification + content-available data)를 만든다.
// ⚠️ APNS content-available(앱 깨우기) 플래그는 fcm.Message가 silent에서만 설정 — background 깨우기 정밀도는
// device 한정 갭(HTTP 응답 byte·검증과 무관). notification(title/body)은 정상 도달.
func buildBackgroundMessage(token, title, content string, in BackgroundInput) fcm.Message {
	data := map[string]string{
		"title":             title,
		"body":              content,
		"content_available": boolDigit(in.ContentAvailable),
		"priority":          "high",
		"background_push":   "true",
		"timestamp":         strconv.FormatInt(time.Now().UnixMilli(), 10),
		"show_notification": "false",
	}
	if in.EventURL != "" {
		data["event_url"] = in.EventURL
	}
	if in.ScheduleID != "" {
		data["schedule_id"] = in.ScheduleID
	}
	return fcm.Message{Token: token, Title: title, Body: content, Data: data, TimeSensitive: true}
}

func boolDigit(b bool) string {
	if b {
		return "1"
	}
	return "0"
}
