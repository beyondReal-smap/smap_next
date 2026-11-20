package dto

// LocationResponse는 Python LocationResponse(LocationBase 상속)와 키/순서·타입이 동일하다.
// ⚠️ schema-model 불일치: LocationBase가 선언한 slt_fine_location/slt_location_chk/slt_all_day는
// ORM 모델에 대응 컬럼이 없어 항상 null(여기서도 nil). LocationBase는 sgdt_idx만 두고 sgt_idx는 없다.
// slt_lat/slt_long은 Decimal→문자열("37.52460739277500"). 날짜는 서비스에서 isoformat으로 채운다.
type LocationResponse struct {
	InsertMtIdx     *int    `json:"insert_mt_idx"`
	MtIdx           *int    `json:"mt_idx"`
	SgdtIdx         *int    `json:"sgdt_idx"`
	SltTitle        *string `json:"slt_title"`
	SltAdd          *string `json:"slt_add"`
	SltLat          *string `json:"slt_lat"`
	SltLong         *string `json:"slt_long"`
	SltFineLocation *string `json:"slt_fine_location"` // 모델 미매핑 → 항상 null
	SltLocationChk  *string `json:"slt_location_chk"`  // 모델 미매핑 → 항상 null
	SltAllDay       *string `json:"slt_all_day"`       // 모델 미매핑 → 항상 null
	SltShow         *string `json:"slt_show"`
	SltEnterAlarm   *string `json:"slt_enter_alarm"`
	SltEnterChk     *string `json:"slt_enter_chk"`
	SltIdx          int     `json:"slt_idx"`
	SltWdate        *string `json:"slt_wdate"`
	SltUdate        *string `json:"slt_udate"`
	SltDdate        *string `json:"slt_ddate"`
	SltIcon         *string `json:"slt_icon"` // 사용자가 고른 아이콘 키, 없으면 null
}
