package handler

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/auth"
	"github.com/bluemusk/smap_next_go/internal/config"
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// MemberWriteHandler는 Python members.py의 write 17종(google-login 제외 16종, google은 auth 재사용)을 이식한다.
type MemberWriteHandler struct {
	svc        *service.MemberWriteService
	cfg        *config.Config
	revocation auth.AccessRevocationChecker
}

// SetRevocation은 구 access token 무효 기준 조회기를 주입한다(비밀번호 변경 이전 토큰 거부).
func (h *MemberWriteHandler) SetRevocation(r auth.AccessRevocationChecker) { h.revocation = r }

func NewMemberWrite(svc *service.MemberWriteService, cfg *config.Config) *MemberWriteHandler {
	return &MemberWriteHandler{svc: svc, cfg: cfg}
}

func (h *MemberWriteHandler) optUID(c *gin.Context) (int, bool) {
	uid, ok := auth.ParseOptionalUserID(c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm)
	if !ok {
		return 0, false
	}
	// 비밀번호 변경 이전에 발급된 토큰은 인증 실패로 취급한다(Redis 장애 시에는 통과 + 경고 로그).
	if ident, state := auth.VerifyAccessTokenIdentity(c.GetHeader("Authorization"), h.cfg.JWTSecretKey, h.cfg.JWTAlgorithm); state == auth.TokenValid &&
		auth.AccessRevoked(h.revocation, nil, ident) {
		return 0, false
	}
	return uid, true
}

// ======================= 비밀번호 (verify/change) =======================

// VerifyPassword은 POST /members/verify-password. 인증/검증/오류 전부 HTTP 200 + {result,message,success}.
func (h *MemberWriteHandler) VerifyPassword(c *gin.Context) {
	body := bindJSONMap(c)
	var errs []valErr
	cur := reqNonBlankStr(body, "currentPassword", "현재 비밀번호를 입력해주세요.", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	uid, ok := h.optUID(c)
	if !ok {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "인증이 필요합니다.", Success: false})
		return
	}
	if h.svc.VerifyPassword(uid, cur) {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "Y", Message: "비밀번호가 확인되었습니다.", Success: true})
		return
	}
	writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "현재 비밀번호가 올바르지 않습니다.", Success: false})
}

// ChangePassword은 POST /members/change-password. 전부 HTTP 200 래핑.
func (h *MemberWriteHandler) ChangePassword(c *gin.Context) {
	body := bindJSONMap(c)
	var errs []valErr
	cur := reqNonBlankStr(body, "currentPassword", "현재 비밀번호를 입력해주세요.", &errs)
	newPwd := reqNewPassword(body, "newPassword", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	uid, ok := h.optUID(c)
	if !ok {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "인증이 필요합니다.", Success: false})
		return
	}
	found, err := h.svc.FindActive(uid)
	if err != nil {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "서버 오류가 발생했습니다.", Success: false})
		return
	}
	if !found {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "사용자를 찾을 수 없습니다.", Success: false})
		return
	}
	if !h.svc.VerifyPassword(uid, cur) {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "현재 비밀번호가 올바르지 않습니다.", Success: false})
		return
	}
	if h.svc.ChangePassword(uid, newPwd) {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "Y", Message: "비밀번호가 성공적으로 변경되었습니다.", Success: true})
		return
	}
	writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "비밀번호 변경에 실패했습니다.", Success: false})
}

// ======================= 인증 위임 (register/login) =======================

