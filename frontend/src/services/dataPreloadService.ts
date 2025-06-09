import apiClient from './apiClient';
import groupService from './groupService';
import memberService from './memberService';
import scheduleService from './scheduleService';
import locationService from './locationService';
import memberLocationLogService from './memberLocationLogService';

interface PreloadOptions {
  userId: number;
  onProgress?: (step: string, progress: number) => void;
  onError?: (error: Error, step: string) => void;
}

interface PreloadResult {
  userProfile: any;
  userGroups: any[];
  groupMembers: { [groupId: string]: any[] };
  monthlySchedules: { [groupId: string]: any };
  groupPlaces: { [groupId: string]: any[] };
  todayLocationData: { [groupId: string]: any };
  dailyLocationCounts: { [groupId: string]: any };
}

class DataPreloadService {
  private abortController: AbortController | null = null;

  /**
   * 로그인 시 모든 필요한 데이터를 비동기로 프리로딩
   */
  async preloadAllData(options: PreloadOptions): Promise<PreloadResult> {
    this.abortController = new AbortController();
    const { userId, onProgress, onError } = options;
    
    const result: PreloadResult = {
      userProfile: null,
      userGroups: [],
      groupMembers: {},
      monthlySchedules: {},
      groupPlaces: {},
      todayLocationData: {},
      dailyLocationCounts: {},
    };

    try {
      console.log('[DATA PRELOAD] 🚀 데이터 프리로딩 시작:', userId);
      
      // 1. 사용자 프로필 조회 (가장 우선)
      onProgress?.('사용자 정보 조회', 10);
      try {
        result.userProfile = await this.loadUserProfile(userId);
        console.log('[DATA PRELOAD] ✅ 사용자 프로필 조회 완료');
      } catch (error) {
        console.error('[DATA PRELOAD] ❌ 사용자 프로필 조회 실패:', error);
        onError?.(error as Error, 'userProfile');
      }

      // 2. 사용자 그룹 조회
      onProgress?.('그룹 정보 조회', 20);
      try {
        result.userGroups = await this.loadUserGroups(userId);
        console.log('[DATA PRELOAD] ✅ 사용자 그룹 조회 완료:', result.userGroups.length);
      } catch (error) {
        console.error('[DATA PRELOAD] ❌ 사용자 그룹 조회 실패:', error);
        onError?.(error as Error, 'userGroups');
      }

      if (result.userGroups.length === 0) {
        console.log('[DATA PRELOAD] 소속 그룹이 없어 프리로딩 완료');
        onProgress?.('완료', 100);
        return result;
      }

      // 3. 각 그룹의 데이터를 병렬로 조회
      const groupIds = result.userGroups.map(group => group.sgt_idx);
      console.log('[DATA PRELOAD] 그룹별 데이터 조회 시작:', groupIds);

      // 병렬 처리를 위한 Promise 배열
      const groupDataPromises = groupIds.map(groupId => 
        this.loadGroupData(groupId, onProgress, onError)
      );

      // 모든 그룹 데이터를 병렬로 조회
      onProgress?.('그룹 데이터 조회', 30);
      const groupDataResults = await Promise.allSettled(groupDataPromises);

      // 결과 정리
      groupDataResults.forEach((promiseResult, index) => {
        const groupId = groupIds[index];
        if (promiseResult.status === 'fulfilled') {
          const { members, schedules, places, locationData, dailyCounts } = promiseResult.value;
          if (members) result.groupMembers[groupId] = members;
          if (schedules) result.monthlySchedules[groupId] = schedules;
          if (places) result.groupPlaces[groupId] = places;
          if (locationData) result.todayLocationData[groupId] = locationData;
          if (dailyCounts) result.dailyLocationCounts[groupId] = dailyCounts;
        } else {
          console.error(`[DATA PRELOAD] 그룹 ${groupId} 데이터 조회 실패:`, promiseResult.reason);
        }
      });

      onProgress?.('프리로딩 완료', 100);
      console.log('[DATA PRELOAD] 🎉 모든 데이터 프리로딩 완료');
      
      return result;

    } catch (error) {
      console.error('[DATA PRELOAD] ❌ 프리로딩 중 오류:', error);
      throw error;
    }
  }

  /**
   * 사용자 프로필 조회
   */
  private async loadUserProfile(userId: number) {
    // memberService에서 실제 메서드명으로 수정 필요
    return await apiClient.get(`/members/${userId}`);
  }

  /**
   * 사용자 그룹 조회
   */
  private async loadUserGroups(userId: number) {
    return await groupService.getCurrentUserGroups();
  }

