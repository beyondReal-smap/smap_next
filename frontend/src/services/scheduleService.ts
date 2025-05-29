// import { getToken } from '@/lib/auth';
import { 
    AllDayCheckEnum, ShowEnum, ScheduleAlarmCheckEnum, InCheckEnum, ScheduleCheckEnum 
} from '../types/enums'; // 생성한 Enum 타입 임포트
import apiClient from './apiClient';

// Schedule 인터페이스를 home/page.tsx와 동일하게 확장
export interface Schedule {
  id: string; // sst_idx
  sst_pidx?: number | null;
  memberId?: string | null; // mt_idx
  mt_schedule_idx?: number | null; // 새로 추가된 필드
  title?: string | null; // sst_title
  date?: string | null; // sst_sdate
  sst_edate?: string | null;
  sst_sedate?: string | null;
  sst_all_day?: AllDayCheckEnum | null;
  sst_repeat_json?: string | null;
  sst_repeat_json_v?: string | null;
  sgt_idx?: number | null;
  sgdt_idx?: number | null;
  sgdt_idx_t?: string | null;
  sst_alram?: number | null;
  sst_alram_t?: string | null;
  sst_adate?: string | null;
  slt_idx?: number | null;
  slt_idx_t?: string | null;
  location?: string | null; // sst_location_title
  sst_location_add?: string | null;
  sst_location_lat?: number | null;
  sst_location_long?: number | null;
  sst_supplies?: string | null;
  sst_memo?: string | null;
  sst_show?: ShowEnum | null;
  sst_location_alarm?: number | null;
  sst_schedule_alarm_chk?: ScheduleAlarmCheckEnum | null;
  sst_pick_type?: string | null;
  sst_pick_result?: number | null;
  sst_schedule_alarm?: string | null;
  sst_update_chk?: string | null;
  sst_wdate?: string | null;
  sst_udate?: string | null;
  sst_ddate?: string | null;
  sst_in_chk?: InCheckEnum | null;
  sst_schedule_chk?: ScheduleCheckEnum | null;
  sst_entry_cnt?: number | null;
  sst_exit_cnt?: number | null;
  // 추가 필드 (조인으로 가져온 데이터)
  member_name?: string;
  member_photo?: string;
}

// 그룹 멤버 권한 정보
export interface GroupMember {
  mt_idx: number;
  mt_name: string;
  mt_file1?: string;
  sgt_idx: number;
  sgdt_idx: number;
  sgdt_owner_chk: 'Y' | 'N';
  sgdt_leader_chk: 'Y' | 'N';
}

// 사용자 권한 정보
export interface UserPermission {
  canManage: boolean;
  isOwner: boolean;
  isLeader: boolean;
}

// 그룹 스케줄 조회 응답
export interface GroupScheduleResponse {
  success: boolean;
  data: {
    groupMembers: GroupMember[];
    schedules: Schedule[];
    userPermission: UserPermission;
  };
}

// 스케줄 생성 요청
export interface CreateScheduleRequest {
  groupId: number;
  targetMemberId?: number; // 다른 멤버 스케줄 생성 시
  sst_title: string;
  sst_sdate: string;
  sst_edate: string;
  sst_all_day?: 'Y' | 'N';
  sst_location_title?: string;
  sst_location_add?: string;
  sst_location_lat?: number;
  sst_location_long?: number;
  sst_memo?: string;
  sst_supplies?: string;
  sst_alram?: number;
  sst_schedule_alarm_chk?: 'Y' | 'N';
}

// 스케줄 수정 요청
export interface UpdateScheduleRequest {
  sst_idx: number;
  groupId: number;
  sst_title?: string;
  sst_sdate?: string;
  sst_edate?: string;
  sst_all_day?: 'Y' | 'N';
  sst_location_title?: string;
  sst_location_add?: string;
  sst_location_lat?: number;
  sst_location_long?: number;
  sst_memo?: string;
  sst_supplies?: string;
  sst_alram?: number;
  sst_schedule_alarm_chk?: 'Y' | 'N';
}

class ScheduleService {
  // apiClient를 사용하므로 baseURL 제거
  // private readonly baseURL = 'http://118.67.130.71:8000/api/schedule/group-manage';

  // 인증 헤더 생성 메서드도 제거 (apiClient에서 자동 처리)
  // private getHeaders(): HeadersInit {
  //   return {
  //     'Content-Type': 'application/json',
  //     // 필요시 인증 토큰 추가
  //     // 'Authorization': `Bearer ${token}`
  //   };
  // }