// Register은 POST /members/register. 항상 HTTP 200(service 흡수). 422는 스키마 검증 실패만.
func (h *MemberWriteHandler) Register(c *gin.Context) {
	in, errs := parseRegister(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	writeJSON(c, http.StatusOK, h.svc.Register(in))
}

// Login은 POST /members/login. 항상 HTTP 200(service 흡수). 토큰 미발급(data={"user":...}).
func (h *MemberWriteHandler) Login(c *gin.Context) {
	body := bindJSONMap(c)
	var errs []valErr
	mtID := uReqStr(body, "mt_id", &errs)
	mtPwd := uReqStr(body, "mt_pwd", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	writeJSON(c, http.StatusOK, h.svc.Login(mtID, mtPwd))
}

// ======================= 프로필/연락처 (update-profile/contact) =======================

// UpdateProfile은 POST /members/update-profile. 닉네임 중복체크 후 갱신. 전부 HTTP 200 래핑.
func (h *MemberWriteHandler) UpdateProfile(c *gin.Context) {
	body := bindJSONMap(c)
	var errs []valErr
	name := uReqStr(body, "mt_name", &errs)
	nickname := uReqStr(body, "mt_nickname", &errs)
	birth := uOptStr(body, "mt_birth", &errs)
	gender := uOptInt(body, "mt_gender", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	uid, ok := h.optUID(c)
	if !ok {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "인증이 필요합니다.", Success: false})
		return
	}
	dup, err := h.svc.CheckNicknameDup(uid, nickname)
	if err != nil {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "서버 오류가 발생했습니다.", Success: false})
		return
	}
	if dup {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "이미 사용 중인 닉네임입니다.", Success: false})
		return
	}
	if h.svc.UpdateProfile(uid, name, nickname, birth, gender) {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "Y", Message: "프로필이 성공적으로 업데이트되었습니다.", Success: true})
		return
	}
	writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "프로필 업데이트에 실패했습니다.", Success: false})
}

// UpdateContact은 POST /members/update-contact. 전화/이메일 중복체크 후 갱신. 전부 HTTP 200 래핑.
func (h *MemberWriteHandler) UpdateContact(c *gin.Context) {
	body := bindJSONMap(c)
	var errs []valErr
	hp := uReqStr(body, "mt_hp", &errs)
	email := uReqStr(body, "mt_email", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	uid, ok := h.optUID(c)
	if !ok {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "인증이 필요합니다.", Success: false})
		return
	}
	dupP, err := h.svc.CheckPhoneDup(uid, hp)
	if err != nil {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "서버 오류가 발생했습니다.", Success: false})
		return
	}
	if dupP {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "이미 사용 중인 전화번호입니다.", Success: false})
		return
	}
	dupE, err := h.svc.CheckEmailDup(uid, email)
	if err != nil {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "서버 오류가 발생했습니다.", Success: false})
		return
	}
	if dupE {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "이미 사용 중인 이메일입니다.", Success: false})
		return
	}
	if h.svc.UpdateContact(uid, hp, email) {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "Y", Message: "연락처가 성공적으로 업데이트되었습니다.", Success: true})
		return
	}
	writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "연락처 업데이트에 실패했습니다.", Success: false})
}

// ======================= 탈퇴 (withdraw) =======================

// Withdraw은 POST /members/withdraw. 전부 HTTP 200 래핑.
func (h *MemberWriteHandler) Withdraw(c *gin.Context) {
	body := bindJSONMap(c)
	var errs []valErr
	// mt_retire_chk: int required + validator(1-5)
	chkBefore := len(errs)
	chk := requiredIntField(body, "mt_retire_chk", &errs)
	if len(errs) == chkBefore && (chk < 1 || chk > 5) {
		errs = append(errs, valueErr("mt_retire_chk", "탈퇴 사유는 1-5 사이의 값이어야 합니다.", chk))
	}
	// mt_retire_etc: Optional[str]. ⚠️ Python WithdrawRequest.validate_etc_reason(chk==5면 필수)는
	// 실제로 발동하지 않는다(Pydantic v2 미작동, 422 없이 통과 — 라이브 확인) → 충실 이식: validator 재현 안 함.
	etc := uOptStr(body, "mt_retire_etc", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	uid, ok := h.optUID(c)
	if !ok {
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "인증이 필요합니다.", Success: false})
		return
	}
	switch h.svc.Withdraw(uid, chk, etc) {
	case "notfound":
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "사용자를 찾을 수 없습니다.", Success: false})
	case "already":
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "이미 탈퇴한 회원입니다.", Success: false})
	case "ok":
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "Y", Message: "회원 탈퇴가 완료되었습니다.", Success: true})
	default:
		writeJSON(c, http.StatusOK, dto.MemberResultMsg{Result: "N", Message: "서버 오류가 발생했습니다.", Success: false})
	}
}

// ======================= 동의 (consent/consent-all) =======================

// Consent은 POST /members/consent. 미인증 401(password계열과 달리). 성공 시 data:null.
func (h *MemberWriteHandler) Consent(c *gin.Context) {
	body := bindJSONMap(c)
	var errs []valErr
	field := reqConsentField(body, &errs)
	value := reqYNEnum(body, "value", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	uid, ok := h.optUID(c)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return
	}
	updated, err := h.svc.Consent(uid, field, value)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "서버 오류가 발생했습니다."})
		return
	}
	if !updated {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "동의 상태 변경에 실패했습니다."})
		return
	}
	writeJSON(c, http.StatusOK, dto.MemberConsentUpdateResponse{Success: true, Message: "동의 상태가 성공적으로 변경되었습니다.", Data: nil})
}

