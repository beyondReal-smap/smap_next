'use client';

import React, { useEffect, useState } from 'react';

interface MapDebuggerProps {
  isVisible?: boolean;
}

const MapDebugger: React.FC<MapDebuggerProps> = ({ isVisible = false }) => {
  const [debugInfo, setDebugInfo] = useState({
    isIOSWebView: false,
    naverMapsLoaded: false,
    googleMapsLoaded: false,
    networkStatus: 'unknown',
    userAgent: '',
    currentUrl: '',
    mapContainers: 0
  });

  useEffect(() => {
    const updateDebugInfo = () => {
      const isIOSWebView = !!(window as any).webkit && !!(window as any).webkit.messageHandlers;
      const naverMapsLoaded = !!(window as any).naver && !!(window as any).naver.maps;
      const googleMapsLoaded = !!(window as any).google && !!(window as any).google.maps;
      const networkStatus = navigator.onLine ? 'online' : 'offline';
      const userAgent = navigator.userAgent;
      const currentUrl = window.location.href;
      const mapContainers = document.querySelectorAll('[id*="map"], .map-container').length;

      setDebugInfo({
        isIOSWebView,
        naverMapsLoaded,
        googleMapsLoaded,
        networkStatus,
        userAgent,
        currentUrl,
        mapContainers
      });
    };

    updateDebugInfo();
    
    // 주기적으로 업데이트
    const interval = setInterval(updateDebugInfo, 2000);
    
    return () => clearInterval(interval);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg text-xs max-w-sm z-[10000]">
      <h3 className="font-bold mb-2">지도 디버그 정보</h3>
      <div className="space-y-1">
        <div>iOS WebView: {debugInfo.isIOSWebView ? '✅' : '❌'}</div>
        <div>Naver Maps: {debugInfo.naverMapsLoaded ? '✅' : '❌'}</div>
        <div>Google Maps: {debugInfo.googleMapsLoaded ? '✅' : '❌'}</div>
        <div>네트워크: {debugInfo.networkStatus}</div>
        <div>지도 컨테이너: {debugInfo.mapContainers}개</div>
        <div className="text-xs opacity-75 mt-2">
          URL: {debugInfo.currentUrl.substring(0, 50)}...
        </div>
        <div className="text-xs opacity-75">
          UA: {debugInfo.userAgent.substring(0, 50)}...
        </div>
      </div>
    </div>
  );
};

export default MapDebugger; 