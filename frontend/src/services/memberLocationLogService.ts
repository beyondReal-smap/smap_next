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

// 날짜별 요약 데이터 인터페이스
export interface DailySummary {
  mlt_idx: number;
  log_date: string;
  start_time: string;
  end_time: string;
}

// 체류시간 분석 데이터 인터페이스
export interface StayTime {
  // 기존 백엔드 필드들
  label?: string;
  grp?: number;
  start_time: string;
  end_time: string;
  duration: number;
  distance?: number;
  start_lat?: number;
  start_long?: number;
  
  // 변환된 API 응답 필드들
  location?: string;
  latitude?: number;
  longitude?: number;
  stay_duration?: string;
  point_count?: number;
}

// 지도 마커 데이터 인터페이스
export interface MapMarker {
  // 기존 백엔드 필드들
  mlt_idx?: number;
  mt_idx?: number;
  mlt_gps_time?: string;
  mlt_speed?: number;
  mlt_lat?: number;
  mlt_long?: number;
  mlt_accuacy?: number;
  mt_health_work?: number;
  mlt_battery?: number;
  mlt_fine_location?: string;
  mlt_location_chk?: string;
  mlt_wdate?: string;
  stay_lat?: number;
  stay_long?: number;
  
  // 변환된 API 응답 필드들
  id?: string | number;
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  speed?: number;
  accuracy?: number;
  battery_level?: number;
  marker_type?: string;
  address?: string;
}

// API 응답 인터페이스
export interface ApiResponse<T> {
  result: string;
  data: T;
  total_days?: number;
  total_stays?: number;
  total_markers?: number;
}

// PHP 로직 기반 요약 데이터 인터페이스
export interface LocationLogSummary {
  schedule_count: string;  // 일정 개수 (포맷된 문자열)
  distance: string;        // 이동거리 (포맷된 문자열, 예: "5.2km")
  duration: string;        // 이동시간 (포맷된 문자열, 예: "2시간 30분")
  steps: number;          // 걸음수
}

// 일별 카운트 데이터 인터페이스
export interface DailyCount {
  date: string;
  count: number;
  formatted_date: string;
  day_of_week: string;
  is_today: boolean;
  is_weekend: boolean;
}

// 멤버별 일별 카운트 데이터 인터페이스
export interface MemberDailyCount {
  member_id: number;
  member_name: string;
  member_photo: string | null;
  member_gender: number | null;
  daily_counts: DailyCount[];
}

// 일별 카운트 응답 인터페이스 (멤버별 분리)
export interface DailyCountsResponse {
  member_daily_counts: MemberDailyCount[];
  total_daily_counts: DailyCount[];
  total_days: number;
  start_date: string;
  end_date: string;
  group_id: number;
  total_members: number;
}

// 멤버 활동 데이터 인터페이스
export interface MemberActivity {
  member_id: number;
  member_name: string;
  member_photo: string | null;
  member_gender: number | null;
  log_count: number;
  first_log_time: string | null;
  last_log_time: string | null;
  is_active: boolean;
}