// ConsentAll은 POST /members/consent/all. 미인증 401.
func (h *MemberWriteHandler) ConsentAll(c *gin.Context) {
	body := bindJSONMap(c)
	var errs []valErr
	a1 := reqYNEnum(body, "mt_agree1", &errs)
	a2 := reqYNEnum(body, "mt_agree2", &errs)
	a3 := reqYNEnum(body, "mt_agree3", &errs)
	a4 := reqYNEnum(body, "mt_agree4", &errs)
	a5 := reqYNEnum(body, "mt_agree5", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	uid, ok := h.optUID(c)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return
	}
	updated, err := h.svc.ConsentAll(uid, a1, a2, a3, a4, a5)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "서버 오류가 발생했습니다."})
		return
	}
	if !updated {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "전체 동의 상태 변경에 실패했습니다."})
		return
	}
	writeJSON(c, http.StatusOK, dto.MemberConsentUpdateResponse{Success: true, Message: "전체 동의 상태가 성공적으로 변경되었습니다.", Data: nil})
}

// ======================= 약관 (terms) — 정상화(약관 5개 200) =======================

// Terms은 GET /members/terms. Python은 /{member_id}에 가려져 422(dead)지만, 사용자 결정에 따라
// Gin 정적 우선 등록으로 약관 5개를 정상 반환한다(TermInfo 스키마 필드명: last_updated/is_required/db_field).
func (h *MemberWriteHandler) Terms(c *gin.Context) {
	writeJSON(c, http.StatusOK, dto.MemberTermsListResponse{
		Success: true,
		Message: "약관 목록 조회 성공",
		Data: []dto.MemberTermInfo{
			{ID: "service", Title: "서비스 이용약관", Description: "SMAP 서비스 이용에 관한 약관", Version: "1.0", LastUpdated: "2024-01-01", IsRequired: true, DBField: "mt_agree1"},
			{ID: "privacy", Title: "개인정보 처리방침", Description: "개인정보 수집 및 이용에 관한 방침", Version: "1.0", LastUpdated: "2024-01-01", IsRequired: true, DBField: "mt_agree2"},
			{ID: "location", Title: "위치기반서비스 이용약관", Description: "위치정보 수집 및 이용에 관한 약관", Version: "1.0", LastUpdated: "2024-01-01", IsRequired: true, DBField: "mt_agree3"},
			{ID: "third_party", Title: "개인정보 제3자 제공", Description: "개인정보 제3자 제공에 관한 동의", Version: "1.0", LastUpdated: "2024-01-01", IsRequired: false, DBField: "mt_agree4"},
			{ID: "marketing", Title: "마케팅 정보 수신", Description: "마케팅 정보 수집 및 이용에 관한 동의", Version: "1.0", LastUpdated: "2024-01-01", IsRequired: false, DBField: "mt_agree5"},
		},
	})
}

// ======================= CRUD (create/put/delete/location) =======================

