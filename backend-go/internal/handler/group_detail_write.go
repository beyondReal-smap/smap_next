package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Create는 POST /group-details/ (무인증).
// ⚠️ Python create_group_detail은 GroupDetail(**dict)에 스키마-모델 불일치 필드(sgdt_*_chk)를 넘겨
//
//	SQLAlchemy TypeError → try/except 없음 → **항상 500 plain "Internal Server Error"**(라이브 확인).
func (h *GroupDetailHandler) Create(c *gin.Context) {
	internalServerErrorPlain(c)
}

// Update는 PUT /group-details/:group_detail_id (무인증). exclude_unset, 모델 매핑 컬럼만 영속.
func (h *GroupDetailHandler) Update(c *gin.Context) {
	id, ok := groupDetailPathID(c)
	if !ok {
		return
	}
	fields, errs := parseGroupDetailUpdate(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, found, sok := h.svc.UpdateGroupDetail(id, fields)
	if !sok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "GroupDetail not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// UpdateRole은 PUT /group-details/:group_detail_id/role (무인증). MemberRoleUpdate{sgdt_leader_chk 필수}.
func (h *GroupDetailHandler) UpdateRole(c *gin.Context) {
	id, ok := groupDetailPathID(c)
	if !ok {
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	var errs []valErr
	leader := requiredStringField(body, "sgdt_leader_chk", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, found, sok := h.svc.UpdateRole(id, leader)
	if !sok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "GroupDetail not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// RemoveMember는 PUT /group-details/:group_detail_id/remove (무인증). body 무시(항상 show='N'/exit='Y').
func (h *GroupDetailHandler) RemoveMember(c *gin.Context) {
	id, ok := groupDetailPathID(c)
	if !ok {
		return
	}
	resp, found, sok := h.svc.RemoveMember(id)
	if !sok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "GroupDetail not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Delete는 DELETE /group-details/:group_detail_id (무인증). 소프트삭제, {success, message}.
func (h *GroupDetailHandler) Delete(c *gin.Context) {
	id, ok := groupDetailPathID(c)
	if !ok {
		return
	}
	found, sok := h.svc.DeleteGroupDetail(id)
	if !sok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "GroupDetail not found"})
		return
	}
	writeJSON(c, http.StatusOK, okMessage{Success: true, Message: "GroupDetail deleted successfully"})
}

func groupDetailPathID(c *gin.Context) (int, bool) {
	idStr := c.Param("group_detail_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "group_detail_id", idStr)
		return 0, false
	}
	return id, true
}

// ynEnumSet/yndEnumSet은 package handler 공용 enum 허용값(app/models/enums.py 다수가 Y/N).
// GroupCheckEnum(sgdt_group_chk)만 Y/N/D. push_log의 ReadCheckEnum/ShowEnum 등도 ynEnumSet 재사용.
var (
	ynEnumSet  = map[string]bool{"Y": true, "N": true}
	yndEnumSet = map[string]bool{"Y": true, "N": true, "D": true}
)

// parseGroupDetailUpdate는 GroupDetailUpdate(=GroupDetailBase) 13필드를 Pydantic 선언 순서대로
// 검증한다(sgt_idx/mt_idx=int, 나머지 11개=Enum). 모델 미매핑 phantom 7필드도 present에 담아
// 응답 echo에 사용한다(Python setattr은 응답엔 반영되나 DB엔 미영속). 검증 실패는 선언 순서대로 422.
func parseGroupDetailUpdate(c *gin.Context) (map[string]interface{}, []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	present := map[string]interface{}{}
	var errs []valErr
	const yn, ynd = "'Y' or 'N'", "'Y', 'N' or 'D'"
	bodyOptInt(body, "sgt_idx", present, &errs)
	bodyOptInt(body, "mt_idx", present, &errs)
	bodyOptEnum(body, "sgdt_owner_chk", ynEnumSet, yn, present, &errs)
	bodyOptEnum(body, "sgdt_leader_chk", ynEnumSet, yn, present, &errs)
	bodyOptEnum(body, "sgdt_discharge_chk", ynEnumSet, yn, present, &errs)
	bodyOptEnum(body, "sgdt_group_chk", yndEnumSet, ynd, present, &errs)
	bodyOptEnum(body, "sgdt_exit_chk", ynEnumSet, yn, present, &errs)
	bodyOptEnum(body, "sgdt_push_chk", ynEnumSet, yn, present, &errs)
	bodyOptEnum(body, "sgdt_in_chk", ynEnumSet, yn, present, &errs)
	bodyOptEnum(body, "sgdt_schedule_chk", ynEnumSet, yn, present, &errs)
	bodyOptEnum(body, "sgdt_read_chk", ynEnumSet, yn, present, &errs)
	bodyOptEnum(body, "sgdt_enter_alarm", ynEnumSet, yn, present, &errs)
	bodyOptEnum(body, "sgdt_enter_chk", ynEnumSet, yn, present, &errs)
	return present, errs
}

// bodyOptEnum은 Optional Enum 필드를 검증한다(Pydantic str-Enum과 동등). 검증 통과한 값의 포인터를 반환
// (create처럼 입력 포인터가 필요한 호출용; 반환을 무시하면 present 맵만 채우는 호출도 가능).
// 미존재→nil, null→present[key]=nil(Optional None 허용)·nil, 허용값 문자열→present 기록·&값,
// 그 외(미허용 문자열·비문자열)→type:"enum" 422(ctx.expected=expected, input=원본 JSON값)·nil.
func bodyOptEnum(body map[string]interface{}, key string, allowed map[string]bool, expected string, present map[string]interface{}, errs *[]valErr) *string {
	raw, ok := body[key]
	if !ok {
		return nil
	}
	if raw == nil {
		present[key] = nil
		return nil
	}
	if s, oks := raw.(string); oks && allowed[s] {
		present[key] = s
		return &s
	}
	e := valErr{Type: "enum", Loc: []string{"body", key}, Msg: "Input should be " + expected, Input: raw}
	e.Ctx = map[string]any{"expected": expected}
	*errs = append(*errs, e)
	return nil
}
