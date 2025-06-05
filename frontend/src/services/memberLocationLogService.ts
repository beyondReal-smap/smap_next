import apiClient from './apiClient';

// 기본 위치 로그 인터페이스
export interface LocationLog {
  log_idx: number;
  mt_idx: number;
  mt_name?: string;
  log_datetime: string;
  log_lat: number;
  log_long: number;
  log_battery?: number;
  log_speed?: number;
  distance_from_prev?: number;
}

// 위치 요약 데이터 인터페이스
export interface LocationSummary {
  total_distance: number;
  total_time: string;
  step_count: number;
  average_speed: number;
  battery_consumption: number;
}

// 위치 경로 포인트 인터페이스
export interface LocationPoint {
  timestamp: string;
  latitude: number;
  longitude: number;
  address?: string;
}

// 위치 경로 데이터 인터페이스
export interface LocationPathData {
  points: LocationPoint[];
}

class MemberLocationLogService {
  /**
   * 일일 위치 로그 조회 (정확한 날짜 매칭)
   */
  async getDailyLocationLogs(memberId: number, date: string): Promise<LocationLog[]> {
    const mockData: LocationLog[] = [
      {
        log_idx: 1,
        mt_idx: memberId,
        mt_name: "목업사용자",
        log_datetime: `${date}T09:30:00`,
        log_lat: 37.5665,
        log_long: 126.9780,
        log_battery: 85,
        log_speed: 1.2,
        distance_from_prev: 0.5
      },
      {
        log_idx: 2,
        mt_idx: memberId,
        mt_name: "목업사용자",
        log_datetime: `${date}T12:15:00`,
        log_lat: 37.5660,
        log_long: 126.9785,
        log_battery: 78,
        log_speed: 2.1,
        distance_from_prev: 0.8
      }
    ];

    try {
      console.log('[MemberLocationLogService] 일일 위치 로그 조회 시작:', { memberId, date });
      
      const response = await apiClient.get<LocationLog[]>(`/location-logs/daily/${memberId}?date=${date}`);
      
      console.log('[MemberLocationLogService] 일일 위치 로그 조회 응답:', {
        status: response.status,
        dataLength: response.data?.length || 0
      });
      
      if (Array.isArray(response.data) && response.data.length >= 0) {
        console.log('[MemberLocationLogService] ✅ 실제 백엔드 데이터 사용:', response.data.length, '개');
        return response.data;
      } else {
        console.warn('[MemberLocationLogService] ⚠️ 백엔드에서 유효하지 않은 데이터 반환, mock 데이터 사용');
        return mockData;
      }
    } catch (error) {
      console.error('[MemberLocationLogService] 일일 위치 로그 조회 오류:', error);
      
      if (error instanceof Error) {
        console.error('[MemberLocationLogService] 오류 상세:', {
          message: error.message,
          name: error.name,
        });
      }
      
      return mockData;
    }
  }

  /**
   * 일일 위치 요약 정보 조회
   */
  async getDailyLocationSummary(memberId: number, date: string): Promise<LocationSummary> {
    const mockData: LocationSummary = {
      total_distance: 8.5,
      total_time: "4시간 30분",
      step_count: 12500,
      average_speed: 1.9,
      battery_consumption: 15
    };

    try {
      console.log('[MemberLocationLogService] 일일 위치 요약 조회 시작:', { memberId, date });
      
      const response = await apiClient.get<LocationSummary>(`/location-logs/summary/${memberId}?date=${date}`);
      
      console.log('[MemberLocationLogService] 일일 위치 요약 조회 응답:', {
        status: response.status,
        data: response.data
      });
      
      if (response.data && typeof response.data === 'object') {
        console.log('[MemberLocationLogService] ✅ 실제 백엔드 데이터 사용');
        return response.data;
      } else {
        console.warn('[MemberLocationLogService] ⚠️ 백엔드에서 유효하지 않은 데이터 반환, mock 데이터 사용');
        return mockData;
      }
    } catch (error) {
      console.error('[MemberLocationLogService] 일일 위치 요약 조회 오류:', error);
      
      if (error instanceof Error) {
        console.error('[MemberLocationLogService] 오류 상세:', {
          message: error.message,
          name: error.name,
        });
      }
      
      return mockData;
    }
  }

  /**
   * 일일 위치 경로 데이터 조회
   */
  async getDailyLocationPath(memberId: number, date: string): Promise<LocationPoint[]> {
    const mockData: LocationPoint[] = [
      {
        timestamp: `${date}T09:00:00`,
        latitude: 37.5665,
        longitude: 126.9780,
        address: "서울시 중구 명동"
      },
      {
        timestamp: `${date}T12:00:00`,
        latitude: 37.5660,
        longitude: 126.9785,
        address: "서울시 중구 을지로"
      },
      {
        timestamp: `${date}T15:00:00`,
        latitude: 37.5670,
        longitude: 126.9790,
        address: "서울시 중구 소공동"
      }
    ];

    try {
      console.log('[MemberLocationLogService] 일일 위치 경로 조회 시작:', { memberId, date });
      
      const response = await apiClient.get<LocationPoint[]>(`/location-logs/path/${memberId}?date=${date}`);
      
      console.log('[MemberLocationLogService] 일일 위치 경로 조회 응답:', {
        status: response.status,
        dataLength: response.data?.length || 0
      });
      
      if (Array.isArray(response.data) && response.data.length >= 0) {
        console.log('[MemberLocationLogService] ✅ 실제 백엔드 데이터 사용:', response.data.length, '개');
        return response.data;
      } else {
        console.warn('[MemberLocationLogService] ⚠️ 백엔드에서 유효하지 않은 데이터 반환, mock 데이터 사용');
        return mockData;
      }
    } catch (error) {
      console.error('[MemberLocationLogService] 일일 위치 경로 조회 오류:', error);
      
      if (error instanceof Error) {
        console.error('[MemberLocationLogService] 오류 상세:', {
          message: error.message,
          name: error.name,
        });
      }
      
      return mockData;
    }
  }

  /**
   * 특정 날짜에 로그가 있는 멤버 목록 조회
   */
  async getMembersWithLogs(groupId: number, date: string): Promise<number[]> {
    const mockData: number[] = [282, 1186];

    try {
      console.log('[MemberLocationLogService] 로그가 있는 멤버 목록 조회 시작:', { groupId, date });
      
      const response = await apiClient.get<number[]>(`/location-logs/members-with-logs?group_id=${groupId}&date=${date}`);
      
      console.log('[MemberLocationLogService] 로그가 있는 멤버 목록 조회 응답:', {
        status: response.status,
        dataLength: response.data?.length || 0
      });
      
      if (Array.isArray(response.data) && response.data.length >= 0) {
        console.log('[MemberLocationLogService] ✅ 실제 백엔드 데이터 사용:', response.data.length, '명');
        return response.data;
      } else {
        console.warn('[MemberLocationLogService] ⚠️ 백엔드에서 유효하지 않은 데이터 반환, mock 데이터 사용');
        return mockData;
      }
    } catch (error) {
      console.error('[MemberLocationLogService] 로그가 있는 멤버 목록 조회 오류:', error);
      
      if (error instanceof Error) {
        console.error('[MemberLocationLogService] 오류 상세:', {
          message: error.message,
          name: error.name,
        });
      }
      
      return mockData;
    }
  }
}

export default new MemberLocationLogService(); 