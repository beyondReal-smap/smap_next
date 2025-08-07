import apiClient from './apiClient';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  altitude?: number;
  timestamp: number;
  source: string;
  mt_idx?: number; // 사용자 ID 추가
}

interface LocationTrackingConfig {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceFilter?: number;
  updateInterval?: number;
}

class LocationTrackingService {
  private isTracking = false;
  private watchId: number | null = null;
  private lastLocation: LocationData | null = null;
  private updateCallbacks: ((location: LocationData) => void)[] = [];
  private errorCallbacks: ((error: any) => void)[] = [];

  constructor() {
    console.log('📍 [LOCATION TRACKING] LocationTrackingService 인스턴스 생성');
    this.setupNativeCallbacks();
  }

  private setupNativeCallbacks() {
    // 서버 사이드 렌더링 체크
    if (typeof window === 'undefined') {
      console.log('📍 [LOCATION TRACKING] 서버 사이드 렌더링 환경 - 네이티브 콜백 설정 건너뜀');
      return;
    }
    
    console.log('📍 [LOCATION TRACKING] 네이티브 콜백 설정 시작');
    
    // iOS 네이티브 지속적 위치 업데이트 콜백
    (window as any).onLocationUpdate = (locationData: LocationData) => {
      console.log('📍 [LOCATION TRACKING] iOS 네이티브 지속적 위치 업데이트:', locationData);
      this.handleLocationUpdate(locationData);
    };

    // Android 네이티브 지속적 위치 업데이트 콜백
    (window as any).onAndroidLocationUpdate = (locationData: LocationData) => {
      console.log('📍 [LOCATION TRACKING] Android 네이티브 지속적 위치 업데이트:', locationData);
      this.handleLocationUpdate(locationData);
    };
    
    console.log('📍 [LOCATION TRACKING] 네이티브 콜백 설정 완료');
    console.log('📍 [LOCATION TRACKING] window.onLocationUpdate 등록됨:', typeof (window as any).onLocationUpdate);
  }

  private handleLocationUpdate(locationData: LocationData) {
    console.log('📍 [LOCATION TRACKING] 위치 업데이트 처리:', {
      lat: locationData.latitude,
      lng: locationData.longitude,
      accuracy: locationData.accuracy,
      source: locationData.source
    });

    // 사용자 정보 자동 추가 (있으면 추가, 없어도 계속 진행)
    const user = this.getCurrentUser();
    if (user?.mt_idx) {
      locationData.mt_idx = user.mt_idx;
      console.log('📍 [LOCATION TRACKING] 사용자 정보 추가됨:', user.mt_idx);
    } else {
      console.warn('📍 [LOCATION TRACKING] 사용자 정보 없음 - 위치 데이터만 저장');
      // 사용자 정보가 없어도 위치 데이터는 저장하고 콜백은 실행
    }

    this.lastLocation = locationData;
    
    // 콜백 실행
    this.updateCallbacks.forEach(callback => {
      try {
        callback(locationData);
      } catch (error) {
        console.error('📍 [LOCATION TRACKING] 콜백 실행 오류:', error);
      }
    });

    // 서버로 위치 정보 전송 (사용자 정보가 있어야만 전송)
    if (user?.mt_idx) {
      this.sendLocationToServer(locationData);
    } else {
      console.log('📍 [LOCATION TRACKING] 사용자 정보 없음 - 서버 전송 건너뜀 (위치 데이터는 저장됨)');
    }
  }

