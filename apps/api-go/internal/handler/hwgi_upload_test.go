package handler

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/service"
)

func init() { gin.SetMode(gin.TestMode) }

// DB(service)는 nil이다: 아래 요청들은 모두 DB 접근 전에 거부돼야 한다(도달하면 nil 역참조로 실패).
func newHwgiTestRouter(t *testing.T, maxBytes int) (*gin.Engine, string) {
	t.Helper()
	dir := t.TempDir()
	h := NewHwgi(service.NewHwgi(nil, ""), &config.Config{HwgiUploadDir: filepath.Join(dir, "hwgi"), HwgiMaxUploadBytes: maxBytes})
	r := gin.New()
	r.POST("/hwgi/upload-photo", h.UploadPhoto)
	return r, dir
}

func postUpload(r *gin.Engine, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/hwgi/upload-photo", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func uploadBody(itemID string, raw []byte) string {
	return `{"bt_idx":1,"item_id":"` + itemID + `","image_base64":"` + base64.StdEncoding.EncodeToString(raw) + `"}`
}

func dirEmpty(t *testing.T, dir string) bool {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	return len(entries) == 0
}

func TestHwgiUploadRejectsPathTraversalItemID(t *testing.T) {
	r, dir := newHwgiTestRouter(t, 1024)
	bad := []string{
		"../../../etc", "..", ".", "a/b", `a\\b`, "../x", "x/../y", "/abs", "a..b", "has space", "tab\\t",
		"", strings.Repeat("a", 101), "x%2f..", "a;b", "a\\u0000b",
	}
	for _, id := range bad {
		w := postUpload(r, uploadBody(id, []byte("img")))
		if w.Code != http.StatusUnprocessableEntity {
			t.Errorf("item_id=%q: 422 기대, got %d %s", id, w.Code, w.Body.String())
		}
	}
	// 어떤 디렉터리/파일도 만들어지면 안 된다(업로드 루트 포함).
	if !dirEmpty(t, dir) {
		t.Errorf("거부된 요청이 파일시스템에 흔적을 남김")
	}
}

func TestHwgiUploadSizeLimit(t *testing.T) {
	r, dir := newHwgiTestRouter(t, 1024)
	// 디코드 후 1024바이트 초과 → 413 (본문은 읽기 한도 이내).
	if w := postUpload(r, uploadBody("item-1", make([]byte, 2000))); w.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("디코드 크기 초과: 413 기대, got %d %s", w.Code, w.Body.String())
	}
	// 본문 자체가 한도(환산+64KiB)를 크게 넘으면 읽는 도중 413.
	if w := postUpload(r, uploadBody("item-1", make([]byte, 200*1024))); w.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("본문 초과: 413 기대, got %d", w.Code)
	}
	if !dirEmpty(t, dir) {
		t.Errorf("거부된 업로드가 파일을 남김")
	}
}

func TestHwgiUploadValidationOrderAndShape(t *testing.T) {
	r, _ := newHwgiTestRouter(t, 1024)
	// 필수 필드 누락은 기존 FastAPI 형식 422(필드 검증)가 그대로 나간다.
	w := postUpload(r, `{"bt_idx":1}`)
	if w.Code != http.StatusUnprocessableEntity || !strings.Contains(w.Body.String(), `"type":"missing"`) {
		t.Errorf("기존 422 형식 유지: %d %s", w.Code, w.Body.String())
	}
}

func TestValidHwgiItemID(t *testing.T) {
	for _, ok := range []string{"item-1", "A_b.c", "점검항목1", "1", "a.b", strings.Repeat("a", 100)} {
		if !validHwgiItemID(ok) {
			t.Errorf("%q 는 허용돼야 함", ok)
		}
	}
	for _, bad := range []string{"", ".", "..", "a/b", "a..b", "a b", ".."} {
		if validHwgiItemID(bad) {
			t.Errorf("%q 는 거부돼야 함", bad)
		}
	}
}

func TestPathWithin(t *testing.T) {
	base := "/data/uploads/hwgi"
	cases := map[string]bool{
		"/data/uploads/hwgi/1/item/a.jpg":     true,
		"/data/uploads/hwgi/a.jpg":            true,
		"/data/uploads/hwgi":                  false,
		"/data/uploads/hwgi/../../etc/passwd": false,
		"/data/uploads/hwgi/1/../../../x":     false,
		"/data/uploads/hwgi2/a.jpg":           false,
		"/etc/passwd":                         false,
		"/data/uploads/hwgi/../hwgi/ok/a.jpg": true,
	}
	for target, want := range cases {
		if got := pathWithin(base, target); got != want {
			t.Errorf("pathWithin(%q) = %v, want %v", target, got, want)
		}
	}
}