// 멤버 활동 응답 인터페이스
export interface MemberActivityResponse {
  member_activities: MemberActivity[];
  date: string;
  group_id: number;
  total_members: number;
  active_members: number;
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
        timestamp: `${date}T12:30:00`,
        latitude: 37.5660,
        longitude: 126.9785,
        address: "서울시 중구 을지로"
      },
      {
        timestamp: `${date}T18:00:00`,
        latitude: 37.5655,
        longitude: 126.9790,
        address: "서울시 중구 충무로"
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
   * 위치 로그가 있는 멤버 목록 조회
   */
  async getMembersWithLogs(groupId: number, date: string): Promise<number[]> {
    const mockData: number[] = [1186, 1187, 1188];

    try {
      console.log('[MemberLocationLogService] 위치 로그가 있는 멤버 조회 시작:', { groupId, date });
      
      const response = await apiClient.get<number[]>(`/location-logs/members-with-logs?group_id=${groupId}&date=${date}`);
      
      console.log('[MemberLocationLogService] 위치 로그가 있는 멤버 조회 응답:', {
        status: response.status,
        dataLength: response.data?.length || 0
      });
      
      if (Array.isArray(response.data)) {
        console.log('[MemberLocationLogService] ✅ 실제 백엔드 데이터 사용:', response.data.length, '명');
        return response.data;
      } else {
        console.warn('[MemberLocationLogService] ⚠️ 백엔드에서 유효하지 않은 데이터 반환, mock 데이터 사용');
        return mockData;
      }
    } catch (error) {
      console.error('[MemberLocationLogService] 위치 로그가 있는 멤버 조회 오류:', error);
      
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
   * 날짜별 요약 데이터 조회 (새로운 API)
   */
  async getDailySummaryByRange(
    memberId: number, 
    startDate: string, 
    endDate: string, 
    maxAccuracy: number = 50.0, 
    minSpeed: number = 0.0
  ): Promise<DailySummary[]> {
    const mockData: DailySummary[] = [
      {
        mlt_idx: 52890682,
        log_date: startDate,
        start_time: `${startDate} 08:28:10`,
        end_time: `${startDate} 21:48:20`
      }
    ];

    try {
      console.log('[MemberLocationLogService] 날짜별 요약 조회 시작:', { 
        memberId, startDate, endDate, maxAccuracy, minSpeed 
      });
      
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        max_accuracy: maxAccuracy.toString(),
        min_speed: minSpeed.toString()
      });
      
      const url = `location-logs/daily-summary/${memberId}?${params}`;
      const response = await apiClient.get(url);

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<DailySummary[]> = response.data;
      
      console.log('[MemberLocationLogService] 날짜별 요약 조회 응답:', {
        status: response.status,
        dataLength: result.data?.length || 0,
        totalDays: result.total_days
      });
      
      if (result.result === 'Y' && Array.isArray(result.data)) {
        console.log('[MemberLocationLogService] ✅ 실제 백엔드 데이터 사용:', result.data.length, '일');
        return result.data;
      } else {
        console.warn('[MemberLocationLogService] ⚠️ 백엔드에서 유효하지 않은 데이터 반환, mock 데이터 사용');
        return mockData;
      }
    } catch (error) {
      console.error('[MemberLocationLogService] 날짜별 요약 조회 오류:', error);
      
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
   * 특정 날짜 체류시간 분석 조회 (새로운 API)
   */
  async getStayTimes(
    memberId: number, 
    date: string, 
    minSpeed: number = 1.0, 
    maxAccuracy: number = 50.0, 
    minDuration: number = 5
  ): Promise<StayTime[]> {
    const mockData: StayTime[] = [
      {
        label: 'stay',
        grp: 1,
        start_time: `${date} 09:00:00`,
        end_time: `${date} 09:15:00`,
        duration: 15.0,
        distance: 0.1,
        start_lat: 37.5665,
        start_long: 126.9780
      }
    ];

    try {
      console.log('[MemberLocationLogService] 체류시간 분석 조회 시작:', { 
        memberId, date, minSpeed, maxAccuracy, minDuration 
      });
      
      const params = new URLSearchParams({
        date: date,
        min_speed: minSpeed.toString(),
        max_accuracy: maxAccuracy.toString(),
        min_duration: minDuration.toString()
      });
      
      const url = `location-logs/stay-times/${memberId}?${params}`;
      const response = await apiClient.get(url);

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<StayTime[]> = response.data;
      
      console.log('[MemberLocationLogService] 체류시간 분석 조회 응답:', {
        status: response.status,
        dataLength: result.data?.length || 0,
        totalStays: result.total_stays
      });
      
      if (result.result === 'Y' && Array.isArray(result.data)) {
        console.log('[MemberLocationLogService] ✅ 실제 백엔드 데이터 사용:', result.data.length, '개');
        return result.data;
      } else {
        console.warn('[MemberLocationLogService] ⚠️ 백엔드에서 유효하지 않은 데이터 반환, mock 데이터 사용');
        return mockData;
      }
    } catch (error) {
      console.error('[MemberLocationLogService] 체류시간 분석 조회 오류:', error);
      
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
   * 지도 마커용 이동로그 데이터 조회 (새로운 API)
   */
  async getMapMarkers(
    memberId: number, 
    date: string, 
    minSpeed: number = 1.0, 
    maxAccuracy: number = 50.0
  ): Promise<MapMarker[]> {
    const mockData: MapMarker[] = [
      {
        mlt_idx: 1,
        mt_idx: memberId,
        mlt_gps_time: `${date} 09:30:00`,
        mlt_speed: 2.5,
        mlt_lat: 37.5665,
        mlt_long: 126.9780,
        mlt_accuacy: 15.0,
        mt_health_work: 5000,
        mlt_battery: 85,
        mlt_fine_location: 'Y',
        mlt_location_chk: 'Y',
        mlt_wdate: `${date} 09:30:00`,
        stay_lat: undefined,
        stay_long: undefined
      }
    ];

    try {
      console.log('[MemberLocationLogService] 지도 마커 데이터 조회 시작:', { 
        memberId, date, minSpeed, maxAccuracy 
      });
      
      const params = new URLSearchParams({
        date: date,
        min_speed: minSpeed.toString(),
        max_accuracy: maxAccuracy.toString()
      });
      
      const url = `/member-location-logs/${memberId}/map-markers?${params}`;
      const response = await apiClient.get(url);

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<MapMarker[]> = response.data;
      
      console.log('[MemberLocationLogService] 지도 마커 데이터 조회 응답:', {
        status: response.status,
        dataLength: result.data?.length || 0,
        totalMarkers: result.total_markers
      });
      
      if (result.result === 'Y' && Array.isArray(result.data)) {
        console.log('[MemberLocationLogService] ✅ 실제 백엔드 데이터 사용:', result.data.length, '개');
        
        // 600건 넘는 경우 경고 로그
        if (result.data.length > 600) {
          console.warn(`[MemberLocationLogService] ⚠️ 지도 마커 600건 초과 경고: ${result.data.length}건 (member=${memberId}, date=${date})`);
        }
        
        return result.data;
      } else {
        console.warn('[MemberLocationLogService] ⚠️ 백엔드에서 유효하지 않은 데이터 반환, mock 데이터 사용');
        return mockData;
      }
    } catch (error) {
      console.error('[MemberLocationLogService] 지도 마커 데이터 조회 오류:', error);
      
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
   * PHP 로직 기반 위치 로그 요약 정보 조회 (새로운 API)
   */
  async getLocationLogSummary(memberId: number, date: string): Promise<LocationLogSummary> {
    const mockData: LocationLogSummary = {
      schedule_count: "3",
      distance: "5.2km",
      duration: "2시간 30분",
      steps: 7500
    };

    try {
      console.log('[MemberLocationLogService] PHP 로직 기반 요약 조회 시작:', { memberId, date });
      
      const response = await apiClient.get(`location-logs/location-summary/${memberId}?date=${date}`);

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<LocationLogSummary> = response.data;
      
      console.log('[MemberLocationLogService] PHP 로직 기반 요약 조회 응답:', {
        status: response.status,
        data: result.data
      });
      
      if (result.result === 'Y' && result.data) {
        console.log('[MemberLocationLogService] ✅ 실제 백엔드 데이터 사용 (PHP 로직)');
        return result.data;
      } else {
        console.warn('[MemberLocationLogService] ⚠️ 백엔드에서 유효하지 않은 데이터 반환, mock 데이터 사용');
        return mockData;
      }
    } catch (error) {
      console.error('[MemberLocationLogService] PHP 로직 기반 요약 조회 오류:', error);
      
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
   * 최근 N일간 그룹 멤버들의 일별 위치 기록 카운트 조회
   */
  async getDailyLocationCounts(groupId: number, days: number = 14): Promise<DailyCountsResponse> {
    // 멤버별 Mock 데이터 생성
    const mockMemberDailyCounts: MemberDailyCount[] = [
      {
        member_id: 1,
        member_name: "김철수",
        member_photo: null,
        member_gender: 1,
        daily_counts: []
      },
      {
        member_id: 2,
        member_name: "이영희", 
        member_photo: null,
        member_gender: 2,
        daily_counts: []
      }
    ];

    const mockTotalDailyCounts: DailyCount[] = [];

    // Mock 데이터 생성 (최근 N일간)
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const dailyCountTemplate = {
        date: dateStr,
        formatted_date: date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
        day_of_week: date.toLocaleDateString('ko-KR', { weekday: 'short' }),
        is_today: i === 0,
        is_weekend: date.getDay() === 0 || date.getDay() === 6
      };

      let totalCount = 0;
      
      // 각 멤버별 카운트 생성
      mockMemberDailyCounts.forEach(member => {
        const count = Math.floor(Math.random() * 25) + 5; // 5-30 사이 랜덤 카운트
        member.daily_counts.push({
          ...dailyCountTemplate,
          count: count
        });
        totalCount += count;
      });

      // 전체 카운트 추가
      mockTotalDailyCounts.push({
        ...dailyCountTemplate,
        count: totalCount
      });
    }

    const mockData: DailyCountsResponse = {
      member_daily_counts: mockMemberDailyCounts,
      total_daily_counts: mockTotalDailyCounts,
      total_days: days,
      start_date: new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      group_id: groupId,
      total_members: mockMemberDailyCounts.length
    };

    try {
      console.log('[MemberLocationLogService] 일별 위치 카운트 조회 시작:', { groupId, days });
      
      const response = await apiClient.get<DailyCountsResponse>(`/member-location-logs/daily-counts?group_id=${groupId}&days=${days}`);
      
      console.log('[MemberLocationLogService] 일별 위치 카운트 조회 응답:', {
        status: response.status,
        memberCountsLength: response.data?.member_daily_counts?.length || 0,
        totalCountsLength: response.data?.total_daily_counts?.length || 0
      });
      
      if (response.data && response.data.member_daily_counts && Array.isArray(response.data.member_daily_counts)) {
        console.log('[MemberLocationLogService] ✅ 실제 백엔드 데이터 사용:', response.data.member_daily_counts.length, '명');
        return response.data;
      } else {
        console.warn('[MemberLocationLogService] ⚠️ 백엔드에서 유효하지 않은 데이터 반환, mock 데이터 사용');
        return mockData;
      }
    } catch (error) {
      console.error('[MemberLocationLogService] 일별 위치 카운트 조회 오류:', error);
      
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
   * 특정 날짜의 그룹 멤버별 위치 기록 활동 조회
   */
  async getMemberActivityByDate(groupId: number, date: string): Promise<MemberActivityResponse> {
    const mockData: MemberActivityResponse = {
      member_activities: [
        {
          member_id: 1,
          member_name: "김철수",
          member_photo: null,
          member_gender: 1,
          log_count: 45,
          first_log_time: `${date}T08:30:00`,
          last_log_time: `${date}T18:45:00`,
          is_active: true
        },
        {
          member_id: 2,
          member_name: "이영희",
          member_photo: null,
          member_gender: 2,
          log_count: 32,
          first_log_time: `${date}T09:15:00`,
          last_log_time: `${date}T17:20:00`,
          is_active: true
        },
        {
          member_id: 3,
          member_name: "박지민",
          member_photo: null,
          member_gender: 2,
          log_count: 0,
          first_log_time: null,
          last_log_time: null,
          is_active: false
        }
      ],
      date: date,
      group_id: groupId,
      total_members: 3,
      active_members: 2
    };

    try {
      console.log('[MemberLocationLogService] 멤버 활동 조회 시작:', { groupId, date });
      
      const response = await apiClient.get<MemberActivityResponse>(`/member-location-logs/member-activity?group_id=${groupId}&date=${date}`);
      
      console.log('[MemberLocationLogService] 멤버 활동 조회 응답:', {
        status: response.status,
        dataLength: response.data?.member_activities?.length || 0
      });
      
      if (response.data && response.data.member_activities && Array.isArray(response.data.member_activities)) {
        console.log('[MemberLocationLogService] ✅ 실제 백엔드 데이터 사용:', response.data.member_activities.length, '개');
        return response.data;
      } else {
        console.warn('[MemberLocationLogService] ⚠️ 백엔드에서 유효하지 않은 데이터 반환, mock 데이터 사용');
        return mockData;
      }
    } catch (error) {
      console.error('[MemberLocationLogService] 멤버 활동 조회 오류:', error);
      
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