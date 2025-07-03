'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hapticFeedback } from '../../../utils/haptic';

export default function BottomNavBar() {
  const pathname = usePathname();
  
  // 네비게이션 바 위치 강제 설정
  useEffect(() => {
    let isSettingPosition = false; // 무한 루프 방지 플래그
    
    // 🔥 강제 위치 설정 (조건부 실행으로 무한루프 방지)
    const forceBottomNavPosition = () => {
      if (isSettingPosition) return; // 이미 설정 중이면 무시
      
      const bottomNav = document.getElementById('bottom-navigation-bar');
      if (bottomNav) {
        const currentBottom = bottomNav.style.bottom;
        const currentPosition = bottomNav.style.position;
        
        // 현재 페이지에 따라 다른 bottom 값 적용
        const currentPath = window.location.pathname;
        let targetBottom = '40px'; // 기본값
        
        // 모든 페이지에서 40px 위로 설정
        if (['/home', '/group', '/schedule', '/logs', '/location'].includes(currentPath)) {
          targetBottom = '40px'; // 모든 페이지는 40px 위로
        }
        
        // 이미 올바른 값이면 실행하지 않음 (무한루프 방지)
        if (currentPosition === 'fixed' && currentBottom === targetBottom) {
          return;
        }
        
        // 1. 인라인 스타일 강제 설정
        bottomNav.style.setProperty('position', 'fixed', 'important');
        bottomNav.style.setProperty('bottom', targetBottom, 'important');
        bottomNav.style.setProperty('top', 'auto', 'important');
        bottomNav.style.setProperty('left', '0px', 'important');
        bottomNav.style.setProperty('right', '0px', 'important');
        bottomNav.style.setProperty('width', '100%', 'important');
        bottomNav.style.setProperty('z-index', '999999', 'important');
        bottomNav.style.setProperty('transform', 'none', 'important');
        bottomNav.style.setProperty('-webkit-transform', 'none', 'important');
        bottomNav.style.setProperty('animation', 'none', 'important');
        bottomNav.style.setProperty('transition', 'none', 'important');
        
        // 2. 클래스 강제 추가
        bottomNav.classList.add('forced-bottom-nav', 'position-fixed-bottom');
        bottomNav.setAttribute('data-forced-position', 'bottom-fixed');
        bottomNav.setAttribute('data-bottom', targetBottom.replace('px', ''));
        
        console.log(`[BottomNavBar] 네비게이션 바 위치 조정 완료 (${targetBottom}) - 페이지: ${currentPath}`);
      }
    };

    // DOM 변경 감시 (더 제한적으로)
    const observer = new MutationObserver((mutations) => {
      let needsForce = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
          const target = mutation.target;
                      if (target.id === 'bottom-navigation-bar') {
              const style = target.style;
              const currentPath = window.location.pathname;
              const expectedBottom = ['/home', '/group', '/schedule', '/logs', '/location'].includes(currentPath) ? '40px' : '40px';
              
              if (style.bottom !== expectedBottom || style.position !== 'fixed') {
                needsForce = true;
              }
            }
        }
      });
      
      if (needsForce) {
        forceBottomNavPosition();
      }
    });

    // 즉시 실행
    forceBottomNavPosition();
    
    // 일반 주기적 체크만 (빠른 체크 제거)
    const normalInterval = setInterval(forceBottomNavPosition, 10000); // 10초마다로 변경

    // DOM 감시 시작 (제한적으로)
    const targetElement = document.getElementById('bottom-navigation-bar');
    if (targetElement) {
      observer.observe(targetElement, {
        attributes: true,
        attributeFilter: ['style'],
        subtree: false
      });
    }

    // 페이지 로드 완료 후 한 번만 실행
    if (document.readyState === 'complete') {
      setTimeout(forceBottomNavPosition, 500);
    } else {
      window.addEventListener('load', () => {
        setTimeout(forceBottomNavPosition, 500);
      });
    }

    // cleanup
    return () => {
      clearInterval(normalInterval);
      observer.disconnect();
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

  return (
    <div 
      className="fixed left-0 right-0 bg-white border-t shadow-xl z-[999] rounded-t-2xl"
      id="bottom-navigation-bar"
      style={{
        position: 'fixed !important' as any,
        bottom: '40px !important',
        left: '0px !important',
        right: '0px !important',
        zIndex: 999,
        backgroundColor: 'white',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)',
        transform: 'translate3d(0, 0, 0)',
        WebkitTransform: 'translate3d(0, 0, 0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px',
        borderRadius: '16px 16px 0 0',
        overflow: 'visible',
        willChange: 'auto',
        paddingTop: '12px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        height: 'auto',
        minHeight: '76px'
      }}
    >
      <nav className="flex justify-around items-center px-2">
        {navItems.map(({ name, path, icon }) => {
          const isActive = pathname === path;
          
          return (
            <Link 
              key={path}
              href={path}
              onClick={() => handleNavClick({ name, path, icon })}
              className="flex flex-col items-center space-y-1 transition-colors duration-200 flex-1 min-w-0 py-2"
            >
              <div className="relative flex flex-col items-center space-y-1">
                {/* 아이콘 컨테이너 */}
                <div 
                  className="w-6 h-6 flex items-center justify-center relative"
                  style={{ 
                    color: isActive ? '#0113A3' : '#6b7280',
                    transform: 'none'
                  }}
                >
                  {/* 선택된 아이템 배경 표시 */}
                  {isActive && (
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{ 
                        background: 'radial-gradient(circle, rgba(1, 19, 163, 0.1) 0%, transparent 70%)'
                      }}
                    />
                  )}
                  
                  {/* 홈 아이콘 */}
                  {icon === 'home' && (
                    <svg 
                      className="w-6 h-6 relative z-10" 
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
                      <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
                    </svg>
                  )}
                  
                  {/* 사용자 그룹 아이콘 */}
                  {icon === 'users' && (
                    <svg 
                      className="w-6 h-6 relative z-10" 
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
                      <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.041c-.07.027-.22.07-.544.14-.42.094-.85.174-1.27.24.15-.171.2-.26.05-.94Z" />
                    </svg>
                  )}
                  
                  {/* 달력 아이콘 */}
                  {icon === 'calendar' && (
                    <svg 
                      className="w-6 h-6 relative z-10" 
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
                      className="w-6 h-6 relative z-10" 
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                    </svg>
                  )}
                  
                  {/* 문서 아이콘 */}
                  {icon === 'document' && (
                    <svg 
                      className="w-6 h-6 relative z-10" 
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
                  className="text-xs font-medium relative z-10 text-center"
                  style={{ 
                    color: isActive ? '#0113A3' : '#6b7280',
                    transform: 'none'
                  }}
                >
                  {name}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
} 