// Create은 POST /members/. MemberCreate(mt_pwd는 해시 저장, mt_type/level/status는 서버 강제) → MemberResponse.
func (h *MemberWriteHandler) Create(c *gin.Context) {
	in, errs := parseMemberCreate(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, ok := h.svc.Create(in)
	if !ok {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Update은 PUT /members/:member_id. exclude_unset 갱신, dict 응답(mt_wdate/udate=null). 404 "Member not found".
func (h *MemberWriteHandler) Update(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	present, errs := parseMemberUpdate(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, found, ok := h.svc.UpdateMember(id, present)
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Member not found"})
		return
	}
	if !ok {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Delete은 DELETE /members/:member_id. 소프트 삭제(mt_status=0). 404 "Member not found".
func (h *MemberWriteHandler) Delete(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	found, err := h.svc.DeleteMember(id)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Member not found"})
		return
	}
	writeJSON(c, http.StatusOK, dto.MemberSimpleSuccess{Success: true, Message: "Member deleted successfully"})
}

// UpdateLocation은 PATCH /members/:member_id/location. query lat/lng(required float). 응답=ORM MemberResponse.
func (h *MemberWriteHandler) UpdateLocation(c *gin.Context) {
	idStr := c.Param("member_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "member_id", idStr)
		return
	}
	var errs []valErr
	lat := floatQueryRequired(c, "lat", &errs)
	lng := floatQueryRequired(c, "lng", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, found, ok := h.svc.UpdateLocation(id, lat, lng)
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Member not found"})
		return
	}
	if !ok {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// ======================= 파일 I/O (upload/delete-profile-image) =======================

// UploadProfileImage은 POST /members/upload-profile-image. multipart, 5MB, image/*, {mt_idx}.jpg 저장.
func (h *MemberWriteHandler) UploadProfileImage(c *gin.Context) {
	fileHeader, ferr := c.FormFile("file")
	if ferr != nil {
		// File(...) required missing → FastAPI 422.
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": []valErr{{
			Type: "missing", Loc: []string{"body", "file"}, Msg: msgFieldRequired, Input: nil,
		}}})
		return
	}
	uid, ok := h.optUID(c)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return
	}
	// 파일 타입(content_type) 검사
	contentType := fileHeader.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "이미지 파일만 업로드 가능합니다."})
		return
	}
	// 내용 읽기 + 크기(5MB 초과 차단)
	src, err := fileHeader.Open()
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "프로필 사진 업로드 중 오류가 발생했습니다."})
		return
	}
	content, err := io.ReadAll(src)
	src.Close()
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "프로필 사진 업로드 중 오류가 발생했습니다."})
		return
	}
	size := len(content)
	if size > 5*1024*1024 {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "파일 크기는 5MB를 초과할 수 없습니다."})
		return
	}
	// 파일 저장(public/images/{mt_idx}.jpg, 절대경로) — Python과 동일 순서: 저장 후 member 조회(404)
	newFilename := strconv.Itoa(uid) + ".jpg"
	fullPath := filepath.Join(h.cfg.ProfileImageDir, newFilename)
	if err := os.MkdirAll(h.cfg.ProfileImageDir, 0o755); err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "프로필 사진 업로드 중 오류가 발생했습니다."})
		return
	}
	if err := os.WriteFile(fullPath, content, 0o644); err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "프로필 사진 업로드 중 오류가 발생했습니다."})
		return
	}
	fileURL := "/images/" + newFilename
	found, err := h.svc.SetProfileImage(uid, fileURL)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "프로필 사진 업로드 중 오류가 발생했습니다."})
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "사용자를 찾을 수 없습니다."})
		return
	}
	writeJSON(c, http.StatusOK, dto.UploadProfileResponse{
		Success: true,
		Message: "프로필 사진이 성공적으로 업로드되었습니다.",
		Data:    dto.UploadProfileData{FilePath: fileURL, FileName: newFilename, FileSize: size},
	})
}

// DeleteProfileImage은 DELETE /members/delete-profile-image. 파일 삭제 + mt_file1=NULL.
func (h *MemberWriteHandler) DeleteProfileImage(c *gin.Context) {
	uid, ok := h.optUID(c)
	if !ok {
		writeJSON(c, http.StatusUnauthorized, gin.H{"detail": "인증이 필요합니다."})
		return
	}
	found, oldFile, err := h.svc.ClearProfileImage(uid)
	if err != nil {
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "프로필 사진 삭제 중 오류가 발생했습니다."})
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "사용자를 찾을 수 없습니다."})
		return
	}
	// 기존 파일 삭제(Python: mt_file1.replace('/images/','') → UPLOAD_DIR/경로, exists면 remove).
	if oldFile != nil && *oldFile != "" {
		rel := strings.ReplaceAll(*oldFile, "/images/", "")
		full := filepath.Join(h.cfg.ProfileImageDir, rel)
		if _, statErr := os.Stat(full); statErr == nil {
			_ = os.Remove(full)
		}
	}
	writeJSON(c, http.StatusOK, dto.MemberSimpleSuccess{Success: true, Message: "프로필 사진이 성공적으로 삭제되었습니다."})
}

// ======================= 검증 헬퍼 =======================

// bindJSONMap은 요청 본문을 map으로 파싱한다(실패 시 빈 맵 — 필드별 missing 검증으로 이어짐).
func bindJSONMap(c *gin.Context) map[string]interface{} {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil || body == nil {
		body = map[string]interface{}{}
	}
	return body
}

