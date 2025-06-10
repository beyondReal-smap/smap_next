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

const CACHE_DURATION = {
  userProfile: 30 * 60 * 1000, // 30분
  userGroups: 15 * 60 * 1000,  // 15분
  groupMembers: 10 * 60 * 1000, // 10분
  scheduleData: 5 * 60 * 1000,  // 5분
  locationData: 2 * 60 * 1000,  // 2분 (위치 데이터는 자주 변경)
  groupPlaces: 30 * 60 * 1000,  // 30분
  dailyLocationCounts: 5 * 60 * 1000, // 5분
};

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

  console.log('[DATA CACHE] 🚀 DataCacheProvider 초기화');

  // 캐시 상태 변화 추적
  React.useEffect(() => {
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
  }, [cache]);

  // 캐시 유효성 검사
  const isCacheValid = useCallback((type: string, groupId?: number, date?: string): boolean => {
    const now = Date.now();
    const duration = CACHE_DURATION[type as keyof typeof CACHE_DURATION] || 5 * 60 * 1000;
    
    let isValid = false;
    let lastUpdate = 0;
    
    switch (type) {
      case 'userProfile':
        lastUpdate = cache.lastUpdated.userProfile;
        isValid = now - lastUpdate < duration;
        break;
      case 'userGroups':
        lastUpdate = cache.lastUpdated.userGroups;
        isValid = now - lastUpdate < duration;
        break;
      case 'groupMembers':
        if (!groupId) return false;
        lastUpdate = cache.lastUpdated.groupMembers[groupId] || 0;
        isValid = now - lastUpdate < duration;
        break;
      case 'scheduleData':
        if (!groupId) return false;
        lastUpdate = cache.lastUpdated.scheduleData[groupId] || 0;
        isValid = now - lastUpdate < duration;
        break;
      case 'locationData':
        if (!groupId || !date) return false;
        // memberId가 없으면 해당 그룹/날짜의 모든 멤버 데이터가 유효한지 확인
        const memberUpdates = cache.lastUpdated.locationData[groupId]?.[date];
        if (!memberUpdates) return false;
        const allMemberUpdates = Object.values(memberUpdates);
        lastUpdate = allMemberUpdates.length > 0 ? Math.max(...allMemberUpdates) : 0;
        isValid = now - lastUpdate < duration;
        break;
      case 'groupPlaces':
        if (!groupId) return false;
        lastUpdate = cache.lastUpdated.groupPlaces[groupId] || 0;
        isValid = now - lastUpdate < duration;
        break;
      case 'dailyLocationCounts':
        if (!groupId) return false;
        lastUpdate = cache.lastUpdated.dailyLocationCounts[groupId] || 0;
        isValid = now - lastUpdate < duration;
        break;
      default:
        return false;
    }
    
    console.log(`[DATA CACHE] 캐시 유효성 검사: ${type}${groupId ? `(${groupId})` : ''}${date ? `[${date}]` : ''} - ${isValid ? '유효' : '만료'} (${Math.round((now - lastUpdate) / 1000)}초 경과)`);
    return isValid;
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
    console.log(`[DATA CACHE] 💾 그룹 멤버 캐시 저장 (${groupId}):`, members.length, '명');
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
          [groupId]: Date.now(),
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

  // 일별 위치 카운트
  const getDailyLocationCounts = useCallback((groupId: number) => {
    const isValid = isCacheValid('dailyLocationCounts', groupId);
    const counts = cache.dailyLocationCounts[groupId];
    if (isValid && counts) {
      console.log(`[DATA CACHE] ✅ 일별 위치 카운트 캐시 히트 (${groupId}):`, counts);
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