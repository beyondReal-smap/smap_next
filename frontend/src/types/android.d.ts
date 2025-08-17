// 안드로이드 네이티브 API 타입 정의
declare global {
  interface Window {
    Android?: {
      // 권한 관련 API
      checkPermission: (permission: string) => Promise<{
        granted: boolean;
        canAskAgain: boolean;
        shouldShowRationale?: boolean;
      }>;
      
      requestPermission: (permission: string) => Promise<{
        granted: boolean;
        message?: string;
      }>;
      
      // 앱 설정 열기
      openAppSettings: () => void;
      
      // 기타 안드로이드 전용 API들
      showToast: (message: string, duration?: 'short' | 'long') => void;
      vibrate: (duration: number) => void;
      getDeviceInfo: () => Promise<{
        brand: string;
        model: string;
        sdkVersion: number;
        appVersion: string;
      }>;
    };
  }
}

export {};
