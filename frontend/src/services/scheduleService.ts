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
        groupId: groupId.toString(),
        ...(options?.startDate && { startDate: options.startDate }),
        ...(options?.endDate && { endDate: options.endDate }),
        ...(options?.memberId && { memberId: options.memberId.toString() })
      });

      console.log('[SCHEDULE SERVICE] 그룹 스케줄 조회 시작:', { groupId, options });
      
      const response = await apiClient.get(`/schedule/group-manage?${params}`);
      
      console.log('[SCHEDULE SERVICE] 그룹 스케줄 조회 응답:', {
        status: response.status,
        success: response.data.success,
        schedulesCount: response.data.data?.schedules?.length || 0,
        membersCount: response.data.data?.groupMembers?.length || 0,
        userPermission: response.data.data?.userPermission
      });

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
      
      const response = await apiClient.post('/schedule/group-manage', scheduleData);
      
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
      
      const response = await apiClient.put('/schedule/group-manage', scheduleData);
      
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
      
      const params = new URLSearchParams({
        sst_idx: sst_idx.toString(),
        groupId: groupId.toString()
      });

      const response = await apiClient.delete(`/schedule/group-manage?${params}`);
      
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
}

// 싱글톤 인스턴스 내보내기
const scheduleService = new ScheduleService();
export default scheduleService; 