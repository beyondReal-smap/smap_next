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
      mapMarkers: any[];
      stayTimes: any[];
      summary: any;
      members: GroupMember[];
      lastUpdated: number;
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
    locationData: { [groupId: string]: { [date: string]: number } };
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
  getLocationData: (groupId: number, date: string) => any | null;
  setLocationData: (groupId: number, date: string, data: any) => void;
  
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

  // 캐시 유효성 검사
  const isCacheValid = useCallback((type: string, groupId?: number, date?: string): boolean => {
    const now = Date.now();
    const duration = CACHE_DURATION[type as keyof typeof CACHE_DURATION] || 5 * 60 * 1000;
    
    switch (type) {
      case 'userProfile':
        return now - cache.lastUpdated.userProfile < duration;
      case 'userGroups':
        return now - cache.lastUpdated.userGroups < duration;
      case 'groupMembers':
        if (!groupId) return false;
        return now - (cache.lastUpdated.groupMembers[groupId] || 0) < duration;
      case 'scheduleData':
        if (!groupId) return false;
        return now - (cache.lastUpdated.scheduleData[groupId] || 0) < duration;
      case 'locationData':
        if (!groupId || !date) return false;
        return now - (cache.lastUpdated.locationData[groupId]?.[date] || 0) < duration;
      case 'groupPlaces':
        if (!groupId) return false;
        return now - (cache.lastUpdated.groupPlaces[groupId] || 0) < duration;
      case 'dailyLocationCounts':
        if (!groupId) return false;
        return now - (cache.lastUpdated.dailyLocationCounts[groupId] || 0) < duration;
      default:
        return false;
    }
  }, [cache.lastUpdated]);

  // 사용자 프로필
  const getUserProfile = useCallback(() => cache.userProfile, [cache.userProfile]);
  
  const setUserProfile = useCallback((profile: UserProfile) => {
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
  const getUserGroups = useCallback(() => cache.userGroups, [cache.userGroups]);
  
  const setUserGroups = useCallback((groups: GroupInfo[]) => {
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
    return cache.groupMembers[groupId] || [];
  }, [cache.groupMembers]);
  
  const setGroupMembers = useCallback((groupId: number, members: GroupMember[]) => {
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
    if (date) {
      return cache.scheduleData[groupId]?.[date] || [];
    }
    // 날짜 지정이 없으면 전체 스케줄 반환
    return Object.values(cache.scheduleData[groupId] || {}).flat();
  }, [cache.scheduleData]);
  
  const setScheduleData = useCallback((groupId: number, date: string, schedules: any[]) => {
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
  const getLocationData = useCallback((groupId: number, date: string) => {
    return cache.locationData[groupId]?.[date] || null;
  }, [cache.locationData]);
  
  const setLocationData = useCallback((groupId: number, date: string, data: any) => {
    setCache(prev => ({
      ...prev,
      locationData: {
        ...prev.locationData,
        [groupId]: {
          ...prev.locationData[groupId],
          [date]: {
            ...data,
            lastUpdated: Date.now(),
          },
        },
      },
      lastUpdated: {
        ...prev.lastUpdated,
        locationData: {
          ...prev.lastUpdated.locationData,
          [groupId]: {
            ...prev.lastUpdated.locationData[groupId],
            [date]: Date.now(),
          },
        },
      },
    }));
  }, []);

  // 그룹 장소
  const getGroupPlaces = useCallback((groupId: number): any[] => {
    return cache.groupPlaces[groupId] || [];
  }, [cache.groupPlaces]);
  
  const setGroupPlaces = useCallback((groupId: number, places: any[]) => {
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
    return cache.dailyLocationCounts[groupId] || null;
  }, [cache.dailyLocationCounts]);
  
  const setDailyLocationCounts = useCallback((groupId: number, counts: any) => {
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