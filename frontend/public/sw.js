// SMAP 지도 최적화 서비스 워커
const CACHE_NAME = 'smap-maps-cache-v1.2';
const MAP_CACHE_NAME = 'smap-map-tiles-v1.2';
const API_CACHE_NAME = 'smap-api-cache-v1.2';

// 캐시할 정적 리소스들
const STATIC_RESOURCES = [
  '/',
  '/home',
  '/logs',
  '/location',
  '/manifest.json',
  // 지도 관련 스크립트들 (동적으로 로드되므로 여기서는 제외)
];

// 지도 타일 URL 패턴들
const MAP_TILE_PATTERNS = [
  // 네이버 지도 타일
  /https:\/\/.*\.pstatic\.net\/.*\/maps\//,
  /https:\/\/.*navermaps.*\.(png|jpg|jpeg)/i,
  
  // 구글 지도 타일  
  /https:\/\/maps\.googleapis\.com\/maps\/api\//,
  /https:\/\/.*\.googleapis\.com\/.*\.(png|jpg|jpeg)/i,
  /https:\/\/maps\.gstatic\.com\//,
  
  // 카카오 지도 타일
  /https:\/\/.*kakaocdn.*\.(png|jpg|jpeg)/i,
  
  // 기타 지도 리소스
  /\.(png|jpg|jpeg|gif|svg)$/i
];

// API 응답 캐시 패턴들
const API_CACHE_PATTERNS = [
  /\/api\/location-logs\//,
  /\/api\/groups\//,
  /\/api\/members\//
];

// 설치 이벤트 - 기본 리소스 캐시
self.addEventListener('install', (event) => {
  console.log('[SW] 서비스 워커 설치 중...');
  
  event.waitUntil(
    Promise.all([
      // 정적 리소스 캐시
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] 정적 리소스 캐시 중...');
        return cache.addAll(STATIC_RESOURCES);
      }),
      // 빈 지도 타일 캐시 생성
      caches.open(MAP_CACHE_NAME).then(() => {
        console.log('[SW] 지도 타일 캐시 준비 완료');
      }),
      // 빈 API 캐시 생성
      caches.open(API_CACHE_NAME).then(() => {
        console.log('[SW] API 캐시 준비 완료');
      })
    ]).then(() => {
      console.log('[SW] 서비스 워커 설치 완료');
      self.skipWaiting(); // 즉시 활성화
    })
  );
});

// 활성화 이벤트 - 오래된 캐시 정리
self.addEventListener('activate', (event) => {
  console.log('[SW] 서비스 워커 활성화 중...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 현재 버전이 아닌 캐시들 삭제
          if (cacheName !== CACHE_NAME && 
              cacheName !== MAP_CACHE_NAME && 
              cacheName !== API_CACHE_NAME) {
            console.log('[SW] 오래된 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] 서비스 워커 활성화 완료');
      return self.clients.claim(); // 즉시 제어권 획득
    })
  );
});

// 네트워크 요청 인터셉트
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 지도 타일 요청 처리
  if (isMapTileRequest(url.href)) {
    event.respondWith(handleMapTileRequest(request));
    return;
  }
  
  // API 요청 처리 
  if (isAPIRequest(url.href)) {
    event.respondWith(handleAPIRequest(request));
    return;
  }
  
  // 정적 리소스 요청 처리
  if (request.method === 'GET') {
    event.respondWith(handleStaticRequest(request));
  }
});

// 지도 타일 요청인지 확인
function isMapTileRequest(url) {
  return MAP_TILE_PATTERNS.some(pattern => pattern.test(url));
}

// API 요청인지 확인
function isAPIRequest(url) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url));
}

// 지도 타일 요청 처리 - Stale While Revalidate 전략
async function handleMapTileRequest(request) {
  const cache = await caches.open(MAP_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // 캐시된 응답이 있으면 즉시 반환하고 백그라운드에서 업데이트
  if (cachedResponse) {
    // 백그라운드에서 새로운 데이터 가져오기
    fetch(request).then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
    }).catch(() => {
      // 네트워크 오류는 무시 (캐시된 데이터 사용)
    });
    
    return cachedResponse;
  }
  
  // 캐시에 없으면 네트워크에서 가져오고 캐시에 저장
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] 지도 타일 로드 실패:', request.url);
    // 오프라인 상태에서는 기본 이미지 반환
    return new Response('', { status: 404 });
  }
}

// API 요청 처리 - Cache First 전략 (단기 캐시)
async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // 캐시가 있고 5분 이내면 캐시 사용
  if (cachedResponse) {
    const cacheDate = new Date(cachedResponse.headers.get('sw-cached-date') || 0);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (now.getTime() - cacheDate.getTime() < fiveMinutes) {
      console.log('[SW] API 캐시 사용:', request.url);
      return cachedResponse;
    }
  }
  
  // 네트워크에서 새 데이터 가져오기
  try {
    const response = await fetch(request);
    if (response.ok) {
      // 응답 헤더에 캐시 시간 추가
      const responseClone = response.clone();
      const responseBody = await responseClone.text();
      const newResponse = new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'sw-cached-date': new Date().toISOString()
        }
      });
      
      cache.put(request, newResponse.clone());
      return newResponse;
    }
    return response;
  } catch (error) {
    // 네트워크 오류 시 캐시된 데이터 반환 (오래되었더라도)
    if (cachedResponse) {
      console.log('[SW] 네트워크 오류, 캐시된 API 응답 사용:', request.url);
      return cachedResponse;
    }
    throw error;
  }
}

// 정적 리소스 요청 처리 - Cache First 전략
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // 오프라인 상태에서 기본 페이지 반환
    if (request.destination === 'document') {
      return cache.match('/');
    }
    throw error;
  }
}

// 캐시 크기 관리 (메모리 사용량 제한)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      Promise.all([
        caches.delete(MAP_CACHE_NAME),
        caches.delete(API_CACHE_NAME)
      ]).then(() => {
        console.log('[SW] 캐시 수동 정리 완료');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

// 주기적으로 오래된 캐시 정리 (1시간마다)
setInterval(async () => {
  const cache = await caches.open(API_CACHE_NAME);
  const requests = await cache.keys();
  const now = new Date();
  const oneHour = 60 * 60 * 1000;
  
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const cacheDate = new Date(response.headers.get('sw-cached-date') || 0);
      if (now.getTime() - cacheDate.getTime() > oneHour) {
        await cache.delete(request);
      }
    }
  }
  
  console.log('[SW] 오래된 API 캐시 정리 완료');
}, 60 * 60 * 1000); // 1시간마다 실행 