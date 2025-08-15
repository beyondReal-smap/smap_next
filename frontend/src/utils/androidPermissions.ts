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
    };
  }
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
      
      // 10초 후 타임아웃
      setTimeout(() => {
        if (window.onPermissionsGranted) {
          console.log('⚠️ [PERMISSIONS] 권한 요청 타임아웃');
          delete window.onPermissionsGranted;
          resolve(false);
        }
      }, 10000);
      
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
      
      if (isFirst) {
        // 권한 요청 결과를 받기 위한 콜백 등록
        window.onPermissionsGranted = () => {
          console.log('✅ [PERMISSIONS] 첫 로그인 권한 요청 완료');
          delete window.onPermissionsGranted;
          resolve(true);
        };

        // 타임아웃 설정
        setTimeout(() => {
          if (window.onPermissionsGranted) {
            console.log('⚠️ [PERMISSIONS] 첫 로그인 권한 요청 타임아웃');
            delete window.onPermissionsGranted;
            resolve(false);
          }
        }, 15000);
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

// 전역 콜백 타입 선언
declare global {
  interface Window {
    onPermissionsGranted?: () => void;
    onLocationActivityPermissionsGranted?: () => void;
  }
}
