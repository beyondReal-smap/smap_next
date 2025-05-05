'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNavBar } from './index';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // 모바일 메뉴 토글
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  
  // 네비게이션 메뉴 아이템
  const navItems = [
    { name: '홈', path: '/home', icon: 'home' },
    { name: '그룹', path: '/group', icon: 'users' },
    { name: '일정', path: '/schedule', icon: 'calendar' },
    { name: '내장소', path: '/location', icon: 'map-pin' },
    { name: '로그', path: '/logs', icon: 'list' },
  ];
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* 로고 */}
            <Link href="/home" className="flex items-center">
              <div className="h-10 w-10 bg-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xl font-bold font-suite">S</span>
              </div>
              <span className="ml-2 text-xl text-gray-900 font-medium font-suite">SMAP</span>
            </Link>
            
            {/* 페이지 타이틀 - 모바일에서만 표시 */}
            <div className="md:hidden text-lg font-medium text-gray-900">
              {navItems.find(item => pathname.startsWith(item.path))?.name || '홈'}
            </div>
            
            {/* 데스크톱 네비게이션 */}
            <nav className="hidden md:flex space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors duration-300 ${
                    pathname.startsWith(item.path)
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-700 hover:text-indigo-500'
                  }`}
                >
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
            
            {/* 프로필 아이콘 */}
            <div className="flex items-center">
              <Link
                href="/profile"
                className="ml-3 p-1 rounded-full text-gray-500 hover:text-gray-700 transition-colors duration-300"
              >
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </Link>
              
              {/* 모바일 메뉴 버튼 */}
              <button
                type="button"
                className="ml-3 md:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none"
                onClick={toggleMenu}
              >
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 모바일 메뉴 */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 20,
              display: window.innerWidth >= 768 ? 'none' : 'block'
            }}
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={toggleMenu}></div>
            <div className="relative bg-white w-4/5 max-w-sm h-full shadow-xl flex flex-col">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-10 w-10 bg-indigo-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xl font-bold font-suite">S</span>
                    </div>
                    <span className="ml-2 text-xl text-gray-900 font-medium font-suite">SMAP</span>
                  </div>
                  <button
                    type="button"
                    className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none"
                    onClick={toggleMenu}
                  >
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <nav className="flex-1 p-4">
                <ul className="space-y-4">
                  {navItems.map((item) => (
                    <li key={item.path}>
                      <Link
                        href={item.path}
                        className={`block px-3 py-2 rounded-md ${
                          pathname.startsWith(item.path)
                            ? 'bg-indigo-50 text-indigo-600'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-500'
                        }`}
                        onClick={toggleMenu}
                      >
                        <div className="flex items-center">
                          <span>{item.name}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              
              <div className="border-t p-4">
                <Link
                  href="/profile"
                  className="block px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 hover:text-indigo-500"
                  onClick={toggleMenu}
                >
                  <div className="flex items-center">
                    <span>프로필</span>
                  </div>
                </Link>
                <Link
                  href="/logout"
                  className="block px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 hover:text-red-500"
                  onClick={toggleMenu}
                >
                  <div className="flex items-center">
                    <span>로그아웃</span>
                  </div>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 mt-16 bg-gradient-to-b from-indigo-50/50 to-white pb-24 md:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>

      {/* 모바일 하단 네비게이션 */}
      <BottomNavBar />
    </div>
  );
} 