'use client';

import SocialLogin from '../components/SocialLogin';

export default function SocialLoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-gradient-to-b from-indigo-50 to-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="container-mobile animate-fadeIn">
        {/* 로고 및 타이틀 */}
        <div className="text-center mb-8">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="absolute inset-0 bg-indigo-500 rounded-full opacity-20 animate-pulse"></div>
            <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
              <h1 className="text-4xl text-indigo-600 font-suite">S</h1>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 font-suite">간편 로그인</h2>
          <p className="mt-2 text-lg text-gray-600">원하시는 서비스로 로그인하세요</p>
        </div>

        {/* 카드 컨테이너 */}
        <div className="card bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100">
          <SocialLogin />
        </div>
      </div>
    </div>
  );
} 