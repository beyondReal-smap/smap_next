'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// 캐시 데이터 타입 정의
interface UserProfile {
  mt_idx: number;
  mt_name: string;
  mt_nickname?: string;
  mt_email?: string;
  mt_file1?: string;
  mt_gender?: number;
  // 기타 사용자 정보 필드들
}

interface GroupInfo {
  sgt_idx: number;
  sgt_title: string;
  sgt_intro?: string;
  member_count: number;
  sgdt_owner_chk: string;
  sgdt_leader_chk: string;
}

interface GroupMember {
  mt_idx: number;
  mt_name: string;
  mt_file1?: string;
  mt_gender?: number;
  sgdt_owner_chk: string;
  sgdt_leader_chk: string;
  isSelected?: boolean;
  location?: {
    lat: number;
    lng: number;
  };
}

interface ScheduleData {
  [groupId: string]: {
    [date: string]: any[]; // 해당 날짜의 스케줄 배열
  };
}

interface LocationData {
  [groupId: string]: {
    [date: string]: {
      [memberId: string]: {
        mapMarkers: any[];
        stayTimes: any[];
        dailySummary: any[];
        locationLogSummary: any;
        members: GroupMember[];
        lastUpdated: number;
      };
    };
  };
}

interface GroupPlaces {
  [groupId: string]: any[]; // 그룹별 장소 데이터
}

interface CacheData {
  userProfile: UserProfile | null;
  userGroups: GroupInfo[];
  groupMembers: { [groupId: string]: GroupMember[] };
  scheduleData: ScheduleData;
  locationData: LocationData;
  groupPlaces: GroupPlaces;
  dailyLocationCounts: { [groupId: string]: any };
  lastUpdated: {
    userProfile: number;
    userGroups: number;
    groupMembers: { [groupId: string]: number };
    scheduleData: { [groupId: string]: number };
    locationData: { [groupId: string]: { [date: string]: { [memberId: string]: number } } };
    groupPlaces: { [groupId: string]: number };
    dailyLocationCounts: { [groupId: string]: number };
  };
}

interface DataCacheContextType {
  cache: CacheData;
  
  // 사용자 프로필
  getUserProfile: () => UserProfile | null;
  setUserProfile: (profile: UserProfile) => void;
  
  // 사용자 그룹
  getUserGroups: () => GroupInfo[];
  setUserGroups: (groups: GroupInfo[]) => void;
  
  // 그룹 멤버
  getGroupMembers: (groupId: number) => GroupMember[];
  setGroupMembers: (groupId: number, members: GroupMember[]) => void;
  
  // 스케줄 데이터
  getScheduleData: (groupId: number, date?: string) => any[];
  setScheduleData: (groupId: number, date: string, schedules: any[]) => void;
  
  // 위치 데이터
  getLocationData: (groupId: number, date: string, memberId?: string) => any | null;
  setLocationData: (groupId: number, date: string, memberId: string, data: any) => void;
  
  // 그룹 장소
  getGroupPlaces: (groupId: number) => any[];
  setGroupPlaces: (groupId: number, places: any[]) => void;
  
  // 일별 위치 카운트
  getDailyLocationCounts: (groupId: number) => any | null;
  setDailyLocationCounts: (groupId: number, counts: any) => void;
  
  // 캐시 관리
  isCacheValid: (type: string, groupId?: number, date?: string) => boolean;
  invalidateCache: (type: string, groupId?: number, date?: string) => void;
  clearAllCache: () => void;
  