  /**
   * 그룹 스케줄 조회
   * @param groupId 그룹 ID
   * @param options 조회 옵션
   */
  async getGroupSchedules(
    groupId: number, 
    options?: {
      startDate?: string;
      endDate?: string;
      memberId?: number;
    }
  ): Promise<GroupScheduleResponse> {
    try {
      const params = new URLSearchParams({
        days: '7', // 기본 7일
        ...(options?.startDate && { startDate: options.startDate }),
        ...(options?.endDate && { endDate: options.endDate }),
        ...(options?.memberId && { memberId: options.memberId.toString() })
      });

      console.log('[SCHEDULE SERVICE] 그룹 스케줄 조회 시작:', { groupId, options });
      
      const response = await apiClient.get(`/schedules/group/${groupId}?${params}`);
      
      console.log('[SCHEDULE SERVICE] 그룹 스케줄 조회 응답:', {
        status: response.status,
        dataType: Array.isArray(response.data) ? 'array' : 'object',
        schedulesCount: Array.isArray(response.data) ? response.data.length : (response.data.data?.schedules?.length || 0),
        rawData: response.data
      });

      // API 응답이 직접 배열인 경우 처리
      if (Array.isArray(response.data)) {
        return {
          success: true,
          data: {
            groupMembers: [],
            schedules: response.data,
            userPermission: {
              canManage: true,
              isOwner: false,
              isLeader: false
            }
          }
        };
      }

      // 기존 구조 형태의 응답 처리
      return response.data;
    } catch (error) {
      console.error('[SCHEDULE SERVICE] 그룹 스케줄 조회 실패:', error);
      
      // 에러 발생 시 기본 구조 반환
      return {
        success: false,
        data: {
          groupMembers: [],
          schedules: [],
          userPermission: {
            canManage: false,
            isOwner: false,
            isLeader: false
          }
        }
      };
    }
  }

