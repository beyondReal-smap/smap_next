'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hapticFeedback } from '../../../utils/haptic';

export default function BottomNavBar() {
  const pathname = usePathname();
  
  // 🔥 강화된 네비게이션 바 숨김 조건 - 먼저 체크
  const hiddenPages = ['/signin', '/register', '/login', '/social-login', '/'];
  const shouldHideNavBar = hiddenPages.some(page => pathname?.startsWith(page)) || pathname === '/';
  
  // 🔥 추가 런타임 안전 체크들
  const [isHidden, setIsHidden] = useState(true);
  
  React.useEffect(() => {
    if (typeof window === 'undefined') {
      setIsHidden(true);
      return;
    }
    
    // 다중 체크 시스템
    const checks = [
      // 1. pathname 체크
      hiddenPages.some(page => pathname?.startsWith(page)) || pathname === '/',
      // 2. window.location 체크
      hiddenPages.some(page => window.location.pathname?.startsWith(page)) || window.location.pathname === '/',
      // 3. HTML 속성 체크
      document.documentElement.getAttribute('data-signin') === 'true',
      document.body.getAttribute('data-page') === '/signin',
      document.body.classList.contains('signin-page'),
      document.body.classList.contains('hide-bottom-nav'),
      // 4. CSS 변수 체크
      getComputedStyle(document.body).getPropertyValue('--bottom-nav-display')?.trim() === 'none'
    ];
    
    const shouldHide = checks.some(check => check === true);
    
    console.log('[BottomNavBar] 숨김 체크:', {
      pathname,
      windowPath: window.location.pathname,
      dataSignin: document.documentElement.getAttribute('data-signin'),
      dataPage: document.body.getAttribute('data-page'),
      signinClass: document.body.classList.contains('signin-page'),
      hideNavClass: document.body.classList.contains('hide-bottom-nav'),
      cssVar: getComputedStyle(document.body).getPropertyValue('--bottom-nav-display'),
      shouldHide,
      checks
    });
    
    setIsHidden(shouldHide);
  }, [pathname, shouldHideNavBar]);
  
  // 🔥 1차 조건부 렌더링 - 가장 빠른 체크
  if (shouldHideNavBar) {
    console.log('[BottomNavBar] pathname 기반 숨김:', pathname);
    return null;
  }
  
  // 🔥 2차 조건부 렌더링 - 런타임 체크
  if (isHidden) {
    console.log('[BottomNavBar] 런타임 체크 기반 숨김');
    return null;
  }
  
  // 🔥 3차 조건부 렌더링 - window 객체 체크
  if (typeof window !== 'undefined') {
    const isSigninPage = window.location.pathname === '/signin' ||
                        window.location.pathname === '/register' ||
                        window.location.pathname === '/login' ||
                        window.location.pathname === '/social-login' ||
                        window.location.pathname === '/' ||
                        document.documentElement.getAttribute('data-signin') === 'true' ||
                        document.body.classList.contains('signin-page');
    if (isSigninPage) {
      console.log('[BottomNavBar] window 기반 숨김:', window.location.pathname);
      return null;
    }
  }
  
  // home 페이지 여부 확인
  const isHomePage = pathname === '/home';
  
  // 랜덤 깜빡임을 위한 상태
  const [randomDelays, setRandomDelays] = useState([0, 0, 0]);
  
  // 랜덤 딜레이 업데이트 (3-5초마다)
  useEffect(() => {
    const updateRandomDelays = () => {
      setRandomDelays([
        Math.random() * 2,
        Math.random() * 2.5,
        Math.random() * 1.8
      ]);
    };
    
    // 초기 설정
    updateRandomDelays();
    
    // 3-5초마다 랜덤하게 업데이트
    const interval = setInterval(() => {
      updateRandomDelays();
    }, 3000 + Math.random() * 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  // iOS 감지 및 body에 클래스 추가
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // iOS 디바이스일 때 body에 클래스 추가
      document.body.classList.add('ios-device');
    } else {
      document.body.classList.add('android-device');
    }
    
    return () => {
      document.body.classList.remove('ios-device', 'android-device');
    };
  }, []);
  
  // 네비게이션 바 마진 제거를 위한 전역 스타일
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      #bottom-navigation-bar * {
        margin: 0 !important;
        padding: 0 !important;
      }
      #bottom-navigation-bar {
        margin: 0 !important;
        padding: 0 !important;
      }
      #bottom-navigation-bar nav {
        margin: 0 !important;
        padding: 0 !important;
      }
      #bottom-navigation-bar a {
        margin: 0 !important;
        padding: 0 !important;
      }
      #bottom-navigation-bar div {
        margin: 0 !important;
        padding: 0 !important;
      }
      #bottom-navigation-bar span {
        margin: 0 !important;
        padding: 0 !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  // 네비게이션 메뉴 아이템
  const navItems = [
    { name: '홈', path: '/home', icon: 'home' },
    { name: '그룹', path: '/group', icon: 'users' },
    { name: '일정', path: '/schedule', icon: 'calendar' },
    { name: '내장소', path: '/location', icon: 'map-pin' },
    { name: '활동 로그', path: '/logs', icon: 'document' },
  ];

  // 네비게이션 메뉴 클릭 핸들러
  const handleNavClick = (item: { name: string; path: string; icon: string }) => {
    // 현재 페이지가 아닌 경우에만 햅틱 피드백 실행
    if (pathname !== item.path) {
      hapticFeedback.menuSelect({
        component: 'BottomNavBar',
        menuName: item.name,
        menuPath: item.path,
        currentPath: pathname,
        iconType: item.icon
      });
    }
  };

  console.log('[BottomNavBar] 렌더링 진행:', { pathname, isHidden });

  return (
    <div 
      className="fixed left-0 right-0 bg-white border-t shadow-xl z-[999] rounded-t-2xl m-0 p-0"
      id="bottom-navigation-bar"
      style={{
        bottom: '0px',
        position: 'fixed',
        left: '0px',
        right: '0px',
        zIndex: 999999,
        margin: '0 !important',
        padding: '0 !important',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around'
      }}
    >
        {navItems.map(({ name, path, icon }) => {
          const isActive = pathname === path;
          
          return (
            <Link 
              key={path}
              href={path}
              onClick={() => handleNavClick({ name, path, icon })}
              className="flex flex-col items-center justify-center transition-colors duration-200 flex-1 min-w-0 m-0 p-0 h-full"
              style={{ 
                margin: '0 !important', 
                padding: '0 !important',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
                <div 
                  className="relative flex flex-col items-center justify-center m-0 p-0" 
                  style={{ 
                    margin: '0 !important', 
                    padding: '0 !important',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px'
                  }}
                >
                {/* 아이콘 컨테이너 */}
                <div 
                  className="w-5 h-5 flex items-center justify-center relative m-0 p-0"
                  style={{ 
                    color: isActive ? '#0113A3' : '#6b7280',
                    transform: 'none',
                    margin: '0 !important',
                    padding: '0 !important',
                    filter: isActive ? 'drop-shadow(0 0 4px rgba(1, 19, 163, 0.3))' : 'none',
                    animation: isActive ? 'icon-glow 2s ease-in-out infinite alternate' : 'none'
                  }}
                >
                  {/* 선택된 아이템 배경 표시 */}
                  {isActive && (
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{ 
                        background: 'radial-gradient(circle, rgba(1, 19, 163, 0.1) 0%, transparent 70%)',
                        animation: 'gentle-glow 2s ease-in-out infinite alternate',
                        WebkitAnimation: 'gentle-glow 2s ease-in-out infinite alternate'
                      }}
                    />
                  )}
                  
                  {/* 랜덤 깜빡이는 점 효과 */}
                  {isActive && (
                    <>
                      <div
                        className="absolute random-blink-dot"
                        style={{
                          top: '-4px',
                          right: '-4px',
                          width: '4px',
                          height: '4px',
                          background: '#0113A3',
                          borderRadius: '50%',
                          animation: 'randomBlink 2s infinite',
                          animationDelay: `${randomDelays[0]}s`
                        }}
                      />
                      <div
                        className="absolute random-blink-dot"
                        style={{
                          top: '12px',
                          left: '-6px',
                          width: '3px',
                          height: '3px',
                          background: '#0113A3',
                          borderRadius: '50%',
                          animation: 'randomBlink 2.5s infinite',
                          animationDelay: `${randomDelays[1]}s`
                        }}
                      />
                      <div
                        className="absolute random-blink-dot"
                        style={{
                          bottom: '-2px',
                          right: '-2px',
                          width: '2px',
                          height: '2px',
                          background: '#0113A3',
                          borderRadius: '50%',
                          animation: 'randomBlink 1.8s infinite',
                          animationDelay: `${randomDelays[2]}s`
                        }}
                      />
                    </>
                  )}
                  
                  {/* 홈 아이콘 */}
                  {icon === 'home' && (
                    <svg 
                      className="w-5 h-5 relative z-10" 
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
                      <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
                    </svg>
                  )}
                  
                  {/* 사용자들 아이콘 */}
                  {icon === 'users' && (
                    <svg 
                      className="w-5 h-5 relative z-10" 
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157l.001.003Z" />
                    </svg>
                  )}
                  
                  {/* 달력 아이콘 */}
                  {icon === 'calendar' && (
                    <svg 
                      className="w-5 h-5 relative z-10" 
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
                      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75ZM5.25 6A1.5 1.5 0 0 0 3.75 7.5v11.25A1.5 1.5 0 0 0 5.25 20.25h13.5A1.5 1.5 0 0 0 20.25 18.75V7.5A1.5 1.5 0 0 0 18.75 6H5.25Z" clipRule="evenodd" />
                    </svg>
                  )}
                  
                  {/* 지도 핀 아이콘 */}
                  {icon === 'map-pin' && (
                    <svg 
                      className="w-5 h-5 relative z-10" 
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                    </svg>
                  )}
                  
                  {/* 문서 아이콘 */}
                  {icon === 'document' && (
                    <svg 
                      className="w-5 h-5 relative z-10" 
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75-6.75a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" />
                      <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
                    </svg>
                  )}
                </div>
                
                {/* 텍스트 라벨 */}
                <span 
                  className="text-xs relative z-10 m-0 p-0" 
                  style={{ 
                    color: isActive ? '#0113A3' : '#6b7280',
                    fontWeight: isActive ? '600' : '400',
                    fontSize: '10px',
                    lineHeight: 1,
                    margin: '0 !important',
                    padding: '0 !important',
                    textAlign: 'center',
                    filter: isActive ? 'drop-shadow(0 0 2px rgba(1, 19, 163, 0.2))' : 'none'
                  }}
                >
                  {name}
                </span>
                </div>
            </Link>
          );
        })}
    </div>
  );
} 