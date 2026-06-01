// Package fcm은 Firebase Cloud Messaging 발송 래퍼다(Phase 3).
//
// 이번 단계(무발송)에서는 인터페이스 + 초기화 + 페이로드 빌더만 제공한다. 실제 발송 잡
// (daily:silent / daily:battery / geofence 등)은 다음 단계에서 이 Sender를 호출한다.
//
// fail-soft 원칙: 자격증명이 없거나 초기화에 실패해도 New는 에러를 반환하지 않고
// available=false인 Client를 돌려준다(워커 부팅은 성공해야 함). Send 계열은 available=false면
// ErrUnavailable을 반환해 호출자가 명시적으로 인지하도록 한다 — 실패를 조용히 성공으로 흡수하지 않는다.
package fcm

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"

	"github.com/bluemusk/smap_next_go/internal/config"
)

// ErrUnavailable은 FCM 클라이언트가 초기화되지 않은(자격증명 없음/실패) 상태에서
// 발송을 시도할 때 반환된다.
var ErrUnavailable = errors.New("fcm: client unavailable (no credentials)")

// Message는 단일 디바이스 발송 요청이다. Python push_service의 payload 구조와 동등한
// 필드를 buildMessage가 messaging.Message로 변환한다.
type Message struct {
	Token            string            // FCM 디바이스 토큰(필수)
	Title            string            // 알림 제목(silent면 빈 문자열)
	Body             string            // 알림 본문(silent면 빈 문자열)
	Data             map[string]string // data 페이로드
	Badge            *int              // iOS 뱃지 수(nil이면 미설정)
	Silent           bool              // true면 content-available 무음 푸시(알림 비표시)
	TimeSensitive    bool              // true면 APNs interruption-level=time-sensitive
}

// Sender는 잡 핸들러가 의존하는 발송 동작(소비자 인터페이스)이다.
// *Client가 이를 만족하며, 테스트에서는 fake로 대체한다.
type Sender interface {
	Send(ctx context.Context, msg Message) (string, error)
	SendEach(ctx context.Context, msgs []Message) (*messaging.BatchResponse, error)
}

// Client는 firebase messaging 클라이언트 래퍼다. available=false면 자격증명 부재로
// 발송 불가 상태이며, 모든 Send 계열이 ErrUnavailable을 반환한다.
type Client struct {
	mc                  *messaging.Client
	available           bool
	androidChannelID    string
	apnsTopic           string // iOS Bundle ID(apns-topic 헤더)
	log                 *slog.Logger
}

// New는 cfg의 3단 폴백으로 firebase 앱을 초기화한다:
//  1. FirebaseCredentialsJSON(인라인 JSON) — option.WithCredentialsJSON
//  2. FirebaseCredentialsPath(파일 경로, 존재 시) — option.WithCredentialsFile
//  3. ProjectID만으로 firebase.NewApp(ADC 환경 가정)
//
// 어떤 경로로도 초기화에 실패하면 available=false Client를 반환한다(에러 없이 fail-soft).
func New(cfg *config.Config, log *slog.Logger) *Client {
	if log == nil {
		log = slog.Default()
	}
	c := &Client{
		available:        false,
		androidChannelID: cfg.FCMAndroidChannelID,
		apnsTopic:        cfg.IOSBundleID,
		log:              log,
	}

	app, err := newFirebaseApp(cfg)
	if err != nil {
		log.Warn("fcm disabled: firebase init failed", slog.String("err", err.Error()))
		return c
	}

	mc, err := app.Messaging(context.Background())
	if err != nil {
		log.Warn("fcm disabled: messaging client init failed", slog.String("err", err.Error()))
		return c
	}

	c.mc = mc
	c.available = true
	log.Info("fcm client initialized")
	return c
}

