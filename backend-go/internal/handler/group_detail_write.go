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

// parseGroupDetailUpdate는 GroupDetailUpdate의 모델 매핑 가능 필드만 present-기반으로 파싱한다.
// (sgt_idx/mt_idx=int, sgdt_owner_chk/leader_chk/group_chk/push_chk=string). 미매핑 스키마 필드는 무시
// (Python setattr이 무영속하므로 동등). int 타입오류만 422.
func parseGroupDetailUpdate(c *gin.Context) (map[string]interface{}, []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	present := map[string]interface{}{}
	var errs []valErr
	bodyOptInt(body, "sgt_idx", present, &errs)
	bodyOptInt(body, "mt_idx", present, &errs)
	bodyOptStr(body, "sgdt_owner_chk", present, &errs)
	bodyOptStr(body, "sgdt_leader_chk", present, &errs)
	bodyOptStr(body, "sgdt_group_chk", present, &errs)
	bodyOptStr(body, "sgdt_push_chk", present, &errs)
	return present, errs
}
