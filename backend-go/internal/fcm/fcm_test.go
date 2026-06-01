package fcm

import "testing"

// newTestClient는 firebase 초기화 없이 페이로드 빌더만 테스트하기 위한 Client다.
func newTestClient() *Client {
	return &Client{
		available:        false,
		androidChannelID: "com.dmonster.smap-Smap",
		apnsTopic:        "com.dmonster.smap",
	}
}

func TestBuildMessage_Notification(t *testing.T) {
	c := newTestClient()
	badge := 3
	m := Message{
		Token:         "tok123",
		Title:         "제목",
		Body:          "본문",
		Data:          map[string]string{"k": "v"},
		Badge:         &badge,
		TimeSensitive: true,
	}
	out := c.buildMessage(m)

	if out.Token != "tok123" {
		t.Errorf("Token = %q", out.Token)
	}
	if out.Notification == nil || out.Notification.Title != "제목" || out.Notification.Body != "본문" {
		t.Errorf("Notification = %+v", out.Notification)
	}
	if out.Android == nil || out.Android.Notification == nil || out.Android.Notification.ChannelID != "com.dmonster.smap-Smap" {
		t.Errorf("Android channel = %+v", out.Android)
	}
	if out.Android.Notification.Sound != "default" {
		t.Errorf("Android sound = %q, want default", out.Android.Notification.Sound)
	}
	if out.APNS == nil || out.APNS.Headers["apns-topic"] != "com.dmonster.smap" {
		t.Errorf("apns-topic = %v", out.APNS)
	}
	if out.APNS.Payload.Aps.Sound != "default" {
		t.Errorf("aps sound = %q, want default", out.APNS.Payload.Aps.Sound)
	}
	if out.APNS.Payload.Aps.Badge == nil || *out.APNS.Payload.Aps.Badge != 3 {
		t.Errorf("aps badge = %v, want 3", out.APNS.Payload.Aps.Badge)
	}
	if out.APNS.Payload.CustomData["interruption-level"] != "time-sensitive" {
		t.Errorf("interruption-level missing: %v", out.APNS.Payload.CustomData)
	}
}

func TestBuildMessage_Silent(t *testing.T) {
	c := newTestClient()
	m := Message{
		Token:  "tok",
		Silent: true,
		Data:   map[string]string{"type": "silent"},
	}
	out := c.buildMessage(m)

	if out.Notification != nil {
		t.Errorf("silent push should have no Notification: %+v", out.Notification)
	}
	if out.APNS == nil || !out.APNS.Payload.Aps.ContentAvailable {
		t.Errorf("silent push should set content-available: %+v", out.APNS)
	}
	if out.APNS.Headers["apns-push-type"] != "background" {
		t.Errorf("apns-push-type = %q, want background", out.APNS.Headers["apns-push-type"])
	}
}

func TestSend_Unavailable(t *testing.T) {
	c := newTestClient() // available=false
	if _, err := c.Send(nil, Message{Token: "x"}); err != ErrUnavailable {
		t.Errorf("Send on unavailable client = %v, want ErrUnavailable", err)
	}
	if _, err := c.SendEach(nil, []Message{{Token: "x"}}); err != ErrUnavailable {
		t.Errorf("SendEach on unavailable client = %v, want ErrUnavailable", err)
	}
}
