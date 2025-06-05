'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNavBar } from './index';
import { FaUsers } from 'react-icons/fa';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const memberName = searchParams?.get('memberName');

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
    { name: '활동 로그', path: '/logs', icon: 'document' },
  ];
  
  // 특정 페이지 확인 (일정, 내장소, 로그)
  const simplifiedHeaderPages = ['/schedule', '/location', '/logs'];
  const isSimplifiedHeader = simplifiedHeaderPages.some(path => pathname?.startsWith(path) ?? false);
  
  // 헤더가 없는 페이지 확인 (그룹)
  const noHeaderPages = ['/group'];
  const isNoHeader = noHeaderPages.some(path => pathname?.startsWith(path) ?? false);
  
  // 현재 페이지가 홈 페이지인지 확인
  const isHomePage = pathname?.startsWith('/home') ?? false;
  
  // 현재 페이지의 타이틀 가져오기
  let currentPageTitle = '홈'; // 기본값 \'홈\'으로 초기화
  if (pathname) { // pathname이 null이 아닐 경우에만 아래 로직 수행
    currentPageTitle = navItems.find(item => pathname.startsWith(item.path))?.name || currentPageTitle;
    if (pathname === '/schedule/add') {
      currentPageTitle = memberName ? `${memberName}의 일정 입력` : '새 일정 입력';
    }
  }
  
  // main 태그의 상단 마진 클래스를 조건부로 설정
  const mainMarginTopClass = isNoHeader ? '' : (isHomePage || isSimplifiedHeader ? 'mt-12' : 'mt-16');

  // /schedule/add 페이지인지 확인
  const isScheduleAddPage = pathname === '/schedule/add';

  // children을 감싸는 div의 클래스를 동적으로 결정
  const mainContentWrapperClass = isScheduleAddPage || isSimplifiedHeader || isNoHeader
    ? 'h-full' // /schedule/add, simplifiedHeaderPages, 또는 noHeaderPages에서는 패딩 없이 높이 100%
    : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'; // 기존 패딩
  
  // 메인 영역 배경색 결정
  const mainBgClass = isSimplifiedHeader ? 'bg-gray-50' : ''; // simplifiedHeader 페이지에 배경색 적용

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 헤더 (조건부 렌더링) */}
      {!isNoHeader && (
        <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {isSimplifiedHeader ? (
              // 간소화된 헤더 (그룹, 일정, 내장소, 로그 페이지, /schedule/add 포함)
              <div className="flex items-center h-12">
                <Link href="/home" className="flex items-center mr-2">
                  <Image 
                    src="/images/smap_logo.webp" 
                    alt="SMAP 로고" 
                    width={32} 
                    height={32} 
                    className="h-10 w-auto"
                    priority
                  />
                </Link>
                {pathname === '/schedule/add' && (
                  <button
                    onClick={() => router.back()}
                    aria-label="뒤로 가기"
                    className="p-2 mr-2 -ml-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                <h1 className="text-lg font-medium text-gray-900 truncate">{currentPageTitle}</h1>
              </div>
            ) : isHomePage ? (
              // 홈 페이지 헤더 (홈 텍스트 없이, 높이 동일하게)
              <div className="flex justify-between items-center h-12">
                {/* 로고 */}
                <Link href="/home" className="flex items-center">
                  <img 
                    src="/images/smap_logo.webp" 
                    alt="SMAP 로고" 
                    className="h-10"
                  />
                  <span className="ml-1 text-lg font-normal text-gray-900">SMAP</span>
                </Link>
                {/* 아이콘 모음 */}
                <div className="flex items-center space-x-2">
                  {/* 알림 메시지 아이콘 */}
                  <Link
                    href="/notice"
                    className="p-1.5 rounded-full text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </Link>
                  
                  {/* 설정 아이콘 */}
                  <Link
                    href="/setting"
                    className="p-1.5 rounded-full text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </Link>
                </div>
              </div>
            ) : (
              // 기타 페이지 헤더 (기본 레이아웃)
              <div className="flex justify-between items-center h-16">
                {/* 로고 */}
                <Link href="/home" className="flex items-center">
                  <img 
                    src="/images/smap_logo.webp" 
                    alt="SMAP 로고" 
                    className="h-10"
                  />
                </Link>
                
                {/* 페이지 타이틀 - 모바일에서만 표시 */}
                <div className="md:hidden text-lg font-medium text-gray-900">
                  {currentPageTitle}
                </div>
                
                {/* 데스크톱 네비게이션 */}
                <nav className="hidden md:flex space-x-8">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors duration-300 ${
                        (pathname && pathname.startsWith(item.path)) // pathname 존재 여부 확인
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
            )}
          </div>
        </header>
      )}

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
                    <img 
                      src="/images/smap_logo.webp" 
                      alt="SMAP 로고" 
                      className="h-10"
                    />
                  </div>
                  <button
                    type="button"
                    className="p-2 rounded-md text-gray-500 hover:text-indigo-700 hover:bg-indigo-50 focus:outline-none transition-colors duration-300"
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
                          (pathname && pathname.startsWith(item.path)) // pathname 존재 여부 확인
                            ? 'bg-indigo-50 text-indigo-600'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-500'
                        }`}
                        onClick={() => handleNavigation(item.path)}
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
                  onClick={() => handleNavigation('/profile')}
                >
                  <div className="flex items-center">
                    <span>프로필</span>
                  </div>
                </Link>
                <Link
                  href="/logout"
                  className="block px-3 py-2 rounded-md text-gray-700 hover:bg-gray-50 hover:text-red-500"
                  onClick={() => handleNavigation('/logout')}
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

      {/* 메인 컨텐츠 - 배경색 조건부 적용 */}
      <main className={`flex-grow ${mainMarginTopClass} overflow-auto ${mainBgClass}`}>
        <div className={mainContentWrapperClass}>
          {children}
        </div>
      </main>

      {/* 하단 네비게이션 바 (조건부 렌더링 제거) */}
      <BottomNavBar />
    </div>
  );
} 