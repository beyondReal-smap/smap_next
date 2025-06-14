// SMAP 최적화 서비스 워커 v2.0
const CACHE_VERSION = '2.0.0';
const CACHE_NAME = `smap-static-v${CACHE_VERSION}`;
const MAP_CACHE_NAME = `smap-maps-v${CACHE_VERSION}`;
const API_CACHE_NAME = `smap-api-v${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `smap-runtime-v${CACHE_VERSION}`;

// 캐시 전략 설정
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
};

// 캐시할 정적 리소스들
const STATIC_RESOURCES = [
  '/',
  '/offline',
  '/manifest.json'
];

// 런타임 캐시 규칙
const RUNTIME_CACHE_RULES = [
  {
    urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
    handler: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE,
    options: {
      cacheName: 'google-fonts-stylesheets',
      expiration: {
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365 // 1년
      }
    }
  },
  {
    urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
    handler: CACHE_STRATEGIES.CACHE_FIRST,
    options: {
      cacheName: 'google-fonts-webfonts',
      expiration: {
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365 // 1년
      }
    }
  },
  {
    urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/,
    handler: CACHE_STRATEGIES.CACHE_FIRST,
    options: {
      cacheName: 'images',
      expiration: {
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30 // 30일
      }
    }
  },
  {
    urlPattern: /\.(?:js|css)$/,
    handler: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE,
    options: {
      cacheName: 'static-resources',
      expiration: {
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7 // 7일
      }
    }
  }
];

// 지도 타일 URL 패턴들
const MAP_TILE_PATTERNS = [
  /https:\/\/.*\.pstatic\.net\/.*\/maps\//,
  /https:\/\/.*navermaps.*\.(png|jpg|jpeg|webp)/i,
  /https:\/\/maps\.googleapis\.com\/maps\/api\//,
  /https:\/\/.*\.googleapis\.com\/.*\.(png|jpg|jpeg|webp)/i,
  /https:\/\/maps\.gstatic\.com\//,
  /https:\/\/.*kakaocdn.*\.(png|jpg|jpeg|webp)/i
];

// API 캐시 패턴들
const API_CACHE_PATTERNS = [
  { pattern: /\/api\/location-logs\//, ttl: 5 * 60 * 1000 }, // 5분
  { pattern: /\/api\/groups\//, ttl: 10 * 60 * 1000 }, // 10분
  { pattern: /\/api\/members\//, ttl: 15 * 60 * 1000 }, // 15분
  { pattern: /\/api\/orders\//, ttl: 30 * 60 * 1000 } // 30분
];

// 성능 모니터링
const PERFORMANCE_MARKS = {
  SW_INSTALL_START: 'sw-install-start',
  SW_INSTALL_END: 'sw-install-end',
  SW_ACTIVATE_START: 'sw-activate-start',
  SW_ACTIVATE_END: 'sw-activate-end'
};

// 설치 이벤트 - 향상된 캐싱 전략
self.addEventListener('install', (event) => {
  console.log('[SW] 서비스 워커 v2.0 설치 시작');
  performance.mark(PERFORMANCE_MARKS.SW_INSTALL_START);
  
  event.waitUntil(
    Promise.all([
      // 정적 리소스 프리캐싱
      precacheStaticResources(),
      // 캐시 스토리지 초기화
      initializeCacheStorages(),
      // 백그라운드 동기화 등록
      registerBackgroundSync()
    ]).then(() => {
      performance.mark(PERFORMANCE_MARKS.SW_INSTALL_END);
      performance.measure('sw-install-duration', 
        PERFORMANCE_MARKS.SW_INSTALL_START, 
        PERFORMANCE_MARKS.SW_INSTALL_END
      );
      console.log('[SW] 서비스 워커 설치 완료');
      return self.skipWaiting();
    }).catch(error => {
      console.error('[SW] 설치 중 오류:', error);
    })
  );
});

// 활성화 이벤트 - 캐시 정리 및 클라이언트 제어
self.addEventListener('activate', (event) => {
  console.log('[SW] 서비스 워커 활성화 시작');
  performance.mark(PERFORMANCE_MARKS.SW_ACTIVATE_START);
  
  event.waitUntil(
    Promise.all([
      // 오래된 캐시 정리
      cleanupOldCaches(),
      // 클라이언트 제어권 획득
      self.clients.claim(),
      // 캐시 크기 최적화
      optimizeCacheSizes()
    ]).then(() => {
      performance.mark(PERFORMANCE_MARKS.SW_ACTIVATE_END);
      performance.measure('sw-activate-duration',
        PERFORMANCE_MARKS.SW_ACTIVATE_START,
        PERFORMANCE_MARKS.SW_ACTIVATE_END
      );
      console.log('[SW] 서비스 워커 활성화 완료');
    }).catch(error => {
      console.error('[SW] 활성화 중 오류:', error);
    })
  );
});

// 네트워크 요청 인터셉트 - 향상된 라우팅
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 크롬 확장 프로그램 요청 무시
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // 지도 타일 요청
  if (isMapTileRequest(url.href)) {
    event.respondWith(handleMapTileRequest(request));
    return;
  }
  
  // API 요청
  if (isAPIRequest(url.href)) {
    event.respondWith(handleAPIRequest(request));
    return;
  }
  
  // 런타임 캐시 규칙 적용
  const matchedRule = findMatchingCacheRule(url.href);
  if (matchedRule) {
    event.respondWith(handleRuntimeCache(request, matchedRule));
    return;
  }
  
  // 네비게이션 요청 (SPA 라우팅)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }
  
  // 기본 네트워크 요청
  if (request.method === 'GET') {
    event.respondWith(handleDefaultRequest(request));
  }
});

// 백그라운드 동기화
self.addEventListener('sync', (event) => {
  console.log('[SW] 백그라운드 동기화:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// 푸시 알림
self.addEventListener('push', (event) => {
  console.log('[SW] 푸시 알림 수신');
  
  const options = {
    body: event.data ? event.data.text() : '새로운 알림이 있습니다.',
    icon: '/icon?size=192',
    badge: '/icon?size=72',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '확인',
        icon: '/icon?size=128'
      },
      {
        action: 'close',
        title: '닫기',
        icon: '/icon?size=128'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('스맵', options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 알림 클릭:', event.action);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// 유틸리티 함수들

// 정적 리소스 프리캐싱
async function precacheStaticResources() {
  const cache = await caches.open(CACHE_NAME);
  
  for (const resource of STATIC_RESOURCES) {
    try {
      await cache.add(resource);
      console.log('[SW] 프리캐시 성공:', resource);
    } catch (error) {
      console.warn('[SW] 프리캐시 실패:', resource, error.message);
    }
  }
}

// 캐시 스토리지 초기화
async function initializeCacheStorages() {
  await Promise.all([
    caches.open(MAP_CACHE_NAME),
    caches.open(API_CACHE_NAME),
    caches.open(RUNTIME_CACHE_NAME)
  ]);
}

// 백그라운드 동기화 등록
async function registerBackgroundSync() {
  if (typeof self !== 'undefined' && self.registration && 'sync' in self.registration) {
    try {
      await self.registration.sync.register('background-sync');
      console.log('[SW] 백그라운드 동기화 등록 완료');
    } catch (error) {
      console.warn('[SW] 백그라운드 동기화 등록 실패:', error);
    }
  }
}

// 오래된 캐시 정리
async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const currentCaches = [CACHE_NAME, MAP_CACHE_NAME, API_CACHE_NAME, RUNTIME_CACHE_NAME];
  
  await Promise.all(
    cacheNames.map(cacheName => {
      if (!currentCaches.includes(cacheName)) {
        console.log('[SW] 오래된 캐시 삭제:', cacheName);
        return caches.delete(cacheName);
      }
    })
  );
}

// 캐시 크기 최적화
async function optimizeCacheSizes() {
  const cacheNames = await caches.keys();
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    // 캐시 항목이 너무 많으면 오래된 것부터 삭제
    if (keys.length > 100) {
      const keysToDelete = keys.slice(0, keys.length - 100);
      await Promise.all(keysToDelete.map(key => cache.delete(key)));
      console.log(`[SW] ${cacheName} 캐시 최적화: ${keysToDelete.length}개 항목 삭제`);
    }
  }
}

// 지도 타일 요청 확인
function isMapTileRequest(url) {
  return MAP_TILE_PATTERNS.some(pattern => pattern.test(url));
}

// API 요청 확인
function isAPIRequest(url) {
  return API_CACHE_PATTERNS.some(({ pattern }) => pattern.test(url));
}

// 런타임 캐시 규칙 찾기
function findMatchingCacheRule(url) {
  return RUNTIME_CACHE_RULES.find(rule => rule.urlPattern.test(url));
}

// 지도 타일 요청 처리 - Stale While Revalidate
async function handleMapTileRequest(request) {
  const cache = await caches.open(MAP_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  
  return cachedResponse || fetchPromise || new Response('', { status: 404 });
}

// API 요청 처리 - 스마트 캐싱
async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  const url = request.url;
  
  // TTL 확인
  const cacheRule = API_CACHE_PATTERNS.find(({ pattern }) => pattern.test(url));
  const ttl = cacheRule ? cacheRule.ttl : 5 * 60 * 1000; // 기본 5분
  
  if (cachedResponse) {
    const cacheDate = new Date(cachedResponse.headers.get('sw-cached-date') || 0);
    const isExpired = Date.now() - cacheDate.getTime() > ttl;
    
    if (!isExpired) {
      return cachedResponse;
    }
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
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
    return cachedResponse || new Response(JSON.stringify({ error: 'Network error' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 런타임 캐시 처리
async function handleRuntimeCache(request, rule) {
  const cache = await caches.open(rule.options.cacheName);
  
  switch (rule.handler) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      return handleCacheFirst(request, cache);
    case CACHE_STRATEGIES.NETWORK_FIRST:
      return handleNetworkFirst(request, cache);
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      return handleStaleWhileRevalidate(request, cache);
    default:
      return fetch(request);
  }
}

// Cache First 전략
async function handleCacheFirst(request, cache) {
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

// Network First 전략
async function handleNetworkFirst(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    return cachedResponse || new Response('', { status: 404 });
  }
}

// Stale While Revalidate 전략
async function handleStaleWhileRevalidate(request, cache) {
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  
  return cachedResponse || fetchPromise;
}

// 네비게이션 요청 처리 (SPA)
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match('/');
    return cachedResponse || new Response('오프라인 상태입니다.', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

// 기본 요청 처리
async function handleDefaultRequest(request) {
  const cache = await caches.open(RUNTIME_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // 백그라운드에서 업데이트
    fetch(request).then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
    }).catch(() => {});
    
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('', { status: 404 });
  }
}

// 백그라운드 동기화 작업
async function doBackgroundSync() {
  console.log('[SW] 백그라운드 동기화 실행');
  
  // 오프라인 상태에서 저장된 요청들 처리
  // 캐시 정리
  // 성능 데이터 수집 등
  
  try {
    await optimizeCacheSizes();
    console.log('[SW] 백그라운드 동기화 완료');
  } catch (error) {
    console.error('[SW] 백그라운드 동기화 실패:', error);
    throw error;
  }
}

// 성능 모니터링 리포트
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_PERFORMANCE_REPORT') {
    const performanceEntries = performance.getEntriesByType('measure');
    event.ports[0].postMessage({
      type: 'PERFORMANCE_REPORT',
      data: performanceEntries
    });
  }
});

console.log('[SW] 서비스 워커 v2.0 로드 완료'); 