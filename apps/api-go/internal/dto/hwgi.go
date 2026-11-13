package dto

// hwgi(한화 점검) write 응답 DTO. Python `app/api/v1/endpoints/hwgi.py` 이식.

// HwgiAllDataResponse는 GET /hwgi/all-data. data는 지점별(bt_idx) 동적 dict라 interface{}.
// ⚠️ data 내부 키 순서는 동적(Python dict 삽입순서 vs Go map)이라 byte 동등 대신 구조 동등으로 검증한다.
type HwgiAllDataResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
}

// HwgiSimpleResponse는 {success:true}(bulk-save, delete-photo).
type HwgiSimpleResponse struct {
	Success bool `json:"success"`
}

// HwgiPhotoData는 upload-photo 성공 시 photo dict(ip_idx, url 순서).
type HwgiPhotoData struct {
	IpIdx int    `json:"ip_idx"`
	URL   string `json:"url"`
}

// HwgiUploadResponse는 POST /hwgi/upload-photo 성공 응답({success, photo}).
type HwgiUploadResponse struct {
	Success bool          `json:"success"`
	Photo   HwgiPhotoData `json:"photo"`
}
