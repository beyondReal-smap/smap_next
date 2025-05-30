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
  // 기본 멤버 정보
  mt_idx: number;
  mt_type?: number;
  mt_level?: number;
  mt_status: number;
  mt_id?: string;
  mt_name: string;
  mt_nickname?: string;
  mt_hp?: string;
  mt_email?: string;
  mt_birth?: string;
  mt_gender?: number;
  mt_file1?: string;
  mt_lat?: number;
  mt_long?: number;
  mt_sido?: string;
  mt_gu?: string;
  mt_dong?: string;
  mt_onboarding?: string;
  mt_push1?: string;
  mt_plan_check?: string;
  mt_plan_date?: string;
  mt_weather_pop?: string;
  mt_weather_sky?: number;
  mt_weather_tmn?: number;
  mt_weather_tmx?: number;
  mt_weather_date?: string;
  mt_ldate?: string;
  mt_adate?: string;
  
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
  
  // 최신 위치 정보 (새로 추가)
  mlt_lat?: number | null;
  mlt_long?: number | null;
  mlt_speed?: number | null;
  mlt_battery?: number | null;
  mlt_gps_time?: string | null;
  
  // 호환성을 위한 필드
  id?: string;
  name?: string;
  photo?: string;
  isSelected?: boolean;
}

export interface GroupMemberStats {
  mt_idx: number;
  mt_name: string;
  mt_nickname: string;
  weekly_schedules: number;
  total_locations: number;
  weekly_locations: number;
  is_owner: boolean;
  is_leader: boolean;
}

export interface GroupStats {
  group_id: number;
  group_title: string;
  member_count: number;
  weekly_schedules: number;
  total_locations: number;
  stats_period: {
    start_date: string;
    end_date: string;
    days: number;
  };
  member_stats: GroupMemberStats[];
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
      console.log(`[GroupService] 멤버 그룹 조회 시작 - memberId: ${memberId}`);
      console.log(`[GroupService] API 요청 URL: /groups/member/${memberId}`);
      
      const response = await apiClient.get(`/groups/member/${memberId}`);
      
      console.log(`[GroupService] API 응답:`, response.data);
      
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
      const response = await apiClient.post('/groups', groupData);
      
      if (!response.data.success) {
        throw new Error(response.data.message || '그룹 생성에 실패했습니다.');
      }
      