  // 로딩 상태
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

// 캐시 지속 시간 설정 (더 긴 시간으로 변경)
const CACHE_DURATION = {
  userProfile: 15 * 60 * 1000, // 15분 (5분 → 15분)
  userGroups: 15 * 60 * 1000,  // 15분
  groupMembers: 10 * 60 * 1000, // 10분
  scheduleData: 10 * 60 * 1000,  // 10분
  locationData: 15 * 60 * 1000,  // 15분 (더 긴 시간)
  groupPlaces: 30 * 60 * 1000,  // 30분 (장소는 자주 변하지 않음)
  dailyLocationCounts: 10 * 60 * 1000, // 10분 (5분 → 10분)
};

// 백그라운드 새로고침을 위한 소프트 만료 시간 (실제 만료의 80%)
const SOFT_EXPIRY_RATIO = 0.8;

const initialCache: CacheData = {
  userProfile: null,
  userGroups: [],
  groupMembers: {},
  scheduleData: {},
  locationData: {},
  groupPlaces: {},
  dailyLocationCounts: {},
  lastUpdated: {
    userProfile: 0,
    userGroups: 0,
    groupMembers: {},
    scheduleData: {},
    locationData: {},
    groupPlaces: {},
    dailyLocationCounts: {},
  },
};

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

export const DataCacheProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cache, setCache] = useState<CacheData>(initialCache);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 초기화는 한 번만 로그 출력
  React.useEffect(() => {
    if (!isInitialized) {
      console.log('[DATA CACHE] 🚀 DataCacheProvider 초기화');
      
      // 기존 캐시에서 잘못된 타임스탬프 데이터 정리
      const now = Date.now();
      let needsCleanup = false;
      
      // 각 타임스탬프 검사 및 수정
      const cleanedLastUpdated = { ...cache.lastUpdated };
      
      // userProfile 타임스탬프 검사
      if (cleanedLastUpdated.userProfile > 0 && cleanedLastUpdated.userProfile < 9999999999) {
        console.warn('[DATA CACHE] ⚠️ userProfile 타임스탬프 수정:', cleanedLastUpdated.userProfile);
        cleanedLastUpdated.userProfile = 0; // 무효화
        needsCleanup = true;
      }
      
      // userGroups 타임스탬프 검사
      if (cleanedLastUpdated.userGroups > 0 && cleanedLastUpdated.userGroups < 9999999999) {
        console.warn('[DATA CACHE] ⚠️ userGroups 타임스탬프 수정:', cleanedLastUpdated.userGroups);
        cleanedLastUpdated.userGroups = 0; // 무효화
        needsCleanup = true;
      }
      
      // groupMembers 타임스탬프 검사
      Object.keys(cleanedLastUpdated.groupMembers).forEach(groupId => {
        const timestamp = cleanedLastUpdated.groupMembers[groupId];
        if (timestamp > 0 && timestamp < 9999999999) {
          console.warn(`[DATA CACHE] ⚠️ groupMembers(${groupId}) 타임스탬프 수정:`, timestamp);
          cleanedLastUpdated.groupMembers[groupId] = 0; // 무효화
          needsCleanup = true;
        }
      });
      
      // 정리가 필요한 경우 캐시 업데이트
      if (needsCleanup) {
        console.log('[DATA CACHE] 🔧 잘못된 타임스탬프 데이터 정리 완료');
        setCache(prev => ({
          ...prev,
          lastUpdated: cleanedLastUpdated,
        }));
      }
      
      setIsInitialized(true);
    }
  }, [isInitialized, cache.lastUpdated]);

  // 캐시 상태 변화 추적 (디바운스 적용)
  React.useEffect(() => {
    if (!isInitialized) return;
    
    const timeoutId = setTimeout(() => {
      const cacheStats = {
        userProfile: cache.userProfile ? '존재' : '없음',
        userGroups: cache.userGroups.length,
        groupMembers: Object.keys(cache.groupMembers).length,
        scheduleData: Object.keys(cache.scheduleData).length,
        locationData: Object.keys(cache.locationData).length,
        groupPlaces: Object.keys(cache.groupPlaces).length,
        dailyLocationCounts: Object.keys(cache.dailyLocationCounts).length,
      };
      
      console.log('[DATA CACHE] 📊 캐시 상태 업데이트:', cacheStats);
    }, 500); // 500ms 디바운스
    
    return () => clearTimeout(timeoutId);
  }, [cache, isInitialized]);

  // 캐시 유효성 검사 (하드 만료와 소프트 만료 구분)
  const isCacheValid = useCallback((type: string, groupId?: number, date?: string, checkSoft = false): boolean => {
    const now = Date.now();
    let duration = CACHE_DURATION[type as keyof typeof CACHE_DURATION] || 10 * 60 * 1000;
    
    // 🕒 위치 데이터의 경우 날짜별 차등 캐시 시간 적용
    if (type === 'locationData' && date) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      if (date === today) {
        duration = 3 * 60 * 1000; // 오늘: 3분 (자주 업데이트)
      } else if (date === yesterday) {
        duration = 15 * 60 * 1000; // 어제: 15분
      } else {
        duration = 24 * 60 * 60 * 1000; // 과거 날짜: 24시간 (거의 변경되지 않음)
      }
    }
    
    const actualDuration = checkSoft ? duration * SOFT_EXPIRY_RATIO : duration; // 소프트 체크 시 80% 시점
    
    let isValid = false;
    let lastUpdate = 0;
    
    switch (type) {
      case 'userProfile':
        lastUpdate = cache.lastUpdated.userProfile;
        isValid = now - lastUpdate < actualDuration;
        break;
      case 'userGroups':
        lastUpdate = cache.lastUpdated.userGroups;
        isValid = now - lastUpdate < actualDuration;
        break;
      case 'groupMembers':
        if (!groupId) return false;
        lastUpdate = cache.lastUpdated.groupMembers[groupId] || 0;
        isValid = now - lastUpdate < actualDuration;
        break;
      case 'scheduleData':
        if (!groupId) return false;
        lastUpdate = cache.lastUpdated.scheduleData[groupId] || 0;
        isValid = now - lastUpdate < actualDuration;
        break;
      case 'locationData':
        if (!groupId || !date) return false;
        // memberId가 없으면 해당 그룹/날짜의 모든 멤버 데이터가 유효한지 확인
        const memberUpdates = cache.lastUpdated.locationData[groupId]?.[date];
        if (!memberUpdates) return false;
        const allMemberUpdates = Object.values(memberUpdates);
        lastUpdate = allMemberUpdates.length > 0 ? Math.max(...allMemberUpdates) : 0;
        isValid = now - lastUpdate < actualDuration;
        break;
      case 'groupPlaces':
        if (!groupId) return false;
        lastUpdate = cache.lastUpdated.groupPlaces[groupId] || 0;
        isValid = now - lastUpdate < actualDuration;
        break;
      case 'dailyLocationCounts':
        if (!groupId) return false;
        lastUpdate = cache.lastUpdated.dailyLocationCounts[groupId] || 0;
        isValid = now - lastUpdate < actualDuration;
        break;
      default:
        return false;
    }
    
    // 타임스탬프 검증 및 수정
    let correctedLastUpdate = lastUpdate;
    let timestampCorrected = false;
    
    // lastUpdate가 초 단위로 저장된 경우 (10자리 숫자) 밀리초로 변환
    if (lastUpdate > 0 && lastUpdate < 9999999999) { // 10자리 미만이면 초 단위
      correctedLastUpdate = lastUpdate * 1000;
      timestampCorrected = true;
      console.warn(`[DATA CACHE] ⚠️ 타임스탬프 형식 오류 감지 및 수정: ${lastUpdate} → ${correctedLastUpdate}`);
    }
    
    // 수정된 타임스탬프로 유효성 재계산
    const correctedElapsedMs = now - correctedLastUpdate;
    const correctedIsValid = correctedElapsedMs < actualDuration;
    
    const elapsedSeconds = Math.round(correctedElapsedMs / 1000);
    const maxSeconds = Math.round(actualDuration / 1000);
    const status = correctedIsValid ? '유효' : '만료';
    const softCheck = checkSoft ? ' (소프트)' : '';
    const correctionNote = timestampCorrected ? ' (타임스탬프 수정됨)' : '';
    
    console.log(`[DATA CACHE] 캐시 유효성 검사: ${type}${groupId ? `(${groupId})` : ''}${date ? `[${date}]` : ''}${softCheck} - ${status} (${elapsedSeconds}초/${maxSeconds}초)${correctionNote}`);
    
    // 타임스탬프가 수정되었고 캐시가 만료된 경우 캐시 무효화
    if (timestampCorrected && !correctedIsValid) {
      console.log(`[DATA CACHE] 🔄 잘못된 타임스탬프로 인한 캐시 무효화: ${type}${groupId ? `(${groupId})` : ''}`);
      // 해당 캐시 항목의 타임스탬프를 0으로 리셋하여 다음에 새로 로드하도록 함
      setTimeout(() => {
        invalidateCache(type, groupId, date);
      }, 0);
    }
    
    return correctedIsValid;
  }, [cache.lastUpdated]);

  // 사용자 프로필
  const getUserProfile = useCallback(() => {
    const isValid = isCacheValid('userProfile');
    if (isValid && cache.userProfile) {
      console.log('[DATA CACHE] ✅ 사용자 프로필 캐시 히트:', cache.userProfile);
      return cache.userProfile;
    } else {
      console.log('[DATA CACHE] ❌ 사용자 프로필 캐시 미스');
      return null;
    }
  }, [cache.userProfile, isCacheValid]);
  
  const setUserProfile = useCallback((profile: UserProfile) => {
    console.log('[DATA CACHE] 💾 사용자 프로필 캐시 저장:', profile);
    setCache(prev => ({
      ...prev,
      userProfile: profile,
      lastUpdated: {
        ...prev.lastUpdated,
        userProfile: Date.now(),
      },
    }));
  }, []);

  // 사용자 그룹
  const getUserGroups = useCallback(() => {
    const isValid = isCacheValid('userGroups');
    if (isValid && cache.userGroups.length > 0) {
      console.log('[DATA CACHE] ✅ 사용자 그룹 캐시 히트:', cache.userGroups.length, '개');
      return cache.userGroups;
    } else {
      console.log('[DATA CACHE] ❌ 사용자 그룹 캐시 미스');
      return [];
    }
  }, [cache.userGroups, isCacheValid]);
  
  const setUserGroups = useCallback((groups: GroupInfo[]) => {
    console.log('[DATA CACHE] 💾 사용자 그룹 캐시 저장:', groups.length, '개');
    setCache(prev => ({
      ...prev,
      userGroups: groups,
      lastUpdated: {
        ...prev.lastUpdated,
        userGroups: Date.now(),
      },
    }));
  }, []);

  // 그룹 멤버
  const getGroupMembers = useCallback((groupId: number): GroupMember[] => {
    const isValid = isCacheValid('groupMembers', groupId);
    const members = cache.groupMembers[groupId] || [];
    if (isValid && members.length > 0) {
      console.log(`[DATA CACHE] ✅ 그룹 멤버 캐시 히트 (${groupId}):`, members.length, '명');
      return members;
    } else {
      console.log(`[DATA CACHE] ❌ 그룹 멤버 캐시 미스 (${groupId})`);
      return [];
    }
  }, [cache.groupMembers, isCacheValid]);
  
  const setGroupMembers = useCallback((groupId: number, members: GroupMember[]) => {
    const timestamp = Date.now();
    console.log(`[DATA CACHE] 💾 그룹 멤버 캐시 저장 (${groupId}):`, members.length, '명', `타임스탬프: ${timestamp}`);
    setCache(prev => ({
      ...prev,
      groupMembers: {
        ...prev.groupMembers,
        [groupId]: members,
      },
      lastUpdated: {
        ...prev.lastUpdated,
        groupMembers: {
          ...prev.lastUpdated.groupMembers,
          [groupId]: timestamp,
        },
      },
    }));
  }, []);

  // 스케줄 데이터
  const getScheduleData = useCallback((groupId: number, date?: string): any[] => {
    const isValid = isCacheValid('scheduleData', groupId);
    if (isValid && cache.scheduleData[groupId]) {
      if (date) {
        const schedules = cache.scheduleData[groupId]?.[date] || [];
        console.log(`[DATA CACHE] ✅ 스케줄 데이터 캐시 히트 (${groupId}/${date}):`, schedules.length, '개');
        return schedules;
      }
      // 날짜 지정이 없으면 전체 스케줄 반환
      const allSchedules = Object.values(cache.scheduleData[groupId] || {}).flat();
      console.log(`[DATA CACHE] ✅ 전체 스케줄 데이터 캐시 히트 (${groupId}):`, allSchedules.length, '개');
      return allSchedules;
    } else {
      console.log(`[DATA CACHE] ❌ 스케줄 데이터 캐시 미스 (${groupId}/${date || 'all'})`);
      return [];
    }
  }, [cache.scheduleData, isCacheValid]);
  
  const setScheduleData = useCallback((groupId: number, date: string, schedules: any[]) => {
    console.log(`[DATA CACHE] 💾 스케줄 데이터 캐시 저장 (${groupId}/${date}):`, schedules.length, '개');
    setCache(prev => ({
      ...prev,
      scheduleData: {
        ...prev.scheduleData,
        [groupId]: {
          ...prev.scheduleData[groupId],
          [date]: schedules,
        },
      },
      lastUpdated: {
        ...prev.lastUpdated,
        scheduleData: {
          ...prev.lastUpdated.scheduleData,
          [groupId]: Date.now(),
        },
      },
    }));
  }, []);

  // 위치 데이터
  const getLocationData = useCallback((groupId: number, date: string, memberId?: string) => {
    const isValid = isCacheValid('locationData', groupId, date);
    if (!isValid) {
      console.log(`[DATA CACHE] ❌ 위치 데이터 캐시 미스 - 만료됨 (${groupId}/${date}${memberId ? `/${memberId}` : ''})`);
      return null;
    }

    const locationData = cache.locationData[groupId]?.[date];
    if (!locationData) {
      console.log(`[DATA CACHE] ❌ 위치 데이터 캐시 미스 - 데이터 없음 (${groupId}/${date}${memberId ? `/${memberId}` : ''})`);
      return null;
    }

    if (memberId) {
      const memberData = locationData[memberId];
      if (memberData) {
        console.log(`[DATA CACHE] ✅ 위치 데이터 캐시 히트 (${groupId}/${date}/${memberId}):`, memberData);
        return memberData;
      } else {
        console.log(`[DATA CACHE] ❌ 위치 데이터 캐시 미스 - 멤버 데이터 없음 (${groupId}/${date}/${memberId})`);
        return null;
      }
    } else {
      // memberId가 없으면 전체 날짜 데이터 반환
      console.log(`[DATA CACHE] ✅ 위치 데이터 캐시 히트 - 전체 날짜 (${groupId}/${date}):`, locationData);
      return locationData;
    }
  }, [cache.locationData, isCacheValid]);
  
  const setLocationData = useCallback((groupId: number, date: string, memberId: string, data: any) => {
    console.log(`[DATA CACHE] 💾 위치 데이터 캐시 저장 (${groupId}/${date}/${memberId}):`, data);
    setCache(prev => ({
      ...prev,
      locationData: {
        ...prev.locationData,
        [groupId]: {
          ...prev.locationData[groupId],
          [date]: {
            ...prev.locationData[groupId]?.[date],
            [memberId]: {
              ...data,
              lastUpdated: Date.now(),
            },
          },
        },
      },
      lastUpdated: {
        ...prev.lastUpdated,
        locationData: {
          ...prev.lastUpdated.locationData,
          [groupId]: {
            ...prev.lastUpdated.locationData[groupId],
            [date]: {
              ...prev.lastUpdated.locationData[groupId]?.[date],
              [memberId]: Date.now(),
            },
          },
        },
      },
    }));
  }, []);

  // 그룹 장소
  const getGroupPlaces = useCallback((groupId: number): any[] => {
    const isValid = isCacheValid('groupPlaces', groupId);
    const places = cache.groupPlaces[groupId] || [];
    if (isValid && places.length > 0) {
      console.log(`[DATA CACHE] ✅ 그룹 장소 캐시 히트 (${groupId}):`, places.length, '개');
      return places;
    } else {
      console.log(`[DATA CACHE] ❌ 그룹 장소 캐시 미스 (${groupId})`);
      return [];
    }
  }, [cache.groupPlaces, isCacheValid]);
  
  const setGroupPlaces = useCallback((groupId: number, places: any[]) => {
    console.log(`[DATA CACHE] 💾 그룹 장소 캐시 저장 (${groupId}):`, places.length, '개');
    setCache(prev => ({
      ...prev,
      groupPlaces: {
        ...prev.groupPlaces,
        [groupId]: places,
      },
      lastUpdated: {
        ...prev.lastUpdated,
        groupPlaces: {
          ...prev.lastUpdated.groupPlaces,
          [groupId]: Date.now(),
        },
      },
    }));
  }, []);

  // 일별 위치 카운트 (백그라운드 새로고침 포함)
  const getDailyLocationCounts = useCallback((groupId: number) => {
    const isValid = isCacheValid('dailyLocationCounts', groupId);
    const isSoftExpired = !isCacheValid('dailyLocationCounts', groupId, undefined, true); // 소프트 만료 체크
    const counts = cache.dailyLocationCounts[groupId];
    
    if (isValid && counts) {
      console.log(`[DATA CACHE] ✅ 일별 위치 카운트 캐시 히트 (${groupId}):`, counts);
      
      // 소프트 만료된 경우 백그라운드에서 새로고침 힌트 제공
      if (isSoftExpired) {
        console.log(`[DATA CACHE] 💡 일별 위치 카운트 백그라운드 새로고침 권장 (${groupId})`);
        // 백그라운드 새로고침을 위한 이벤트 발생 (선택적)
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('cache-soft-expired', {
            detail: { type: 'dailyLocationCounts', groupId }
          }));
        }, 100);
      }
      
      return counts;
    } else {
      console.log(`[DATA CACHE] ❌ 일별 위치 카운트 캐시 미스 (${groupId})`);
      return null;
    }
  }, [cache.dailyLocationCounts, isCacheValid]);
  
  const setDailyLocationCounts = useCallback((groupId: number, counts: any) => {
    console.log(`[DATA CACHE] 💾 일별 위치 카운트 캐시 저장 (${groupId}):`, counts);
    setCache(prev => ({
      ...prev,
      dailyLocationCounts: {
        ...prev.dailyLocationCounts,
        [groupId]: counts,
      },
      lastUpdated: {
        ...prev.lastUpdated,
        dailyLocationCounts: {
          ...prev.lastUpdated.dailyLocationCounts,
          [groupId]: Date.now(),
        },
      },
    }));
  }, []);

  // 캐시 무효화
  const invalidateCache = useCallback((type: string, groupId?: number, date?: string) => {
    console.log(`[DATA CACHE] 🗑️ 캐시 무효화: ${type}${groupId ? `(${groupId})` : ''}${date ? `[${date}]` : ''}`);
    setCache(prev => {
      const newCache = { ...prev };
      
      switch (type) {
        case 'userProfile':
          newCache.userProfile = null;
          newCache.lastUpdated.userProfile = 0;
          break;
        case 'userGroups':
          newCache.userGroups = [];
          newCache.lastUpdated.userGroups = 0;
          break;
        case 'groupMembers':
          if (groupId) {
            delete newCache.groupMembers[groupId];
            delete newCache.lastUpdated.groupMembers[groupId];
          }
          break;
        case 'scheduleData':
          if (groupId) {
            delete newCache.scheduleData[groupId];
            delete newCache.lastUpdated.scheduleData[groupId];
          }
          break;
        case 'locationData':
          if (groupId && date) {
            if (newCache.locationData[groupId]) {
              delete newCache.locationData[groupId][date];
              if (newCache.lastUpdated.locationData[groupId]) {
                delete newCache.lastUpdated.locationData[groupId][date];
              }
            }
          } else if (groupId) {
            delete newCache.locationData[groupId];
            delete newCache.lastUpdated.locationData[groupId];
          }
          break;
        case 'groupPlaces':
          if (groupId) {
            delete newCache.groupPlaces[groupId];
            delete newCache.lastUpdated.groupPlaces[groupId];
          }
          break;
        case 'dailyLocationCounts':
          if (groupId) {
            delete newCache.dailyLocationCounts[groupId];
            delete newCache.lastUpdated.dailyLocationCounts[groupId];
          }
          break;
      }
      
      return newCache;
    });
  }, []);

  // 모든 캐시 삭제
  const clearAllCache = useCallback(() => {
    console.log('[DATA CACHE] 🧹 모든 캐시 삭제');
    setCache(initialCache);
  }, []);

  // 디버그: 타임스탬프 상태 확인
  const debugTimestamps = useCallback(() => {
    const now = Date.now();
    console.log('[DATA CACHE] 🔍 타임스탬프 디버그 정보:');
    console.log('현재 시간:', now, new Date(now).toISOString());
    console.log('userProfile:', cache.lastUpdated.userProfile, cache.lastUpdated.userProfile > 0 ? new Date(cache.lastUpdated.userProfile).toISOString() : 'N/A');
    console.log('userGroups:', cache.lastUpdated.userGroups, cache.lastUpdated.userGroups > 0 ? new Date(cache.lastUpdated.userGroups).toISOString() : 'N/A');
    console.log('groupMembers:', cache.lastUpdated.groupMembers);
    console.log('scheduleData:', cache.lastUpdated.scheduleData);
    console.log('dailyLocationCounts:', cache.lastUpdated.dailyLocationCounts);
  }, [cache.lastUpdated]);

  // 전역 디버그 함수 등록
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__SMAP_DEBUG_CACHE__ = {
        debugTimestamps,
        clearAllCache,
        cache: cache,
      };
    }
  }, [debugTimestamps, clearAllCache, cache]);

  const value: DataCacheContextType = {
    cache,
    getUserProfile,
    setUserProfile,
    getUserGroups,
    setUserGroups,
    getGroupMembers,
    setGroupMembers,
    getScheduleData,
    setScheduleData,
    getLocationData,
    setLocationData,
    getGroupPlaces,
    setGroupPlaces,
    getDailyLocationCounts,
    setDailyLocationCounts,
    isCacheValid,
    invalidateCache,
    clearAllCache,
    isLoading,
    setIsLoading,
  };

  return (
    <DataCacheContext.Provider value={value}>
      {children}
    </DataCacheContext.Provider>
  );
};

export const useDataCache = () => {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error('useDataCache must be used within DataCacheProvider');
  }
  return context;
};

export default DataCacheContext; 