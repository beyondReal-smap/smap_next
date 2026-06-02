package service

import (
	"github.com/bluemusk/smap_next_go/internal/dto"
	"github.com/bluemusk/smap_next_go/internal/model"
)

// groupMemberWriteRepo는 group-members write 핸들러가 의존하는 데이터 접근 인터페이스.
// 기존 read 인터페이스(groupMemberRepo)와 분리해 NewGroupMember 시그니처를 보존한다.
type groupMemberWriteRepo interface {
	MemberExists(mtIdx int) (bool, error)
	FindGD(sgtIdx, mtIdx int, show string) (*model.GroupDetail, error)
	FindGDActive(sgtIdx, mtIdx int) (*model.GroupDetail, error)
	CreateGD(gd *model.GroupDetail) error
	UpdateGD(sgdtIdx int, fields map[string]interface{}) error
}

// SetWriteRepo는 write용 repo를 주입한다(read 전용 NewGroupMember와 분리, 선택적 주입).
func (s *GroupMemberService) SetWriteRepo(r groupMemberWriteRepo) {
	s.wrepo = r
}

// AddMember는 Python add_member_to_group을 이식한다.
//
//	found=false → 404 "Member not found"(멤버 미존재)
//	ok=false    → 500(repo 에러)
//	그 외 resp.Success로 분기(false=이미 존재, true=복구/신규).
func (s *GroupMemberService) AddMember(groupID, memberID int) (resp dto.GMSimpleResponse, found, ok bool) {
	exists, err := s.wrepo.MemberExists(memberID)
	if err != nil {
		return resp, false, false
	}
	if !exists {
		return resp, false, true // 404 "Member not found"
	}
	// 이미 그룹에 표시(show='Y') 중이면 변경 없음
	cur, err := s.wrepo.FindGD(groupID, memberID, "Y")
	if err != nil {
		return resp, true, false
	}
	if cur != nil {
		return dto.GMSimpleResponse{Success: false, Message: "Member is already in the group"}, true, true
	}
	// 이전에 삭제(show='N')된 행이면 show='Y'로 복구
	deleted, err := s.wrepo.FindGD(groupID, memberID, "N")
	if err != nil {
		return resp, true, false
	}
	if deleted != nil {
		if err := s.wrepo.UpdateGD(deleted.SgdtIdx, map[string]interface{}{"sgdt_show": "Y"}); err != nil {
			return resp, true, false
		}
	} else {
		// 신규 행 INSERT(sgt_idx/mt_idx/sgdt_show만, 나머지 NULL)
		g, m := groupID, memberID
		y := "Y"
		gd := &model.GroupDetail{SgtIdx: &g, MtIdx: &m, SgdtShow: &y}
		if err := s.wrepo.CreateGD(gd); err != nil {
			return resp, true, false
		}
	}
	return dto.GMSimpleResponse{Success: true, Message: "Member added to group successfully"}, true, true
}

// RemoveMember는 Python remove_member_from_group을 이식한다(show='Y' 행을 show='N'으로 소프트삭제).
// found=false → 404 "Member not found in the group", ok=false → 500.
func (s *GroupMemberService) RemoveMember(groupID, memberID int) (found, ok bool) {
	gd, err := s.wrepo.FindGD(groupID, memberID, "Y")
	if err != nil {
		return false, false
	}
	if gd == nil {
		return false, true
	}
	if err := s.wrepo.UpdateGD(gd.SgdtIdx, map[string]interface{}{"sgdt_show": "N"}); err != nil {
		return true, false
	}
	return true, true
}

// RemoveMemberPath는 Python remove_member_from_group_path를 이식한다(show='N' + exit='Y').
// found=false → 404 "Member not found in the group", ok=false → 500.
func (s *GroupMemberService) RemoveMemberPath(groupID, memberID int) (found, ok bool) {
	gd, err := s.wrepo.FindGD(groupID, memberID, "Y")
	if err != nil {
		return false, false
	}
	if gd == nil {
		return false, true
	}
	if err := s.wrepo.UpdateGD(gd.SgdtIdx, map[string]interface{}{"sgdt_show": "N", "sgdt_exit": "Y"}); err != nil {
		return true, false
	}
	return true, true
}

// UpdateRole은 Python update_member_role을 이식한다.
//
//	mtIdxRaw   : 응답 data.mt_idx에 그대로 넣을 원본값(정수/문자열)
//	leaderVal  : 변환된 sgdt_leader_chk 문자열(leaderChange=true일 때만 UPDATE)
//	leaderChange: is_leader is not None 여부(false면 미변경)
//	found=false → 404, ok=false → 500(repo 에러 = 잘못된 ENUM 값 거부 포함).
func (s *GroupMemberService) UpdateRole(groupID, memberID int, mtIdxRaw interface{}, leaderVal string, leaderChange bool) (resp *dto.GMRoleResponse, found, ok bool) {
	gd, err := s.wrepo.FindGDActive(groupID, memberID)
	if err != nil {
		return nil, false, false
	}
	if gd == nil {
		return nil, false, true
	}
	if leaderChange {
		if err := s.wrepo.UpdateGD(gd.SgdtIdx, map[string]interface{}{"sgdt_leader_chk": leaderVal}); err != nil {
			return nil, true, false
		}
	}
	// 커밋 후 값 재조회(미변경이면 기존값 유지, NULL이면 null)
	saved, err := s.wrepo.FindGDActive(groupID, memberID)
	if err != nil || saved == nil {
		return nil, true, false
	}
	return &dto.GMRoleResponse{
		Success: true,
		Message: "멤버 역할이 변경되었습니다.",
		Data: dto.GMRoleData{
			SgdtIdx:       saved.SgdtIdx,
			SgtIdx:        groupID,
			MtIdx:         mtIdxRaw,
			SgdtLeaderChk: saved.SgdtLeaderChk,
		},
	}, true, true
}
