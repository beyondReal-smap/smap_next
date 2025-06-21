'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { hapticFeedback } from '../../../utils/haptic';

export default function BottomNavBar() {
  const pathname = usePathname();
  
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
      className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-xl z-[9999] rounded-t-2xl !important"
      id="bottom-navigation-bar"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: 'white',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)',
        transform: 'none',
        WebkitTransform: 'none',
        backfaceVisibility: 'visible',
        WebkitBackfaceVisibility: 'visible',
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px',
        borderRadius: '16px 16px 0 0',
        overflow: 'hidden'
      }}
    >
      <nav className="flex justify-around items-center py-3">
        {navItems.map(({ name, path, icon }) => {
          const isActive = pathname === path;
          
          return (
            <Link 
              key={path}
              href={path}
              onClick={() => handleNavClick({ name, path, icon })}
              className="flex flex-col items-center space-y-1 transition-colors duration-200 flex-1"
            >
                             <motion.div 
                 className="relative flex flex-col items-center space-y-1"
                 whileTap={{ scale: 0.9 }}
                 whileHover={{ scale: 1.05 }}
                 transition={{ type: "spring", stiffness: 400, damping: 17 }}
               >
                 {/* 아이콘 컨테이너 */}
                 <motion.div 
                   className="w-5 h-5 flex items-center justify-center relative"
                   animate={isActive ? {
                     scale: [1, 1.2, 1],
                     rotate: [0, 5, -5, 0]
                   } : {}}
                   transition={{
                     duration: 0.6,
                     ease: "easeInOut"
                   }}
                   style={{ 
                     color: isActive ? '#0113A3' : '#6b7280'
                   }}
                 >
                   {/* 선택된 아이템에 반짝이는 효과 */}
                   {isActive && (
                     <motion.div
                       className="absolute inset-0 rounded-full"
                       style={{ 
                         background: 'radial-gradient(circle, rgba(1, 19, 163, 0.2) 0%, transparent 70%)',
                         filter: 'blur(2px)'
                       }}
                       animate={{
                         scale: [0.8, 1.2, 0.8],
                         rotate: [0, 180, 360]
                       }}
                       transition={{
                         duration: 3,
                         repeat: Infinity,
                         ease: "easeInOut"
                       }}
                     />
                   )}
                   
                   {/* 선택된 아이템에 작은 별 효과 */}
                   {isActive && (
                     <>
                       <motion.div
                         className="absolute -top-1 -right-1 w-1 h-1 rounded-full"
                         style={{ backgroundColor: '#0113A3' }}
                         animate={{
                           scale: [0, 1, 0],
                           opacity: [0, 1, 0]
                         }}
                         transition={{
                           duration: 2.5,
                           repeat: Infinity,
                           delay: 0
                         }}
                       />
                       <motion.div
                         className="absolute -top-1 -left-1 w-0.5 h-0.5 rounded-full"
                         style={{ backgroundColor: '#0113A3' }}
                         animate={{
                           scale: [0, 1, 0],
                           opacity: [0, 1, 0]
                         }}
                         transition={{
                           duration: 2.5,
                           repeat: Infinity,
                           delay: 0.8
                         }}
                       />
                       <motion.div
                         className="absolute -bottom-1 -right-1 w-0.5 h-0.5 rounded-full"
                         style={{ backgroundColor: '#0113A3' }}
                         animate={{
                           scale: [0, 1, 0],
                           opacity: [0, 1, 0]
                         }}
                         transition={{
                           duration: 2.5,
                           repeat: Infinity,
                           delay: 1.6
                         }}
                       />
                     </>
                   )}
                  
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
                  {icon === 'users' && (
                    <svg 
                      className="w-5 h-5 relative z-10" 
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157l.001.003Z" />
                    </svg>
                  )}
                  {icon === 'calendar' && (
                    <svg 
                      className="w-5 h-5 relative z-10" 
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
                      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                    </svg>
                  )}
                  {icon === 'map-pin' && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 relative z-10"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                    </svg>
                  )}
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
                </motion.div>
                
                {/* 텍스트 라벨 */}
                <motion.span 
                  className="text-xs font-medium relative z-10"
                  style={{ 
                    color: isActive ? '#0113A3' : '#6b7280'
                  }}
                  animate={isActive ? {
                    scale: [1, 1.1, 1]
                  } : {}}
                  transition={{
                    duration: 0.3,
                    ease: "easeInOut"
                  }}
                >
                  {name}
                </motion.span>
                
                
              </motion.div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
} 