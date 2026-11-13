package handler

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// HwgiHandler는 Python hwgi.py(한화 점검) 5종을 이식한다. 전부 무인증.
// hwgi는 외부 프론트엔드(hwgi-cstmer.vercel.app, 한화 디지털화상창구 방문 점검 시스템)가 로그인 없이
// 호출하는 별도 시스템이라 사용자 인증을 붙이지 않는다. 대신 업로드 경로·크기를 서버에서 제한한다.
type HwgiHandler struct {
	svc *service.HwgiService
	cfg *config.Config
}

func NewHwgi(svc *service.HwgiService, cfg *config.Config) *HwgiHandler {
	return &HwgiHandler{svc: svc, cfg: cfg}
}

// AllData는 GET /hwgi/all-data. ⚠️ data 내부 키 순서는 동적(구조 검증).
func (h *HwgiHandler) AllData(c *gin.Context) {
	data, err := h.svc.AllData()
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, dto.HwgiAllDataResponse{Success: true, Data: data})
}

// BulkSave는 POST /hwgi/bulk-save: inspection + 항목 upsert.
func (h *HwgiHandler) BulkSave(c *gin.Context) {
	body := bindJSONMap(c)
	var errs []valErr
	btIdx := requiredIntField(body, "bt_idx", &errs)
	inspector := uOptStr(body, "inspector", &errs)
	visitor := uOptStr(body, "visitor", &errs)
	fp := uOptStr(body, "fp_interviewee", &errs)
	op := uOptStr(body, "opinion_interviewee", &errs)
	items := parseHwgiItems(body, &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	in := service.HwgiBulkInput{
		BtIdx: btIdx, Inspector: inspector, Visitor: visitor,
		FpInterviewee: fp, OpinionInterviewee: op, Items: items,
	}
	if err := h.svc.BulkSave(in); err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, dto.HwgiSimpleResponse{Success: true})
}

// hwgiItemIDPattern은 item_id 화이트리스트다: 글자·숫자·`_`·`-`·`.` 1~100자.
// item_id는 업로드 디렉터리 이름으로 쓰이므로 경로 구분자(슬래시·역슬래시)와 NUL, 공백은 허용하지 않는다.
var hwgiItemIDPattern = regexp.MustCompile(`^[\p{L}\p{N}_.\-]{1,100}$`)

// validHwgiItemID는 item_id가 디렉터리 이름으로 안전한지 검사한다(경로 순회 차단).
func validHwgiItemID(id string) bool {
	if !hwgiItemIDPattern.MatchString(id) || id == "." || strings.Contains(id, "..") {
		return false
	}
	return filepath.Base(id) == id
}

// readLimitedBody는 요청 본문을 maxBytes까지만 읽는다. 초과하면 tooLarge=true를 반환한다.
// 읽은 본문은 이후 bindJSONMap이 다시 읽을 수 있게 복원한다.
func readLimitedBody(c *gin.Context, maxBytes int64) (tooLarge bool, err error) {
	raw, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes))
	if err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			return true, nil
		}
		return false, err
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(raw))
	return false, nil
}

// UploadPhoto는 POST /hwgi/upload-photo: base64 디코드 → 파일 저장 → DB 기록.
// 요청 본문은 HWGI_MAX_UPLOAD_BYTES(디코드 후 크기 기준, base64 오버헤드 포함해 환산)를 넘으면 413,
// item_id가 화이트리스트를 벗어나면 422로 거부한다.
func (h *HwgiHandler) UploadPhoto(c *gin.Context) {
	maxDecoded := int64(h.cfg.HwgiMaxUploadBytes)
	// base64는 3바이트를 4글자로 늘리므로 본문 상한은 환산값 + JSON 여유분(64KiB).
	tooLarge, rerr := readLimitedBody(c, maxDecoded/3*4+4+64*1024)
	if rerr != nil {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "요청 본문을 읽을 수 없습니다."})
		return
	}
	if tooLarge {
		writeJSON(c, http.StatusRequestEntityTooLarge, gin.H{"detail": "업로드 크기 제한을 초과했습니다."})
		return
	}
	body := bindJSONMap(c)
	var errs []valErr
	btIdx := requiredIntField(body, "bt_idx", &errs)
	itemID := uReqStr(body, "item_id", &errs)
	imgB64 := uReqStr(body, "image_base64", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	if !validHwgiItemID(itemID) {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": []valErr{
			valueErr("item_id", "item_id에 사용할 수 없는 문자가 있습니다.", itemID),
		}})
		return
	}
	// base64 디코드(data URI prefix 제거)
	img := imgB64
	if i := strings.Index(img, ","); i >= 0 {
		img = img[i+1:]
	}
	raw, err := base64.StdEncoding.DecodeString(img)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if int64(len(raw)) > maxDecoded {
		writeJSON(c, http.StatusRequestEntityTooLarge, gin.H{"detail": "업로드 크기 제한을 초과했습니다."})
		return
	}
	// 파일명: {ts(ms)}_{uuid8}.jpg
	ts := time.Now().UnixMilli()
	rb := make([]byte, 4)
	_, _ = rand.Read(rb)
	short := hex.EncodeToString(rb)
	filename := strconv.FormatInt(ts, 10) + "_" + short + ".jpg"
	relDir := strconv.Itoa(btIdx) + "/" + itemID
	saveDir := filepath.Join(h.cfg.HwgiUploadDir, strconv.Itoa(btIdx), itemID)
	if err := os.MkdirAll(saveDir, 0o755); err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if err := os.WriteFile(filepath.Join(saveDir, filename), raw, 0o644); err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	urlPath := "/uploads/hwgi/" + relDir + "/" + filename

	ipIdx, err := h.svc.UploadPhotoDB(btIdx, itemID, urlPath, filename)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, dto.HwgiUploadResponse{
		Success: true,
		Photo:   dto.HwgiPhotoData{IpIdx: ipIdx, URL: h.svc.Absolutize(urlPath)},
	})
}

