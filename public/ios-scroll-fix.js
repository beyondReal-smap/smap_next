// iOS WebView 스크롤 완전 차단 스크립트
(function() {
  'use strict';
  
  console.log('[iOS-SCROLL-FIX] 스크롤 차단 스크립트 시작');
  
  // iOS WebView 감지
  const isIOSWebView = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                       window.webkit && 
                       window.webkit.messageHandlers;
  
  if (isIOSWebView) {
    console.log('[iOS-SCROLL-FIX] iOS WebView 감지 - 스크롤 차단 적용');
    
    // 1. 모든 스크롤 이벤트 차단
    const preventScroll = function(e) {
      // 지도 컨테이너는 예외 처리
      const target = e.target;
      const isMapContainer = target.closest('.map-container, .full-map-container, #googleMapContainer, #naverMapContainer');
      
      if (!isMapContainer) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };
    
    // 2. 터치 이벤트 차단 (스크롤 방지)
    const preventTouchScroll = function(e) {
      const target = e.target;
      const isMapContainer = target.closest('.map-container, .full-map-container, #googleMapContainer, #naverMapContainer');
      const isScrollableContent = target.closest('.scrollable-content');
      
      // 지도 컨테이너나 명시적으로 스크롤 허용된 컨테이너가 아닌 경우 차단
      if (!isMapContainer && !isScrollableContent) {
        e.preventDefault();
        return false;
      }
    };
    
    // 3. 휠 이벤트 차단
    const preventWheel = function(e) {
      const target = e.target;
      const isMapContainer = target.closest('.map-container, .full-map-container, #googleMapContainer, #naverMapContainer');
      
      if (!isMapContainer) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };
    
    // 4. 키보드 스크롤 차단
    const preventKeyScroll = function(e) {
      const scrollKeys = [32, 33, 34, 35, 36, 37, 38, 39, 40]; // space, page up/down, end, home, arrows
      if (scrollKeys.includes(e.keyCode)) {
        e.preventDefault();
        return false;
      }
    };
    
    // 이벤트 리스너 등록
    document.addEventListener('scroll', preventScroll, { passive: false });
    document.addEventListener('touchstart', preventTouchScroll, { passive: false });
    document.addEventListener('touchmove', preventTouchScroll, { passive: false });
    document.addEventListener('wheel', preventWheel, { passive: false });
    document.addEventListener('keydown', preventKeyScroll, { passive: false });
    
    // window 스크롤도 차단
    window.addEventListener('scroll', preventScroll, { passive: false });
    
    // 5. 스크롤 위치 강제 고정
    let scrollTop = 0;
    let scrollLeft = 0;
    
    const lockScroll = function() {
      if (window.scrollY !== scrollTop || window.scrollX !== scrollLeft) {
        window.scrollTo(scrollLeft, scrollTop);
      }
      if (document.documentElement.scrollTop !== scrollTop || document.documentElement.scrollLeft !== scrollLeft) {
        document.documentElement.scrollTop = scrollTop;
        document.documentElement.scrollLeft = scrollLeft;
      }
      if (document.body.scrollTop !== scrollTop || document.body.scrollLeft !== scrollLeft) {
        document.body.scrollTop = scrollTop;
        document.body.scrollLeft = scrollLeft;
      }
    };
    
    // 스크롤 위치 모니터링
    setInterval(lockScroll, 10);
    
    // 6. CSS로 추가 차단
    const style = document.createElement('style');
    style.textContent = `
      html, body {
        overflow: hidden !important;
        position: fixed !important;
        width: 100% !important;
        height: 100% !important;
        touch-action: none !important;
        -webkit-overflow-scrolling: auto !important;
      }
      
      #__next {
        overflow: hidden !important;
        position: fixed !important;
        width: 100% !important;
        height: 100% !important;
        touch-action: none !important;
      }
      
      .map-container, .full-map-container, #googleMapContainer, #naverMapContainer {
        touch-action: manipulation !important;
        overflow: visible !important;
      }
    `;
    document.head.appendChild(style);
    
    console.log('[iOS-SCROLL-FIX] 스크롤 차단 설정 완료');
  } else {
    console.log('[iOS-SCROLL-FIX] iOS WebView가 아님 - 스크립트 종료');
  }
})(); 