  private async sendLocationToServer(locationData: LocationData) {
    try {
      console.log('📍 [LOCATION TRACKING] 서버로 위치 정보 전송 시작');
      
      // 현재 로그인된 사용자 정보 가져오기
      const user = this.getCurrentUser();
      if (!user?.mt_idx) {
        console.warn('📍 [LOCATION TRACKING] 사용자 정보 없음, 위치 전송 건너뜀');
        return;
      }

      const locationPayload = {
        mt_idx: user.mt_idx,
        mlt_lat: locationData.latitude,
        mlt_long: locationData.longitude,
        mlt_accuracy: locationData.accuracy || 0,
        mlt_speed: locationData.speed || 0,
        mlt_altitude: locationData.altitude || 0,
        mlt_timestamp: new Date(locationData.timestamp).toISOString(),
        source: locationData.source
      };

      console.log('📍 [LOCATION TRACKING] 위치 페이로드:', locationPayload);

      // 백엔드 API로 위치 정보 전송
      const response = await apiClient.post('/api/v1/logs/member-location-logs', {
        act: 'create_location_log',
        ...locationPayload
      });

      console.log('📍 [LOCATION TRACKING] 서버 응답:', response.data);
      
    } catch (error) {
      console.error('📍 [LOCATION TRACKING] 서버 전송 실패:', error);
      this.errorCallbacks.forEach(callback => {
        try {
          callback(error);
        } catch (callbackError) {
          console.error('📍 [LOCATION TRACKING] 에러 콜백 실행 오류:', callbackError);
        }
      });
    }
  }

  private getCurrentUser() {
    // 서버 사이드 렌더링 체크
    if (typeof window === 'undefined') {
      console.log('📍 [LOCATION TRACKING] 서버 사이드 렌더링 환경 - 사용자 정보 조회 건너뜀');
      return null;
    }
    
    try {
      // 여러 가능한 키에서 사용자 정보 찾기
      const possibleKeys = ['user', 'smap_user_data', 'auth_user'];
      let userData = null;
      
      for (const key of possibleKeys) {
        const userStr = localStorage.getItem(key);
        if (userStr) {
          try {
            userData = JSON.parse(userStr);
            console.log(`📍 [LOCATION TRACKING] 사용자 정보 발견 (키: ${key}):`, {
              mt_idx: userData.mt_idx,
              mt_name: userData.mt_name
            });
            break;
          } catch (parseError) {
            console.warn(`📍 [LOCATION TRACKING] 키 ${key} 파싱 실패:`, parseError);
          }
        }
      }
      
      if (!userData) {
        console.warn('📍 [LOCATION TRACKING] 사용자 정보를 찾을 수 없음. 가능한 키들:', possibleKeys);
        console.log('📍 [LOCATION TRACKING] localStorage 전체 내용:', Object.keys(localStorage));
      }
      
      return userData;
    } catch (error) {
      console.error('📍 [LOCATION TRACKING] 사용자 정보 파싱 오류:', error);
      return null;
    }
  }

  public startTracking(config: LocationTrackingConfig = {}) {
    if (this.isTracking) {
      console.log('📍 [LOCATION TRACKING] 이미 추적 중입니다');
      return;
    }

    console.log('📍 [LOCATION TRACKING] 위치 추적 시작');
    
    const {
      enableHighAccuracy = true,
      timeout = 10000,
      maximumAge = 300000,
      distanceFilter = 10,
      updateInterval = 30000
    } = config;

    // 네이티브 앱 환경에서 네이티브 위치 추적 시작
    if (this.isNativeApp()) {
      this.startNativeLocationTracking();
    } else {
      // 웹 브라우저에서 위치 추적 시작
      this.startWebLocationTracking({
        enableHighAccuracy,
        timeout,
        maximumAge,
        distanceFilter
      });
    }

    this.isTracking = true;
    console.log('✅ [LOCATION TRACKING] 위치 추적 시작됨');

    // 사용자 정보가 나중에 로드될 때를 대비해 주기적으로 확인
    this.checkAndSendPendingLocations();
  }

  // 사용자 정보가 로드되면 이전 위치 데이터도 전송
  private checkAndSendPendingLocations() {
    // 서버 사이드 렌더링 체크
    if (typeof window === 'undefined') {
      return;
    }
    
    const user = this.getCurrentUser();
    if (user?.mt_idx && this.lastLocation && !this.lastLocation.mt_idx) {
      console.log('📍 [LOCATION TRACKING] 사용자 정보 로드됨 - 이전 위치 데이터 전송');
      this.lastLocation.mt_idx = user.mt_idx;
      this.sendLocationToServer(this.lastLocation);
    }
  }

