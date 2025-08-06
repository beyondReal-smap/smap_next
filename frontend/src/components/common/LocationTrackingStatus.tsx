'use client';

import { useState, useEffect } from 'react';
import locationTrackingService from '@/services/locationTrackingService';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  altitude?: number;
  timestamp: number;
  source: string;
}

export default function LocationTrackingStatus() {
  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 위치 추적 상태 확인
    const checkTrackingStatus = () => {
      setIsTracking(locationTrackingService.isCurrentlyTracking());
      setLastLocation(locationTrackingService.getLastLocation());
    };

    // 초기 상태 확인
    checkTrackingStatus();

    // 위치 업데이트 콜백 등록
    const handleLocationUpdate = (location: LocationData) => {
      setLastLocation(location);
      setError(null);
    };

    // 에러 콜백 등록
    const handleError = (error: any) => {
      setError(error.message || '위치 추적 오류');
    };

    locationTrackingService.onLocationUpdate(handleLocationUpdate);
    locationTrackingService.onError(handleError);

    // 주기적으로 상태 확인
    const interval = setInterval(checkTrackingStatus, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'ios-native-continuous':
        return 'iOS 네이티브';
      case 'android-native-continuous':
        return 'Android 네이티브';
      case 'web-browser':
        return '웹 브라우저';
      default:
        return source;
    }
  };

  if (!isTracking) {
    return (
      <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-2 rounded-lg shadow-lg z-50">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">위치 추적 대기 중</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-800 px-3 py-2 rounded-lg shadow-lg z-50 max-w-xs">
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm font-medium">위치 추적 중</span>
      </div>
      
      {lastLocation && (
        <div className="text-xs space-y-1">
          <div>📍 {lastLocation.latitude.toFixed(6)}, {lastLocation.longitude.toFixed(6)}</div>
          <div>🎯 정확도: {lastLocation.accuracy?.toFixed(1)}m</div>
          <div>🚀 속도: {lastLocation.speed?.toFixed(1)}m/s</div>
          <div>📱 소스: {getSourceLabel(lastLocation.source)}</div>
          <div>⏰ {formatTime(lastLocation.timestamp)}</div>
        </div>
      )}
      
      {error && (
        <div className="text-xs text-red-600 mt-1">
          ❌ {error}
        </div>
      )}
    </div>
  );
} 