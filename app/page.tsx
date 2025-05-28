import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">SMAP</h1>
              <span className="ml-2 text-sm text-gray-500">스마트 위치 관리</span>
            </div>
            <nav className="hidden md:flex space-x-8">
              <Link href="/group" className="text-gray-600 hover:text-gray-900">
                그룹 관리
              </Link>
              <Link href="/schedule" className="text-gray-600 hover:text-gray-900">
                스케줄
              </Link>
              <Link href="/location" className="text-gray-600 hover:text-gray-900">
                위치 공유
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 히어로 섹션 */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            스마트한 그룹 관리의 시작
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            실시간 위치 공유와 스케줄 관리를 통해 그룹 활동을 더욱 효율적으로 관리하세요.
            SMAP과 함께 새로운 협업 경험을 시작해보세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/group" 
              className="btn-primary inline-flex items-center justify-center px-8 py-3 text-lg"
            >
              그룹 관리 시작하기
            </Link>
            <Link 
              href="/schedule/add" 
              className="btn-secondary inline-flex items-center justify-center px-8 py-3 text-lg"
            >
              스케줄 추가하기
            </Link>
          </div>
        </div>

        {/* 기능 소개 */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="card text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">실시간 위치 공유</h3>
            <p className="text-gray-600">
              그룹 멤버들의 실시간 위치를 지도에서 확인하고, 안전하게 위치 정보를 공유하세요.
            </p>
          </div>

          <div className="card text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">스케줄 관리</h3>
            <p className="text-gray-600">
              그룹 일정을 체계적으로 관리하고, 멤버들과 스케줄을 공유하여 효율적인 협업을 실현하세요.
            </p>
          </div>

          <div className="card text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">그룹 관리</h3>
            <p className="text-gray-600">
              다양한 그룹을 생성하고 관리하며, 멤버 권한을 설정하여 체계적인 그룹 운영을 지원합니다.
            </p>
          </div>
        </div>

        {/* 통계 섹션 */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-16">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
            SMAP과 함께하는 스마트한 관리
          </h3>
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">실시간</div>
              <div className="text-gray-600">위치 추적</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600 mb-2">24/7</div>
              <div className="text-gray-600">서비스 운영</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600 mb-2">무제한</div>
              <div className="text-gray-600">그룹 생성</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600 mb-2">안전한</div>
              <div className="text-gray-600">데이터 보호</div>
            </div>
          </div>
        </div>

        {/* CTA 섹션 */}
        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            지금 바로 시작해보세요
          </h3>
          <p className="text-gray-600 mb-8">
            SMAP의 강력한 기능들을 직접 체험해보세요.
          </p>
          <Link 
            href="/group" 
            className="btn-primary inline-flex items-center justify-center px-8 py-3 text-lg"
          >
            무료로 시작하기
          </Link>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h4 className="text-lg font-semibold mb-2">SMAP</h4>
            <p className="text-gray-400">스마트한 위치 기반 그룹 관리 서비스</p>
            <div className="mt-4 text-sm text-gray-500">
              © 2024 SMAP. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
} 