// DeletePhoto는 DELETE /hwgi/delete-photo/:photo_id: 파일 + DB 삭제. 404 "Photo not found".
func (h *HwgiHandler) DeletePhoto(c *gin.Context) {
	idStr := c.Param("photo_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "photo_id", idStr)
		return
	}
	filePath, found, err := h.svc.PhotoFilePath(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Photo not found"})
		return
	}
	// 파일 삭제(Python BACKEND_DIR/storage + ip_file_path.lstrip('/') = HwgiUploadDir + /uploads/hwgi 제거분).
	rel := strings.TrimPrefix(filePath, "/uploads/hwgi")
	full := filepath.Join(h.cfg.HwgiUploadDir, rel)
	if !pathWithin(h.cfg.HwgiUploadDir, full) {
		// 과거 업로드(item_id 검증 도입 전)가 DB에 남긴 경로가 업로드 디렉터리 밖을 가리키는 경우:
		// 임의 파일 삭제를 막기 위해 파일은 건드리지 않고 DB 행만 지운다.
		slog.Warn("hwgi_delete_photo_path_outside_upload_dir", slog.Int("photo_id", id))
	} else if _, statErr := os.Stat(full); statErr == nil {
		_ = os.Remove(full)
	}
	if err := h.svc.DeletePhotoDB(id); err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	writeJSON(c, http.StatusOK, dto.HwgiSimpleResponse{Success: true})
}

// GenerateReport는 POST /hwgi/generate-report. ⚠️ Python은 settings.OPENAI_API_KEY 미정의(AttributeError,
// try 블록 밖)로 검증 통과 시 항상 FastAPI 기본 500 "Internal Server Error"(plain text). OpenAI 미호출.
func (h *HwgiHandler) GenerateReport(c *gin.Context) {
	body := bindJSONMap(c)
	var errs []valErr
	_ = uReqStr(body, "branch_name", &errs)
	_ = uReqStr(body, "branch_address", &errs)
	_ = uReqStr(body, "prompt_data", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	// 검증 통과 → 항상 500(plain text, FastAPI 미처리 예외 기본 응답).
	c.String(http.StatusInternalServerError, "Internal Server Error")
}

// parseHwgiItems는 BulkSaveRequest.items(list[InspectionItem])를 파싱한다. item_id/category 필수, status/memo opt.
// ⚠️ nested loc의 인덱스는 Python(int) vs Go(string) 차이로 검증 422 byte는 미보장(정상 동작 위주).
func parseHwgiItems(body map[string]interface{}, errs *[]valErr) []service.HwgiInspItemInput {
	raw, ok := body["items"]
	if !ok || raw == nil {
		return nil // 기본 []
	}
	arr, ok := raw.([]interface{})
	if !ok {
		*errs = append(*errs, valErr{Type: "list_type", Loc: []string{"body", "items"}, Msg: "Input should be a valid list", Input: raw})
		return nil
	}
	out := make([]service.HwgiInspItemInput, 0, len(arr))
	for idx, el := range arr {
		m, ok := el.(map[string]interface{})
		if !ok {
			*errs = append(*errs, valErr{Type: "model_attributes_type", Loc: []string{"body", "items", strconv.Itoa(idx)},
				Msg: "Input should be a valid dictionary or object to extract fields from", Input: el})
			continue
		}
		var it service.HwgiInspItemInput
		it.ItemID = nestedReqStr(m, "item_id", idx, errs)
		it.Category = nestedReqStr(m, "category", idx, errs)
		if v, ok := m["status"].(string); ok {
			it.Status = &v
		}
		if v, ok := m["memo"].(string); ok {
			it.Memo = &v
		}
		out = append(out, it)
	}
	return out
}

func nestedReqStr(m map[string]interface{}, key string, idx int, errs *[]valErr) string {
	raw, present := m[key]
	if !present {
		*errs = append(*errs, valErr{Type: "missing", Loc: []string{"body", "items", strconv.Itoa(idx), key}, Msg: msgFieldRequired, Input: m})
		return ""
	}
	s, ok := raw.(string)
	if !ok {
		*errs = append(*errs, valErr{Type: "string_type", Loc: []string{"body", "items", strconv.Itoa(idx), key}, Msg: msgStringType, Input: raw})
		return ""
	}
	return s
}

// pathWithin은 target이 base 디렉터리 안(자기 자신 제외)에 있는지 검사한다.
func pathWithin(base, target string) bool {
	rel, err := filepath.Rel(filepath.Clean(base), filepath.Clean(target))
	if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return false
	}
	return true
}
