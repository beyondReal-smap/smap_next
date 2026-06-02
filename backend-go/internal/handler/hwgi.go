package handler

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// HwgiHandler는 Python hwgi.py(한화 점검) 5종을 이식한다. 전부 무인증.
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

// UploadPhoto는 POST /hwgi/upload-photo: base64 디코드 → 파일 저장 → DB 기록.
func (h *HwgiHandler) UploadPhoto(c *gin.Context) {
	body := bindJSONMap(c)
	var errs []valErr
	btIdx := requiredIntField(body, "bt_idx", &errs)
	itemID := uReqStr(body, "item_id", &errs)
	imgB64 := uReqStr(body, "image_base64", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
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
	if _, statErr := os.Stat(full); statErr == nil {
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
