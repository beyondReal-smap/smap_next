'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  
  const handleLogin = () => {
    // 실제로는 로그인 로직이 여기에 들어갑니다.
    // 로그인 성공 시 홈 페이지로 리다이렉트
    router.push('/home');
  };
  
  return (
    <div className="min-h-screen flex flex-col justify-center bg-gradient-to-b from-indigo-50 to-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="container-mobile animate-fadeIn">
        {/* 헤더 및 브랜딩 */}
        <div className="text-center mb-12">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 bg-indigo-500 rounded-full opacity-20 animate-pulse"></div>
            <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
              <h1 className="text-4xl text-indigo-600 font-suite font-bold">S</h1>
            </div>
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 font-suite">스맵</h2>
          <p className="mt-4 text-xl text-gray-600">스케줄과 지도를 한번에</p>
          <p className="mt-2 text-lg text-gray-500">더 편리한 일정관리를 시작하세요</p>
        </div>

        {/* 주요 기능 소개 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
            <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">일정 관리</h3>
            <p className="text-gray-600">효율적인 일정 관리로 시간을 절약하세요. 간편한 등록과 알림 기능을 제공합니다.</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
            <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">위치 저장</h3>
            <p className="text-gray-600">자주 방문하는 장소를 저장하고 일정에 활용하세요. 이동 경로도 쉽게 확인할 수 있습니다.</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
            <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">그룹 관리</h3>
            <p className="text-gray-600">팀원들과 일정과 장소를 공유하세요. 그룹 기능으로 협업이 더 쉬워집니다.</p>
          </div>
        </div>

        {/* 시작하기 버튼 */}
        <div className="flex flex-col items-center space-y-4">
          <button 
            onClick={handleLogin}
            className="w-full max-w-xs flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-105"
          >
            소셜 로그인
          </button>
          
          <Link 
            href="/register"
            className="w-full max-w-xs flex justify-center items-center py-3 px-4 border border-gray-300 rounded-xl shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
          >
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
} 