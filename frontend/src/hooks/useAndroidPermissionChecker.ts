/**
 * 안드로이드 권한 지속적 체크 Hook
 */

import { useEffect, useCallback } from 'react';
import { 
  checkLocationAndActivityPermissionsOnFocus, 
  isAndroid,
  hasLocationAndActivityPermissions,
  requestLocationAndActivityPermissions 
} from '@/utils/androidPermissions';

// 전역 권한 체크 상태 관리
let isPermissionCheckInProgress = false;
let lastPermissionCheckTime = 0;
const PERMISSION_CHECK_INTERVAL = 30000; // 30초마다 체크

export function useAndroidPermissionChecker() {
  // 권한 체크 함수
  const checkPermissions = useCallback(async () => {
    if (!isAndroid() || isPermissionCheckInProgress) {
      return;
    }

    const now = Date.now();
    if (now - lastPermissionCheckTime < PERMISSION_CHECK_INTERVAL) {
      return; // 너무 자주 체크하지 않도록 제한
    }

    isPermissionCheckInProgress = true;
    lastPermissionCheckTime = now;

    try {
      console.log('🔥 [PERMISSION_CHECKER] 정기 권한 체크 시작');
      
      if (!hasLocationAndActivityPermissions()) {
        console.log('⚠️ [PERMISSION_CHECKER] 위치/동작 권한이 없음 - 재요청');
        await requestLocationAndActivityPermissions();
      } else {
        console.log('✅ [PERMISSION_CHECKER] 위치/동작 권한 정상');
      }
    } catch (error) {
      console.error('❌ [PERMISSION_CHECKER] 권한 체크 중 오류:', error);
    } finally {
      isPermissionCheckInProgress = false;
    }
  }, []);

  // 앱 포커스 시 권한 체크
  const handleAppResumed = useCallback(async () => {
    if (!isAndroid()) return;
    
    console.log('🔥 [PERMISSION_CHECKER] 앱 포그라운드 복귀 - 권한 체크');
    try {
      await checkLocationAndActivityPermissionsOnFocus();
    } catch (error) {
      console.error('❌ [PERMISSION_CHECKER] 앱 복귀 시 권한 체크 오류:', error);
    }
  }, []);

  // 페이지 visibility 변경 시 권한 체크
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      console.log('🔥 [PERMISSION_CHECKER] 페이지 visible - 권한 체크');
      setTimeout(checkPermissions, 1000); // 1초 후 체크
    }
  }, [checkPermissions]);

  // 윈도우 포커스 시 권한 체크
  const handleWindowFocus = useCallback(() => {
    console.log('🔥 [PERMISSION_CHECKER] 윈도우 포커스 - 권한 체크');
    setTimeout(checkPermissions, 500); // 0.5초 후 체크
  }, [checkPermissions]);

  useEffect(() => {
    if (!isAndroid()) return;

    // 안드로이드 앱 복귀 이벤트 리스너 등록
    window.onAppResumed = handleAppResumed;

    // 웹 이벤트 리스너들 등록
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    // 주기적 권한 체크 (30초마다)
    const intervalId = setInterval(checkPermissions, PERMISSION_CHECK_INTERVAL);

    // 초기 권한 체크 (3초 후)
    const timeoutId = setTimeout(() => {
      console.log('🔥 [PERMISSION_CHECKER] 초기 권한 체크');
      checkPermissions();
    }, 3000);

    return () => {
      // 정리
      delete window.onAppResumed;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [handleAppResumed, handleVisibilityChange, handleWindowFocus, checkPermissions]);

  return {
    checkPermissions,
    handleAppResumed
  };
}

// 전역 타입 선언
declare global {
  interface Window {
    onAppResumed?: () => void;
  }
}
