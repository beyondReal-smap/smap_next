package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/service"
)

// Add는 POST /api/v1/group-members/add?group_id=&member_id= — 그룹에 멤버 추가(query param).
func (h *GroupMemberHandler) Add(c *gin.Context) {
	errs := make([]valErr, 0, 2)
	gid := requiredQueryInt(c, "group_id", &errs)
	mid := requiredQueryInt(c, "member_id", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, found, ok := h.svc.AddMember(gid, mid)
	if !ok {
		internalServerErrorPlain(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Member not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Remove는 DELETE /api/v1/group-members/remove?group_id=&member_id= — show='N' 소프트삭제.
func (h *GroupMemberHandler) Remove(c *gin.Context) {
	errs := make([]valErr, 0, 2)
	gid := requiredQueryInt(c, "group_id", &errs)
	mid := requiredQueryInt(c, "member_id", &errs)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	found, ok := h.svc.RemoveMember(gid, mid)
	if !ok {
		internalServerErrorPlain(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Member not found in the group"})
		return
	}
	// gin.H/map은 키를 알파벳 정렬하므로 키 순서(success,message) 보존을 위해 구조체 사용.
	writeJSON(c, http.StatusOK, dto.GMSimpleResponse{Success: true, Message: "Member removed from group successfully"})
}

// RemovePath는 DELETE /api/v1/group-members/:group_id/member/:member_id — show='N'+exit='Y'.
func (h *GroupMemberHandler) RemovePath(c *gin.Context) {
	gidStr := c.Param("group_id")
	gid, err := strconv.Atoi(gidStr)
	if err != nil {
		pathIntErr(c, "group_id", gidStr)
		return
	}
	midStr := c.Param("member_id")
	mid, err := strconv.Atoi(midStr)
	if err != nil {
		pathIntErr(c, "member_id", midStr)
		return
	}
	// G7: 본인 제거는 자진 탈퇴, 타인 제거는 그룹장의 강퇴(sgdt_discharge='Y' 기록). 그 외는 403.
	kind, allowed := h.group.Removal(c, gid, mid)
	if !allowed {
		return
	}
	found, ok, rerr := h.svc.RemoveMemberPath(gid, mid, kind)
	if errors.Is(rerr, service.ErrOwnerCannotLeave) {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": ownerCannotLeaveDetail})
		return
	}
	if !ok {
		internalServerErrorPlain(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Member not found in the group"})
		return
	}
	writeJSON(c, http.StatusOK, dto.GMSimpleResponse{Success: true, Message: "멤버가 그룹에서 내보내졌습니다."})
}

// UpdateRole은 PUT /api/v1/group-members/:group_id/role — 멤버 리더 역할 변경.
// member_id 추출은 "member_id" 키 존재 우선("mt_idx" fallback, 단 member_id 키가 있으면 fallback 안 함).
// is_leader: bool→'Y'/'N', 그 외→str(x).upper()(MySQL ENUM 위반 시 repo 에러→500).
func (h *GroupMemberHandler) UpdateRole(c *gin.Context) {
	gidStr := c.Param("group_id")
	gid, err := strconv.Atoi(gidStr)
	if err != nil {
		pathIntErr(c, "group_id", gidStr)
		return
	}
	// G7: 리더 지정·해제는 그룹장만.
	if !h.group.ManageGroup(c, gid) {
		return
	}
	raw, _ := io.ReadAll(c.Request.Body)

	// body는 dict 필수. 비-dict(array/scalar)면 dict_type 422.
	var m map[string]json.RawMessage
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	if err := dec.Decode(&m); err != nil {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": []valErr{{
			Type: "dict_type", Loc: []string{"body"}, Msg: "Input should be a valid dictionary",
			Input: decodeAnyNum(raw),
		}}})
		return
	}

	// member_id 추출: "member_id" 키 존재 시 그 값(null이어도 fallback 안 함), 없으면 "mt_idx".
	var midRaw interface{}
	if v, ok := m["member_id"]; ok {
		midRaw = decodeAnyNum(v)
	} else if v, ok := m["mt_idx"]; ok {
		midRaw = decodeAnyNum(v)
	}
	if !isTruthy(midRaw) {
		writeJSON(c, http.StatusBadRequest, gin.H{"detail": "member_id or mt_idx is required"})
		return
	}
	mid := toIntFromAny(midRaw)

	// is_leader 추출: "is_leader" 키 우선, "sgdt_leader_chk" fallback. nil(JSON null/미존재)이면 미변경.
	var ilRaw interface{}
	if v, ok := m["is_leader"]; ok {
		ilRaw = decodeAnyNum(v)
	} else if v, ok := m["sgdt_leader_chk"]; ok {
		ilRaw = decodeAnyNum(v)
	}
	leaderVal, leaderChange := "", false
	if ilRaw != nil {
		leaderVal, leaderChange = leaderToStr(ilRaw), true
	}

	resp, found, ok := h.svc.UpdateRole(gid, mid, midRaw, leaderVal, leaderChange)
	if !ok {
		internalServerErrorPlain(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Member not found in the group"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// decodeAnyNum은 json.RawMessage를 UseNumber로 디코드한다(정수/실수 표기 보존, Python int/float 구분).
func decodeAnyNum(raw json.RawMessage) interface{} {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var v interface{}
	if err := dec.Decode(&v); err != nil {
		return nil
	}
	return v
}

// isTruthy는 Python `if not x`의 부정(truthy 판정)을 재현한다.
func isTruthy(v interface{}) bool {
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case json.Number:
		f, err := x.Float64()
		if err != nil {
			return x.String() != "" && x.String() != "0"
		}
		return f != 0
	case string:
		return x != ""
	default:
		return true
	}
}

// leaderToStr은 Python is_leader 변환을 재현한다: bool→'Y'/'N', 그 외→str(x).upper().
func leaderToStr(v interface{}) string {
	switch x := v.(type) {
	case bool:
		if x {
			return "Y"
		}
		return "N"
	case json.Number:
		return strings.ToUpper(x.String())
	case string:
		return strings.ToUpper(x)
	default:
		return strings.ToUpper(fmt.Sprintf("%v", x))
	}
}

// toIntFromAny는 member_id를 sgt/mt 비교용 int로 변환한다(비정수면 0 → 매칭 0건 → 404).
func toIntFromAny(v interface{}) int {
	switch x := v.(type) {
	case json.Number:
		if n, err := x.Int64(); err == nil {
			return int(n)
		}
		if f, err := x.Float64(); err == nil {
			return int(f)
		}
		return 0
	case string:
		if n, err := strconv.Atoi(strings.TrimSpace(x)); err == nil {
			return n
		}
		return 0
	default:
		return 0
	}
}
