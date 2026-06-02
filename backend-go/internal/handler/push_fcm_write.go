package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/bluemusk/smap_next_go/internal/service"
)

// MarkDelivered는 POST /push-fcms/mark-delivered/:push_fcm_id.
// ⚠️ PushFCM에 delivered_at 컬럼이 없어 상태 변경 없는 no-op + 메시지(Python hasattr 분기 거짓).
// ⚠️ not-found 시 Python은 raise HTTPException(404)가 같은 함수 except에 잡혀 **500**으로 변환된다
//
//	(str(HTTPException(404,...))="404: ..."): {"detail":"메시지 상태 업데이트 중 오류 발생: 404: Push FCM not found"}.
func (h *PushFCMHandler) MarkDelivered(c *gin.Context) {
	id, ok := pushFCMPathID(c)
	if !ok {
		return
	}
	found, sok := h.svc.MarkDelivered(id)
	if !sok || !found {
		// 404·DB오류 모두 바깥 except로 흡수되어 500-wrap. not-found는 "404: Push FCM not found"가 {e}.
		writeJSON(c, http.StatusInternalServerError, gin.H{"detail": "메시지 상태 업데이트 중 오류 발생: 404: Push FCM not found"})
		return
	}
	writeJSON(c, http.StatusOK, gin.H{"message": "메시지가 전달 완료로 표시되었습니다."})
}

// Create는 POST /push-fcms/ — PushFCMCreate(전 필드 Optional) INSERT 후 재조회.
func (h *PushFCMHandler) Create(c *gin.Context) {
	in, _, errs := parsePushFCMBody(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, ok := h.svc.CreatePushFCM(in)
	if !ok {
		plainServerError(c)
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Update는 PUT /push-fcms/:push_fcm_id — exclude_unset. 404 "Push FCM not found".
func (h *PushFCMHandler) Update(c *gin.Context) {
	id, ok := pushFCMPathID(c)
	if !ok {
		return
	}
	_, present, errs := parsePushFCMBody(c)
	if len(errs) > 0 {
		writeJSON(c, http.StatusUnprocessableEntity, gin.H{"detail": errs})
		return
	}
	resp, found, sok := h.svc.UpdatePushFCM(id, present)
	if !sok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Push FCM not found"})
		return
	}
	writeJSON(c, http.StatusOK, resp)
}

// Delete는 DELETE /push-fcms/:push_fcm_id — 하드 삭제. 404 "Push FCM not found".
func (h *PushFCMHandler) Delete(c *gin.Context) {
	id, ok := pushFCMPathID(c)
	if !ok {
		return
	}
	found, sok := h.svc.DeletePushFCM(id)
	if !sok {
		plainServerError(c)
		return
	}
	if !found {
		writeJSON(c, http.StatusNotFound, gin.H{"detail": "Push FCM not found"})
		return
	}
	writeJSON(c, http.StatusOK, gin.H{"message": "Push FCM deleted successfully"})
}

func pushFCMPathID(c *gin.Context) (int, bool) {
	idStr := c.Param("push_fcm_id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		pathIntErr(c, "push_fcm_id", idStr)
		return 0, false
	}
	return id, true
}

// parsePushFCMBody는 PushFCMBase(전 Optional)를 필드 순서대로 파싱한다(create/update 공용).
func parsePushFCMBody(c *gin.Context) (in service.PushFCMWriteInput, present map[string]interface{}, errs []valErr) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]interface{}{}
	}
	present = map[string]interface{}{}
	// 순서: pft_code, pft_title, pft_content, pft_send_type, pft_send_mt_idx, pft_rdate, pft_url, pft_status, pft_show, pft_sdate, pft_edate
	in.PftCode = bodyOptStr(body, "pft_code", present, &errs)
	in.PftTitle = bodyOptStr(body, "pft_title", present, &errs)
	in.PftContent = bodyOptStr(body, "pft_content", present, &errs)
	in.PftSendType = bodyOptInt(body, "pft_send_type", present, &errs)
	in.PftSendMtIdx = bodyOptInt(body, "pft_send_mt_idx", present, &errs)
	in.PftRdate = bodyOptDatetime(body, "pft_rdate", present, &errs)
	in.PftURL = bodyOptStr(body, "pft_url", present, &errs)
	in.PftStatus = bodyOptInt(body, "pft_status", present, &errs)
	in.PftShow = bodyOptStr(body, "pft_show", present, &errs)
	in.PftSdate = bodyOptDatetime(body, "pft_sdate", present, &errs)
	in.PftEdate = bodyOptDatetime(body, "pft_edate", present, &errs)
	return in, present, errs
}
