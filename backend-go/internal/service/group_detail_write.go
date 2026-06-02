package service

import (
	"time"

	"github.com/bluemusk/smap_next_go/internal/dto"
)

// groupDetailUpdatableCols는 Python update_group_detail에서 실제 영속되는 컬럼이다.
// ⚠️ GroupDetailUpdate 스키마는 sgdt_discharge_chk/exit_chk/in_chk/schedule_chk/read_chk/enter_alarm/enter_chk
// 같은 모델 미존재 필드를 갖지만, SQLAlchemy setattr이 무시(미영속)한다. 모델 컬럼과 일치하는 것만 반영된다.
var groupDetailUpdatableCols = map[string]bool{
	"sgt_idx": true, "mt_idx": true, "sgdt_owner_chk": true,
	"sgdt_leader_chk": true, "sgdt_group_chk": true, "sgdt_push_chk": true,
}

// UpdateGroupDetail은 Python update_group_detail을 이식한다(exclude_unset, 모델 매핑 컬럼만 영속).
// found=false→404, ok=false→500.
func (s *GroupDetailService) UpdateGroupDetail(id int, fields map[string]interface{}) (resp *dto.GroupDetailResponse, found, ok bool) {
	gd, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if gd == nil {
		return nil, false, true
	}
	// 모델 미존재 스키마 필드는 제거(Python setattr 무시와 동등).
	apply := map[string]interface{}{}
	for k, v := range fields {
		if groupDetailUpdatableCols[k] {
			apply[k] = v
		}
	}
	if err := s.repo.UpdateFields(id, apply); err != nil {
		return nil, true, false
	}
	saved, err := s.repo.GetByID(id)
	if err != nil || saved == nil {
		return nil, true, false
	}
	r := toGroupDetailResponse(saved)
	return &r, true, true
}

// UpdateRole은 Python update_member_role을 이식한다. sgdt_leader_chk='Y'/'N' + sgdt_udate=utcnow()(dbUTCNow).
func (s *GroupDetailService) UpdateRole(id int, leaderChk string) (resp *dto.GroupDetailWriteResponse, found, ok bool) {
	gd, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if gd == nil {
		return nil, false, true
	}
	leader := "N"
	if leaderChk == "Y" {
		leader = "Y"
	}
	now := dbUTCNow().Truncate(time.Second)
	if err := s.repo.UpdateFields(id, map[string]interface{}{"sgdt_leader_chk": leader, "sgdt_udate": now}); err != nil {
		return nil, true, false
	}
	saved, err := s.repo.GetByID(id)
	if err != nil || saved == nil {
		return nil, true, false
	}
	return &dto.GroupDetailWriteResponse{
		Success: true, Message: "멤버 역할이 성공적으로 변경되었습니다.",
		Data: dto.GroupDetailRoleData{SgdtIdx: saved.SgdtIdx, SgdtLeaderChk: saved.SgdtLeaderChk, SgdtUdate: pyISOEmpty(saved.SgdtUdate)},
	}, true, true
}

// RemoveMember는 Python remove_member_from_group을 이식한다(body 무시, 항상 show='N'/exit='Y'/udate=utcnow()).
func (s *GroupDetailService) RemoveMember(id int) (resp *dto.GroupDetailWriteResponse, found, ok bool) {
	gd, err := s.repo.GetByID(id)
	if err != nil {
		return nil, false, false
	}
	if gd == nil {
		return nil, false, true
	}
	now := dbUTCNow().Truncate(time.Second)
	if err := s.repo.UpdateFields(id, map[string]interface{}{"sgdt_show": "N", "sgdt_exit": "Y", "sgdt_udate": now}); err != nil {
		return nil, true, false
	}
	saved, err := s.repo.GetByID(id)
	if err != nil || saved == nil {
		return nil, true, false
	}
	return &dto.GroupDetailWriteResponse{
		Success: true, Message: "멤버가 그룹에서 탈퇴되었습니다.",
		Data: dto.GroupDetailRemoveData{SgdtIdx: saved.SgdtIdx, SgdtShow: saved.SgdtShow, SgdtExit: saved.SgdtExit, SgdtUdate: pyISOEmpty(saved.SgdtUdate)},
	}, true, true
}

// DeleteGroupDetail은 Python delete_group_detail을 이식한다(소프트삭제 exit='Y'/show='N', sgdt_udate 미설정).
func (s *GroupDetailService) DeleteGroupDetail(id int) (found, ok bool) {
	gd, err := s.repo.GetByID(id)
	if err != nil {
		return false, false
	}
	if gd == nil {
		return false, true
	}
	if err := s.repo.UpdateFields(id, map[string]interface{}{"sgdt_exit": "Y", "sgdt_show": "N"}); err != nil {
		return true, false
	}
	return true, true
}
