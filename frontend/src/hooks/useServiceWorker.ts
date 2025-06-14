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
        
        // 개발 환경 감지
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        // 서비스 워커 등록 (개발 환경에서는 더 관대한 설정)
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
          updateViaCache: isDevelopment ? 'none' : 'imports', // 개발 환경에서는 캐시 비활성화
        });

        console.log(`[ServiceWorker] 서비스 워커 등록 성공 (${isDevelopment ? '개발' : '프로덕션'} 모드):`, registration.scope);

        // 개발 환경에서는 자동 업데이트 확인
        if (isDevelopment) {
          // 개발 환경에서는 즉시 업데이트 확인
          registration.update();
          
          // 5초마다 업데이트 확인 (개발 중 변경사항 반영)
          const updateInterval = setInterval(() => {
            registration.update();
          }, 5000);

          // 컴포넌트 언마운트 시 인터벌 정리
          return () => clearInterval(updateInterval);
        }

        // 서비스 워커 업데이트 확인
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            console.log('[ServiceWorker] 새로운 서비스 워커 설치 중...');
            
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[ServiceWorker] 새로운 버전 사용 가능');
                  
                  // 개발 환경에서는 자동 새로고침
                  if (isDevelopment) {
                    console.log('[ServiceWorker] 개발 환경 - 자동 새로고침');
                    window.location.reload();
                  } else {
                    console.log('[ServiceWorker] 프로덕션 환경 - 새로고침 권장');
                    // 프로덕션에서는 사용자에게 알림
                  }
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

        // 개발 환경에서 에러 처리 강화
        if (isDevelopment) {
          navigator.serviceWorker.addEventListener('error', (error) => {
            console.warn('[ServiceWorker] 개발 환경 서비스 워커 오류 (무시됨):', error);
          });

          // 개발 환경에서 서비스 워커 메시지 로깅
          navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('[ServiceWorker] 메시지 수신:', event.data);
          });
        }

      } catch (error) {
        console.error('[ServiceWorker] 서비스 워커 등록 실패:', error);
        
        // 개발 환경에서는 오류를 무시하고 계속 진행
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ServiceWorker] 개발 환경에서 서비스 워커 오류 무시');
        }
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
          const timeout = setTimeout(() => {
            reject(new Error('캐시 정리 타임아웃'));
          }, 5000);

          messageChannel.port1.onmessage = (event) => {
            clearTimeout(timeout);
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

  // 서비스 워커 강제 업데이트
  const forceUpdate = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          console.log('[ServiceWorker] 강제 업데이트 완료');
          return true;
        }
      } catch (error) {
        console.error('[ServiceWorker] 강제 업데이트 실패:', error);
      }
    }
    return false;
  };

  // 서비스 워커 해제 (개발 환경용)
  const unregister = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.unregister();
          console.log('[ServiceWorker] 서비스 워커 해제 완료');
          return true;
        }
      } catch (error) {
        console.error('[ServiceWorker] 서비스 워커 해제 실패:', error);
      }
    }
    return false;
  };

  return {
    clearCache,
    forceUpdate,
    unregister
  };
}; 