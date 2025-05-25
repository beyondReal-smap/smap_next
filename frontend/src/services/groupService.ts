import apiClient from './apiClient';

// 그룹 타입 정의
export interface Group {
  sgt_idx: number;
  sgt_title: string;
  sgt_content?: string;
  sgt_memo?: string;
  mt_idx: number;
  sgt_show: string;
  sgt_wdate: string;
  memberCount?: number;
  member_count?: number;  // 백엔드에서 제공하는 멤버 수
}

export interface GroupMember {
  mt_idx: number;
  mt_type: number;
  mt_level: number;
  mt_status: number;
  mt_id: string;
  mt_name: string;
  mt_nickname: string;
  mt_hp: string;
  mt_email: string;
  mt_birth?: string;
  mt_gender: number;
  mt_file1: string;
  mt_lat: number;
  mt_long: number;
  mt_sido: string;
  mt_gu: string;
  mt_dong: string;
  mt_onboarding?: string;
  mt_push1?: string;
  mt_plan_check?: string;
  mt_plan_date?: string;
  mt_weather_pop?: string;
  mt_weather_sky: number;
  mt_weather_tmn: number;
  mt_weather_tmx: number;
  mt_weather_date: string;
  mt_ldate: string;
  mt_adate: string;
  // 그룹 상세 정보
  sgdt_idx: number;
  sgt_idx: number;
  sgdt_owner_chk: string;
  sgdt_leader_chk: string;
  sgdt_discharge?: string;
  sgdt_group_chk?: string;
  sgdt_exit?: string;
  sgdt_show?: string;
  sgdt_push_chk?: string;
  sgdt_wdate?: string;
  sgdt_udate?: string;
  sgdt_ddate?: string;
  sgdt_xdate?: string;
  sgdt_adate?: string;
}

export interface GroupCreate {
  mt_idx?: number | null;
  sgt_title?: string | null;
  sgt_code?: string | null;
  sgt_memo?: string | null;
  sgt_show?: 'Y' | 'N' | null;
}

export interface GroupUpdate {
  mt_idx?: number | null;
  sgt_title?: string | null;
  sgt_code?: string | null;
  sgt_memo?: string | null;
  sgt_show?: 'Y' | 'N' | null;
}

class GroupService {
  // 모든 그룹 목록 조회
  async getAllGroups(skip: number = 0, limit: number = 100): Promise<Group[]> {
    try {
      const response = await apiClient.get(`/groups?skip=${skip}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch all groups:', error);
      throw error;
    }
  }

  // ID로 그룹 조회
  async getGroupById(groupId: number): Promise<Group> {
    try {
      const response = await apiClient.get(`/groups/${groupId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch group ${groupId}:`, error);
      throw error;
    }
  }

  // 특정 멤버의 그룹 목록 조회
  async getMemberGroups(memberId: number): Promise<Group[]> {
    try {
      const response = await apiClient.get(`/v1/groups/member/${memberId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch member groups:', error);
      throw error;
    }
  }

  // 그룹 코드로 그룹 조회
  async getGroupByCode(code: string): Promise<Group> {
    try {
      const response = await apiClient.get(`/groups/code/${code}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch group with code ${code}:`, error);
      throw error;
    }
  }

  // 그룹 생성
  async createGroup(groupData: GroupCreate): Promise<Group> {
    try {
      // Next.js API 라우트를 통해 백엔드 호출
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groupData),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || '그룹 생성에 실패했습니다.');
      }
      
      return result.data;
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    }
  }

  // 그룹 업데이트
  async updateGroup(groupId: number, groupData: GroupUpdate): Promise<Group> {
    try {
      const response = await apiClient.put(`/groups/${groupId}`, groupData);
      return response.data;
    } catch (error) {
      console.error(`Failed to update group ${groupId}:`, error);
      throw error;
    }
  }

  // 그룹 삭제
  async deleteGroup(groupId: number): Promise<Group> {
    try {
      const response = await apiClient.delete(`/groups/${groupId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to delete group ${groupId}:`, error);
      throw error;
    }
  }

  // 현재 로그인한 사용자의 그룹 목록 조회 (임시로 고정 멤버 ID 사용)
  async getCurrentUserGroups(): Promise<Group[]> {
    try {
      // TODO: 실제 로그인한 사용자의 mt_idx를 가져와야 함
      const CURRENT_USER_ID = 1186; // 1에서 1186으로 변경
      return await this.getMemberGroups(CURRENT_USER_ID);
    } catch (error) {
      console.error('Failed to fetch current user groups:', error);
      throw error;
    }
  }

  /**
   * 사용자의 그룹 목록 조회
   */
  async getMyGroups(mt_idx: number | string = 1186): Promise<Group[]> {
    try {
      const response = await fetch(`/api/groups?mt_idx=${mt_idx}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || '그룹 목록 조회에 실패했습니다.');
      }
      
      return result.data || [];
    } catch (error) {
      console.error('그룹 목록 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 특정 그룹의 멤버 목록 조회
   */
  async getGroupMembers(sgt_idx: number | string): Promise<GroupMember[]> {
    try {
      const response = await fetch(`/api/groups/${sgt_idx}/members`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || '그룹 멤버 조회에 실패했습니다.');
      }
      
      return result.data || [];
    } catch (error) {
      console.error('그룹 멤버 조회 오류:', error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스 생성
const groupService = new GroupService();
export default groupService; 