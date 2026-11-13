package service

import (
	"context"
	"strconv"
	"strings"
	"time"

	"firebase.google.com/go/v4/messaging"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/fcm"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// SUCCESS/FAILURE는 Python fcm_sendone의 응답 success 문자열 상수.
const (
	pushSUCCESS = "true"
	pushFAILURE = "false"
)

// pushSendMemberRepo는 PushSendService가 의존하는 회원 조회(GetByID 무필터, 전체발송용 토큰목록).
type pushSendMemberRepo interface {
	GetByID(mtIdx int) (*model.Member, error)
	GetTokenList() ([]model.Member, error)
}

// pushLogWriter는 push_log INSERT.
type pushLogWriter interface {
	Create(p *model.PushLog) error
}

// pushSender는 FCM 발송 + 가용성(fcm.Client 만족).
type pushSender interface {
	Send(ctx context.Context, msg fcm.Message) (string, error)
	Available() bool
}

// PushSendService는 Python app/api/v1/endpoints/fcm_sendone.py의 단건/전체 발송을 이식한다.
// ⚠️ 폴백(email/SMS)은 이식하지 않는다(Phase 3 잡과 동일 정책 — 응답 byte엔 무관, fire-and-forget).
// ⚠️ 토큰 무효화는 no-op이다 — Python `_handle_token_invalidation`의 DB 변경부가 주석처리(no-op)이므로
//
//	실패 분기에서 DB를 건드리지 않고 응답만 반환한다(충실).
type PushSendService struct {
	members pushSendMemberRepo
	logs    pushLogWriter
	fcm     pushSender
}

func NewPushSend(members pushSendMemberRepo, logs pushLogWriter, sender pushSender) *PushSendService {
	return &PushSendService{members: members, logs: logs, fcm: sender}
}

// FCMSendInput은 FCMSendRequest(plt_type/sst_idx/plt_condition/plt_memo/mt_idx/plt_title/plt_content).
type FCMSendInput struct {
	PltType      string
	SstIdx       string
	PltCondition string
	PltMemo      string
	MtIdx        int
	PltTitle     string
	PltContent   string
}

// SendOne은 Python send_fcm_push_notification을 이식한다.
func (s *PushSendService) SendOne(in FCMSendInput) dto.FCMSendResponse {
	// mt_idx==0: FCM 토큰 보유 전체 사용자에게 발송(N+1) 후 공지형 로그 1건.
	if in.MtIdx == 0 {
		members, err := s.members.GetTokenList()
		if err != nil {
			return pushResp(pushFAILURE, "푸시발송(단건) 실패", err.Error())
		}
		success := 0
		for i := range members {
			if _, e := s.fcm.Send(context.Background(), buildPushMessage(derefStr(members[i].MtTokenID), in.PltTitle, in.PltContent)); e == nil {
				success++
			}
		}
		if err := s.writeLog(in, 0, 2); err != nil {
			return pushResp(pushFAILURE, "푸시발송(단건) 실패", err.Error())
		}
		return pushResp(pushSUCCESS, "전체 발송 성공",
			"총 "+strconv.Itoa(len(members))+"명 중 "+strconv.Itoa(success)+"명에게 푸시를 발송했습니다.")
	}

	member, err := s.members.GetByID(in.MtIdx)
	if err != nil {
		return pushResp(pushFAILURE, "푸시발송(단건) 실패", err.Error())
	}
	if member == nil {
		return pushResp(pushFAILURE, "푸시발송(단건) 실패", "존재하지 않는 회원입니다.")
	}
	token := derefStr(member.MtTokenID)
	if token == "" {
		return pushResp(pushFAILURE, "푸시발송(단건) 실패", "앱토큰이 존재하지 않습니다.")
	}
	if !s.fcm.Available() {
		return pushResp(pushFAILURE, "푸시발송(단건) 실패", "Firebase 서비스가 사용 불가능합니다. 관리자에게 문의하세요.")
	}

	if _, sendErr := s.fcm.Send(context.Background(), buildPushMessage(token, in.PltTitle, in.PltContent)); sendErr != nil {
		return classifyPushError(sendErr)
	}

	// 발송 성공 → 푸시 이력 저장(status=2). 저장 실패는 Python의 generic except 경로(user_message)로 흡수.
	if err := s.writeLog(in, member.MtIdx, 2); err != nil {
		return pushResp(pushFAILURE, "푸시발송(단건) 실패", "푸시 메시지 전송에 실패했습니다. 잠시 후 다시 시도해주세요.")
	}
	return pushResp(pushSUCCESS, "푸시발송(단건) 성공", "푸시발송(단건) 성공 및 이력이 저장되었습니다.")
}

// classifyPushError는 fcm_sendone의 messaging 예외 분기를 이식한다(토큰 무효화는 no-op).
func classifyPushError(err error) dto.FCMSendResponse {
	if messaging.IsUnregistered(err) {
		return pushResp(pushFAILURE, "푸시발송(단건) 실패 - 토큰 만료",
			"FCM 토큰이 만료되었습니다. 앱을 완전히 종료하고 재시작하여 새로운 토큰을 받아주세요.")
	}
	if messaging.IsThirdPartyAuthError(err) {
		return pushResp(pushFAILURE, "푸시발송(단건) 실패 - 잘못된 토큰",
			"FCM 토큰 형식이 잘못되었습니다. 앱을 완전히 종료하고 재시작하여 새로운 토큰을 받아주세요.")
	}
	// 일반 오류: Python user_message(token/network 키워드 분기).
	msg := "푸시 메시지 전송에 실패했습니다."
	low := strings.ToLower(err.Error())
	switch {
	case strings.Contains(low, "token"):
		msg += " 앱을 재시작하여 새로운 토큰을 받아주세요."
	case strings.Contains(low, "network"):
		msg += " 네트워크 연결을 확인해주세요."
	default:
		msg += " 잠시 후 다시 시도해주세요."
	}
	return pushResp(pushFAILURE, "푸시발송(단건) 실패", msg)
}

// writeLog는 Python create_push_log를 이식한다. plt_sdate/plt_wdate=now(datetime.now()=KST→time.Now()),
// plt_status, plt_read_chk='N', plt_show='Y'. plt_type 'admin'→1(Integer 컬럼 대응), sst_idx 문자열→int.
func (s *PushSendService) writeLog(in FCMSendInput, mtIdx, status int) error {
	// 단건 `/`은 plt_type 'admin'→1 변환 적용(Python log_args).
	return s.writeLogPltType(in, mtIdx, status, pushTypeToInt(in.PltType))
}

// writeLogPltType은 plt_type 정수값을 호출 측이 지정해 push_log를 INSERT한다.
// background는 변환 없이 coerce(Python create_push_log(args) 직접, 'admin'→1 미적용).
func (s *PushSendService) writeLogPltType(in FCMSendInput, mtIdx, status, pltType int) error {
	now := time.Now()
	sstIdx := mysqlCoerceInt(in.SstIdx)
	readChk := "N"
	show := "Y"
	return s.logs.Create(&model.PushLog{
		PltType:      &pltType,
		MtIdx:        &mtIdx,
		SstIdx:       &sstIdx,
		PltCondition: &in.PltCondition,
		PltMemo:      &in.PltMemo,
		PltTitle:     &in.PltTitle,
		PltContent:   &in.PltContent,
		PltSdate:     &now,
		PltStatus:    &status,
		PltReadChk:   &readChk,
		PltShow:      &show,
		PltWdate:     &now,
	})
}

// buildPushMessage는 fcm_sendone의 메시지 구성을 근사한다(iOS는 ':' 토큰 → time-sensitive + ios_delivery_mode).
// notification(title/body)이 도달을 좌우하며, data 필드는 앱용. HTTP 응답 byte와는 무관.
func buildPushMessage(token, title, content string) fcm.Message {
	ios := strings.Contains(token, ":")
	data := map[string]string{
		"title":             title,
		"body":              content,
		"click_action":      "OPEN_ACTIVITY",
		"notification_type": "standard_push",
		"timestamp":         strconv.FormatInt(time.Now().Unix(), 10),
	}
	if ios {
		data["ios_delivery_mode"] = "reliable"
	}
	return fcm.Message{Token: token, Title: title, Body: content, Data: data, TimeSensitive: ios}
}

func pushResp(success, title, message string) dto.FCMSendResponse {
	return dto.FCMSendResponse{Success: success, Title: title, Message: message}
}

// pushTypeToInt는 plt_type 문자열을 Integer 컬럼 값으로 변환한다. Python: 'admin'→'1'→1, 그 외 문자열은
// MySQL이 INT 컬럼 삽입 시 coerce(숫자 접두부, 비숫자→0).
func pushTypeToInt(pltType string) int {
	if pltType == "admin" {
		return 1
	}
	return mysqlCoerceInt(pltType)
}

// mysqlCoerceInt는 문자열을 MySQL의 string→INT 암묵 coerce처럼 변환한다(전체 숫자면 그 값, 아니면 0).
// 실 데이터(숫자 코드/"0")는 정확히 일치하며, 혼합 문자열("12abc")은 0으로 단순화(비관찰 side-effect).
func mysqlCoerceInt(s string) int {
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil {
		return 0
	}
	return n
}
