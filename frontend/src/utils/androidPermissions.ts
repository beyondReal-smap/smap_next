/**
 * 안드로이드 권한 관리 유틸리티
 */

// 안드로이드 권한 인터페이스 타입 정의
declare global {
  interface Window {
    AndroidPermissions?: {
      requestPermissions(): void;
      hasAllPermissions(): boolean;
      getMissingPermissions(): string;
      setFirstLogin(isFirst: boolean): void;
      hasLocationAndActivityPermissions(): boolean;
      requestLocationAndActivityPermissions(): void;
      getMissingLocationAndActivityPermissions(): string;
      resetPermissionState?(): void; // 권한 상태 초기화 메서드 추가
    };
  }
}

// 앱 재설치 감지를 위한 키
const APP_INSTALL_KEY = 'smap_app_install_id';
const LAST_PERMISSION_CHECK_KEY = 'smap_last_permission_check';

/**
 * 앱 재설치 여부 확인
 */
function isAppReinstalled(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }

  const currentInstallId = localStorage.getItem(APP_INSTALL_KEY);
  const lastPermissionCheck = localStorage.getItem(LAST_PERMISSION_CHECK_KEY);
  
  // 설치 ID가 없거나 권한 체크 기록이 없으면 재설치로 간주
  if (!currentInstallId || !lastPermissionCheck) {
    // 새로운 설치 ID 생성
    const newInstallId = `install_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(APP_INSTALL_KEY, newInstallId);
    localStorage.setItem(LAST_PERMISSION_CHECK_KEY, Date.now().toString());
    console.log('🔄 [PERMISSIONS] 앱 재설치 감지됨 - 새로운 설치 ID 생성:', newInstallId);
    return true;
  }

  return false;
}

/**
 * 권한 상태 강제 초기화
 */
function forceResetPermissionState(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  // 권한 관련 로컬 스토리지 키들 초기화
  const keysToRemove = [
    'smap_permissions_granted',
    'smap_location_permission',
    'smap_activity_permission',
    'smap_camera_permission',
    'smap_notification_permission',
    'smap_storage_permission'
  ];

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });

  console.log('🔄 [PERMISSIONS] 권한 상태 강제 초기화 완료');
}

/**
 * 안드로이드 환경인지 확인
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
}

/**
 * 안드로이드 권한 인터페이스가 사용 가능한지 확인
 */
export function isAndroidPermissionsAvailable(): boolean {
  return isAndroid() && typeof window.AndroidPermissions !== 'undefined';
}

/**
 * 모든 권한이 허용되었는지 확인
 */
export function hasAllPermissions(): boolean {
  if (!isAndroidPermissionsAvailable()) {
    console.log('🔍 [PERMISSIONS] 안드로이드 환경이 아니거나 권한 인터페이스가 없음');
    return true; // 웹 환경에서는 권한 체크를 하지 않음
  }

  try {
    const result = window.AndroidPermissions!.hasAllPermissions();
    console.log('🔍 [PERMISSIONS] 권한 확인 결과:', result);
    return result;
  } catch (error) {
    console.error('❌ [PERMISSIONS] 권한 확인 중 오류:', error);
    return false;
  }
}

/**
 * 누락된 권한 목록 가져오기
 */
export function getMissingPermissions(): string[] {
  if (!isAndroidPermissionsAvailable()) {
    return [];
  }

  try {
    const result = window.AndroidPermissions!.getMissingPermissions();
    console.log('🔍 [PERMISSIONS] 누락된 권한:', result);
    return result ? result.split(',').filter(p => p.trim()) : [];
  } catch (error) {
    console.error('❌ [PERMISSIONS] 누락된 권한 확인 중 오류:', error);
    return [];
  }
}

/**
 * 권한 요청
 */
export function requestPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isAndroidPermissionsAvailable()) {
      console.log('🔍 [PERMISSIONS] 안드로이드 환경이 아니므로 권한 요청 생략');
      resolve(true);
      return;
    }

    try {
      console.log('🔥 [PERMISSIONS] 권한 요청 시작');
      
      // 권한 요청 결과를 받기 위한 콜백 등록
      window.onPermissionsGranted = () => {
        console.log('✅ [PERMISSIONS] 모든 권한 허용됨');
        delete window.onPermissionsGranted;
        resolve(true);
      };

      // 권한 요청 실행
      window.AndroidPermissions!.requestPermissions();
      
      // 15초 후 타임아웃 (권한 요청 창이 나타날 시간을 고려하여 증가)
      setTimeout(() => {
        if (window.onPermissionsGranted) {
          console.log('⚠️ [PERMISSIONS] 권한 요청 타임아웃 - 직접 권한 요청 시도');
          delete window.onPermissionsGranted;
          
          // 타임아웃 후 직접 권한 요청 시도
          try {
            if (window.AndroidPermissions?.requestPermissions) {
              window.AndroidPermissions.requestPermissions();
              console.log('🔄 [PERMISSIONS] 타임아웃 후 직접 권한 요청 재시도');
              
              // 추가 10초 대기
              setTimeout(() => {
                if (window.onPermissionsGranted) {
                  console.log('❌ [PERMISSIONS] 재시도 후에도 타임아웃');
                  delete window.onPermissionsGranted;
                  resolve(false);
                }
              }, 10000);
            } else {
              resolve(false);
            }
          } catch (error) {
            console.error('❌ [PERMISSIONS] 타임아웃 후 권한 요청 재시도 실패:', error);
            resolve(false);
          }
        }
      }, 15000);
      
    } catch (error) {
      console.error('❌ [PERMISSIONS] 권한 요청 중 오류:', error);
      resolve(false);
    }
  });
}

/**
 * 첫 로그인 설정 및 권한 요청
 */
export function setFirstLogin(isFirst: boolean = true): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isAndroidPermissionsAvailable()) {
      console.log('🔍 [PERMISSIONS] 안드로이드 환경이 아니므로 첫 로그인 설정 생략');
      resolve(true);
      return;
    }

    try {
      console.log('🔥 [PERMISSIONS] 첫 로그인 설정:', isFirst);
      
      // 앱 재설치 감지 및 권한 상태 초기화
      if (isAppReinstalled()) {
        console.log('🔄 [PERMISSIONS] 앱 재설치 감지 - 권한 상태 초기화');
        forceResetPermissionState();
        
        // 네이티브 권한 상태도 초기화 시도
        if (window.AndroidPermissions?.resetPermissionState) {
          try {
            window.AndroidPermissions.resetPermissionState();
            console.log('✅ [PERMISSIONS] 네이티브 권한 상태 초기화 완료');
          } catch (error) {
            console.log('⚠️ [PERMISSIONS] 네이티브 권한 상태 초기화 실패:', error);
          }
        }
        
        // 강제로 첫 로그인으로 설정
        isFirst = true;
      }
      
      if (isFirst) {
        // 권한 요청 결과를 받기 위한 콜백 등록
        window.onPermissionsGranted = () => {
          console.log('✅ [PERMISSIONS] 첫 로그인 권한 요청 완료');
          delete window.onPermissionsGranted;
          
          // 권한 체크 시간 업데이트
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(LAST_PERMISSION_CHECK_KEY, Date.now().toString());
          }
          
          resolve(true);
        };

        // 타임아웃 설정 (20초로 증가)
        setTimeout(() => {
          if (window.onPermissionsGranted) {
            console.log('⚠️ [PERMISSIONS] 첫 로그인 권한 요청 타임아웃 - 직접 권한 요청 시도');
            delete window.onPermissionsGranted;
            
            // 타임아웃 후 직접 권한 요청 시도
            try {
              if (window.AndroidPermissions?.requestPermissions) {
                window.AndroidPermissions.requestPermissions();
                console.log('🔄 [PERMISSIONS] 첫 로그인 타임아웃 후 직접 권한 요청 재시도');
                
                // 추가 15초 대기
                setTimeout(() => {
                  if (window.onPermissionsGranted) {
                    console.log('❌ [PERMISSIONS] 첫 로그인 재시도 후에도 타임아웃');
                    delete window.onPermissionsGranted;
                    resolve(false);
                  }
                }, 15000);
              } else {
                resolve(false);
              }
            } catch (error) {
              console.error('❌ [PERMISSIONS] 첫 로그인 타임아웃 후 권한 요청 재시도 실패:', error);
              resolve(false);
            }
          }
        }, 20000);
      }

      // 첫 로그인 설정 실행 (내부적으로 권한 요청도 함께 실행됨)
      window.AndroidPermissions!.setFirstLogin(isFirst);
      
      if (!isFirst) {
        resolve(true);
      }
      
    } catch (error) {
      console.error('❌ [PERMISSIONS] 첫 로그인 설정 중 오류:', error);
      resolve(false);
    }
  });
}

/**
 * 권한 이름을 한국어로 변환
 */
export function getPermissionName(permission: string): string {
  const permissionNames: { [key: string]: string } = {
    'android.permission.CAMERA': '카메라',
    'android.permission.READ_EXTERNAL_STORAGE': '사진보관함',
    'android.permission.ACCESS_FINE_LOCATION': '위치 (정확한)',
    'android.permission.ACCESS_COARSE_LOCATION': '위치 (대략적인)',
    'android.permission.POST_NOTIFICATIONS': '알림',
    'android.permission.ACTIVITY_RECOGNITION': '동작 인식'
  };
  
  return permissionNames[permission] || permission;
}

/**
 * 위치 및 동작 권한이 모두 허용되었는지 확인
 */
export function hasLocationAndActivityPermissions(): boolean {
  if (!isAndroidPermissionsAvailable()) {
    console.log('🔍 [LOCATION_ACTIVITY_PERMISSIONS] 안드로이드 환경이 아니거나 권한 인터페이스가 없음');
    return true; // 웹 환경에서는 권한 체크를 하지 않음
  }

  try {
    const result = window.AndroidPermissions!.hasLocationAndActivityPermissions();
    console.log('🔍 [LOCATION_ACTIVITY_PERMISSIONS] 위치/동작 권한 확인 결과:', result);
    return result;
  } catch (error) {
    console.error('❌ [LOCATION_ACTIVITY_PERMISSIONS] 위치/동작 권한 확인 중 오류:', error);
    return false;
  }
}

/**
 * 누락된 위치/동작 권한 목록 가져오기
 */
export function getMissingLocationAndActivityPermissions(): string[] {
  if (!isAndroidPermissionsAvailable()) {
    return [];
  }

  try {
    const result = window.AndroidPermissions!.getMissingLocationAndActivityPermissions();
    console.log('🔍 [LOCATION_ACTIVITY_PERMISSIONS] 누락된 위치/동작 권한:', result);
    return result ? result.split(',').filter(p => p.trim()) : [];
  } catch (error) {
    console.error('❌ [LOCATION_ACTIVITY_PERMISSIONS] 누락된 위치/동작 권한 확인 중 오류:', error);
    return [];
  }
}

/**
 * 위치 및 동작 권한 요청
 */
export function requestLocationAndActivityPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isAndroidPermissionsAvailable()) {
      console.log('🔍 [LOCATION_ACTIVITY_PERMISSIONS] 안드로이드 환경이 아니므로 권한 요청 생략');
      resolve(true);
      return;
    }

    try {
      console.log('🔥 [LOCATION_ACTIVITY_PERMISSIONS] 위치/동작 권한 요청 시작');
      
      // 권한 요청 결과를 받기 위한 콜백 등록
      window.onLocationActivityPermissionsGranted = () => {
        console.log('✅ [LOCATION_ACTIVITY_PERMISSIONS] 위치/동작 권한 허용됨');
        delete window.onLocationActivityPermissionsGranted;
        resolve(true);
      };

      // 권한 요청 실행
      window.AndroidPermissions!.requestLocationAndActivityPermissions();
      
      // 10초 후 타임아웃
      setTimeout(() => {
        if (window.onLocationActivityPermissionsGranted) {
          console.log('⚠️ [LOCATION_ACTIVITY_PERMISSIONS] 위치/동작 권한 요청 타임아웃');
          delete window.onLocationActivityPermissionsGranted;
          resolve(false);
        }
      }, 10000);
      
    } catch (error) {
      console.error('❌ [LOCATION_ACTIVITY_PERMISSIONS] 위치/동작 권한 요청 중 오류:', error);
      resolve(false);
    }
  });
}

/**
 * 앱 포커스 시 위치/동작 권한 체크
 */
export function checkLocationAndActivityPermissionsOnFocus(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isAndroidPermissionsAvailable()) {
      resolve(true);
      return;
    }

    console.log('🔥 [LOCATION_ACTIVITY_PERMISSIONS] 앱 포커스 시 권한 체크');
    
    // 권한 체크 후 필요시 요청
    if (!hasLocationAndActivityPermissions()) {
      const missingPermissions = getMissingLocationAndActivityPermissions();
      const missingNames = missingPermissions.map(getPermissionName).join(', ');
      
      console.log('⚠️ [LOCATION_ACTIVITY_PERMISSIONS] 누락된 권한:', missingNames);
      
      // 자동으로 권한 요청
      requestLocationAndActivityPermissions().then((success) => {
        if (success) {
          console.log('✅ [LOCATION_ACTIVITY_PERMISSIONS] 권한 재요청 성공');
        } else {
          console.log('⚠️ [LOCATION_ACTIVITY_PERMISSIONS] 권한 재요청 실패');
        }
        resolve(success);
      });
    } else {
      console.log('✅ [LOCATION_ACTIVITY_PERMISSIONS] 모든 권한이 이미 허용됨');
      resolve(true);
    }
  });
}

/**
 * 앱 시작 시 권한 상태 자동 확인 및 초기화
 */
export function initializePermissionState(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    console.log('🔄 [PERMISSIONS] 앱 시작 시 권한 상태 초기화 시작');
    
    // 앱 재설치 감지
    if (isAppReinstalled()) {
      console.log('🔄 [PERMISSIONS] 앱 재설치 감지 - 권한 상태 강제 초기화');
      forceResetPermissionState();
      
      // 네이티브 권한 상태도 초기화 시도
      if (isAndroidPermissionsAvailable() && window.AndroidPermissions?.resetPermissionState) {
        try {
          window.AndroidPermissions.resetPermissionState();
          console.log('✅ [PERMISSIONS] 네이티브 권한 상태 초기화 완료');
        } catch (error) {
          console.log('⚠️ [PERMISSIONS] 네이티브 권한 상태 초기화 실패:', error);
        }
      }
    } else {
      console.log('✅ [PERMISSIONS] 앱 재설치 아님 - 기존 권한 상태 유지');
    }
    
    // 권한 상태 로깅
    const currentInstallId = localStorage.getItem(APP_INSTALL_KEY);
    const lastPermissionCheck = localStorage.getItem(LAST_PERMISSION_CHECK_KEY);
    console.log('🔍 [PERMISSIONS] 현재 권한 상태:', {
      installId: currentInstallId,
      lastCheck: lastPermissionCheck,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [PERMISSIONS] 권한 상태 초기화 중 오류:', error);
  }
}

// 전역 콜백 타입 선언
declare global {
  interface Window {
    onPermissionsGranted?: () => void;
    onLocationActivityPermissionsGranted?: () => void;
  }
}
