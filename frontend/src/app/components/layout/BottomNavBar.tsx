'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNavBar() {
  const pathname = usePathname();
  
  // 네비게이션 메뉴 아이템
  const navItems = [
    { name: '홈', path: '/home', icon: 'home' },
    { name: '그룹', path: '/group', icon: 'users' },
    { name: '일정', path: '/schedule', icon: 'calendar' },
    { name: '내장소', path: '/location', icon: 'map-pin' },
    { name: '로그', path: '/logs', icon: 'list' },
  ];

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-xl z-[9999] !important"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: 'white',
        borderTopWidth: '1px',
        boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div className="grid grid-cols-5 h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname ? pathname.startsWith(item.path) : false;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center justify-center py-1.5 transition-all duration-200 ${
                isActive 
                  ? 'text-indigo-600' 
                  : 'text-gray-500 hover:text-indigo-500'
              }`}
            >
              <div className="p-1 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-6 w-6 ${isActive ? 'stroke-2' : 'stroke-1'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {item.icon === 'home' && (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  )}
                  {item.icon === 'users' && (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  )}
                  {item.icon === 'calendar' && (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  )}
                  {item.icon === 'map-pin' && (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  )}
                  {item.icon === 'list' && (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  )}
                </svg>
              </div>
              <div className="flex items-center justify-center mt-0.5">
                <span className={`text-xs font-medium ${isActive ? 'font-semibold' : ''}`}>{item.name}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
} 