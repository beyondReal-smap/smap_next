package dto

// GMSimpleResponse는 add/remove/delete-path 공통 응답({success, message}, 키 순서 고정).
// add는 success가 true(추가/복구) 또는 false(이미 존재)일 수 있다.
type GMSimpleResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// GMRoleResponse는 PUT /{group_id}/role 응답({success, message, data}).
type GMRoleResponse struct {
	Success bool       `json:"success"`
	Message string     `json:"message"`
	Data    GMRoleData `json:"data"`
}

// GMRoleData는 role 응답의 data. Python dict 키 순서(sgdt_idx, sgt_idx, mt_idx, sgdt_leader_chk).
// sgt_idx=path의 group_id(int), mt_idx=body에서 추출한 원본값(interface{}로 보존: 정수/문자열),
// sgdt_leader_chk=커밋 후 DB 값(*string, NULL이면 null).
type GMRoleData struct {
	SgdtIdx       int         `json:"sgdt_idx"`
	SgtIdx        int         `json:"sgt_idx"`
	MtIdx         interface{} `json:"mt_idx"`
	SgdtLeaderChk *string     `json:"sgdt_leader_chk"`
}