  /**
   * 특정 그룹의 모든 데이터 조회
   */
  private async loadGroupData(
    groupId: number, 
    onProgress?: (step: string, progress: number) => void,
    onError?: (error: Error, step: string) => void
  ) {
    const promises = [
      // 그룹 멤버 조회
      this.loadGroupMembers(groupId).catch(error => {
        console.error(`[DATA PRELOAD] 그룹 ${groupId} 멤버 조회 실패:`, error);
        onError?.(error, `groupMembers-${groupId}`);
        return null;
      }),

      // 월간 스케줄 조회
      this.loadMonthlySchedules(groupId).catch(error => {
        console.error(`[DATA PRELOAD] 그룹 ${groupId} 스케줄 조회 실패:`, error);
        onError?.(error, `schedules-${groupId}`);
        return null;
      }),

      // 그룹 장소 조회
      this.loadGroupPlaces(groupId).catch(error => {
        console.error(`[DATA PRELOAD] 그룹 ${groupId} 장소 조회 실패:`, error);
        onError?.(error, `places-${groupId}`);
        return null;
      }),

      // 오늘 위치 데이터 조회
      this.loadTodayLocationData(groupId).catch(error => {
        console.error(`[DATA PRELOAD] 그룹 ${groupId} 오늘 위치 데이터 조회 실패:`, error);
        onError?.(error, `locationData-${groupId}`);
        return null;
      }),

      // 일별 위치 카운트 조회
      this.loadDailyLocationCounts(groupId).catch(error => {
        console.error(`[DATA PRELOAD] 그룹 ${groupId} 일별 카운트 조회 실패:`, error);
        onError?.(error, `dailyCounts-${groupId}`);
        return null;
      }),
    ];

    const [members, schedules, places, locationData, dailyCounts] = await Promise.all(promises);

    return {
      members,
      schedules,
      places,
      locationData,
      dailyCounts,
    };
  }

  /**
   * 그룹 멤버 조회
   */
  private async loadGroupMembers(groupId: number) {
    return await groupService.getGroupMembers(groupId);
  }

  /**
   * 월간 스케줄 조회
   */
  private async loadMonthlySchedules(groupId: number) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    try {
      return await scheduleService.getGroupSchedules(groupId);
    } catch (error) {
      console.warn(`[DATA PRELOAD] 그룹 ${groupId} 스케줄 조회 실패, 빈 배열 반환:`, error);
      return [];
    }
  }

  /**
   * 그룹 장소 조회
   */
  private async loadGroupPlaces(groupId: number) {
    try {
      // locationService에 적절한 메서드가 없으므로 API 직접 호출
      const response = await apiClient.get(`/groups/${groupId}/locations`);
      return response.data;
    } catch (error) {
      console.warn(`[DATA PRELOAD] 그룹 ${groupId} 장소 조회 실패, 빈 배열 반환:`, error);
      return [];
    }
  }

  /**
   * 오늘 위치 데이터 조회
   */
  private async loadTodayLocationData(groupId: number) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    try {
      // 멤버 활동 데이터 조회
      const memberActivity = await memberLocationLogService.getMemberActivityByDate(groupId, today);
      
      // 활성 멤버가 있는 경우 위치 데이터도 조회
      const activeMembers = memberActivity.member_activities?.filter((m: any) => m.is_active) || [];
      
      if (activeMembers.length > 0) {
        // 첫 번째 활성 멤버의 위치 데이터 조회 (예시)
        const firstActiveMember = activeMembers[0];
        try {
          const locationData = await memberLocationLogService.getMapMarkers(firstActiveMember.member_id, today);
          return {
            memberActivity,
            locationData,
            activeMembers,
          };
        } catch (locationError) {
          console.warn(`[DATA PRELOAD] 그룹 ${groupId} 위치 데이터 조회 실패:`, locationError);
          return { memberActivity, activeMembers };
        }
      }
      
      return { memberActivity, activeMembers: [] };
    } catch (error) {
      console.warn(`[DATA PRELOAD] 그룹 ${groupId} 오늘 데이터 조회 실패:`, error);
      return null;
    }
  }

  /**
   * 일별 위치 카운트 조회
   */
  private async loadDailyLocationCounts(groupId: number) {
    try {
      return await memberLocationLogService.getDailyLocationCounts(groupId, 14);
    } catch (error) {
      console.warn(`[DATA PRELOAD] 그룹 ${groupId} 일별 카운트 조회 실패:`, error);
      return null;
    }
  }

  /**
   * 프리로딩 중단
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      console.log('[DATA PRELOAD] 프리로딩 중단됨');
    }
  }

  /**
   * 특정 데이터만 새로고침
   */
  async refreshData(type: string, groupId?: number, userId?: number) {
    console.log(`[DATA PRELOAD] 데이터 새로고침: ${type}`, { groupId, userId });
    
    try {
      switch (type) {
        case 'userProfile':
          if (userId) return await this.loadUserProfile(userId);
          break;
        case 'userGroups':
          if (userId) return await this.loadUserGroups(userId);
          break;
        case 'groupMembers':
          if (groupId) return await this.loadGroupMembers(groupId);
          break;
        case 'schedules':
          if (groupId) return await this.loadMonthlySchedules(groupId);
          break;
        case 'places':
          if (groupId) return await this.loadGroupPlaces(groupId);
          break;
        case 'locationData':
          if (groupId) return await this.loadTodayLocationData(groupId);
          break;
        case 'dailyCounts':
          if (groupId) return await this.loadDailyLocationCounts(groupId);
          break;
        default:
          console.warn(`[DATA PRELOAD] 알 수 없는 데이터 타입: ${type}`);
      }
    } catch (error) {
      console.error(`[DATA PRELOAD] ${type} 새로고침 실패:`, error);
      throw error;
    }
  }
}

export const dataPreloadService = new DataPreloadService();
export default dataPreloadService; 