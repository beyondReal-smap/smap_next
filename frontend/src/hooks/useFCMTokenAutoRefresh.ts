import { useState, useEffect, useCallback, useRef } from 'react';
import { fcmTokenService } from '../services/fcmTokenService';
import { fcmTokenAutoRefreshService } from '../services/fcmTokenAutoRefreshService';

interface UseFCMTokenAutoRefreshOptions {
  userId?: number | null;
  enabled?: boolean;
  autoRefreshInterval?: number; // 밀리초 단위, 기본값: 30분
  onSuccess?: (result: any) => void;
  onError?: (error: any) => void;
  onTokenUpdate?: (token: string) => void;
}

interface FCMTokenAutoRefreshState {
  isInitialized: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  token: string | null;
  lastUpdateTime: number | null;
  autoRefreshStatus: {
    isActive: boolean;
    interval: number;
    retryCount: number;
  };
}

export const useFCMTokenAutoRefresh = (options: UseFCMTokenAutoRefreshOptions = {}) => {
  const {
    userId,
    enabled = true,
    autoRefreshInterval = 30 * 60 * 1000, // 30분
    onSuccess,
    onError,
    onTokenUpdate
  } = options;

  const [state, setState] = useState<FCMTokenAutoRefreshState>({
    isInitialized: false,
    isLoading: false,
    isRefreshing: false,
    error: null,
    token: null,
    lastUpdateTime: null,
    autoRefreshStatus: {
      isActive: false,
      interval: autoRefreshInterval,
      retryCount: 0
    }
  });

  const isInitializedRef = useRef(false);
  const userIdRef = useRef<number | null>(null);

  // 환경 감지
  const detectEnvironment = useCallback(() => {
    if (typeof window === 'undefined') return 'server';
    
    const userAgent = navigator.userAgent;
    const isAndroid = /Android/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/i.test(userAgent);
    const isWebView = /WebView|wv/i.test(userAgent);
    
    if (isAndroid) {
      return isWebView ? 'android_webview' : 'android';
    } else if (isIOS) {
      return isWebView ? 'ios_webview' : 'ios';
    } else {
      return 'web';
    }
  }, []);

  // FCM 토큰 초기화 및 업데이트
  const initializeAndUpdateToken = useCallback(async (forceUpdate: boolean = false) => {
    if (!userId || !enabled) {
      console.log('[FCM Hook] ⏸️ 토큰 업데이트 스킵: 사용자 ID 없음 또는 비활성화');
      return { success: false, error: '사용자 ID 없음 또는 비활성화' };
    }

    try {
      setState(prev => ({ ...prev, isRefreshing: true, error: null }));
      
      console.log(`[FCM Hook] 🔄 FCM 토큰 초기화 및 업데이트 시작 (사용자 ID: ${userId})`);
      console.log(`[FCM Hook] 🌐 환경: ${detectEnvironment()}`);
      
      const result = await (fcmTokenService as any).initializeAndCheckUpdateToken(userId, forceUpdate);
      
      if (result.success) {
        console.log('[FCM Hook] ✅ FCM 토큰 업데이트 성공:', result.message);
        
        setState(prev => ({
          ...prev,
          isInitialized: true,
          isRefreshing: false,
          error: null,
          token: result.token || null,
          lastUpdateTime: Date.now()
        }));

        // 콜백 호출
        if (onSuccess) onSuccess(result);
        if (result.token && onTokenUpdate) onTokenUpdate(result.token);
        
        return result;
      } else {
        console.warn('[FCM Hook] ⚠️ FCM 토큰 업데이트 실패:', result.error);
        
        setState(prev => ({
          ...prev,
          isRefreshing: false,
          error: result.error || '토큰 업데이트 실패'
        }));

        if (onError) onError(result.error);
        return result;
      }
      
    } catch (error) {
      console.error('[FCM Hook] ❌ FCM 토큰 업데이트 중 오류:', error);
      
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: errorMessage
      }));

      if (onError) onError(error);
      return { success: false, error: errorMessage };
    }
  }, [userId, enabled, onSuccess, onError, onTokenUpdate, detectEnvironment]);

  // 자동 갱신 시작
  const startAutoRefresh = useCallback((customUserId?: number, customInterval?: number) => {
    const targetUserId = customUserId || userId;
    const targetInterval = customInterval || autoRefreshInterval;
    
    if (!targetUserId) {
      console.warn('[FCM Hook] ⚠️ 자동 갱신 시작 실패: 사용자 ID 없음');
      return;
    }

    try {
      console.log(`[FCM Hook] 🔄 자동 갱신 시작 (사용자 ID: ${targetUserId}, 간격: ${targetInterval / 1000 / 60}분)`);
      
      fcmTokenAutoRefreshService.startPeriodicRefresh(targetUserId, targetInterval);
      
      setState(prev => ({
        ...prev,
        autoRefreshStatus: {
          ...prev.autoRefreshStatus,
          isActive: true,
          interval: targetInterval
        }
      }));
      
    } catch (error) {
      console.error('[FCM Hook] ❌ 자동 갱신 시작 실패:', error);
    }
  }, [userId, autoRefreshInterval]);

  // 자동 갱신 중지
  const stopAutoRefresh = useCallback(() => {
    try {
      console.log('[FCM Hook] ⏹️ 자동 갱신 중지');
      
      fcmTokenAutoRefreshService.stopPeriodicRefresh();
      
      setState(prev => ({
        ...prev,
        autoRefreshStatus: {
          ...prev.autoRefreshStatus,
          isActive: false
        }
      }));
      
    } catch (error) {
      console.error('[FCM Hook] ❌ 자동 갱신 중지 실패:', error);
    }
  }, []);

  // 수동 갱신 트리거
  const triggerManualRefresh = useCallback(async () => {
    if (!userId) {
      console.warn('[FCM Hook] ⚠️ 수동 갱신 실패: 사용자 ID 없음');
      return { success: false, error: '사용자 ID 없음' };
    }

    try {
      console.log(`[FCM Hook] 🔄 수동 갱신 트리거 (사용자 ID: ${userId})`);
      
      const result = await fcmTokenAutoRefreshService.triggerManualRefresh();
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          lastUpdateTime: Date.now()
        }));
      }
      
      return result;
      
    } catch (error) {
      console.error('[FCM Hook] ❌ 수동 갱신 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }, [userId]);

  // 자동 갱신 상태 확인
  const getAutoRefreshStatus = useCallback(() => {
    return fcmTokenAutoRefreshService.getStatus();
  }, []);

  // 초기화 및 자동 갱신 시작
  useEffect(() => {
    if (!userId || !enabled || isInitializedRef.current) return;

    const initializeFCM = async () => {
      try {
        console.log(`[FCM Hook] 🔧 FCM 초기화 시작 (사용자 ID: ${userId})`);
        
        setState(prev => ({ ...prev, isLoading: true }));
        
        // FCM 토큰 초기화 및 업데이트
        const result = await initializeAndUpdateToken();
        
        if (result.success) {
          console.log('[FCM Hook] ✅ FCM 초기화 완료');
          
          // 자동 갱신 시작
          startAutoRefresh();
          
          isInitializedRef.current = true;
          userIdRef.current = userId;
        } else {
          console.warn('[FCM Hook] ⚠️ FCM 초기화 실패:', result.error);
        }
        
      } catch (error) {
        console.error('[FCM Hook] ❌ FCM 초기화 중 오류:', error);
      } finally {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initializeFCM();
  }, [userId, enabled, initializeAndUpdateToken, startAutoRefresh]);

  // 사용자 ID 변경 시 재초기화
  useEffect(() => {
    if (userId !== userIdRef.current) {
      console.log(`[FCM Hook] 🔄 사용자 ID 변경 감지: ${userIdRef.current} → ${userId}`);
      
      // 기존 자동 갱신 중지
      stopAutoRefresh();
      
      // 상태 초기화
      setState(prev => ({
        ...prev,
        isInitialized: false,
        token: null,
        lastUpdateTime: null,
        autoRefreshStatus: {
          ...prev.autoRefreshStatus,
          isActive: false,
          retryCount: 0
        }
      }));
      
      isInitializedRef.current = false;
      userIdRef.current = userId || null;
    }
  }, [userId, stopAutoRefresh]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (isInitializedRef.current) {
        console.log('[FCM Hook] 🧹 컴포넌트 언마운트 - 자동 갱신 중지');
        stopAutoRefresh();
      }
    };
  }, [stopAutoRefresh]);

  // 자동 갱신 상태 주기적 업데이트
  useEffect(() => {
    if (!state.autoRefreshStatus.isActive) return;

    const updateStatus = () => {
      const status = getAutoRefreshStatus();
      setState(prev => ({
        ...prev,
        autoRefreshStatus: {
          ...prev.autoRefreshStatus,
          retryCount: status.retryCount
        }
      }));
    };

    const intervalId = setInterval(updateStatus, 10000); // 10초마다 상태 업데이트

    return () => clearInterval(intervalId);
  }, [state.autoRefreshStatus.isActive, getAutoRefreshStatus]);

  return {
    // 상태
    isInitialized: state.isInitialized,
    isLoading: state.isLoading,
    isRefreshing: state.isRefreshing,
    error: state.error,
    token: state.token,
    lastUpdateTime: state.lastUpdateTime,
    autoRefreshStatus: state.autoRefreshStatus,
    
    // 함수들
    initializeAndUpdateToken,
    startAutoRefresh,
    stopAutoRefresh,
    triggerManualRefresh,
    getAutoRefreshStatus,
    
    // 환경 정보
    environment: detectEnvironment(),
    
    // 편의 함수들
    forceRefresh: () => initializeAndUpdateToken(true),
    refreshToken: () => initializeAndUpdateToken(false)
  };
};

export default useFCMTokenAutoRefresh;
