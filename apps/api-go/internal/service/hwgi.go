package service

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/bluemusk/smap_next_go/internal/model"
)

// HwgiService는 Python `app/api/v1/endpoints/hwgi.py`(한화 점검)를 이식한다. raw SQL 특성이라 GORM 직접 사용.
type HwgiService struct {
	db   *gorm.DB
	base string // PUBLIC_API_BASE_URL(rstrip '/')
}

func NewHwgi(db *gorm.DB, publicBase string) *HwgiService {
	return &HwgiService{db: db, base: strings.TrimRight(publicBase, "/")}
}

// absolutize는 Python _absolutize_photo_url: 빈/http(s) URL·base 없음이면 원본, 아니면 base prefix.
func (s *HwgiService) absolutize(url string) string {
	if url == "" {
		return url
	}
	if strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") {
		return url
	}
	if s.base == "" {
		return url
	}
	if strings.HasPrefix(url, "/") {
		return s.base + url
	}
	return s.base + "/" + url
}

func hwgiDateToday() time.Time {
	n := dbUTCNow().Local() // 서버 로컬 날짜(Python date.today())
	return time.Date(n.Year(), n.Month(), n.Day(), 0, 0, 0, 0, n.Location())
}

// AllData는 GET /hwgi/all-data: 3테이블을 지점별(bt_idx) dict로 조립한다.
func (s *HwgiService) AllData() (map[string]map[string]interface{}, error) {
	var insps []model.HwgiInspection
	if err := s.db.Select("it_idx", "bt_idx", "it_inspector", "it_visitor", "it_fp_interviewee", "it_opinion_interviewee").
		Find(&insps).Error; err != nil {
		return nil, err
	}
	var items []model.HwgiInspectionItem
	if err := s.db.Select("ii_idx", "it_idx", "bt_idx", "ii_category", "ii_item_id", "ii_status", "ii_memo").
		Find(&items).Error; err != nil {
		return nil, err
	}
	var photos []model.HwgiInspectionPhoto
	if err := s.db.Select("ip_idx", "ii_item_id", "bt_idx", "ip_file_path").
		Find(&photos).Error; err != nil {
		return nil, err
	}

	data := map[string]map[string]interface{}{}
	get := func(bid string) map[string]interface{} {
		if data[bid] == nil {
			data[bid] = map[string]interface{}{}
		}
		return data[bid]
	}
	nz := func(p *string) bool { return p != nil && *p != "" } // Python truthy(빈문자열 제외)

	for i := range insps {
		in := &insps[i]
		d := get(strconv.Itoa(in.BtIdx))
		if nz(in.ItInspector) {
			d["inspectorName"] = *in.ItInspector
		}
		if nz(in.ItVisitor) {
			d["visitorName"] = *in.ItVisitor
		}
		if nz(in.ItFpInterviewee) {
			d["fpInterviewee"] = *in.ItFpInterviewee
		}
		if nz(in.ItOpinionInterviewee) {
			d["opinionInterviewee"] = *in.ItOpinionInterviewee
		}
	}
	for i := range items {
		it := &items[i]
		d := get(strconv.Itoa(it.BtIdx))
		d[it.IiItemID] = map[string]interface{}{"status": it.IiStatus, "memo": it.IiMemo}
	}
	for i := range photos {
		p := &photos[i]
		d := get(strconv.Itoa(p.BtIdx))
		itemID := ""
		if p.IiItemID != nil {
			itemID = *p.IiItemID
		}
		im, ok := d[itemID].(map[string]interface{})
		if !ok {
			im = map[string]interface{}{}
			d[itemID] = im
		}
		arr, _ := im["photos"].([]interface{})
		arr = append(arr, map[string]interface{}{"ip_idx": p.IpIdx, "url": s.absolutize(p.IpFilePath)})
		im["photos"] = arr
	}
	return data, nil
}

// HwgiInspItemInput은 BulkSaveRequest.items 1건(InspectionItem).
type HwgiInspItemInput struct {
	ItemID   string
	Category string
	Status   *string
	Memo     *string
}

// HwgiBulkInput은 BulkSaveRequest(검증 완료).
type HwgiBulkInput struct {
	BtIdx                                                 int
	Inspector, Visitor, FpInterviewee, OpinionInterviewee *string
	Items                                                 []HwgiInspItemInput
}