// reqNonBlankStr은 필수 str + 공백 불가 validator(빈/공백 → value_error msg). currentPassword용.
func reqNonBlankStr(body map[string]interface{}, key, blankMsg string, errs *[]valErr) string {
	raw, ok := body[key]
	if !ok {
		*errs = append(*errs, valErr{Type: "missing", Loc: []string{"body", key}, Msg: msgFieldRequired, Input: body})
		return ""
	}
	s, oks := raw.(string)
	if !oks {
		*errs = append(*errs, valErr{Type: "string_type", Loc: []string{"body", key}, Msg: msgStringType, Input: raw})
		return ""
	}
	if strings.TrimSpace(s) == "" {
		*errs = append(*errs, valueErr(key, blankMsg, s))
		return ""
	}
	return s
}

// reqNewPassword은 ChangePasswordRequest.newPassword validator를 이식한다(빈/8자/대/소/숫자/특수 @$!%*?&).
func reqNewPassword(body map[string]interface{}, key string, errs *[]valErr) string {
	raw, ok := body[key]
	if !ok {
		*errs = append(*errs, valErr{Type: "missing", Loc: []string{"body", key}, Msg: msgFieldRequired, Input: body})
		return ""
	}
	s, oks := raw.(string)
	if !oks {
		*errs = append(*errs, valErr{Type: "string_type", Loc: []string{"body", key}, Msg: msgStringType, Input: raw})
		return ""
	}
	if strings.TrimSpace(s) == "" {
		*errs = append(*errs, valueErr(key, "새 비밀번호를 입력해주세요.", s))
		return ""
	}
	if len([]rune(s)) < 8 {
		*errs = append(*errs, valueErr(key, "새 비밀번호는 8자 이상이어야 합니다.", s))
		return ""
	}
	if !strings.ContainsFunc(s, func(r rune) bool { return r >= 'A' && r <= 'Z' }) {
		*errs = append(*errs, valueErr(key, "새 비밀번호는 대문자를 포함해야 합니다.", s))
		return ""
	}
	if !strings.ContainsFunc(s, func(r rune) bool { return r >= 'a' && r <= 'z' }) {
		*errs = append(*errs, valueErr(key, "새 비밀번호는 소문자를 포함해야 합니다.", s))
		return ""
	}
	if !strings.ContainsFunc(s, func(r rune) bool { return r >= '0' && r <= '9' }) {
		*errs = append(*errs, valueErr(key, "새 비밀번호는 숫자를 포함해야 합니다.", s))
		return ""
	}
	if !strings.ContainsAny(s, "@$!%*?&") {
		*errs = append(*errs, valueErr(key, "새 비밀번호는 특수문자(@$!%*?&)를 포함해야 합니다.", s))
		return ""
	}
	return s
}

// parseRegister은 RegisterRequest를 Pydantic 필드 순서대로 검증한다(validator 없음, 타입/필수만).
func parseRegister(c *gin.Context) (service.MemberRegisterInput, []valErr) {
	body := bindJSONMap(c)
	var errs []valErr
	var in service.MemberRegisterInput
	in.MtType = uIntDefault(body, "mt_type", 1, &errs)
	in.MtLevel = uIntDefault(body, "mt_level", 2, &errs)
	in.MtStatus = uIntDefault(body, "mt_status", 1, &errs)
	in.MtID = uReqStr(body, "mt_id", &errs) // RegisterRequest mt_id:str (MemberCreate와 달리 validator 없음)
	in.MtPwd = uOptStr(body, "mt_pwd", &errs)
	in.MtName = uReqStr(body, "mt_name", &errs)
	in.MtNickname = uReqStr(body, "mt_nickname", &errs)
	in.MtEmail = uOptStr(body, "mt_email", &errs) // validator 없음
	in.MtBirth = uOptStr(body, "mt_birth", &errs) // raw str(date 변환은 service)
	in.MtGender = uOptInt(body, "mt_gender", &errs)
	in.MtFile1 = uOptStr(body, "mt_file1", &errs)
	in.MtOnboarding = uStrDefault(body, "mt_onboarding", "N", &errs)
	in.MtShow = uStrDefault(body, "mt_show", "Y", &errs)
	in.MtAgree1 = reqBool(body, "mt_agree1", &errs)
	in.MtAgree2 = reqBool(body, "mt_agree2", &errs)
	in.MtAgree3 = reqBool(body, "mt_agree3", &errs)
	in.MtAgree4 = optBoolDefault(body, "mt_agree4", false, &errs)
	in.MtAgree5 = optBoolDefault(body, "mt_agree5", false, &errs)
	in.MtTokenID = uOptStr(body, "mt_token_id", &errs)
	in.MtPush1 = optBoolDefault(body, "mt_push1", true, &errs)
	in.MtLat = uFloat(body, "mt_lat", &errs)
	in.MtLong = uFloat(body, "mt_long", &errs)
	in.MtGoogleID = uOptStr(body, "mt_google_id", &errs)
	in.MtKakaoID = uOptStr(body, "mt_kakao_id", &errs)
	in.MtAppleID = uOptStr(body, "mt_apple_id", &errs)
	return in, errs
}

