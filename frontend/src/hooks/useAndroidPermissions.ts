import { useState, useEffect, useCallback } from 'react';
import {
  checkAllAndroidPermissions,
  checkEssentialPermissions,
  requestEssentialPermissions,
  requestAndroidPermission,
  AndroidPermissions,
  PermissionType,
  PermissionResult,
  logPermissionStatus,
  logPermissionResult
} from '../utils/permissions';

export const useAndroidPermissions = () => {
  const [permissions, setPermissions] = useState<AndroidPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 모든 권한 상태 체크
  const checkPermissions = useCallback(async () => {
    if (typeof window === 'undefined' || !window.Android) {
      console.log('[권한훅] 안드로이드 환경이 아닙니다.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const allPermissions = await checkAllAndroidPermissions();
      setPermissions(allPermissions);
      logPermissionStatus(allPermissions);
      return allPermissions;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '권한 체크 중 오류가 발생했습니다.';
      setError(errorMessage);
      console.error('[권한훅] 권한 체크 실패:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 필수 권한 체크 (동작, 위치)
  const checkEssential = useCallback(async () => {
    if (typeof window === 'undefined' || !window.Android) {
      return { activity: false, location: false };
    }

    try {
      const essential = await checkEssentialPermissions();
      return essential;
    } catch (err) {
      console.error('[권한훅] 필수 권한 체크 실패:', err);
      return { activity: false, location: false };
    }
  }, []);

  // 필수 권한 요청
  const requestEssential = useCallback(async () => {
    if (typeof window === 'undefined' || !window.Android) {
      return {
        activity: { success: false, permission: 'activity', message: '안드로이드 환경이 아닙니다.' },
        location: { success: false, permission: 'location', message: '안드로이드 환경이 아닙니다.' }
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await requestEssentialPermissions();
      
      // 결과 로깅
      logPermissionResult(results.activity);
      logPermissionResult(results.location);

      // 권한 상태 업데이트
      if (permissions) {
        setPermissions(prev => prev ? {
          ...prev,
          activity: { granted: results.activity.success, canAskAgain: true },
          location: { granted: results.location.success, canAskAgain: true }
        } : null);
      }

      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '필수 권한 요청 중 오류가 발생했습니다.';
      setError(errorMessage);
      console.error('[권한훅] 필수 권한 요청 실패:', err);
      return {
        activity: { success: false, permission: 'activity', message: errorMessage },
        location: { success: false, permission: 'location', message: errorMessage }
      };
    } finally {
      setIsLoading(false);
    }
  }, [permissions]);

  // 개별 권한 요청
  const requestPermission = useCallback(async (permission: PermissionType): Promise<PermissionResult> => {
    if (typeof window === 'undefined' || !window.Android) {
      return { success: false, permission, message: '안드로이드 환경이 아닙니다.' };
    }

    try {
      const result = await requestAndroidPermission(permission);
      logPermissionResult(result);

      // 권한 상태 업데이트
      if (permissions && result.success) {
        setPermissions(prev => prev ? {
          ...prev,
          [permission]: { granted: true, canAskAgain: true }
        } : null);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '권한 요청 중 오류가 발생했습니다.';
      console.error(`[권한훅] ${permission} 권한 요청 실패:`, err);
      return { success: false, permission, message: errorMessage };
    }
  }, [permissions]);

  // 초기 권한 체크
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // 권한 상태 확인 헬퍼 함수들
  const hasPermission = useCallback((permission: PermissionType): boolean => {
    return permissions?.[permission]?.granted || false;
  }, [permissions]);

  const canAskPermission = useCallback((permission: PermissionType): boolean => {
    return permissions?.[permission]?.canAskAgain || false;
  }, [permissions]);

  const shouldShowRationale = useCallback((permission: PermissionType): boolean => {
    return permissions?.[permission]?.shouldShowRationale || false;
  }, [permissions]);

  // 모든 권한이 승인되었는지 확인
  const allPermissionsGranted = useCallback((): boolean => {
    if (!permissions) return false;
    
    return Object.values(permissions).every(permission => permission.granted);
  }, [permissions]);

  // 필수 권한이 승인되었는지 확인
  const essentialPermissionsGranted = useCallback((): boolean => {
    if (!permissions) return false;
    
    return permissions.activity.granted && permissions.location.granted;
  }, [permissions]);

  return {
    // 상태
    permissions,
    isLoading,
    error,
    
    // 함수들
    checkPermissions,
    checkEssential,
    requestEssential,
    requestPermission,
    
    // 헬퍼 함수들
    hasPermission,
    canAskPermission,
    shouldShowRationale,
    allPermissionsGranted,
    essentialPermissionsGranted,
    
    // 권한별 상태 확인
    notifications: hasPermission('notifications'),
    camera: hasPermission('camera'),
    storage: hasPermission('storage'),
    activity: hasPermission('activity'),
    location: hasPermission('location')
  };
};