  private isNativeApp(): boolean {
    // 서버 사이드 렌더링 체크
    if (typeof window === 'undefined') {
      return false;
    }
    
    return !!(window as any).webkit?.messageHandlers?.smapIos || 
           !!(window as any).SmapApp ||
           /SMAP/i.test(navigator.userAgent);
  }

  private startNativeLocationTracking() {
    // 서버 사이드 렌더링 체크
    if (typeof window === 'undefined') {
      console.log('📍 [LOCATION TRACKING] 서버 사이드 렌더링 환경 - 네이티브 위치 추적 건너뜀');
      return;
    }
    
    console.log('📍 [LOCATION TRACKING] 네이티브 위치 추적 시작');
    
    // iOS 네이티브 위치 추적 시작
    if ((window as any).webkit?.messageHandlers?.smapIos) {
      console.log('🍎 [LOCATION TRACKING] iOS 네이티브 위치 추적 요청');
      (window as any).webkit.messageHandlers.smapIos.postMessage({
        type: 'startLocationTracking',
        param: {
          enableHighAccuracy: true,
          distanceFilter: 10,
          updateInterval: 30000
        }
      });
    }
    
    // Android 네이티브 위치 추적 시작
    if ((window as any).SmapApp?.startLocationTracking) {
      console.log('🤖 [LOCATION TRACKING] Android 네이티브 위치 추적 요청');
      (window as any).SmapApp.startLocationTracking();
    }
  }

  private startWebLocationTracking(options: any) {
    // 서버 사이드 렌더링 체크
    if (typeof window === 'undefined') {
      console.log('📍 [LOCATION TRACKING] 서버 사이드 렌더링 환경 - 웹 위치 추적 건너뜀');
      return;
    }
    
    console.log('🌐 [LOCATION TRACKING] 웹 브라우저 위치 추적 시작');
    
    if (!navigator.geolocation) {
      console.error('📍 [LOCATION TRACKING] Geolocation API 지원하지 않음');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || 0,
          altitude: position.coords.altitude || 0,
          timestamp: position.timestamp,
          source: 'web-browser'
        };
        
        this.handleLocationUpdate(locationData);
      },
      (error) => {
        console.error('📍 [LOCATION TRACKING] 웹 위치 추적 오류:', error);
        this.errorCallbacks.forEach(callback => callback(error));
      },
      options
    );
  }

  public stopTracking() {
    // 서버 사이드 렌더링 체크
    if (typeof window === 'undefined') {
      console.log('📍 [LOCATION TRACKING] 서버 사이드 렌더링 환경 - 위치 추적 중지 건너뜀');
      return;
    }
    
    if (!this.isTracking) {
      console.log('📍 [LOCATION TRACKING] 추적 중이 아닙니다');
      return;
    }

    console.log('📍 [LOCATION TRACKING] 위치 추적 중지');

    // 웹 브라우저 위치 추적 중지
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // 네이티브 앱 위치 추적 중지
    if ((window as any).webkit?.messageHandlers?.smapIos) {
      (window as any).webkit.messageHandlers.smapIos.postMessage({
        type: 'stopLocationTracking'
      });
    }

    if ((window as any).SmapApp?.stopLocationTracking) {
      (window as any).SmapApp.stopLocationTracking();
    }

    this.isTracking = false;
    console.log('✅ [LOCATION TRACKING] 위치 추적 중지됨');
  }

  public onLocationUpdate(callback: (location: LocationData) => void) {
    this.updateCallbacks.push(callback);
  }

  public onError(callback: (error: any) => void) {
    this.errorCallbacks.push(callback);
  }

  public getLastLocation(): LocationData | null {
    return this.lastLocation;
  }

  public isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  // 사용자 정보가 로드되었을 때 호출 (외부에서 사용)
  public onUserLogin() {
    // 서버 사이드 렌더링 체크
    if (typeof window === 'undefined') {
      return;
    }
    
    console.log('📍 [LOCATION TRACKING] 사용자 로그인 감지 - 위치 데이터 확인');
    this.checkAndSendPendingLocations();
  }
}

// 싱글톤 인스턴스 생성
export const locationTrackingService = new LocationTrackingService();
export default locationTrackingService; 