// uStrDefault은 Optional[str]=default(미제공/null→default, 비문자열→string_type 422).
func uStrDefault(body map[string]interface{}, key, def string, errs *[]valErr) string {
	raw, ok := body[key]
	if !ok || raw == nil {
		return def
	}
	if s, oks := raw.(string); oks {
		return s
	}
	*errs = append(*errs, valErr{Type: "string_type", Loc: []string{"body", key}, Msg: msgStringType, Input: raw})
	return def
}

// reqBool은 필수 bool(미제공→missing, 비bool→bool_type). RegisterRequest mt_agree1~3.
func reqBool(body map[string]interface{}, key string, errs *[]valErr) bool {
	raw, ok := body[key]
	if !ok {
		*errs = append(*errs, valErr{Type: "missing", Loc: []string{"body", key}, Msg: msgFieldRequired, Input: body})
		return false
	}
	if b, okb := raw.(bool); okb {
		return b
	}
	*errs = append(*errs, valErr{Type: "bool_type", Loc: []string{"body", key}, Msg: "Input should be a valid boolean", Input: raw})
	return false
}

// floatQueryRequired은 필수 float 쿼리(미존재→missing, 파싱불가→float_parsing). PATCH location lat/lng.
func floatQueryRequired(c *gin.Context, key string, errs *[]valErr) float64 {
	v, exists := c.GetQuery(key)
	if !exists {
		*errs = append(*errs, valErr{Type: "missing", Loc: []string{"query", key}, Msg: msgFieldRequired, Input: nil})
		return 0
	}
	f, e := strconv.ParseFloat(strings.TrimSpace(v), 64)
	if e != nil {
		*errs = append(*errs, qErr("float_parsing", key, "Input should be a valid number, unable to parse string as a number", v))
		return 0
	}
	return f
}

// reqConsentField은 ConsentUpdate.field validator(str required + mt_agree1~5 화이트리스트).
func reqConsentField(body map[string]interface{}, errs *[]valErr) string {
	raw, ok := body["field"]
	if !ok {
		*errs = append(*errs, valErr{Type: "missing", Loc: []string{"body", "field"}, Msg: msgFieldRequired, Input: body})
		return ""
	}
	s, oks := raw.(string)
	if !oks {
		*errs = append(*errs, valErr{Type: "string_type", Loc: []string{"body", "field"}, Msg: msgStringType, Input: raw})
		return ""
	}
	if !consentFieldSet[s] {
		*errs = append(*errs, valueErr("field", "유효하지 않은 필드입니다. 허용된 필드: ['mt_agree1', 'mt_agree2', 'mt_agree3', 'mt_agree4', 'mt_agree5']", s))
		return ""
	}
	return s
}

var consentFieldSet = map[string]bool{"mt_agree1": true, "mt_agree2": true, "mt_agree3": true, "mt_agree4": true, "mt_agree5": true}

// reqYNEnum은 필수 YNEnum(미제공→missing, Y/N 아님→enum). ConsentUpdate.value / ConsentUpdateAll.mt_agree*.
func reqYNEnum(body map[string]interface{}, key string, errs *[]valErr) string {
	raw, ok := body[key]
	if !ok {
		*errs = append(*errs, valErr{Type: "missing", Loc: []string{"body", key}, Msg: msgFieldRequired, Input: body})
		return ""
	}
	if s, oks := raw.(string); oks && ynEnumSet[s] {
		return s
	}
	e := valErr{Type: "enum", Loc: []string{"body", key}, Msg: "Input should be 'Y' or 'N'", Input: raw}
	e.Ctx = map[string]any{"expected": "'Y' or 'N'"}
	*errs = append(*errs, e)
	return ""
}