  /**
   * 스케줄 생성
   * @param scheduleData 스케줄 생성 데이터
   */
  async createSchedule(scheduleData: CreateScheduleRequest): Promise<{
    success: boolean;
    data?: { sst_idx: number; message: string };
    error?: string;
  }> {
    try {
      console.log('[SCHEDULE SERVICE] 스케줄 생성 시작:', scheduleData);
      
      const response = await apiClient.post(`/schedules/group/${scheduleData.groupId}`, {
        title: scheduleData.sst_title,
        date: scheduleData.sst_sdate,
        endDate: scheduleData.sst_edate,
        location: scheduleData.sst_location_title,
        memo: scheduleData.sst_memo,
        targetMemberId: scheduleData.targetMemberId
      });
      
      console.log('[SCHEDULE SERVICE] 스케줄 생성 응답:', {
        status: response.status,
        data: response.data
      });

      return response.data;
    } catch (error: any) {
      console.error('[SCHEDULE SERVICE] 스케줄 생성 실패:', error);
      
      const errorMessage = error.message || '스케줄 생성 중 오류가 발생했습니다.';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 스케줄 수정
   * @param scheduleData 스케줄 수정 데이터
   */
  async updateSchedule(scheduleData: UpdateScheduleRequest): Promise<{
    success: boolean;
    data?: { message: string };
    error?: string;
  }> {
    try {
      console.log('[SCHEDULE SERVICE] 스케줄 수정 시작:', scheduleData);
      
      const response = await apiClient.put(`/schedules/group/${scheduleData.groupId}`, {
        sst_idx: scheduleData.sst_idx,
        title: scheduleData.sst_title,
        date: scheduleData.sst_sdate,
        endDate: scheduleData.sst_edate,
        location: scheduleData.sst_location_title,
        memo: scheduleData.sst_memo
      });
      
      console.log('[SCHEDULE SERVICE] 스케줄 수정 응답:', {
        status: response.status,
        data: response.data
      });

      return response.data;
    } catch (error: any) {
      console.error('[SCHEDULE SERVICE] 스케줄 수정 실패:', error);
      
      const errorMessage = error.message || '스케줄 수정 중 오류가 발생했습니다.';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 스케줄 삭제
   * @param sst_idx 스케줄 ID
   * @param groupId 그룹 ID
   */
  async deleteSchedule(sst_idx: number, groupId: number): Promise<{
    success: boolean;
    data?: { message: string };
    error?: string;
  }> {
    try {
      console.log('[SCHEDULE SERVICE] 스케줄 삭제 시작:', { sst_idx, groupId });
      
      const response = await apiClient.delete(`/schedules/group/${groupId}?scheduleId=${sst_idx}`);
      
      console.log('[SCHEDULE SERVICE] 스케줄 삭제 응답:', {
        status: response.status,
        data: response.data
      });

      return response.data;
    } catch (error: any) {
      console.error('[SCHEDULE SERVICE] 스케줄 삭제 실패:', error);
      
      const errorMessage = error.message || '스케줄 삭제 중 오류가 발생했습니다.';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 특정 날짜의 그룹 스케줄 조회
   * @param groupId 그룹 ID
   * @param date 날짜 (YYYY-MM-DD)
   */
  async getGroupSchedulesByDate(groupId: number, date: string): Promise<GroupScheduleResponse> {
    const startDate = `${date} 00:00:00`;
    const endDate = `${date} 23:59:59`;
    
    return this.getGroupSchedules(groupId, { startDate, endDate });
  }

  /**
   * 특정 멤버의 스케줄만 조회
   * @param groupId 그룹 ID
   * @param memberId 멤버 ID
   * @param options 추가 옵션
   */
  async getMemberSchedules(
    groupId: number, 
    memberId: number,
    options?: {
      startDate?: string;
      endDate?: string;
    }
  ): Promise<GroupScheduleResponse> {
    return this.getGroupSchedules(groupId, { ...options, memberId });
  }

  /**
   * 권한 확인 헬퍼 함수
   * @param userPermission 사용자 권한 정보
   * @param targetMemberId 대상 멤버 ID (본인이 아닌 경우)
   * @param currentUserId 현재 사용자 ID
   */
  canManageSchedule(
    userPermission: UserPermission, 
    targetMemberId?: number, 
    currentUserId?: number
  ): boolean {
    // 본인 스케줄인 경우
    if (!targetMemberId || targetMemberId === currentUserId) {
      return true;
    }

    // 다른 멤버 스케줄인 경우 오너나 리더만 가능
    return userPermission.canManage;
  }

  /**
   * 날짜 포맷 헬퍼 함수
   * @param date Date 객체 또는 날짜 문자열
   * @param includeTime 시간 포함 여부
   */
  formatDate(date: Date | string, includeTime: boolean = true): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (includeTime) {
      return dateObj.toISOString().slice(0, 19).replace('T', ' ');
    } else {
      return dateObj.toISOString().slice(0, 10);
    }
  }

  /**
   * 스케줄 시간 유효성 검증
   * @param startDate 시작 시간
   * @param endDate 종료 시간
   */
  validateScheduleTime(startDate: string, endDate: string): {
    isValid: boolean;
    error?: string;
  } {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        isValid: false,
        error: '올바른 날짜 형식이 아닙니다.'
      };
    }

    if (start >= end) {
      return {
        isValid: false,
        error: '종료 시간은 시작 시간보다 늦어야 합니다.'
      };
    }

    return { isValid: true };
  }

  /**
   * 현재 사용자의 그룹 정보 조회
   */
  async getCurrentUserGroups(): Promise<{
    success: boolean;
    data: {
      groups: Array<{
        sgt_idx: number;
        sgt_title: string;
        sgdt_owner_chk: 'Y' | 'N';
        sgdt_leader_chk: 'Y' | 'N';
        memberCount: number;
      }>;
    };
  }> {
    try {
      console.log('[SCHEDULE SERVICE] 현재 사용자 그룹 조회 시작');
      
      // getCurrentUserGroupsList를 사용하여 그룹 기본 정보 조회
      const basicGroupsResponse = await this.getCurrentUserGroupsList();
      
      if (!basicGroupsResponse.success || !basicGroupsResponse.data.groups) {
        console.log('[SCHEDULE SERVICE] 기본 그룹 정보 조회 실패');
        return {
          success: false,
          data: { groups: [] }
        };
      }
      
      console.log('[SCHEDULE SERVICE] 기본 그룹 정보 조회 성공:', basicGroupsResponse.data.groups.length, '개');
      
      // 각 그룹에 대해 권한 정보와 멤버 수 추가 (기본값 설정)
      const formattedGroups = basicGroupsResponse.data.groups.map(group => ({
        sgt_idx: group.sgt_idx,
        sgt_title: group.sgt_title,
        sgdt_owner_chk: 'Y' as 'Y' | 'N', // 기본적으로 권한 있다고 가정
        sgdt_leader_chk: 'N' as 'Y' | 'N', // 리더 권한은 기본값 N
        memberCount: 1 // 기본값
      }));
      
      console.log('[SCHEDULE SERVICE] 변환된 그룹 데이터:', formattedGroups);
      
      return {
        success: true,
        data: {
          groups: formattedGroups
        }
      };
    } catch (error) {
      console.error('[SCHEDULE SERVICE] 현재 사용자 그룹 조회 실패:', error);
      
      // 에러 시 기본 그룹 반환
      return {
        success: false,
        data: {
          groups: []
        }
      };
    }
  }

  /**
   * 그룹 멤버의 권한 확인
   */
  async checkUserPermission(
    groupId: number,
    userId: number = 1186 // 기본 사용자 ID
  ): Promise<UserPermission> {
    try {
      console.log('[SCHEDULE SERVICE] 사용자 권한 확인:', { groupId, userId });
      
      const response = await apiClient.get(`/groups/${groupId}/members/${userId}/permission`);
      
      return response.data || {
        canManage: false,
        isOwner: false,
        isLeader: false
      };
    } catch (error) {
      console.error('[SCHEDULE SERVICE] 사용자 권한 확인 실패:', error);
      
      return {
        canManage: false,
        isOwner: false,
        isLeader: false
      };
    }
  }

  /**
   * 모든 그룹의 스케줄 조회
   */
  async getAllUserGroupSchedules(
    options?: {
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{
    success: boolean;
    data: {
      schedulesByGroup: Array<{
        groupId: number;
        groupName: string;
        schedules: Schedule[];
        userPermission: UserPermission;
      }>;
    };
  }> {
    try {
      console.log('[SCHEDULE SERVICE] 모든 그룹 스케줄 조회 시작');
      
      // 1. 사용자 그룹 목록 조회
      const userGroupsResponse = await this.getCurrentUserGroups();
      if (!userGroupsResponse.success || !userGroupsResponse.data.groups) {
        console.log('[SCHEDULE SERVICE] 사용자 그룹이 없음');
        return {
          success: true,
          data: { schedulesByGroup: [] }
        };
      }

      const userGroups = userGroupsResponse.data.groups;
      console.log('[SCHEDULE SERVICE] 사용자 그룹 목록:', userGroups.length, '개');

      // 2. 각 그룹의 스케줄 조회
      const schedulesByGroup = [];
      
      for (const group of userGroups) {
        try {
          console.log(`[SCHEDULE SERVICE] 그룹 ${group.sgt_title}(${group.sgt_idx}) 스케줄 조회 중...`);
          
          // 그룹 스케줄 조회
          const groupScheduleResponse = await this.getGroupSchedules(group.sgt_idx, {
            startDate: options?.startDate,
            endDate: options?.endDate
          });

          if (groupScheduleResponse.success) {
            // 사용자 권한 정보 생성
            const userPermission: UserPermission = {
              canManage: group.sgdt_owner_chk === 'Y' || group.sgdt_leader_chk === 'Y',
              isOwner: group.sgdt_owner_chk === 'Y',
              isLeader: group.sgdt_leader_chk === 'Y'
            };

            schedulesByGroup.push({
              groupId: group.sgt_idx,
              groupName: group.sgt_title,
              schedules: groupScheduleResponse.data.schedules,
              userPermission
            });

            console.log(`[SCHEDULE SERVICE] 그룹 ${group.sgt_title} 스케줄 조회 성공:`, groupScheduleResponse.data.schedules.length, '개');
          } else {
            console.log(`[SCHEDULE SERVICE] 그룹 ${group.sgt_title} 스케줄 조회 실패`);
          }
        } catch (groupError) {
          console.error(`[SCHEDULE SERVICE] 그룹 ${group.sgt_title} 스케줄 조회 중 오류:`, groupError);
          // 개별 그룹 오류는 무시하고 계속 진행
        }
      }

      console.log('[SCHEDULE SERVICE] 전체 그룹 스케줄 조회 완료:', schedulesByGroup.length, '개 그룹');

      return {
        success: true,
        data: { schedulesByGroup }
      };

    } catch (error) {
      console.error('[SCHEDULE SERVICE] 전체 그룹 스케줄 조회 실패:', error);
      return {
        success: false,
        data: { schedulesByGroup: [] }
      };
    }
  }

  /**
   * 현재 사용자가 오너인 그룹들의 모든 멤버 스케줄 조회
   * @param year 조회할 년도 (예: 2024)
   * @param month 조회할 월 (1-12)
   */
  async getOwnerGroupsAllSchedules(
    year?: number,
    month?: number
  ): Promise<{
    success: boolean;
    data: {
      schedules: Schedule[];
      ownerGroups: Array<{ sgt_idx: number; sgt_title: string }>;
      totalSchedules: number;
      queryPeriod?: {
        year: number;
        month: number;
        startDate: string;
        endDate: string;
      };
      userPermission: UserPermission;
    };
  }> {
    try {
      console.log('[SCHEDULE SERVICE] 오너 그룹 전체 스케줄 조회 시작:', { year, month });
      
      // URL 파라미터 구성
      const params = new URLSearchParams({
        current_user_id: '1186'
      });
      
      if (year !== undefined) {
        params.append('year', year.toString());
        console.log('[SCHEDULE SERVICE] year 파라미터 추가:', year);
      }
      if (month !== undefined) {
        params.append('month', month.toString());
        console.log('[SCHEDULE SERVICE] month 파라미터 추가:', month);
      }
      
      const requestUrl = `/schedule/owner-groups/all-schedules?${params}`;
      console.log('[SCHEDULE SERVICE] 요청 URL:', requestUrl);
      
      const response = await apiClient.get(requestUrl);
      
      console.log('[SCHEDULE SERVICE] 오너 그룹 전체 스케줄 조회 응답:', {
        status: response.status,
        totalSchedules: response.data?.data?.totalSchedules || 0,
        ownerGroupsCount: response.data?.data?.ownerGroups?.length || 0,
        queryPeriod: response.data?.data?.queryPeriod,
        rawData: response.data
      });

      // 파라미터와 응답 비교 검증
      const responseQueryPeriod = response.data?.data?.queryPeriod;
      if (responseQueryPeriod) {
        console.log('[SCHEDULE SERVICE] 파라미터 vs 응답 비교:');
        console.log(`  요청 year: ${year} -> 응답 year: ${responseQueryPeriod.year}`);
        console.log(`  요청 month: ${month} -> 응답 month: ${responseQueryPeriod.month}`);
        
        if (year && responseQueryPeriod.year !== year) {
          console.warn('[SCHEDULE SERVICE] ⚠️ YEAR 불일치! 요청:', year, '응답:', responseQueryPeriod.year);
        }
        if (month && responseQueryPeriod.month !== month) {
          console.warn('[SCHEDULE SERVICE] ⚠️ MONTH 불일치! 요청:', month, '응답:', responseQueryPeriod.month);
        }
      }

      return response.data;
    } catch (error) {
      console.error('[SCHEDULE SERVICE] 오너 그룹 전체 스케줄 조회 실패:', error);
      
      return {
        success: false,
        data: {
          schedules: [],
          ownerGroups: [],
          totalSchedules: 0,
          userPermission: {
            canManage: false,
            isOwner: false,
            isLeader: false
          }
        }
      };
    }
  }

  /**
   * 현재 사용자의 그룹 목록 조회
   */
  async getCurrentUserGroupsList(): Promise<{
    success: boolean;
    data: {
      groups: Array<{
        sgt_idx: number;
        sgt_title: string;
      }>;
    };
  }> {
    try {
      console.log('[SCHEDULE SERVICE] 현재 사용자 그룹 목록 조회 시작');
      
      // 실제 API 호출
      const response = await apiClient.get('/groups/current-user');
      console.log('[SCHEDULE SERVICE] 현재 사용자 그룹 목록 조회 응답:', response.data);
      return {
        success: true,
        data: {
          groups: response.data.map((group: any) => ({
            sgt_idx: group.sgt_idx,
            sgt_title: group.sgt_title
          }))
        }
      };
    } catch (error) {
      console.error('[SCHEDULE SERVICE] 현재 사용자 그룹 목록 조회 실패:', error);
      
      // 에러 시에도 목업 데이터 반환
      const mockGroups = [
        { sgt_idx: 1, sgt_title: '샘플 그룹' }
      ];
      
      return {
        success: true,
        data: {
          groups: mockGroups
        }
      };
    }
  }
}

// 싱글톤 인스턴스 내보내기
const scheduleService = new ScheduleService();
export default scheduleService; 