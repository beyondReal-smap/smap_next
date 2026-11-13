package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

// writeSocialVerifyError는 공급자 토큰 검증 실패를 401/502/503 {"detail": ...}로 응답한다.
// 검증 외 에러는 호출하지 않는다(소셜 로그인의 나머지 실패는 기존대로 200+success=false).
func writeSocialVerifyError(c *gin.Context, err error) {
	var ve *service.SocialVerifyError
	if errors.As(err, &ve) {
		writeJSON(c, ve.Status, gin.H{"detail": ve.Detail})
		return
	}
	writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "Internal Server Error"})
}

// KakaoLogin은 POST /auth/kakao-login. KakaoLoginRequest 검증(kakao_id·access_token 필수) → 항상 200.
func (h *AuthHandler) KakaoLogin(c *gin.Context) {
	in, accessToken, errs := parseKakaoBody(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, err := h.svc.KakaoLoginVerified(c.Request.Context(), in, accessToken, c.GetHeader("User-Agent"), clientIPHash(c))
	if err != nil {
		writeSocialVerifyError(c, err)
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// GoogleLogin은 POST /auth/google-login. 수동 파싱(Pydantic 우회, 항상 200+success).
func (h *AuthHandler) GoogleLogin(c *gin.Context) {
	body := map[string]interface{}{}
	if raw, err := c.GetRawData(); err == nil {
		_ = json.Unmarshal(raw, &body) // 파싱 실패해도 빈 맵으로 진행(Python과 동일)
	}
	in := service.GoogleInput{
		GoogleID:  jsonStr(body, "google_id"),
		Email:     jsonStr(body, "email"),
		Name:      jsonStr(body, "name"),
		GivenName: jsonStr(body, "given_name"),
		Image:     jsonStr(body, "image"),
	}
	resp, err := h.svc.GoogleLoginVerified(c.Request.Context(), in, jsonStr(body, "id_token"), false, c.GetHeader("User-Agent"))
	if err != nil {
		writeSocialVerifyError(c, err)
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// GoogleLoginStrict은 POST /members/google-login. /auth(수동파싱)와 달리 Pydantic GoogleLoginRequest
// 검증(google_id·email·name 필수 str → 422)을 거친 뒤 동일 service.GoogleLogin을 호출한다.
// 신규 사용자는 service에서 given_name AttributeError 재현으로 "Google 로그인 처리 중 오류" 반환.
func (h *AuthHandler) GoogleLoginStrict(c *gin.Context) {
	body := bindJSONMap(c)
	var errs []valErr
	gid := uReqStr(body, "google_id", &errs)
	email := uReqStr(body, "email", &errs)
	name := uReqStr(body, "name", &errs)
	img := uOptStr(body, "image", &errs)
	idToken := uOptStr(body, "id_token", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	in := service.GoogleInput{GoogleID: gid, Email: email, Name: name}
	if img != nil {
		in.Image = *img
	}
	token := ""
	if idToken != nil {
		token = *idToken
	}
	resp, err := h.svc.GoogleLoginVerified(c.Request.Context(), in, token, true, c.GetHeader("User-Agent"))
	if err != nil {
		writeSocialVerifyError(c, err)
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// AppleLogin은 POST /auth/apple-login. AppleLoginRequest 검증(userIdentifier 필수) → 항상 200.
func (h *AuthHandler) AppleLogin(c *gin.Context) {
	in, identityToken, errs := parseAppleBody(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, err := h.svc.AppleLoginVerified(c.Request.Context(), in, identityToken, c.GetHeader("User-Agent"))
	if err != nil {
		writeSocialVerifyError(c, err)
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// FindUserByEmail은 POST /auth/find-user-by-email. GoogleUserDataRequest{email 필수, google_id?}.
func (h *AuthHandler) FindUserByEmail(c *gin.Context) {
	email, googleID, errs := parseFindBody(c, "email")
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	writeJSON(c, http.StatusOK, h.svc.FindUserByEmail(email, googleID))
}

// FindUserByPhone은 POST /auth/find-user-by-phone. PhoneUserDataRequest{phone 필수, google_id?}.
func (h *AuthHandler) FindUserByPhone(c *gin.Context) {
	phone, googleID, errs := parseFindBody(c, "phone")
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	writeJSON(c, http.StatusOK, h.svc.FindUserByPhone(phone, googleID))
}

// --- body 파서 ---

// jsonStr은 map에서 문자열 값을 꺼낸다(문자열 아니면 "").
func jsonStr(body map[string]interface{}, key string) string {
	if v, ok := body[key].(string); ok {
		return v
	}
	return ""
}

// parseKakaoBody는 KakaoLoginRequest(kakao_id·access_token 필수)를 파싱한다. 필드순서대로 422 수집.
// access_token은 공급자 검증용으로 별도 반환한다.
func parseKakaoBody(c *gin.Context) (in service.KakaoInput, accessToken string, errs []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	in.KakaoID = requiredStringField(body, "kakao_id", &errs)
	in.Email = derefOpt(optStringField(body, "email", &errs))
	_ = derefOpt(optStringField(body, "nickname", &errs))
	in.ProfileImage = derefOpt(optStringField(body, "profile_image", &errs))
	accessToken = requiredStringField(body, "access_token", &errs)
	_ = derefOpt(optStringField(body, "fcm_token", &errs))
	in.DeviceID = derefOpt(optStringField(body, "device_id", &errs))
	in.DeviceModel = derefOpt(optStringField(body, "device_model", &errs))
	in.OsType = derefOpt(optStringField(body, "os_type", &errs))
	in.OsVersion = derefOpt(optStringField(body, "os_version", &errs))
	in.AppVersion = derefOpt(optStringField(body, "app_version", &errs))
	return in, accessToken, errs
}

// parseAppleBody는 AppleLoginRequest(userIdentifier 필수)를 파싱한다. identityToken(선택)은 공급자 검증용으로
// 별도 반환한다. authorizationCode는 서버가 쓰지 않는다.
func parseAppleBody(c *gin.Context) (in service.AppleInput, identityToken string, errs []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	in.UserIdentifier = requiredStringField(body, "userIdentifier", &errs)
	in.Email = derefOpt(optStringField(body, "email", &errs))
	in.UserName = derefOpt(optStringField(body, "userName", &errs))
	identityToken = derefOpt(optStringField(body, "identityToken", &errs))
	return in, identityToken, errs
}

// parseFindBody는 GoogleUserDataRequest/PhoneUserDataRequest를 파싱한다(idKey=email|phone 필수, google_id?).
func parseFindBody(c *gin.Context, idKey string) (idVal, googleID string, errs []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	idVal = requiredStringField(body, idKey, &errs)
	googleID = derefOpt(optStringField(body, "google_id", &errs))
	return idVal, googleID, errs
}