// newFirebaseApp은 3단 폴백으로 *firebase.App을 만든다.
func newFirebaseApp(cfg *config.Config) (*firebase.App, error) {
	fbCfg := &firebase.Config{}
	if cfg.FirebaseProjectID != "" {
		fbCfg.ProjectID = cfg.FirebaseProjectID
	}

	// 1) 인라인 JSON.
	if cfg.FirebaseCredentialsJSON != "" {
		return firebase.NewApp(context.Background(), fbCfg, option.WithCredentialsJSON([]byte(cfg.FirebaseCredentialsJSON)))
	}

	// 2) 파일 경로(존재할 때만).
	if cfg.FirebaseCredentialsPath != "" {
		if _, err := os.Stat(cfg.FirebaseCredentialsPath); err == nil {
			return firebase.NewApp(context.Background(), fbCfg, option.WithCredentialsFile(cfg.FirebaseCredentialsPath))
		}
	}

	// 3) ProjectID + ADC.
	if cfg.FirebaseProjectID != "" {
		return firebase.NewApp(context.Background(), fbCfg)
	}

	return nil, fmt.Errorf("no firebase credentials configured")
}

// Available은 발송 가능 상태인지 반환한다.
func (c *Client) Available() bool { return c != nil && c.available }

// Send는 단일 메시지를 발송하고 message ID를 반환한다. 비활성이면 ErrUnavailable.
func (c *Client) Send(ctx context.Context, msg Message) (string, error) {
	if !c.Available() {
		return "", ErrUnavailable
	}
	return c.mc.Send(ctx, c.buildMessage(msg))
}

// SendEach는 여러 메시지를 배치 발송한다. 비활성이면 ErrUnavailable.
func (c *Client) SendEach(ctx context.Context, msgs []Message) (*messaging.BatchResponse, error) {
	if !c.Available() {
		return nil, ErrUnavailable
	}
	built := make([]*messaging.Message, 0, len(msgs))
	for _, m := range msgs {
		built = append(built, c.buildMessage(m))
	}
	return c.mc.SendEach(ctx, built)
}

// buildMessage는 Message를 messaging.Message로 변환한다.
// silent면 buildSilent로 위임한다(content-available 무음 푸시).
func (c *Client) buildMessage(m Message) *messaging.Message {
	if m.Silent {
		return c.buildSilent(m)
	}

	out := &messaging.Message{
		Token: m.Token,
		Data:  m.Data,
		Notification: &messaging.Notification{
			Title: m.Title,
			Body:  m.Body,
		},
		Android: &messaging.AndroidConfig{
			Priority: "high",
			Notification: &messaging.AndroidNotification{
				ChannelID: c.androidChannelID,
				Sound:     "default",
			},
		},
		APNS: c.apnsConfig(m, false),
	}
	return out
}

// buildSilent는 무음(content-available) 푸시를 만든다.
// 알림 표시 없이 앱을 백그라운드에서 깨우는 용도(Python의 silent push와 동등).
func (c *Client) buildSilent(m Message) *messaging.Message {
	return &messaging.Message{
		Token: m.Token,
		Data:  m.Data,
		Android: &messaging.AndroidConfig{
			Priority: "high",
		},
		APNS: c.apnsConfig(m, true),
	}
}

// apnsConfig는 APNS 페이로드를 구성한다.
//   - apns-topic 헤더 = IOSBundleID
//   - silent면 content-available=1(무음), 아니면 sound=default(+badge, interruption-level)
func (c *Client) apnsConfig(m Message, silent bool) *messaging.APNSConfig {
	headers := map[string]string{}
	if c.apnsTopic != "" {
		headers["apns-topic"] = c.apnsTopic
	}

	aps := &messaging.Aps{}
	if silent {
		aps.ContentAvailable = true
		headers["apns-push-type"] = "background"
		headers["apns-priority"] = "5"
	} else {
		aps.Sound = "default"
		if m.Badge != nil {
			aps.Badge = m.Badge
		}
		aps.Alert = &messaging.ApsAlert{
			Title: m.Title,
			Body:  m.Body,
		}
		headers["apns-push-type"] = "alert"
	}

	cfgOut := &messaging.APNSConfig{
		Headers: headers,
		Payload: &messaging.APNSPayload{Aps: aps},
	}

	// interruption-level=time-sensitive는 표준 APS 필드가 아니라 커스텀 키로 전달한다.
	if m.TimeSensitive && !silent {
		cfgOut.Payload.CustomData = map[string]interface{}{
			"interruption-level": "time-sensitive",
		}
	}

	return cfgOut
}

// 컴파일 타임에 *Client가 Sender를 만족하는지 확인한다.
var _ Sender = (*Client)(nil)
