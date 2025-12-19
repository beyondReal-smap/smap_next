import apiClient from './apiClient';

export interface Member {
  mt_idx: number;
  mt_name: string;
  mt_file1?: string;
  mt_lat?: string;
  mt_long?: string;
  mt_hp?: string;
  mt_email?: string;
  mt_level?: number;
  mt_regdate?: string;
  mt_wdate?: string;
  mt_status?: string;
  // 최신 위치 정보
  mlt_lat?: number | null;
  mlt_long?: number | null;
  mlt_speed?: number | null;
  mlt_battery?: number | null;
  mlt_gps_time?: string | null;

  // 추가 멤버 정보
  mt_nickname?: string;
  mt_id?: string;
  mt_birth?: string;
  mt_gender?: number;
  mt_sido?: string;
  mt_gu?: string;
  mt_dong?: string;
  mt_type?: string;
  mt_onboarding?: string;
  mt_plan_check?: number;
  mt_plan_date?: string;
  mt_push1?: number;
  mt_adate?: string;
  mt_ldate?: string;
  mt_weather_date?: string;
  mt_weather_pop?: number;
  mt_weather_sky?: string;
  mt_weather_tmn?: number;
  mt_weather_tmx?: number;

  // smap_group_detail_t 필드들
  sgdt_idx?: number;
  sgt_idx?: number;
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
  sgdt_group_chk?: number;
  sgdt_push_chk?: number;
  sgdt_show?: number;
  sgdt_discharge?: number;
  sgdt_exit?: number;
  sgdt_adate?: string;
  sgdt_udate?: string;
  sgdt_wdate?: string;
  sgdt_ddate?: string;
  sgdt_xdate?: string;
}

class MemberService {
  /**
   * 모든 멤버 조회
   */
  async getAllMembers(): Promise<Member[]> {
    try {
      const response = await apiClient.get<Member[]>('/members');
      return response.data || [];
    } catch (error) {
      console.error('[MEMBER SERVICE] 모든 멤버 조회 실패:', error);
      return [];
    }
  }

  /**
   * ID로 멤버 조회
   */
  async getMemberById(id: number | string): Promise<Member> {
    try {
      const response = await apiClient.get<Member>(`/members/${id}`);
      return response.data;
    } catch (error) {
      console.error(`[MEMBER SERVICE] 멤버 조회 실패 (ID: ${id}):`, error);
      throw error;
    }
  }

  /**
   * 그룹 멤버 조회
   */
  async getGroupMembers(groupId: number | string): Promise<Member[]> {
    try {
      console.log('[MEMBER SERVICE] 그룹 멤버 조회 시작:', groupId);
      const response = await apiClient.get<Member[]>(`/group-members/member/${groupId}`);

      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error: any) {
      console.error('[MEMBER SERVICE] 그룹 멤버 조회 실패:', error);
      return [];
    }
  }

  /**
   * 멤버 추가
   */
  async addMember(memberData: Partial<Member>): Promise<Member> {
    const response = await apiClient.post<Member>('/members', memberData);
    return response.data;
  }

  /**
   * 멤버 정보 업데이트
   */
  async updateMember(id: number | string, memberData: Partial<Member>): Promise<Member> {
    const response = await apiClient.put<Member>(`/members/${id}`, memberData);
    return response.data;
  }

  /**
   * 멤버 삭제
   */
  async deleteMember(id: number | string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/members/${id}`);
    return response.data;
  }

  /**
   * 멤버 위치 정보 업데이트
   */
  async updateMemberLocation(id: number | string, lat: number, lng: number): Promise<Member> {
    const response = await apiClient.put<Member>(`/members/${id}/location`, {
      mt_lat: lat.toString(),
      mt_long: lng.toString()
    });
    return response.data;
  }

  /**
   * 그룹 멤버 역할 변경 (리더 권한)
   */
  async updateMemberRole(groupId: number | string, memberId: number | string, isLeader: boolean): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[MEMBER SERVICE] 멤버 역할 변경 시작:', {
        groupId,
        memberId,
        isLeader,
        newRole: isLeader ? 'leader' : 'member'
      });

      const response = await apiClient.put(`/groups/${groupId}/members/${memberId}/role`, {
        sgdt_leader_chk: isLeader ? 'Y' : 'N'
      });

      console.log('[MEMBER SERVICE] 멤버 역할 변경 성공:', response.data);
      return {
        success: true,
        message: `멤버 역할이 ${isLeader ? '리더' : '멤버'}로 변경되었습니다.`
      };
    } catch (error) {
      console.error('[MEMBER SERVICE] 멤버 역할 변경 실패:', error);
      throw new Error('멤버 역할 변경 중 오류가 발생했습니다.');
    }
  }

  /**
   * 그룹 멤버 탈퇴 처리 (소프트 삭제)
   */
  async removeMemberFromGroup(groupId: number | string, memberId: number | string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[MEMBER SERVICE] 그룹 멤버 탈퇴 처리 시작:', {
        groupId,
        memberId
      });

      const response = await apiClient.put(`/groups/${groupId}/members/${memberId}/remove`, {
        sgdt_show: 'N' // 소프트 삭제
      });

      console.log('[MEMBER SERVICE] 그룹 멤버 탈퇴 처리 성공:', response.data);
      return {
        success: true,
        message: '멤버가 그룹에서 탈퇴되었습니다.'
      };
    } catch (error) {
      console.error('[MEMBER SERVICE] 그룹 멤버 탈퇴 처리 실패:', error);
      throw new Error('멤버 탈퇴 처리 중 오류가 발생했습니다.');
    }
  }
}

// 싱글톤 인스턴스 생성
const memberService = new MemberService();
export default memberService;