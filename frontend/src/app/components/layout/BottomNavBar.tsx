'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hapticFeedback } from '../../../utils/haptic';
import { cubicBezier } from 'framer-motion';

export default function BottomNavBar() {
  const pathname = usePathname();

  // home 페이지 여부 확인
  const isHomePage = pathname === '/home';

  // 다른 페이지들도 home과 동일한 액션 적용
  const isOtherPagesLikeHome = ['/group', '/schedule', '/location', '/activelog'].includes(pathname);
  const shouldApplyHomeAction = isHomePage || isOtherPagesLikeHome;

  // 드래그 방지를 위한 터치 상태 관리
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  
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
  
  // 네비게이션 바 위치는 CSS로만 관리 (JavaScript 강제 설정 제거)
  
  // 위치 설정은 CSS와 인라인 스타일로만 처리 (JavaScript 제거)
  
  // 네비게이션 메뉴 아이템
  const navItems = [
    { name: '홈', path: '/home', icon: 'home' },
    { name: '그룹', path: '/group', icon: 'users' },
    { name: '일정', path: '/schedule', icon: 'calendar' },
    { name: '내장소', path: '/location', icon: 'map-pin' },
            { name: '활동 로그', path: '/activelog', icon: 'document' },
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
      className="fixed left-0 right-0 bg-white border-t shadow-xl z-[999] rounded-t-2xl m-0 p-0 bottom-navigation-main"
      id="bottom-navigation-bar"
      onTouchStart={shouldApplyHomeAction ? (e) => {
        setTouchStartY(e.touches[0].clientY);
      } : undefined}
      onTouchMove={shouldApplyHomeAction ? (e) => {
        if (touchStartY !== null) {
          const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
          // 10px 이상 움직이면 드래그로 간주하고 방지
          if (deltaY > 10) {
            e.preventDefault();
          }
        }
      } : undefined}
      onTouchEnd={shouldApplyHomeAction ? (e) => {
        setTouchStartY(null);
      } : undefined}
      style={{
        position: 'fixed' as const,
        bottom: '0px',
        left: '0px',
        right: '0px',
        zIndex: '999999 !important',
        width: '100% !important',
        minHeight: '72px !important',
        display: 'block !important',
        visibility: 'visible' as const,
        opacity: '1 !important',
        transform: 'none !important',
        WebkitTransform: 'none !important',
        pointerEvents: 'auto' as const,
        backgroundColor: 'white !important',
        borderTop: '1px solid #e5e7eb !important',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1) !important',
        borderTopLeftRadius: '16px !important',
        borderTopRightRadius: '16px !important',
        borderBottomLeftRadius: '0px !important',
        borderBottomRightRadius: '0px !important',
        overflow: 'hidden !important',
        touchAction: 'manipulation' as const,
        userSelect: 'none' as const,
        WebkitUserSelect: 'none' as any,
        WebkitTouchCallout: 'none' as any,
        WebkitTapHighlightColor: 'transparent' as any
      }}
    >
      <nav 
        className="flex justify-around items-center px-2 m-0 p-0 h-full" 
        style={{
          margin: '0 !important',
          padding: '0 !important',
          height: '100% !important',
          display: 'flex !important',
          alignItems: 'center !important',
          justifyContent: 'space-around !important'
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
                height: '100% !important',
                display: 'flex !important',
                flexDirection: 'column' as const,
                alignItems: 'center !important',
                justifyContent: 'center !important'
              }}
            >
                <div 
                  className="relative flex flex-col items-center justify-center m-0 p-0" 
                  style={{
                    margin: '0 !important',
                    padding: '0 !important',
                    display: 'flex !important',
                    flexDirection: 'column' as const,
                    alignItems: 'center !important',
                    justifyContent: 'center !important',
                    gap: '2px !important'
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
                  {isActive && (() => {
                    // 3개 점의 위치(원형 배치)
                    const radius = 14;
                    const centerX = 10;
                    const centerY = 10;
                    const dotCount = 3;
                    const hotPink = '#ff1b6b';
                    // 3개 위치 각도 (120도 간격)
                    const angles = [ -90, 30, 150 ];
                    // 점 위치 인덱스를 useRef로 고정
                    const dotIndexRef = React.useRef<number | null>(null);
                    if (dotIndexRef.current === null) {
                      dotIndexRef.current = Math.floor(Math.random() * dotCount);
                    }
                    const randomIndex = dotIndexRef.current;
                    const angle = angles[randomIndex] * Math.PI / 180;
                    const x = centerX + radius * Math.cos(angle);
                    const y = centerY + radius * Math.sin(angle);
                    return (
                      <div
                        key={randomIndex}
                        className="random-blink-dot"
                        style={{
                          position: 'absolute' as const,
                          left: `${x}px`,
                          top: `${y}px`,
                          width: '4px',
                          height: '4px',
                          background: hotPink,
                          borderRadius: '50%',
                          animation: `sparkle 1.2s infinite`,
                          animationDelay: `${randomDelays[randomIndex % 3]}s`,
                          boxShadow: '0 0 6px 2px #ff1b6b66',
                        }}
                      />
                    );
                  })()}
                  
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
                  
                  {/* 사용자 그룹 아이콘 */}
                  {icon === 'users' && (
                    <svg 
                      className="w-5 h-5 relative z-10" 
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
                  className="text-xs font-medium relative z-10 text-center"
                  style={{ 
                    color: isActive ? '#0113A3' : '#6b7280',
                    transform: 'none',
                    margin: '0px !important',
                    fontSize: '11px',
                    lineHeight: '14px'
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