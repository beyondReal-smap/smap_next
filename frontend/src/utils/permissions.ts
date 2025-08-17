// 안드로이드 권한 관리 유틸리티
export interface PermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  shouldShowRationale?: boolean;
}

export interface AndroidPermissions {
  notifications: PermissionStatus;
  camera: PermissionStatus;
  storage: PermissionStatus;
  activity: PermissionStatus;
  location: PermissionStatus;
}

// 권한 타입 정의
export type PermissionType = keyof AndroidPermissions;

// 권한 요청 결과
export interface PermissionResult {
  success: boolean;
  permission: PermissionType;
  message?: string;
}

// 안드로이드 권한 체크 함수
export const checkAndroidPermission = async (permission: PermissionType): Promise<PermissionStatus> => {
  if (typeof window === 'undefined' || !window.Android) {
    return { granted: false, canAskAgain: false };
  }

  try {
    // 안드로이드 네이티브 권한 체크
    const result = await window.Android.checkPermission(permission);
    return {
      granted: result.granted || false,
      canAskAgain: result.canAskAgain || false,
      shouldShowRationale: result.shouldShowRationale || false
    };
  } catch (error) {
    console.warn(`[권한체크] ${permission} 권한 체크 실패:`, error);
    return { granted: false, canAskAgain: false };
  }
};

// 안드로이드 권한 요청 함수
export const requestAndroidPermission = async (permission: PermissionType): Promise<PermissionResult> => {
  if (typeof window === 'undefined' || !window.Android) {
    return { success: false, permission, message: '안드로이드 환경이 아닙니다.' };
  }

  try {
    const result = await window.Android.requestPermission(permission);
    
    if (result.granted) {
      console.log(`[권한요청] ${permission} 권한 승인됨`);
      return { success: true, permission };
    } else {
      console.warn(`[권한요청] ${permission} 권한 거부됨`);
      return { 
        success: false, 
        permission, 
        message: result.message || '권한이 거부되었습니다.' 
      };
    }
  } catch (error) {
    console.error(`[권한요청] ${permission} 권한 요청 실패:`, error);
    return { 
      success: false, 
      permission, 
      message: '권한 요청 중 오류가 발생했습니다.' 
    };
  }
};

// 모든 권한 상태 체크
export const checkAllAndroidPermissions = async (): Promise<AndroidPermissions> => {
  const permissions: PermissionType[] = ['notifications', 'camera', 'storage', 'activity', 'location'];
  
  const results = await Promise.all(
    permissions.map(async (permission) => {
      const status = await checkAndroidPermission(permission);
      return { [permission]: status };
    })
  );

  return results.reduce((acc, result) => ({ ...acc, ...result }), {} as AndroidPermissions);
};

// 필수 권한 체크 (동작, 위치)
export const checkEssentialPermissions = async (): Promise<{ activity: boolean; location: boolean }> => {
  const [activityStatus, locationStatus] = await Promise.all([
    checkAndroidPermission('activity'),
    checkAndroidPermission('location')
  ]);

  return {
    activity: activityStatus.granted,
    location: locationStatus.granted
  };
};

// 필수 권한 요청
export const requestEssentialPermissions = async (): Promise<{
  activity: PermissionResult;
  location: PermissionResult;
}> => {
  const [activityResult, locationResult] = await Promise.all([
    requestAndroidPermission('activity'),
    requestAndroidPermission('location')
  ]);

  return { activity: activityResult, location: locationResult };
};

// 권한 설명 표시
export const showPermissionRationale = (permission: PermissionType): string => {
  const rationales = {
    notifications: '알림을 통해 중요한 정보를 받아볼 수 있습니다.',
    camera: '사진 촬영 및 QR 코드 스캔을 위해 필요합니다.',
    storage: '사진 저장 및 불러오기를 위해 필요합니다.',
    activity: '사용자 활동을 추적하여 서비스를 개선합니다.',
    location: '현재 위치 기반 서비스를 제공합니다.'
  };

  return rationales[permission] || '이 권한은 서비스 이용에 필요합니다.';
};

// 권한 설정 화면으로 이동
export const openAppSettings = (): void => {
  if (typeof window !== 'undefined' && window.Android) {
    try {
      window.Android.openAppSettings();
    } catch (error) {
      console.warn('[권한설정] 앱 설정 열기 실패:', error);
    }
  }
};

// 권한 상태 로깅
export const logPermissionStatus = (permissions: AndroidPermissions): void => {
  console.log('[권한상태] 현재 권한 상태:', {
    알림: permissions.notifications.granted ? '✅' : '❌',
    카메라: permissions.camera.granted ? '✅' : '❌',
    저장소: permissions.storage.granted ? '✅' : '❌',
    동작: permissions.activity.granted ? '✅' : '❌',
    위치: permissions.location.granted ? '✅' : '❌'
  });
};

// 권한 요청 결과 로깅
export const logPermissionResult = (result: PermissionResult): void => {
  const status = result.success ? '✅ 성공' : '❌ 실패';
  console.log(`[권한요청] ${result.permission}: ${status}${result.message ? ` - ${result.message}` : ''}`);
};
