import apiClient from './apiClient';

// WebKit 환경 감지 유틸리티
const isWebKit = () => {
  if (typeof window === 'undefined') return false;
  return !!(window as any).webkit || navigator.userAgent.includes('WebKit');
};

const isIOSWebView = () => {
  if (typeof window === 'undefined') return false;
  const webkit = (window as any).webkit;
  return !!(webkit?.messageHandlers);
};

// WebKit 환경에서 금일 날짜 정규화
const normalizeDate = (date: string): string => {
  if (!isWebKit()) return date;

  // WebKit 환경에서 금일 요청인지 확인
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const standardToday = new Date().toISOString().split('T')[0];

  // 요청된 날짜가 오늘 날짜인 경우에만 WebKit 정규화된 날짜로 변환
  if (date === standardToday || date === today) {
    console.log('[memberLocationLogService] WebKit 금일 날짜 정규화 (오늘만):', {
      원본요청: date,
      정규화결과: today,
      시간대: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    return today;
  }

  // 과거 날짜는 원본 그대로 반환 (정규화하지 않음)
  console.log('[memberLocationLogService] 과거 날짜 정규화 건너뜀:', {
    원본요청: date,
    오늘날짜: today,
    시간대: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  return date;
};

// WebKit 환경에서 최적화된 요청 설정
const getWebKitOptimizedConfig = () => {
  const isWebKitEnv = isWebKit();
  const isIOSWebViewEnv = isIOSWebView();

  if (!isWebKitEnv) return {};

  const config: any = {
    timeout: isIOSWebViewEnv ? 20000 : 25000, // WebKit에서 더 긴 타임아웃
    headers: {
      'X-WebKit-Request': 'true',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    }
  };

  if (isIOSWebViewEnv) {
    config.headers['X-iOS-WebView'] = 'true';
    config.headers['X-Requested-With'] = 'SMAP-iOS-WebView';
  }

  return config;
};

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
    try {
      console.log('[MemberLocationLogService] 일일 위치 로그 조회 시작:', { memberId, date });

      const response = await apiClient.get<LocationLog[]>(`/location-logs/daily/${memberId}?date=${date}`);

      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('[MemberLocationLogService] 일일 위치 로그 조회 오류:', error);
      return [];
    }
  }

  /**
   * 일일 위치 요약 정보 조회
   */
  async getDailyLocationSummary(memberId: number, date: string): Promise<LocationSummary> {
    try {
      console.log('[MemberLocationLogService] 일일 위치 요약 조회 시작:', { memberId, date });

      const response = await apiClient.get<LocationSummary>(`/location-logs/summary/${memberId}?date=${date}`);

      if (response.data && typeof response.data === 'object') {
        return response.data;
      }
      throw new Error('Invalid data returned from server');
    } catch (error) {
      console.error('[MemberLocationLogService] 일일 위치 요약 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 일일 위치 경로 데이터 조회
   */
  async getDailyLocationPath(memberId: number, date: string): Promise<LocationPoint[]> {
    try {
      console.log('[MemberLocationLogService] 일일 위치 경로 조회 시작:', { memberId, date });

      const response = await apiClient.get<LocationPoint[]>(`/location-logs/path/${memberId}?date=${date}`);

      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('[MemberLocationLogService] 일일 위치 경로 조회 오류:', error);
      return [];
    }
  }

  /**
   * 위치 로그가 있는 멤버 목록 조회
   */
  async getMembersWithLogs(groupId: number, date: string): Promise<number[]> {
    try {
      console.log('[MemberLocationLogService] 위치 로그가 있는 멤버 조회 시작:', { groupId, date });

      const response = await apiClient.get<number[]>(`/location-logs/members-with-logs?group_id=${groupId}&date=${date}`);

      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('[MemberLocationLogService] 위치 로그가 있는 멤버 조회 오류:', error);
      return [];
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

      const url = `/location-logs/daily-summary/${memberId}?${params}`;
      const response = await apiClient.get(url);

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<DailySummary[]> = response.data;

      if (result.result === 'Y' && Array.isArray(result.data)) {
        return result.data;
      }
      return [];
    } catch (error) {
      console.error('[MemberLocationLogService] 날짜별 요약 조회 오류:', error);
      return [];
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
    try {
      const params = new URLSearchParams({
        date: date,
        min_speed: minSpeed.toString(),
        max_accuracy: maxAccuracy.toString(),
        min_duration: minDuration.toString()
      });

      const url = `/location-logs/stay-times/${memberId}?${params}`;

      const webkitConfig = getWebKitOptimizedConfig();
      const response = await apiClient.get(url, webkitConfig);

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<StayTime[]> = response.data;

      if (Array.isArray(result.data) && result.data.length > 0) {
        return result.data;
      } else if (result.result === 'Y' && Array.isArray(result.data)) {
        return result.data;
      }
      return [];
    } catch (error) {
      console.error('[MemberLocationLogService] 체류시간 분석 조회 오류:', error);
      return [];
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
    try {
      const params = new URLSearchParams({
        date: date,
        min_speed: minSpeed.toString(),
        max_accuracy: maxAccuracy.toString()
      });

      const url = `/member-location-logs/${memberId}/map-markers?${params}`;

      const webkitConfig = getWebKitOptimizedConfig();
      const response = await apiClient.get(url, webkitConfig);

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<MapMarker[]> = response.data;

      if (result.result === 'Y' && Array.isArray(result.data)) {
        return result.data;
      }
      return [];
    } catch (error) {
      console.error('[MemberLocationLogService] 지도 마커 데이터 조회 오류:', error);
      return [];
    }
  }

  /**
   * PHP 로직 기반 위치 로그 요약 정보 조회 (새로운 API)
   */
  async getLocationLogSummary(memberId: number, date: string): Promise<LocationLogSummary | null> {
    try {
      const response = await apiClient.get(`/location-logs/location-summary/${memberId}?date=${date}`);

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<LocationLogSummary> = response.data;

      if (result.result === 'Y' && result.data) {
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('[MemberLocationLogService] PHP 로직 기반 요약 조회 오류:', error);
      return null;
    }
  }

  /**
   * 최근 N일간 그룹 멤버들의 일별 위치 기록 카운트 조회
   */
  async getDailyLocationCounts(groupId: number, days: number = 14): Promise<DailyCountsResponse | null> {
    try {
      const response = await apiClient.get<DailyCountsResponse>(`/member-location-logs/daily-counts?group_id=${groupId}&days=${days}`);

      if (response.data && response.data.member_daily_counts && Array.isArray(response.data.member_daily_counts)) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('[MemberLocationLogService] 일별 위치 카운트 조회 오류:', error);
      return null;
    }
  }

  /**
   * 특정 날짜의 그룹 멤버별 위치 기록 활동 조회
   */
  async getMemberActivityByDate(groupId: number, date: string): Promise<MemberActivityResponse | null> {
    try {
      const timestamp = Date.now();
      const response = await apiClient.get<ApiResponse<MemberActivityResponse>>(`/member-location-logs/member-activity?group_id=${groupId}&date=${date}&_t=${timestamp}`);
      const result = response.data;

      if (result.result === 'Y' && result.data) {
        if (result.data.date !== date) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const retryTimestamp = Date.now();
          const retryResponse = await apiClient.get<ApiResponse<MemberActivityResponse>>(`/member-location-logs/member-activity?group_id=${groupId}&date=${date}&_t=${retryTimestamp}&retry=1`);
          const retryResult = retryResponse.data;

          if (retryResult.result === 'Y' && retryResult.data) {
            return retryResult.data;
          }
        }
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('[MemberLocationLogService] 멤버 활동 조회 오류:', error);
      return null;
    }
  }
}

export default new MemberLocationLogService();