// BulkSave는 POST /hwgi/bulk-save: inspection + 항목 upsert(tx).
func (s *HwgiService) BulkSave(req HwgiBulkInput) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		today := hwgiDateToday()
		var insp model.HwgiInspection
		err := tx.Select("it_idx").Where("bt_idx = ?", req.BtIdx).First(&insp).Error
		if err == nil {
			if e := tx.Model(&model.HwgiInspection{}).Where("it_idx = ?", insp.ItIdx).Updates(map[string]interface{}{
				"it_inspector":           req.Inspector,
				"it_visitor":             req.Visitor,
				"it_fp_interviewee":      req.FpInterviewee,
				"it_opinion_interviewee": req.OpinionInterviewee,
				"it_date":                today,
			}).Error; e != nil {
				return e
			}
		} else if errors.Is(err, gorm.ErrRecordNotFound) {
			insp = model.HwgiInspection{
				BtIdx: req.BtIdx, ItInspector: req.Inspector, ItVisitor: req.Visitor,
				ItFpInterviewee: req.FpInterviewee, ItOpinionInterviewee: req.OpinionInterviewee, ItDate: &today,
			}
			if e := tx.Select("bt_idx", "it_inspector", "it_visitor", "it_fp_interviewee", "it_opinion_interviewee", "it_date").
				Create(&insp).Error; e != nil {
				return e
			}
		} else {
			return err
		}
		itIdx := insp.ItIdx

		for _, it := range req.Items {
			var item model.HwgiInspectionItem
			e := tx.Select("ii_idx").Where("it_idx = ? AND ii_item_id = ?", itIdx, it.ItemID).First(&item).Error
			if e == nil {
				if e2 := tx.Model(&model.HwgiInspectionItem{}).Where("ii_idx = ?", item.IiIdx).Updates(map[string]interface{}{
					"ii_status": it.Status, "ii_memo": it.Memo, "ii_category": it.Category,
				}).Error; e2 != nil {
					return e2
				}
			} else if errors.Is(e, gorm.ErrRecordNotFound) {
				ni := model.HwgiInspectionItem{
					ItIdx: itIdx, BtIdx: req.BtIdx, IiCategory: it.Category, IiItemID: it.ItemID,
					IiStatus: it.Status, IiMemo: it.Memo,
				}
				if e2 := tx.Select("it_idx", "bt_idx", "ii_category", "ii_item_id", "ii_status", "ii_memo").
					Create(&ni).Error; e2 != nil {
					return e2
				}
			} else {
				return e
			}
		}
		return nil
	})
}

// UploadPhotoDB는 upload-photo의 DB 부분(inspection/item upsert + photo INSERT, tx). 파일 저장은 핸들러.
// 반환: ip_idx. Python과 동일하게 it_idx/ii_idx 없으면 생성(ii_category='env').
func (s *HwgiService) UploadPhotoDB(btIdx int, itemID, urlPath, filename string) (int, error) {
	var ipIdx int
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var insp model.HwgiInspection
		e := tx.Select("it_idx").Where("bt_idx = ?", btIdx).First(&insp).Error
		var itIdx int
		if e == nil {
			itIdx = insp.ItIdx
		} else if errors.Is(e, gorm.ErrRecordNotFound) {
			today := hwgiDateToday()
			ni := model.HwgiInspection{BtIdx: btIdx, ItDate: &today}
			if e2 := tx.Select("bt_idx", "it_date").Create(&ni).Error; e2 != nil {
				return e2
			}
			itIdx = ni.ItIdx
		} else {
			return e
		}

		var item model.HwgiInspectionItem
		e = tx.Select("ii_idx").Where("it_idx = ? AND ii_item_id = ?", itIdx, itemID).First(&item).Error
		var iiIdx int
		if e == nil {
			iiIdx = item.IiIdx
		} else if errors.Is(e, gorm.ErrRecordNotFound) {
			ni := model.HwgiInspectionItem{ItIdx: itIdx, BtIdx: btIdx, IiCategory: "env", IiItemID: itemID}
			if e2 := tx.Select("it_idx", "bt_idx", "ii_category", "ii_item_id").Create(&ni).Error; e2 != nil {
				return e2
			}
			iiIdx = ni.IiIdx
		} else {
			return e
		}

		var sortOrder int
		if e2 := tx.Model(&model.HwgiInspectionPhoto{}).
			Select("COALESCE(MAX(ip_sort_order), -1) + 1").Where("ii_idx = ?", iiIdx).
			Scan(&sortOrder).Error; e2 != nil {
			return e2
		}

		p := model.HwgiInspectionPhoto{
			IiIdx: iiIdx, IiItemID: &itemID, ItIdx: itIdx, BtIdx: btIdx,
			IpFilePath: urlPath, IpFileName: &filename, IpSortOrder: &sortOrder,
		}
		if e2 := tx.Select("ii_idx", "ii_item_id", "it_idx", "bt_idx", "ip_file_path", "ip_file_name", "ip_sort_order").
			Create(&p).Error; e2 != nil {
			return e2
		}
		ipIdx = p.IpIdx
		return nil
	})
	return ipIdx, err
}

// PhotoFilePath는 delete-photo용: ip_file_path 조회. found=false→404.
func (s *HwgiService) PhotoFilePath(ipIdx int) (string, bool, error) {
	var p model.HwgiInspectionPhoto
	e := s.db.Select("ip_file_path").Where("ip_idx = ?", ipIdx).First(&p).Error
	if errors.Is(e, gorm.ErrRecordNotFound) {
		return "", false, nil
	}
	if e != nil {
		return "", false, e
	}
	return p.IpFilePath, true, nil
}

// DeletePhotoDB는 delete-photo의 DB 삭제.
func (s *HwgiService) DeletePhotoDB(ipIdx int) error {
	return s.db.Where("ip_idx = ?", ipIdx).Delete(&model.HwgiInspectionPhoto{}).Error
}

// Absolutize는 핸들러가 upload-photo 응답 URL 절대화에 쓴다.
func (s *HwgiService) Absolutize(url string) string { return s.absolutize(url) }