      return response.data.data;
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    }
  }

  // 그룹 업데이트
  async updateGroup(groupId: number, groupData: GroupUpdate): Promise<Group> {
    try {
      console.log('[GroupService] 그룹 업데이트 요청:', { groupId, groupData });
      
      const response = await apiClient.put(`/groups/${groupId}`, groupData);
      console.log('[GroupService] 응답 성공:', response.data);
      
      if (!response.data.success) {
        throw new Error(response.data.message || '그룹 업데이트에 실패했습니다.');
      }
      
      return response.data.data;
    } catch (error) {
      console.error(`Failed to update group ${groupId}:`, error);
      throw error;
    }
  }

  // 그룹 삭제 (실제로는 sgt_show를 'N'으로 업데이트)
  async deleteGroup(groupId: number): Promise<Group> {
    try {
      console.log('[GroupService] 그룹 삭제 요청:', { groupId });
      console.log('[GroupService] ⚠️ 중요: PUT 메서드로 sgt_show=N 업데이트 실행');
      
      // DELETE 대신 PUT을 사용하여 sgt_show를 'N'으로 업데이트
      const updateData = {
        sgt_show: 'N'
      };
      
      console.log('[GroupService] 전송할 데이터:', updateData);
      console.log('[GroupService] 요청 URL:', `/api/groups/${groupId}`);
      console.log('[GroupService] 요청 메서드: PUT');
      console.log('[GroupService] 🚨 주의: DELETE 메서드가 아닌 PUT 메서드 사용 중');
      
      const response = await apiClient.put(`/groups/${groupId}`, updateData);
      
      console.log('[GroupService] 삭제 응답 성공:', response.data);
      console.log('[GroupService] ✅ 소프트 삭제 완료 - 실제 DB 삭제 아님');
      console.log('[GroupService] 응답 데이터 sgt_show 값:', response.data?.data?.sgt_show);
      
      return response.data.data || response.data;
    } catch (error) {
      console.error('[GroupService] 그룹 삭제 오류:', error);
      console.error('[GroupService] 🚨 오류 발생 - 소프트 삭제 실패');
      throw error;
    }
  }

  // 현재 로그인한 사용자의 그룹 목록 조회
  async getCurrentUserGroups(): Promise<Group[]> {
    try {
      console.log('[GroupService] 현재 사용자 그룹 목록 조회 시작');
      
      // 백엔드 API 문서에 따라 현재 사용자가 속한 그룹 목록 조회
      // Authorization 헤더를 통해 현재 사용자 식별
      const response = await apiClient.get('/groups/current-user');
      
      console.log('[GroupService] 현재 사용자 그룹 목록 응답:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('[GroupService] 현재 사용자 그룹 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자의 그룹 목록 조회
   */
  async getMyGroups(mt_idx: number | string = 1186): Promise<Group[]> {
    try {
      const response = await apiClient.get(`/groups?mt_idx=${mt_idx}`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || '그룹 목록 조회에 실패했습니다.');
      }
      
      return response.data.data || [];
    } catch (error) {
      console.error('그룹 목록 조회 오류:', error);
      throw new Error('그룹 목록을 가져오는데 실패했습니다.');
    }
  }

  /**
   * 특정 그룹의 멤버 목록 조회
   */
  async getGroupMembers(sgt_idx: number | string): Promise<GroupMember[]> {
    try {
      console.log(`[GroupService] 그룹 멤버 조회 시작 - sgt_idx: ${sgt_idx}`);
      console.log(`[GroupService] API 요청 URL: /group-members/member/${sgt_idx}`);
      
      const response = await apiClient.get(`/group-members/member/${sgt_idx}`);
      
      console.log(`[GroupService] API 응답 상태:`, response.status);
      console.log(`[GroupService] API 응답 데이터:`, response.data);
      
      // 응답이 배열 형태인 경우 직접 반환
      if (Array.isArray(response.data)) {
        console.log('[GroupService] 배열 형태 응답, 직접 반환');
        return response.data;
      }
      
      // 일반적인 success/data 구조인 경우
      if (response.data.success) {
        console.log('[GroupService] success 구조 응답, data 필드 반환');
        return response.data.data || [];
      }
      
      // success가 false인 경우
      throw new Error(response.data.message || '그룹 멤버 조회에 실패했습니다.');
      
    } catch (error) {
      console.error('그룹 멤버 조회 오류:', error);
      throw new Error('그룹 멤버를 가져오는데 실패했습니다.');
    }
  }

  /**
   * 그룹 통계 데이터 조회
   * - 1주일간 일정 개수
   * - 위치 데이터 통계
   */
  async getGroupStats(sgt_idx: number | string): Promise<GroupStats> {
    try {
      console.log(`[GroupService] 그룹 통계 조회 요청 - sgt_idx: ${sgt_idx}`);
      console.log(`[GroupService] API 요청 URL: /api/groups/${sgt_idx}/stats`);
      
      const response = await apiClient.get(`/groups/${sgt_idx}/stats`);
      
      console.log(`[GroupService] API 응답 상태:`, response.status);
      console.log(`[GroupService] API 응답 데이터:`, response.data);
      
      if (!response.data.success) {
        console.error(`[GroupService] API 응답 실패:`, response.data.message);
        throw new Error(response.data.message || '그룹 통계 조회에 실패했습니다.');
      }
      
      console.log('[GroupService] 그룹 통계 조회 성공:', response.data.data);
      return response.data.data;
    } catch (error) {
      console.error('[GroupService] 그룹 통계 조회 오류:', error);
      console.error('[GroupService] 오류 타입:', typeof error);
      console.error('[GroupService] 오류 상세:', error instanceof Error ? error.message : String(error));
      
      if (error instanceof Error && error.message.includes('fetch')) {
        console.error('[GroupService] 네트워크 오류로 추정됩니다.');
      }
      
      throw new Error('그룹 통계를 가져오는데 실패했습니다.');
    }
  }
}

// 싱글톤 인스턴스 생성
const groupService = new GroupService();
export default groupService; 