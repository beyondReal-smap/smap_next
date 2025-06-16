import { useState, useCallback, useRef, useEffect } from 'react';
import { useDataCache } from '@/contexts/DataCacheContext';
import memberLocationLogService from '@/services/memberLocationLogService';

interface LocationDataState {
  isLoading: boolean;
  error: string | null;
  data: any | null;
  lastFetched: Date | null;
}

interface UseLocationDataLoaderOptions {
  groupId: number;
  date: string;
  memberId: string;
  autoRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export const useLocationDataLoader = (options: UseLocationDataLoaderOptions) => {
  const { groupId, date, memberId, autoRetry = true, maxRetries = 3, retryDelay = 1000 } = options;
  const { getLocationData, setLocationData, isCacheValid } = useDataCache();
  
  const [state, setState] = useState<LocationDataState>({
    isLoading: false,
    error: null,
    data: null,
    lastFetched: null,
  });
  
  const retryCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 캐시에서 데이터 시도
  const tryCache = useCallback(() => {
    if (!isCacheValid('locationData', groupId, date)) {
      return null;
    }
    
    const cachedData = getLocationData(groupId, date, memberId);
    if (cachedData) {
      console.log(`[LocationLoader] 캐시에서 데이터 로드 성공 (${groupId}/${date}/${memberId})`);
      setState(prev => ({
        ...prev,
        data: cachedData,
        error: null,
      }));
      return cachedData;
    }
    
    return null;
  }, [getLocationData, isCacheValid, groupId, date, memberId]);

  // API에서 데이터 로드
  const loadFromAPI = useCallback(async (signal?: AbortSignal) => {
    try {
      console.log(`[LocationLoader] API에서 데이터 로드 시작 (${groupId}/${date}/${memberId})`);
      
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // 여러 API를 병렬로 호출하여 데이터 조합
      const memberIdNum = parseInt(memberId);
      
      const [mapMarkers, stayTimes, dailySummary, locationLogSummary] = await Promise.all([
        memberLocationLogService.getMapMarkers(memberIdNum, date),
        memberLocationLogService.getStayTimes(memberIdNum, date),
        memberLocationLogService.getDailySummaryByRange(memberIdNum, date, date),
        memberLocationLogService.getLocationLogSummary(memberIdNum, date)
      ]);
      
      const response = {
        mapMarkers,
        stayTimes,
        dailySummary,
        locationLogSummary
      };
      
      if (signal?.aborted) {
        console.log(`[LocationLoader] API 호출 취소됨 (${groupId}/${date}/${memberId})`);
        return null;
      }
      
      // 데이터 검증
      if (!response || typeof response !== 'object') {
        throw new Error('유효하지 않은 응답 데이터');
      }
      
      const validatedData = {
        mapMarkers: Array.isArray(response.mapMarkers) ? response.mapMarkers : [],
        stayTimes: Array.isArray(response.stayTimes) ? response.stayTimes : [],
        dailySummary: Array.isArray(response.dailySummary) ? response.dailySummary : [],
        locationLogSummary: response.locationLogSummary || null,
        members: [], // 빈 배열로 초기화 (필요 시 별도 API로 조회)
      };
      
      // 캐시에 저장
      setLocationData(groupId, date, memberId, validatedData);
      
      setState(prev => ({
        ...prev,
        data: validatedData,
        error: null,
        isLoading: false,
        lastFetched: new Date(),
      }));
      
      retryCountRef.current = 0; // 성공 시 재시도 카운트 리셋
      console.log(`[LocationLoader] API에서 데이터 로드 성공 (${groupId}/${date}/${memberId})`);
      
      return validatedData;
      
    } catch (error: any) {
      if (signal?.aborted) {
        return null; // 취소된 경우 에러로 처리하지 않음
      }
      
      console.error(`[LocationLoader] API 데이터 로드 실패:`, error);
      
      const errorMessage = error.message || '위치 데이터를 불러오는데 실패했습니다.';
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      
      // 자동 재시도
      if (autoRetry && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`[LocationLoader] ${retryDelay}ms 후 재시도 (${retryCountRef.current}/${maxRetries})`);
        
        setTimeout(() => {
          if (!signal?.aborted) {
            loadFromAPI(signal);
          }
        }, retryDelay * retryCountRef.current); // 지수적 백오프
      }
      
      return null;
    }
  }, [groupId, date, memberId, setLocationData, autoRetry, maxRetries, retryDelay]);

  // 메인 로드 함수
  const loadData = useCallback(async (forceRefresh = false) => {
    // 이미 로딩 중이면 스킵
    if (state.isLoading) {
      console.log(`[LocationLoader] 이미 로딩 중이므로 스킵 (${groupId}/${date}/${memberId})`);
      return state.data;
    }
    
    // 진행 중인 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 새로운 AbortController 생성
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    try {
      // forceRefresh가 아닌 경우 캐시 먼저 시도
      if (!forceRefresh) {
        const cachedData = tryCache();
        if (cachedData) {
          return cachedData;
        }
      }
      
      // API에서 로드
      return await loadFromAPI(signal);
      
    } catch (error) {
      console.error(`[LocationLoader] 데이터 로드 실패:`, error);
      return null;
    } finally {
      // AbortController 정리
      if (abortControllerRef.current === abortControllerRef.current) {
        abortControllerRef.current = null;
      }
    }
  }, [state.isLoading, state.data, groupId, date, memberId, tryCache, loadFromAPI]);

  // 수동 재시도
  const retry = useCallback(() => {
    retryCountRef.current = 0;
    setState(prev => ({ ...prev, error: null }));
    return loadData(true); // 강제 새로고침
  }, [loadData]);

  // 데이터 클리어
  const clearData = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      isLoading: false,
      error: null,
      data: null,
      lastFetched: null,
    });
    retryCountRef.current = 0;
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 캐시 변경 감지하여 자동 업데이트
  useEffect(() => {
    const cachedData = tryCache();
    if (cachedData && !state.data) {
      // 캐시에 데이터가 있고 현재 상태에 데이터가 없으면 업데이트
      setState(prev => ({
        ...prev,
        data: cachedData,
        error: null,
      }));
    }
  }, [tryCache, state.data]);

  return {
    // 상태
    isLoading: state.isLoading,
    error: state.error,
    data: state.data,
    lastFetched: state.lastFetched,
    retryCount: retryCountRef.current,
    
    // 액션
    loadData,
    retry,
    clearData,
    
    // 유틸리티
    isFromCache: state.data && !state.lastFetched, // 캐시에서 온 데이터인지
    canRetry: state.error && retryCountRef.current < maxRetries,
  };
}; 