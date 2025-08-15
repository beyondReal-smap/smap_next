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
  getUserGroups: (ignoreCache?: boolean) => GroupInfo[];
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
  
  // 🆕 멀티 데이터 로딩 (새로운 기능)
  getMultiDateLocationData: (groupId: number, dates: string[], memberId?: string) => { results: { [date: string]: any }, missingDates: string[] };
  getMultiMemberLocationData: (groupId: number, date: string, memberIds: string[]) => { results: { [memberId: string]: any }, missingMembers: string[] };
  analyzeCacheStatus: (groupId: number, date?: string) => any;
  
  // 🆕 localStorage 동기화 (새로운 기능)
  saveToLocalStorage: (key: string, data: any) => void;
  loadFromLocalStorage: (key: string) => any;
  saveComprehensiveData: (data: {
    userProfile?: any;
    userGroups?: any[];
    groupMembers?: { [groupId: string]: any[] };
    locationData?: { [groupId: string]: { [date: string]: { [memberId: string]: any } } };
    dailyLocationCounts?: { [groupId: string]: any };
  }) => void;
  
  // 캐시 관리
  isCacheValid: (type: string, groupId?: number, date?: string) => boolean;
  invalidateCache: (type: string, groupId?: number, date?: string) => void;
  clearAllCache: () => void;
  
  // 로딩 상태
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // 🆕 디버깅 및 상태 확인 함수들 추가
  debugCacheStatus: () => void;
  getCacheSummary: () => any;
  exportCacheData: () => any;
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

  // 🆕 localStorage 동기화 기능을 먼저 정의 (다른 함수들에서 사용하므로)
  const saveToLocalStorage = useCallback((key: string, data: any) => {
    try {
      const timestamp = Date.now();
      const storageData = {
        data,
        timestamp,
        expiresAt: timestamp + (CACHE_DURATION[key as keyof typeof CACHE_DURATION] || 10 * 60 * 1000)
      };
      localStorage.setItem(`smap_cache_${key}`, JSON.stringify(storageData));
      // 로깅 제거 - 과도한 로그 방지
    } catch (error) {
      console.warn(`[DATA CACHE] ⚠️ localStorage 저장 실패: ${key}`, error);
    }
  }, []);

  const loadFromLocalStorage = useCallback((key: string) => {
    try {
      const stored = localStorage.getItem(`smap_cache_${key}`);
      if (!stored) return null;
      
      const { data, expiresAt } = JSON.parse(stored);
      if (Date.now() > expiresAt) {
        localStorage.removeItem(`smap_cache_${key}`);
        return null;
      }
      
      // 로깅 제거 - 과도한 로그 방지
      return data;
    } catch (error) {
      console.warn(`[DATA CACHE] ⚠️ localStorage 로드 실패: ${key}`, error);
      return null;
    }
  }, []);

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
        cleanedLastUpdated.userProfile = 0; // 무효화
        needsCleanup = true;
      }
      
      // userGroups 타임스탬프 검사
      if (cleanedLastUpdated.userGroups > 0 && cleanedLastUpdated.userGroups < 9999999999) {
        cleanedLastUpdated.userGroups = 0; // 무효화
        needsCleanup = true;
      }
      
      // groupMembers 타임스탬프 검사
      Object.keys(cleanedLastUpdated.groupMembers).forEach(groupId => {
        const timestamp = cleanedLastUpdated.groupMembers[groupId];
        if (timestamp > 0 && timestamp < 9999999999) {
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

  // 캐시 상태 변화 추적 (디바운스 적용, 로깅 최소화)
  React.useEffect(() => {
    if (!isInitialized) return;
    
    const timeoutId = setTimeout(() => {
      // 로깅 제거 - 과도한 로그 방지
      // console.log('[DATA CACHE] 📊 캐시 상태 업데이트:', cacheStats);
    }, 1000); // 1초로 증가
    
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
    
    // 타임스탬프 형식 오류 감지 및 수정 (초 단위로 저장된 경우)
    let correctedLastUpdate = lastUpdate;
    let timestampCorrected = false;
    
    if (lastUpdate > 0 && lastUpdate < 9999999999) {
      correctedLastUpdate = lastUpdate * 1000;
      timestampCorrected = true;
      // 로깅 제거 - 과도한 로그 방지
    }
    
    // 수정된 타임스탬프로 유효성 재계산
    const correctedElapsedMs = now - correctedLastUpdate;
    const correctedIsValid = correctedElapsedMs < actualDuration;
    
    // 로깅 제거 - 과도한 로그 방지
    
    // 타임스탬프가 수정되었고 캐시가 만료된 경우 캐시 무효화
    if (timestampCorrected && !correctedIsValid) {
      // 로깅 제거 - 과도한 로그 방지
      // 해당 캐시 항목의 타임스탬프를 0으로 리셋하여 다음에 새로 로드하도록 함
      setTimeout(() => {
        invalidateCache(type, groupId, date);
      }, 0);
    }
    
    return correctedIsValid;
  }, [cache.lastUpdated]);

  // 위치 데이터 - set 함수를 먼저 정의
  const setLocationData = useCallback((groupId: number, date: string, memberId: string, data: any) => {
    // 로깅 제거 - 과도한 로그 방지
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

  const getLocationData = useCallback((groupId: number, date: string, memberId?: string) => {
    const isValid = isCacheValid('locationData', groupId, date);
    if (!isValid) {
      // 로깅 제거 - 과도한 로그 방지
      return null;
    }

    const locationData = cache.locationData[groupId]?.[date];
    if (!locationData) {
      // 로깅 제거 - 과도한 로그 방지
      return null;
    }

    if (memberId) {
      const memberData = locationData[memberId];
      if (memberData) {
        // 로깅 제거 - 과도한 로그 방지
        return memberData;
      } else {
        // 로깅 제거 - 과도한 로그 방지
        return null;
      }
    } else {
      // memberId가 없으면 전체 날짜 데이터 반환
      // 로깅 제거 - 과도한 로그 방지
      return locationData;
    }
  }, [cache.locationData, isCacheValid]);
  
  // 그룹 장소
  const getGroupPlaces = useCallback((groupId: number): any[] => {
    const isValid = isCacheValid('groupPlaces', groupId);
    const places = cache.groupPlaces[groupId] || [];
    if (isValid && places.length > 0) {
      // 로깅 제거 - 과도한 로그 방지
      return places;
    } else {
      // 로깅 제거 - 과도한 로그 방지
      return [];
    }
  }, [cache.groupPlaces, isCacheValid]);
  
  const setGroupPlaces = useCallback((groupId: number, places: any[]) => {
    // 로깅 제거 - 과도한 로그 방지
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

  // 일별 위치 카운트 - set 함수를 먼저 정의
  const setDailyLocationCounts = useCallback((groupId: number, counts: any) => {
    // 로깅 제거 - 과도한 로그 방지
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

  const getDailyLocationCounts = useCallback((groupId: number) => {
    const isValid = isCacheValid('dailyLocationCounts', groupId);
    const counts = cache.dailyLocationCounts[groupId];
    if (isValid && counts) {
      // 로깅 제거 - 과도한 로그 방지
      return counts;
    } else {
      // 로깅 제거 - 과도한 로그 방지
      return null;
    }
  }, [cache.dailyLocationCounts, isCacheValid]);

  // 🆕 멀티 날짜 위치 데이터 로딩 (새로운 기능)
  const getMultiDateLocationData = useCallback((groupId: number, dates: string[], memberId?: string) => {
    const results: { [date: string]: any } = {};
    const missingDates: string[] = [];
    
    dates.forEach(date => {
      const data = getLocationData(groupId, date, memberId);
      if (data) {
        results[date] = data;
      } else {
        missingDates.push(date);
      }
    });
    
    // 로깅 제거 - 과도한 로그 방지
    
    return { results, missingDates };
  }, [getLocationData]);

  // 🆕 멀티 멤버 위치 데이터 로딩 (새로운 기능)
  const getMultiMemberLocationData = useCallback((groupId: number, date: string, memberIds: string[]) => {
    const results: { [memberId: string]: any } = {};
    const missingMembers: string[] = [];
    
    memberIds.forEach(memberId => {
      const data = getLocationData(groupId, date, memberId);
      if (data) {
        results[memberId] = data;
      } else {
        missingMembers.push(memberId);
      }
    });
    
    // 로깅 제거 - 과도한 로그 방지
    
    return { results, missingMembers };
  }, [getLocationData]);

  // 🆕 캐시 상태 분석 (새로운 기능)
  const analyzeCacheStatus = useCallback((groupId: number, date?: string) => {
    const analysis = {
      groupMembers: {
        cached: cache.groupMembers[groupId]?.length || 0,
        valid: isCacheValid('groupMembers', groupId)
      },
      dailyLocationCounts: {
        cached: !!cache.dailyLocationCounts[groupId],
        valid: isCacheValid('dailyLocationCounts', groupId)
      },
      locationData: date ? {
        cached: !!cache.locationData[groupId]?.[date],
        valid: isCacheValid('locationData', groupId, date),
        memberCount: Object.keys(cache.locationData[groupId]?.[date] || {}).length
      } : null
    };
    
    // 로깅 제거 - 과도한 로그 방지
    return analysis;
  }, [cache, isCacheValid]);

  // 캐시 무효화
  const invalidateCache = useCallback((type: string, groupId?: number, date?: string) => {
    // 로깅 제거 - 과도한 로그 방지
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

  // 사용자 프로필 - set 함수를 먼저 정의
  const setUserProfile = useCallback((profile: UserProfile) => {
    // 로깅 제거 - 과도한 로그 방지
    setCache(prev => ({
      ...prev,
      userProfile: profile,
      lastUpdated: {
        ...prev.lastUpdated,
        userProfile: Date.now(),
      },
    }));
    // localStorage에도 저장
    saveToLocalStorage('userProfile', profile);
  }, [saveToLocalStorage]);

  const getUserProfile = useCallback(() => {
    const isValid = isCacheValid('userProfile');
    if (isValid && cache.userProfile) {
      // 로깅 제거 - 과도한 로그 방지
      return cache.userProfile;
    } else {
      // 캐시 미스 시 localStorage에서 로드 시도
      const localData = loadFromLocalStorage('userProfile');
      if (localData) {
        // 로깅 제거 - 과도한 로그 방지
        setUserProfile(localData);
        return localData;
      }
      // 로깅 제거 - 과도한 로그 방지
      return null;
    }
  }, [cache.userProfile, isCacheValid, loadFromLocalStorage, setUserProfile]);
  
  // 사용자 그룹 - set 함수를 먼저 정의
  const setUserGroups = useCallback((groups: GroupInfo[]) => {
    // 활성 그룹만 필터링하여 저장 (sgt_show='Y'인 그룹만)
    const activeGroups = Array.isArray(groups) 
      ? groups.filter((group: any) => !group.sgt_show || group.sgt_show === 'Y')
      : [];
      
    console.log('[DATA CACHE] setUserGroups - 활성 그룹 저장:', groups?.length || 0, '→', activeGroups.length);
    
    setCache(prev => ({
      ...prev,
      userGroups: activeGroups,
      lastUpdated: {
        ...prev.lastUpdated,
        userGroups: Date.now(),
      },
    }));
    // localStorage에도 필터링된 데이터 저장
    saveToLocalStorage('userGroups', activeGroups);
  }, [saveToLocalStorage]);

  const getUserGroups = useCallback((ignoreCache: boolean = false) => {
    // 실시간 데이터 요청인 경우 캐시 무시
    if (ignoreCache) {
      console.log('[DATA CACHE] 실시간 그룹 데이터 요청 - 캐시 무시');
      return [];
    }
    
    const isValid = isCacheValid('userGroups');
    if (isValid && cache.userGroups.length > 0) {
      // sgt_show='Y'인 그룹만 반환 (삭제된 그룹 필터링)
      const activeGroups = cache.userGroups.filter((group: any) => 
        !group.sgt_show || group.sgt_show === 'Y'
      );
      console.log('[DATA CACHE] 활성 그룹 필터링:', cache.userGroups.length, '→', activeGroups.length);
      return activeGroups;
    } else {
      // 캐시 미스 시 localStorage에서 로드 시도
      const localData = loadFromLocalStorage('userGroups');
      if (localData && localData.length > 0) {
        // localStorage 데이터도 필터링
        const activeGroups = localData.filter((group: any) => 
          !group.sgt_show || group.sgt_show === 'Y'
        );
        console.log('[DATA CACHE] localStorage 활성 그룹 필터링:', localData.length, '→', activeGroups.length);
        setUserGroups(activeGroups);
        return activeGroups;
      }
      return [];
    }
  }, [cache.userGroups, isCacheValid, loadFromLocalStorage, setUserGroups]);
  
  // 그룹 멤버 - set 함수를 먼저 정의
  const setGroupMembers = useCallback((groupId: number, members: GroupMember[]) => {
    const timestamp = Date.now();
    // 로깅 제거 - 과도한 로그 방지
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
    // localStorage에도 저장
    saveToLocalStorage(`groupMembers_${groupId}`, members);
  }, [saveToLocalStorage]);

  const getGroupMembers = useCallback((groupId: number): GroupMember[] => {
    const isValid = isCacheValid('groupMembers', groupId);
    const members = cache.groupMembers[groupId] || [];
    if (isValid && members.length > 0) {
      // 로깅 제거 - 과도한 로그 방지
      return members;
    } else {
      // 캐시 미스 시 localStorage에서 로드 시도
      const localData = loadFromLocalStorage(`groupMembers_${groupId}`);
      if (localData && localData.length > 0) {
        // 로깅 제거 - 과도한 로그 방지
        setGroupMembers(groupId, localData);
        return localData;
      }
      // 로깅 제거 - 과도한 로그 방지
      return [];
    }
  }, [cache.groupMembers, isCacheValid, loadFromLocalStorage, setGroupMembers]);

  // 스케줄 데이터
  const getScheduleData = useCallback((groupId: number, date?: string): any[] => {
    const isValid = isCacheValid('scheduleData', groupId);
    if (isValid && cache.scheduleData[groupId]) {
      if (date) {
        const schedules = cache.scheduleData[groupId]?.[date] || [];
        // 로깅 제거 - 과도한 로그 방지
        return schedules;
      }
      // 날짜 지정이 없으면 전체 스케줄 반환
      const allSchedules = Object.values(cache.scheduleData[groupId] || {}).flat();
      // 로깅 제거 - 과도한 로그 방지
      return allSchedules;
    } else {
      // 로깅 제거 - 과도한 로그 방지
      return [];
    }
  }, [cache.scheduleData, isCacheValid]);
  
  const setScheduleData = useCallback((groupId: number, date: string, schedules: any[]) => {
    // 로깅 제거 - 과도한 로그 방지
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
    saveToLocalStorage(`scheduleData_${groupId}_${date}`, schedules);
  }, [saveToLocalStorage]);

  // 🆕 일괄 데이터 저장 (로그인 성공 시 사용) - 다른 함수들 다음에 정의
  const saveComprehensiveData = useCallback((data: {
    userProfile?: any;
    userGroups?: any[];
    groupMembers?: { [groupId: string]: any[] };
    locationData?: { [groupId: string]: { [date: string]: { [memberId: string]: any } } };
    dailyLocationCounts?: { [groupId: string]: any };
  }) => {
    // 로깅 제거 - 과도한 로그 방지
    
    if (data.userProfile) {
      setUserProfile(data.userProfile);
      saveToLocalStorage('userProfile', data.userProfile);
    }
    
    if (data.userGroups) {
      setUserGroups(data.userGroups);
      saveToLocalStorage('userGroups', data.userGroups);
    }
    
    if (data.groupMembers) {
      Object.entries(data.groupMembers).forEach(([groupId, members]) => {
        setGroupMembers(parseInt(groupId), members);
        saveToLocalStorage(`groupMembers_${groupId}`, members);
      });
    }
    
    if (data.locationData) {
      Object.entries(data.locationData).forEach(([groupId, dateData]) => {
        Object.entries(dateData).forEach(([date, memberData]) => {
          Object.entries(memberData).forEach(([memberId, locationData]) => {
            setLocationData(parseInt(groupId), date, memberId, locationData);
            saveToLocalStorage(`locationData_${groupId}_${date}_${memberId}`, locationData);
          });
        });
      });
    }
    
    if (data.dailyLocationCounts) {
      Object.entries(data.dailyLocationCounts).forEach(([groupId, counts]) => {
        setDailyLocationCounts(parseInt(groupId), counts);
        saveToLocalStorage(`dailyLocationCounts_${groupId}`, counts);
      });
    }
    
    // 로깅 제거 - 과도한 로그 방지
  }, [setUserProfile, setUserGroups, setGroupMembers, setLocationData, setDailyLocationCounts, saveToLocalStorage]);

  // 🆕 디버깅 및 상태 확인 함수들 추가
  const debugCacheStatus = useCallback(() => {
    // 로깅 제거 - 과도한 로그 방지
    console.log('🔍 [DATA CACHE DEBUG] === 캐시 상태 전체 확인 ===');
    
    // 메모리 캐시 상태
    // 로깅 제거 - 과도한 로그 방지
    console.log('📊 메모리 캐시 상태:');
    console.log('  - userProfile:', cache.userProfile ? '존재' : '없음', cache.userProfile);
    console.log('  - userGroups:', cache.userGroups.length, '개', cache.userGroups);
    console.log('  - groupMembers:', Object.keys(cache.groupMembers).length, '개 그룹', Object.keys(cache.groupMembers));
    console.log('  - scheduleData:', Object.keys(cache.scheduleData).length, '개 그룹');
    console.log('  - locationData:', Object.keys(cache.locationData).length, '개 그룹');
    console.log('  - groupPlaces:', Object.keys(cache.groupPlaces).length, '개 그룹');
    console.log('  - dailyLocationCounts:', Object.keys(cache.dailyLocationCounts).length, '개 그룹');
    
    // 타임스탬프 상태
    // 로깅 제거 - 과도한 로그 방지
    console.log('⏰ 타임스탬프 상태:');
    console.log('  - userProfile:', cache.lastUpdated.userProfile);
    console.log('  - userGroups:', cache.lastUpdated.userGroups);
    console.log('  - groupMembers:', cache.lastUpdated.groupMembers);
    console.log('  - scheduleData:', cache.lastUpdated.scheduleData);
    console.log('  - locationData:', cache.lastUpdated.locationData);
    console.log('  - groupPlaces:', cache.lastUpdated.groupPlaces);
    console.log('  - dailyLocationCounts:', cache.lastUpdated.dailyLocationCounts);
    
    // localStorage 상태
    // 로깅 제거 - 과도한 로그 방지
    console.log('💾 localStorage 상태:');
    try {
      const localStorageKeys = Object.keys(localStorage).filter(key => key.startsWith('smap_cache_'));
      console.log('  - 총 캐시 키:', localStorageKeys.length, '개');
      localStorageKeys.forEach(key => {
        const data = loadFromLocalStorage(key.replace('smap_cache_', ''));
        console.log(`    - ${key}:`, data ? '존재' : '없음', data);
      });
    } catch (error) {
      console.warn('  - localStorage 접근 실패:', error);
    }
    
    // 캐시 유효성 검사
    // 로깅 제거 - 과도한 로그 방지
    console.log('✅ 캐시 유효성 검사:');
    console.log('  - userProfile:', isCacheValid('userProfile'));
    console.log('  - userGroups:', isCacheValid('userGroups'));
    
    if (cache.userGroups.length > 0) {
      cache.userGroups.forEach(group => {
        console.log(`  - groupMembers(${group.sgt_idx}):`, isCacheValid('groupMembers', group.sgt_idx));
        console.log(`  - dailyLocationCounts(${group.sgt_idx}):`, isCacheValid('dailyLocationCounts', group.sgt_idx));
      });
    }
    
    // 로깅 제거 - 과도한 로그 방지
    console.log('🔍 [DATA CACHE DEBUG] === 확인 완료 ===');
  }, [cache, isCacheValid, loadFromLocalStorage]);

  const getCacheSummary = useCallback(() => {
    const summary = {
      memory: {
        userProfile: !!cache.userProfile,
        userGroups: cache.userGroups.length,
        groupMembers: Object.keys(cache.groupMembers).length,
        scheduleData: Object.keys(cache.scheduleData).length,
        locationData: Object.keys(cache.locationData).length,
        groupPlaces: Object.keys(cache.groupPlaces).length,
        dailyLocationCounts: Object.keys(cache.dailyLocationCounts).length,
      },
      localStorage: {
        totalKeys: 0,
        keys: [] as string[],
      },
      validity: {
        userProfile: isCacheValid('userProfile'),
        userGroups: isCacheValid('userGroups'),
        groupMembers: {} as { [groupId: string]: boolean },
        dailyLocationCounts: {} as { [groupId: string]: boolean },
      }
    };
    
    // localStorage 키 수집
    try {
      const localStorageKeys = Object.keys(localStorage).filter(key => key.startsWith('smap_cache_'));
      summary.localStorage.totalKeys = localStorageKeys.length;
      summary.localStorage.keys = localStorageKeys;
    } catch (error) {
      console.warn('localStorage 접근 실패:', error);
    }
    
    // 그룹별 유효성 검사
    cache.userGroups.forEach(group => {
      summary.validity.groupMembers[group.sgt_idx] = isCacheValid('groupMembers', group.sgt_idx);
      summary.validity.dailyLocationCounts[group.sgt_idx] = isCacheValid('dailyLocationCounts', group.sgt_idx);
    });
    
    return summary;
  }, [cache, isCacheValid]);

  const exportCacheData = useCallback(() => {
    const exportData = {
      timestamp: new Date().toISOString(),
      cache: cache,
      localStorage: {} as { [key: string]: any }
    };
    
    // localStorage 데이터 수집
    try {
      const localStorageKeys = Object.keys(localStorage).filter(key => key.startsWith('smap_cache_'));
      localStorageKeys.forEach(key => {
        const data = loadFromLocalStorage(key.replace('smap_cache_', ''));
        if (data) {
          exportData.localStorage[key] = data;
        }
      });
    } catch (error) {
      console.warn('localStorage 수집 실패:', error);
    }
    
    // 로깅 제거 - 과도한 로그 방지
    console.log('📤 [DATA CACHE EXPORT] 캐시 데이터 내보내기:', exportData);
    return exportData;
  }, [cache, loadFromLocalStorage]);

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
    getMultiDateLocationData,
    getMultiMemberLocationData,
    analyzeCacheStatus,
    isCacheValid,
    invalidateCache,
    clearAllCache,
    isLoading,
    setIsLoading,
    saveToLocalStorage,
    loadFromLocalStorage,
    saveComprehensiveData,
    debugCacheStatus,
    getCacheSummary,
    exportCacheData,
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