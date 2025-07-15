'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
    { name: '활동 로그', path: '/activelog', icon: 'document' },
  ];
  
  // 특정 페이지 확인 (일정, 내장소, 로그)
  const simplifiedHeaderPages = ['/schedule', '/location', '/activelog'];
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
  
  // main 태그의 상단 마진 클래스를 조건부로 설정 (헤더 높이 h-14로 통일)
  const mainMarginTopClass = isNoHeader ? '' : 'mt-14';

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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* 헤더 (조건부 렌더링) */}
      {!isNoHeader && (
        <header className="bg-white shadow-sm fixed left-0 right-0 z-10" style={{ top: '0px', paddingTop: '0px', marginTop: '0px' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {isSimplifiedHeader ? (
              // 간소화된 헤더 (그룹, 일정, 내장소, 로그 페이지, /schedule/add 포함)
              <div className="flex items-center h-14">
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M11.03 3.97a.75.75 0 0 1 0 1.06l-6.22 6.22H21a.75.75 0 0 1 0 1.5H4.81l6.22 6.22a.75.75 0 1 1-1.06 1.06l-7.5-7.5a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                <h1 className="text-lg font-medium text-gray-900 truncate">{currentPageTitle}</h1>
              </div>
            ) : isHomePage ? (
              // 홈 페이지 헤더 (홈 텍스트 없이, 높이 동일하게)
              <div className="flex justify-between items-center h-14">
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="gray">
                      <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
                    </svg>
                  </Link>
                  
                  {/* 설정 아이콘 */}
                  <Link
                    href="/setting"
                    className="p-1.5 rounded-full text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="gray">
                      <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.570.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
                    </svg>
                  </Link>
                </div>
              </div>
            ) : (
              // 기타 페이지 헤더 (기본 레이아웃)
              <div className="flex justify-between items-center h-14">
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

      {/* 하단 네비게이션 바는 ClientLayout에서 관리하므로 여기서는 제거 */}
    </div>
  );
} 