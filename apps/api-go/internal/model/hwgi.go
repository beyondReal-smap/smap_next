package model

import "time"

// HwgiInspection은 hwgi_inspection_t(한화 디지털화상창구 점검 기록)와 1:1 대응한다.
type HwgiInspection struct {
	ItIdx                int        `gorm:"column:it_idx;primaryKey;autoIncrement"`
	BtIdx                int        `gorm:"column:bt_idx"`
	ItInspector          *string    `gorm:"column:it_inspector"`
	ItVisitor            *string    `gorm:"column:it_visitor"`
	ItFpInterviewee      *string    `gorm:"column:it_fp_interviewee"`
	ItOpinionInterviewee *string    `gorm:"column:it_opinion_interviewee"`
	ItDate               *time.Time `gorm:"column:it_date"`
	ItStatus             *string    `gorm:"column:it_status"`
	ItWdate              *time.Time `gorm:"column:it_wdate"`
	ItUdate              *time.Time `gorm:"column:it_udate"`
}

func (HwgiInspection) TableName() string { return "hwgi_inspection_t" }

// HwgiInspectionItem은 hwgi_inspection_item_t(점검 항목)와 1:1 대응한다.
type HwgiInspectionItem struct {
	IiIdx       int        `gorm:"column:ii_idx;primaryKey;autoIncrement"`
	ItIdx       int        `gorm:"column:it_idx"`
	BtIdx       int        `gorm:"column:bt_idx"`
	IiCategory  string     `gorm:"column:ii_category"`
	IiItemID    string     `gorm:"column:ii_item_id"`
	IiStatus    *string    `gorm:"column:ii_status"`
	IiMemo      *string    `gorm:"column:ii_memo"`
	IiUpdatedBy *string    `gorm:"column:ii_updated_by"`
	IiWdate     *time.Time `gorm:"column:ii_wdate"`
	IiUdate     *time.Time `gorm:"column:ii_udate"`
}

func (HwgiInspectionItem) TableName() string { return "hwgi_inspection_item_t" }

// HwgiInspectionPhoto은 hwgi_inspection_photo_t(점검 사진)와 1:1 대응한다.
type HwgiInspectionPhoto struct {
	IpIdx       int        `gorm:"column:ip_idx;primaryKey;autoIncrement"`
	IiIdx       int        `gorm:"column:ii_idx"`
	IiItemID    *string    `gorm:"column:ii_item_id"`
	ItIdx       int        `gorm:"column:it_idx"`
	BtIdx       int        `gorm:"column:bt_idx"`
	IpFilePath  string     `gorm:"column:ip_file_path"`
	IpFileName  *string    `gorm:"column:ip_file_name"`
	IpSortOrder *int       `gorm:"column:ip_sort_order"`
	IpWdate     *time.Time `gorm:"column:ip_wdate"`
}

func (HwgiInspectionPhoto) TableName() string { return "hwgi_inspection_photo_t" }
