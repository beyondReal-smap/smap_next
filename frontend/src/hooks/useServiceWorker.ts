'use client';

import { useEffect, useRef } from 'react';

export const useServiceWorker = () => {
  const hasRegistered = useRef(false);

  useEffect(() => {
    // 서비스 워커가 지원되는지 확인
    if (!('serviceWorker' in navigator) || hasRegistered.current) {
      return;
    }

    hasRegistered.current = true;

    const registerServiceWorker = async () => {
      try {
        console.log('[ServiceWorker] 서비스 워커 등록 시작');
        
        // 서비스 워커 등록
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        console.log('[ServiceWorker] 서비스 워커 등록 성공:', registration.scope);

        // 서비스 워커 업데이트 확인
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            console.log('[ServiceWorker] 새로운 서비스 워커 설치 중...');
            
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[ServiceWorker] 새로운 버전 사용 가능 - 새로고침 권장');
                  // 필요시 사용자에게 새로고침 알림
                } else {
                  console.log('[ServiceWorker] 컨텐츠가 오프라인 사용을 위해 캐시됨');
                }
              }
            });
          }
        });

        // 서비스 워커가 제어권을 획득했을 때
        if (registration.active) {
          console.log('[ServiceWorker] 서비스 워커가 활성화됨 - 캐싱 활성화');
        }

      } catch (error) {
        console.error('[ServiceWorker] 서비스 워커 등록 실패:', error);
      }
    };

    // 페이지 로드 완료 후 서비스 워커 등록 (성능 최적화)
    if (document.readyState === 'complete') {
      registerServiceWorker();
    } else {
      window.addEventListener('load', registerServiceWorker);
    }

    return () => {
      window.removeEventListener('load', registerServiceWorker);
    };
  }, []);

  // 캐시 수동 정리 함수
  const clearCache = async () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        const messageChannel = new MessageChannel();
        
        return new Promise((resolve, reject) => {
          messageChannel.port1.onmessage = (event) => {
            if (event.data.success) {
              console.log('[ServiceWorker] 캐시 정리 완료');
              resolve(true);
            } else {
              reject(new Error('캐시 정리 실패'));
            }
          };

          navigator.serviceWorker.controller!.postMessage(
            { type: 'CLEAR_CACHE' },
            [messageChannel.port2]
          );
        });
      } catch (error) {
        console.error('[ServiceWorker] 캐시 정리 오류:', error);
        return false;
      }
    }
    return false;
  };

  return {
    clearCache
  };
}; 