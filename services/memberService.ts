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
    const mockData: Member[] = [
      {
        mt_idx: 1,
        mt_name: '김철수',
        mt_file1: '/images/avatar1.png',
        mt_lat: '37.5692',
        mt_long: '127.0036'
      },
      {
        mt_idx: 2,
        mt_name: '이영희',
        mt_file1: '/images/avatar2.png',
        mt_lat: '37.5612',
        mt_long: '126.9966'
      },
    ];
    
    try {
      const response = await apiClient.get<Member[]>('/members');
      return response.data;
    } catch (error) {
      console.log('서버 API 호출 실패, 목 데이터 반환:', error);
      return mockData;
    }
  }

  /**
   * ID로 멤버 조회
   */
  async getMemberById(id: number | string): Promise<Member> {
    const mockData: Member = {
      mt_idx: 1,
      mt_name: '김철수',
      mt_file1: '/images/avatar1.png',
      mt_lat: '37.5692',
      mt_long: '127.0036'
    };
    
    try {
      const response = await apiClient.get<Member>(`/members/${id}`);
      return response.data;
    } catch (error) {
      console.log('서버 API 호출 실패, 목 데이터 반환:', error);
      return mockData;
    }
  }

  /**
   * 그룹 멤버 조회
   */
  async getGroupMembers(groupId: number | string): Promise<Member[]> {
    const mockData: Member[] = [
      {
        mt_idx: 1186,
        mt_name: '김철수',
        mt_file1: '/images/avatar3.png',
        mt_lat: '37.5692',
        mt_long: '127.0036',
        mt_gender: 1,
        sgdt_idx: 1,
        sgt_idx: Number(groupId),
        sgdt_owner_chk: 'Y', // 첫 번째 멤버는 그룹장
        sgdt_leader_chk: 'N',
        sgdt_group_chk: 1,
        sgdt_show: 1
      },
      {
        mt_idx: 1187,
        mt_name: '이영희',
        mt_file1: '/images/avatar1.png',
        mt_lat: '37.5612',
        mt_long: '126.9966',
        mt_gender: 2,
        sgdt_idx: 2,
        sgt_idx: Number(groupId),
        sgdt_owner_chk: 'N',
        sgdt_leader_chk: 'Y', // 두 번째 멤버는 리더
        sgdt_group_chk: 1,
        sgdt_show: 1
      },
      {
        mt_idx: 1188,
        mt_name: '박민수',
        mt_file1: '/images/avatar2.png',
        mt_lat: '37.5662',
        mt_long: '126.9986',
        mt_gender: 1,
        sgdt_idx: 3,
        sgt_idx: Number(groupId),
        sgdt_owner_chk: 'N',
        sgdt_leader_chk: 'N', // 일반 멤버
        sgdt_group_chk: 1,
        sgdt_show: 1
      }
    ];
    
    try {
      console.log('[MEMBER SERVICE] 그룹 멤버 조회 시작:', groupId);
      // smap_group_detail_t 데이터가 포함된 완전한 멤버 정보 조회
      const response = await apiClient.get<Member[]>(`/groups/${groupId}/members`);
      console.log('[MEMBER SERVICE] 그룹 멤버 조회 응답:', {
        status: response.status,
        dataLength: response.data?.length || 0,
        firstMember: response.data?.[0] ? {
          name: response.data[0].mt_name,
          mt_idx: response.data[0].mt_idx,
          owner: response.data[0].sgdt_owner_chk,
          leader: response.data[0].sgdt_leader_chk
        } : null
      });
      
      // 응답 데이터가 배열이고 길이가 0보다 큰 경우에만 반환
      if (Array.isArray(response.data) && response.data.length > 0) {
        console.log('[MEMBER SERVICE] ✅ 실제 백엔드 데이터 사용:', response.data.length, '명');
        return response.data;
      } else {
        console.warn('[MEMBER SERVICE] ⚠️ 백엔드에서 빈 배열 반환, mock 데이터 사용');
        return mockData;
      }
    } catch (error) {
      console.error('[MEMBER SERVICE] ❌ 백엔드 API 호출 실패, mock 데이터 반환:', error);
      
      // 네트워크 오류나 서버 오류인 경우 상세 로그
      if (error instanceof Error) {
        console.error('[MEMBER SERVICE] 오류 상세:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      
      return mockData;
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