import { 
    AllDayCheckEnum, ShowEnum, ScheduleAlarmCheckEnum, InCheckEnum, ScheduleCheckEnum 
} from '../types/enums'; // 생성한 Enum 타입 임포트

// Schedule 인터페이스를 home/page.tsx와 동일하게 확장
export interface Schedule {
  id: string; // sst_idx를 문자열로 변환
  sst_idx?: number;
  sst_pidx?: number | null;
  mt_idx?: number;
  memberId?: string | null; // mt_idx를 문자열로 변환
  mt_schedule_idx?: number | null;
  title?: string | null; // sst_title
  sst_title?: string;
  date?: string | null; // sst_sdate
  sst_sdate?: string;
  sst_edate?: string | null;
  sst_sedate?: string | null;
  sst_all_day?: 'Y' | 'N' | null;
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
  sst_location_title?: string | null;
  sst_location_add?: string | null;
  sst_location_lat?: number | null;
  sst_location_long?: number | null;
  sst_supplies?: string | null;
  sst_memo?: string | null;
  sst_show?: 'Y' | 'N' | null;
  sst_location_alarm?: number | null;
  sst_schedule_alarm_chk?: 'Y' | 'N' | null;
  sst_pick_type?: string | null;
  sst_pick_result?: number | null;
  sst_schedule_alarm?: string | null;
  sst_update_chk?: string | null;
  sst_wdate?: string | null;
  sst_udate?: string | null;
  sst_ddate?: string | null;
  sst_in_chk?: 'Y' | 'N' | null;
  sst_schedule_chk?: 'Y' | 'N' | null;
  sst_entry_cnt?: number | null;
  sst_exit_cnt?: number | null;
  member_name?: string;
  member_photo?: string;
}

// 그룹 멤버 권한 정보
export interface GroupMember {
  mt_idx: number;
  mt_name: string;
  mt_file1?: string;
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
    schedules: Schedule[];
    groupMembers: GroupMember[];
    userPermission: UserPermission;
  };
  error?: string;
}

// 스케줄 생성 요청
export interface CreateScheduleRequest {
  groupId: number;
  targetMemberId?: number;
  sst_title: string;
  sst_sdate: string;
  sst_edate: string;
  sst_all_day?: 'Y' | 'N';
  sst_location_title?: string;
  sst_location_add?: string;
  sst_location_lat?: number;
  sst_location_long?: number;
  sst_supplies?: string;
  sst_memo?: string;
  sst_alram?: number;
  sst_schedule_alarm_chk?: 'Y' | 'N';
}

// 스케줄 수정 요청
export interface UpdateScheduleRequest {
  sst_idx: number;
  groupId: number;
  sst_title: string;
  sst_sdate: string;
  sst_edate: string;
  sst_all_day?: 'Y' | 'N';
  sst_location_title?: string;
  sst_location_add?: string;
  sst_location_lat?: number;
  sst_location_long?: number;
  sst_supplies?: string;
  sst_memo?: string;
  sst_alram?: number;
  sst_schedule_alarm_chk?: 'Y' | 'N';
}

export interface ScheduleResponse {
  success: boolean;
  data?: any;
  error?: string;
}

class ScheduleService {
  // Next.js API 라우트 사용 (URL 중복 문제 해결)
  private baseUrl = '/api/schedule/group-manage';

  // 인증 토큰 가져오기
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  // API 요청 헤더 생성
  private getHeaders(): HeadersInit {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

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
      console.log('[SCHEDULE SERVICE] 그룹 스케줄 조회 시작:', { groupId, options });
      
      const params = new URLSearchParams({
        groupId: groupId.toString()
      });

      if (options?.startDate) {
        params.append('startDate', options.startDate);
      }
      if (options?.endDate) {
        params.append('endDate', options.endDate);
      }
      if (options?.memberId) {
        params.append('memberId', options.memberId.toString());
      }

      const response = await fetch(`${this.baseUrl}?${params}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();

      console.log('[SCHEDULE SERVICE] 그룹 스케줄 조회 응답:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch group schedules');
      }

      // 스케줄 데이터 변환 (백엔드 필드명을 프론트엔드 필드명으로)
      const transformedSchedules = data.data.schedules.map((schedule: any) => ({
        ...schedule,
        id: schedule.sst_idx?.toString() || '',
        title: schedule.sst_title,
        date: schedule.sst_sdate,
        location: schedule.sst_location_title,
        memberId: schedule.mt_idx?.toString()
      }));

      return {
        ...data,
        data: {
          ...data.data,
          schedules: transformedSchedules
        }
      };
    } catch (error) {
      console.error('[SCHEDULE SERVICE] 그룹 스케줄 조회 실패:', error);
      return {
        success: false,
        data: {
          schedules: [],
          groupMembers: [],
          userPermission: {
            canManage: false,
            isOwner: false,
            isLeader: false
          }
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 그룹 스케줄 생성
   * @param data 스케줄 생성 데이터
   */
  async createSchedule(data: CreateScheduleRequest): Promise<ScheduleResponse> {
    try {
      console.log('[SCHEDULE SERVICE] 스케줄 생성 시작:', data);
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data)
      });

      const result = await response.json();

      console.log('[SCHEDULE SERVICE] 스케줄 생성 응답:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create schedule');
      }

      return result;
    } catch (error) {
      console.error('[SCHEDULE SERVICE] 스케줄 생성 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 그룹 스케줄 수정
   * @param data 스케줄 수정 데이터
   */
  async updateSchedule(data: UpdateScheduleRequest): Promise<ScheduleResponse> {
    try {
      console.log('[SCHEDULE SERVICE] 스케줄 수정 시작:', data);
      
      const response = await fetch(this.baseUrl, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data)
      });

      const result = await response.json();

      console.log('[SCHEDULE SERVICE] 스케줄 수정 응답:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update schedule');
      }

      return result;
    } catch (error) {
      console.error('[SCHEDULE SERVICE] 스케줄 수정 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 그룹 스케줄 삭제
   * @param scheduleId 스케줄 ID
   * @param groupId 그룹 ID
   */
  async deleteSchedule(scheduleId: number, groupId: number): Promise<ScheduleResponse> {
    try {
      console.log('[SCHEDULE SERVICE] 스케줄 삭제 시작:', { scheduleId, groupId });
      
      const params = new URLSearchParams({
        sst_idx: scheduleId.toString(),
        groupId: groupId.toString()
      });
      
      const response = await fetch(`${this.baseUrl}?${params}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      const result = await response.json();

      console.log('[SCHEDULE SERVICE] 스케줄 삭제 응답:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete schedule');
      }

      return result;
    } catch (error) {
      console.error('[SCHEDULE SERVICE] 스케줄 삭제 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 특정 날짜의 그룹 스케줄 조회
   * @param groupId 그룹 ID
   * @param date 날짜 (YYYY-MM-DD)
   */
  async getGroupSchedulesByDate(groupId: number, date: string): Promise<GroupScheduleResponse> {
    return this.getGroupSchedules(groupId, {
      startDate: date,
      endDate: date
    });
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
    scheduleOwnerId: number, 
    currentUserId?: number
  ): boolean {
    // 오너나 리더는 모든 스케줄 관리 가능
    if (userPermission.canManage) {
      return true;
    }

    // 본인 스케줄만 관리 가능
    return currentUserId !== undefined && scheduleOwnerId === currentUserId;
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