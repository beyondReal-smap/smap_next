import React from 'react';
import Image from 'next/image';

export default function FeaturesPage() {
  return (
    <div className="flex flex-col items-center">
      {/* 헤더 섹션 */}
      <section className="w-full py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 z-0"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-200 rounded-full opacity-20 blur-3xl anim-pulse"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-300 rounded-full opacity-20 blur-3xl anim-pulse"></div>
        
        <div className="container mx-auto px-4 sm:px-6 relative z-10 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-balance anim-fade-in">SMAP의 주요 기능</h1>
          <p className="text-gray-600 text-lg sm:text-xl mb-8 max-w-3xl mx-auto leading-relaxed text-balance anim-slide-up" style={{animationDelay: '0.2s'}}>
            자녀의 안전과 일정 관리를 위한 SMAP의 핵심 기능들을 소개합니다. <br />
            실시간 위치 확인부터 효율적인 일정 관리까지, 자녀를 위한 최고의 솔루션입니다.
          </p>
        </div>
      </section>

      {/* 가족만의 프라이빗 공간 */}
      <section className="w-full py-16 md:py-24 bg-teal-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/2 reveal">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 opacity-20 blur-lg"></div>
                <div className="bg-white rounded-xl p-6 h-[450px] flex items-center justify-center shadow-xl border-2 border-white">
                  <div className="bg-white p-4 rounded-lg">
                    <Image
                      src="/images/비공개그룹.webp"
                      alt="가족만의 프라이빗 공간"
                      width={400}
                      height={500}
                      className="object-contain max-h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 mt-12 lg:mt-0 reveal" style={{transitionDelay: '0.2s'}}>
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium">프라이버시 보호</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">가족만의 프라이빗 공간</h2>
              </div>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                초대제로 운영되는 안전한 그룹으로, 가족 구성원들만을 위한 비공개 그룹을 제공합니다. 
                가족의 프라이버시를 최우선으로 지키며, 따뜻한 연결을 만들어갑니다.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.3s'}}>
                  <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">초대제 운영 시스템</p>
                    <p className="text-gray-600 mt-1">초대를 통해서만 가입할 수 있어 안전한 가족 공간을 보장합니다. 외부인의 접근을 원천적으로 차단하여 프라이버시를 보호합니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">실시간 위치 공유</p>
                    <p className="text-gray-600 mt-1">가족 구성원들은 언제 어디서나 서로의 위치를 실시간으로 확인할 수 있어 안심하고 소통할 수 있습니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.5s'}}>
                  <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">정보 보안</p>
                    <p className="text-gray-600 mt-1">가족의 개인정보와 위치 데이터는 철저한 보안 시스템으로 보호되어 외부 유출 위험 없이 안전하게 관리됩니다.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 가족만의 프라이빗 공간 - 빨간색 */}
      <section className="w-full py-16 md:py-24 bg-red-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/2 reveal">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 opacity-20 blur-lg"></div>
                <div className="bg-white rounded-xl p-6 h-[450px] flex items-center justify-center shadow-xl border-2 border-white">
                  <div className="bg-white p-4 rounded-lg">
                    <Image
                      src="/images/비공개그룹.webp"
                      alt="가족만의 프라이빗 공간"
                      width={400}
                      height={500}
                      className="object-contain max-h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 mt-12 lg:mt-0 reveal" style={{transitionDelay: '0.2s'}}>
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">프라이버시 보호</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">가족만의 프라이빗 공간</h2>
              </div>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                초대제로 운영되는 안전한 그룹으로, 가족 구성원들만을 위한 비공개 그룹을 제공합니다. 
                가족의 프라이버시를 최우선으로 지키며, 따뜻한 연결을 만들어갑니다.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.3s'}}>
                  <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">초대제 운영 시스템</p>
                    <p className="text-gray-600 mt-1">초대를 통해서만 가입할 수 있어 안전한 가족 공간을 보장합니다. 외부인의 접근을 원천적으로 차단하여 프라이버시를 보호합니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">실시간 위치 공유</p>
                    <p className="text-gray-600 mt-1">가족 구성원들은 언제 어디서나 서로의 위치를 실시간으로 확인할 수 있어 안심하고 소통할 수 있습니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.5s'}}>
                  <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">정보 보안</p>
                    <p className="text-gray-600 mt-1">가족의 개인정보와 위치 데이터는 철저한 보안 시스템으로 보호되어 외부 유출 위험 없이 안전하게 관리됩니다.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 최적의 이동 경로 안내 */}
      <section className="w-full py-16 md:py-24 bg-amber-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
            <div className="lg:w-1/2 reveal">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 opacity-20 blur-lg"></div>
                <div className="bg-white rounded-xl p-6 h-[450px] flex items-center justify-center shadow-xl border-2 border-white">
                  <div className="bg-white p-4 rounded-lg">
                    <Image
                      src="/images/최적경로.webp"
                      alt="최적의 이동 경로 안내"
                      width={400}
                      height={500}
                      className="object-contain max-h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 mt-12 lg:mt-0 reveal" style={{transitionDelay: '0.2s'}}>
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">편리한 이동</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">최적의 이동 경로 안내</h2>
              </div>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                현재 위치에서 다음 일정 장소까지 T-Map의 최적 경로를 바로 제공합니다. 
                번거로운 검색 없이, 가장 빠르고 편리한 길을 안내받아 시간을 절약하세요.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.3s'}}>
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">T-Map 연동 시스템</p>
                    <p className="text-gray-600 mt-1">국내 최고의 내비게이션 서비스인 T-Map과 연동되어 정확하고 신뢰할 수 있는 최적 경로를 제공합니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">원클릭 길 안내</p>
                    <p className="text-gray-600 mt-1">일정 장소까지 한 번의 클릭으로 바로 경로 안내를 시작할 수 있어 빠르고 편리하게 이동할 수 있습니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.5s'}}>
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">실시간 교통 정보</p>
                    <p className="text-gray-600 mt-1">실시간 교통 상황을 반영한 최적의 경로를 제공하여 이동 시간을 단축하고 효율적인 일정 관리를 도와줍니다.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 최적의 이동 경로 안내 - 주황색 */}
      <section className="w-full py-16 md:py-24 bg-orange-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
            <div className="lg:w-1/2 reveal">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 opacity-20 blur-lg"></div>
                <div className="bg-white rounded-xl p-6 h-[450px] flex items-center justify-center shadow-xl border-2 border-white">
                  <div className="bg-white p-4 rounded-lg">
                    <Image
                      src="/images/최적경로.webp"
                      alt="최적의 이동 경로 안내"
                      width={400}
                      height={500}
                      className="object-contain max-h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 mt-12 lg:mt-0 reveal" style={{transitionDelay: '0.2s'}}>
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">편리한 이동</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">최적의 이동 경로 안내</h2>
              </div>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                현재 위치에서 다음 일정 장소까지 T-Map의 최적 경로를 바로 제공합니다. 
                번거로운 검색 없이, 가장 빠르고 편리한 길을 안내받아 시간을 절약하세요.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.3s'}}>
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">T-Map 연동 시스템</p>
                    <p className="text-gray-600 mt-1">국내 최고의 내비게이션 서비스인 T-Map과 연동되어 정확하고 신뢰할 수 있는 최적 경로를 제공합니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">원클릭 길 안내</p>
                    <p className="text-gray-600 mt-1">일정 장소까지 한 번의 클릭으로 바로 경로 안내를 시작할 수 있어 빠르고 편리하게 이동할 수 있습니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.5s'}}>
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">실시간 교통 정보</p>
                    <p className="text-gray-600 mt-1">실시간 교통 상황을 반영한 최적의 경로를 제공하여 이동 시간을 단축하고 효율적인 일정 관리를 도와줍니다.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 가족 맞춤 스마트 알림 */}
      <section className="w-full py-16 md:py-24 bg-pink-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/2 reveal">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 opacity-20 blur-lg"></div>
                <div className="bg-white rounded-xl p-6 h-[450px] flex items-center justify-center shadow-xl border-2 border-white">
                  <div className="bg-white p-4 rounded-lg">
                    <Image
                      src="/images/스마트알림.webp"
                      alt="가족 맞춤 스마트 알림"
                      width={400}
                      height={500}
                      className="object-contain max-h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 mt-12 lg:mt-0 reveal" style={{transitionDelay: '0.2s'}}>
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-pink-100 text-pink-700 rounded-full text-sm font-medium">맞춤형 알림</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">가족 맞춤 스마트 알림</h2>
              </div>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                입력된 일정과 장소를 기반으로 부모와 자녀 모두에게 최적화된 알림을 제공합니다. 
                중요한 약속이나 활동을 놓치지 않도록, 가족 각자의 필요에 맞춘 세심한 알림으로 하루를 더욱 체계적으로 관리할 수 있습니다.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.3s'}}>
                  <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">일정 맞춤 알림</p>
                    <p className="text-gray-600 mt-1">일정 시작 시간에 맞춰 적절한 시간에 알림을 받아 지각이나 중요한 활동을 놓치는 일이 없도록 도와줍니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">이중 알림 시스템</p>
                    <p className="text-gray-600 mt-1">부모와 자녀 모두에게 알림을 전송하여 양쪽 모두 일정을 놓치지 않도록 하며, 보호자는 자녀의 일정 상태를 확인할 수 있습니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.5s'}}>
                  <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">알림 우선순위 설정</p>
                    <p className="text-gray-600 mt-1">중요도에 따라 알림의 우선순위를 설정할 수 있어 중요한 일정을 더욱 잘 관리할 수 있습니다.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 가족 맞춤 스마트 알림 - 노란색 */}
      <section className="w-full py-16 md:py-24 bg-yellow-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/2 reveal">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 opacity-20 blur-lg"></div>
                <div className="bg-white rounded-xl p-6 h-[450px] flex items-center justify-center shadow-xl border-2 border-white">
                  <div className="bg-white p-4 rounded-lg">
                    <Image
                      src="/images/스마트알림.webp"
                      alt="가족 맞춤 스마트 알림"
                      width={400}
                      height={500}
                      className="object-contain max-h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 mt-12 lg:mt-0 reveal" style={{transitionDelay: '0.2s'}}>
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">맞춤형 알림</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">가족 맞춤 스마트 알림</h2>
              </div>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                입력된 일정과 장소를 기반으로 부모와 자녀 모두에게 최적화된 알림을 제공합니다. 
                중요한 약속이나 활동을 놓치지 않도록, 가족 각자의 필요에 맞춘 세심한 알림으로 하루를 더욱 체계적으로 관리할 수 있습니다.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.3s'}}>
                  <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">일정 맞춤 알림</p>
                    <p className="text-gray-600 mt-1">일정 시작 시간에 맞춰 적절한 시간에 알림을 받아 지각이나 중요한 활동을 놓치는 일이 없도록 도와줍니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">이중 알림 시스템</p>
                    <p className="text-gray-600 mt-1">부모와 자녀 모두에게 알림을 전송하여 양쪽 모두 일정을 놓치지 않도록 하며, 보호자는 자녀의 일정 상태를 확인할 수 있습니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.5s'}}>
                  <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">알림 우선순위 설정</p>
                    <p className="text-gray-600 mt-1">중요도에 따라 알림의 우선순위를 설정할 수 있어 중요한 일정을 더욱 잘 관리할 수 있습니다.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 가족의 발자취 기록 */}
      <section className="w-full py-16 md:py-24 bg-cyan-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
            <div className="lg:w-1/2 reveal">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 opacity-20 blur-lg"></div>
                <div className="bg-white rounded-xl p-6 h-[450px] flex items-center justify-center shadow-lg border border-gray-100">
                  <Image
                    src="/images/위치기록.webp"
                    alt="가족의 발자취 기록"
                    width={400}
                    height={500}
                    className="object-contain max-h-full"
                  />
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 mt-12 lg:mt-0 reveal" style={{transitionDelay: '0.2s'}}>
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-medium">이동 기록</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">가족의 발자취 기록</h2>
              </div>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                지난 2주 동안의 가족 이동 기록을 간편하게 조회할 수 있는 기능을 제공합니다. 
                어디를 방문했는지, 얼마나 머물렀는지 등 상세한 정보를 확인하며, 
                필요할 때 언제든 과거의 여정을 되짚어볼 수 있습니다.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.3s'}}>
                  <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">2주 기록 보관</p>
                    <p className="text-gray-600 mt-1">최근 2주간의 이동 기록을 자동으로 저장하여 필요할 때 언제든지 확인할 수 있습니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">상세 방문 정보</p>
                    <p className="text-gray-600 mt-1">각 장소별 방문 시간, 체류 시간 등 상세한 정보를 제공하여 정확한 활동 파악이 가능합니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.5s'}}>
                  <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">경로 시각화</p>
                    <p className="text-gray-600 mt-1">지도 위에 이동 경로를 시각적으로 표시하여 한눈에 이동 패턴을 파악할 수 있습니다.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 가족의 발자취 기록 - 초록색 */}
      <section className="w-full py-16 md:py-24 bg-green-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
            <div className="lg:w-1/2 reveal">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 opacity-20 blur-lg"></div>
                <div className="bg-white rounded-xl p-6 h-[450px] flex items-center justify-center shadow-xl border-2 border-white">
                  <div className="bg-white p-4 rounded-lg">
                    <Image
                      src="/images/위치기록.webp"
                      alt="가족의 발자취 기록"
                      width={400}
                      height={500}
                      className="object-contain max-h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 mt-12 lg:mt-0 reveal" style={{transitionDelay: '0.2s'}}>
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">이동 기록</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">가족의 발자취 기록</h2>
              </div>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                지난 2주 동안의 가족 이동 기록을 간편하게 조회할 수 있는 기능을 제공합니다. 
                어디를 방문했는지, 얼마나 머물렀는지 등 상세한 정보를 확인하며, 
                필요할 때 언제든 과거의 여정을 되짚어볼 수 있습니다.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.3s'}}>
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">2주 기록 보관</p>
                    <p className="text-gray-600 mt-1">최근 2주간의 이동 기록을 자동으로 저장하여 필요할 때 언제든지 확인할 수 있습니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">상세 방문 정보</p>
                    <p className="text-gray-600 mt-1">각 장소별 방문 시간, 체류 시간 등 상세한 정보를 제공하여 정확한 활동 파악이 가능합니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.5s'}}>
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">경로 시각화</p>
                    <p className="text-gray-600 mt-1">지도 위에 이동 경로를 시각적으로 표시하여 한눈에 이동 패턴을 파악할 수 있습니다.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 스마트 일정 관리 */}
      <section className="w-full py-16 md:py-24 bg-indigo-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/2 reveal">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 opacity-20 blur-lg"></div>
                <div className="bg-white rounded-xl p-6 h-[450px] flex items-center justify-center shadow-lg border border-gray-100">
                  <Image
                    src="/images/스마트일정.webp"
                    alt="스마트 일정 관리"
                    width={400}
                    height={500}
                    className="object-contain max-h-full"
                  />
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 mt-12 lg:mt-0 reveal" style={{transitionDelay: '0.2s'}}>
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">효율적 관리</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">스마트 일정 관리</h2>
              </div>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                부모님은 자녀의 일정을 한눈에 확인하고 직접 관리할 수 있습니다. 
                자녀의 활동을 체계적으로 계획하고, 필요에 따라 유연하게 조정하며 
                가족의 일상을 더욱 효율적으로 운영하세요.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.3s'}}>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">원격 일정 관리</p>
                    <p className="text-gray-600 mt-1">부모님이 자녀의 일정을 원격으로 추가, 수정, 삭제할 수 있어 효율적인 일정 관리가 가능합니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">통합 가족 캘린더</p>
                    <p className="text-gray-600 mt-1">가족 구성원 전체의 일정을 한 화면에서 확인할 수 있어 가족 계획을 더욱 효율적으로 조정할 수 있습니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.5s'}}>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">일정 동기화</p>
                    <p className="text-gray-600 mt-1">학교 행사나 중요 일정을 모든 가족 구성원과 동기화하여 모두가 함께 준비할 수 있도록 합니다.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 스마트 일정 관리 - 파란색 */}
      <section className="w-full py-16 md:py-24 bg-blue-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/2 reveal">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 opacity-20 blur-lg"></div>
                <div className="bg-white rounded-xl p-6 h-[450px] flex items-center justify-center shadow-xl border-2 border-white">
                  <div className="bg-white p-4 rounded-lg">
                    <Image
                      src="/images/스마트일정.webp"
                      alt="스마트 일정 관리"
                      width={400}
                      height={500}
                      className="object-contain max-h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 mt-12 lg:mt-0 reveal" style={{transitionDelay: '0.2s'}}>
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">효율적 관리</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">스마트 일정 관리</h2>
              </div>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                부모님은 자녀의 일정을 한눈에 확인하고 직접 관리할 수 있습니다. 
                자녀의 활동을 체계적으로 계획하고, 필요에 따라 유연하게 조정하며 
                가족의 일상을 더욱 효율적으로 운영하세요.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.3s'}}>
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">원격 일정 관리</p>
                    <p className="text-gray-600 mt-1">부모님이 자녀의 일정을 원격으로 추가, 수정, 삭제할 수 있어 효율적인 일정 관리가 가능합니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">통합 가족 캘린더</p>
                    <p className="text-gray-600 mt-1">가족 구성원 전체의 일정을 한 화면에서 확인할 수 있어 가족 계획을 더욱 효율적으로 조정할 수 있습니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.5s'}}>
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">일정 동기화</p>
                    <p className="text-gray-600 mt-1">학교 행사나 중요 일정을 모든 가족 구성원과 동기화하여 모두가 함께 준비할 수 있도록 합니다.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 유연한 그룹 관리 */}
      <section className="w-full py-16 md:py-24 bg-orange-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
            <div className="lg:w-1/2 reveal">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 opacity-20 blur-lg"></div>
                <div className="bg-white rounded-xl p-6 h-[450px] flex items-center justify-center shadow-lg border border-gray-100">
                  <Image
                    src="/images/그룹관리.webp"
                    alt="유연한 그룹 관리"
                    width={400}
                    height={500}
                    className="object-contain max-h-full"
                  />
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 mt-12 lg:mt-0 reveal" style={{transitionDelay: '0.2s'}}>
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">맞춤형 설정</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">유연한 그룹 관리</h2>
              </div>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                그룹 유효 기간과 구성원의 가입 기간을 개별적으로 설정할 수 있는 고급 관리 기능을 제공합니다. 
                가족의 상황에 맞춰 유연하고 체계적으로 그룹을 운영하며, 더욱 편리한 환경을 만들어갑니다.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.3s'}}>
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">기간별 설정</p>
                    <p className="text-gray-600 mt-1">그룹의 전체 유효 기간과 각 구성원의 개별 가입 기간을 설정하여 특정 기간 동안만 위치 공유가 필요한 상황에 유용합니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">권한 관리</p>
                    <p className="text-gray-600 mt-1">그룹 내 구성원별로 다양한 권한을 설정할 수 있어 정보 접근 범위를 세밀하게 조정할 수 있습니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.5s'}}>
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">다중 그룹 관리</p>
                    <p className="text-gray-600 mt-1">여러 그룹을 동시에 관리할 수 있어 확장 가족이나 다양한 활동 그룹을 효율적으로 운영할 수 있습니다.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 유연한 그룹 관리 - 남색 */}
      <section className="w-full py-16 md:py-24 bg-indigo-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
            <div className="lg:w-1/2 reveal">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 opacity-20 blur-lg"></div>
                <div className="bg-white rounded-xl p-6 h-[450px] flex items-center justify-center shadow-xl border-2 border-white">
                  <div className="bg-white p-4 rounded-lg">
                    <Image
                      src="/images/그룹관리.webp"
                      alt="유연한 그룹 관리"
                      width={400}
                      height={500}
                      className="object-contain max-h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 mt-12 lg:mt-0 reveal" style={{transitionDelay: '0.2s'}}>
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">맞춤형 설정</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">유연한 그룹 관리</h2>
              </div>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                그룹 유효 기간과 구성원의 가입 기간을 개별적으로 설정할 수 있는 고급 관리 기능을 제공합니다. 
                가족의 상황에 맞춰 유연하고 체계적으로 그룹을 운영하며, 더욱 편리한 환경을 만들어갑니다.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.3s'}}>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">기간별 설정</p>
                    <p className="text-gray-600 mt-1">그룹의 전체 유효 기간과 각 구성원의 개별 가입 기간을 설정하여 특정 기간 동안만 위치 공유가 필요한 상황에 유용합니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">권한 관리</p>
                    <p className="text-gray-600 mt-1">그룹 내 구성원별로 다양한 권한을 설정할 수 있어 정보 접근 범위를 세밀하게 조정할 수 있습니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.5s'}}>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">다중 그룹 관리</p>
                    <p className="text-gray-600 mt-1">여러 그룹을 동시에 관리할 수 있어 확장 가족이나 다양한 활동 그룹을 효율적으로 운영할 수 있습니다.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 하루를 한눈에 (일일 요약) */}
      <section className="w-full py-16 md:py-24 bg-violet-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/2 reveal">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 opacity-20 blur-lg"></div>
                <div className="bg-white rounded-xl p-6 h-[450px] flex items-center justify-center shadow-lg border border-gray-100">
                  <Image
                    src="/images/일일요약.webp"
                    alt="하루를 한눈에 일일 요약"
                    width={400}
                    height={500}
                    className="object-contain max-h-full"
                  />
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 mt-12 lg:mt-0 reveal" style={{transitionDelay: '0.2s'}}>
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium">간편한 요약</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">하루를 한눈에</h2>
              </div>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                하루 동안의 일정 수, 이동 시간, 총 이동 거리를 한눈에 볼 수 있는 깔끔한 요약을 제공합니다. 
                가족의 하루를 빠르게 파악하고, 다음 날을 더 효과적으로 계획하세요.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.3s'}}>
                  <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">일정 통계</p>
                    <p className="text-gray-600 mt-1">하루 동안의 전체 일정 수와 완료된 일정 수를 통계로 보여주어 일정 진행 상황을 쉽게 파악할 수 있습니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">이동 분석</p>
                    <p className="text-gray-600 mt-1">총 이동 거리와 이동 시간을 보여주어 가족의 활동량을 파악하고 효율적인 일정 계획에 도움을 줍니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.5s'}}>
                  <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">주간/월간 트렌드</p>
                    <p className="text-gray-600 mt-1">일별 데이터를 기반으로 주간 및 월간 활동 트렌드를 확인할 수 있어 생활 패턴을 더 잘 이해할 수 있습니다.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 하루를 한눈에 (일일 요약) - 보라색 */}
      <section className="w-full py-16 md:py-24 bg-purple-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/2 reveal">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 opacity-20 blur-lg"></div>
                <div className="bg-white rounded-xl p-6 h-[450px] flex items-center justify-center shadow-xl border-2 border-white">
                  <div className="bg-white p-4 rounded-lg">
                    <Image
                      src="/images/일일요약.webp"
                      alt="하루를 한눈에 일일 요약"
                      width={400}
                      height={500}
                      className="object-contain max-h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 mt-12 lg:mt-0 reveal" style={{transitionDelay: '0.2s'}}>
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">간편한 요약</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">하루를 한눈에</h2>
              </div>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                하루 동안의 일정 수, 이동 시간, 총 이동 거리를 한눈에 볼 수 있는 깔끔한 요약을 제공합니다. 
                가족의 하루를 빠르게 파악하고, 다음 날을 더 효과적으로 계획하세요.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.3s'}}>
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">일정 통계</p>
                    <p className="text-gray-600 mt-1">하루 동안의 전체 일정 수와 완료된 일정 수를 통계로 보여주어 일정 진행 상황을 쉽게 파악할 수 있습니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">이동 분석</p>
                    <p className="text-gray-600 mt-1">총 이동 거리와 이동 시간을 보여주어 가족의 활동량을 파악하고 효율적인 일정 계획에 도움을 줍니다.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 reveal" style={{transitionDelay: '0.5s'}}>
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">주간/월간 트렌드</p>
                    <p className="text-gray-600 mt-1">일별 데이터를 기반으로 주간 및 월간 활동 트렌드를 확인할 수 있어 생활 패턴을 더 잘 이해할 수 있습니다.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="w-full py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-800 z-0"></div>
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full opacity-20 blur-3xl anim-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full opacity-20 blur-3xl anim-pulse"></div>
        
        <div className="container mx-auto px-4 sm:px-6 relative z-10 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white reveal">지금, 무료로 시작해 보세요!</h2>
          <p className="text-blue-100 text-lg sm:text-xl mb-10 max-w-3xl mx-auto reveal" style={{transitionDelay: '0.1s'}}>
            가족의 행복한 일상을 지키는 파트너, SMAP의 모든 기능을 경험해보세요.
          </p>
          <div className="flex flex-col gap-6 justify-center reveal" style={{transitionDelay: '0.1s'}}>
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <div className="bg-white p-2 rounded-lg shadow-lg mb-2 inline-block">
                    <Image
                      src="/images/appStoreQR.jpg"
                      alt="App Store QR 코드"
                      width={120}
                      height={120}
                      className="rounded"
                    />
                  </div>
                  <p className="text-sm text-indigo-200">App Store</p>
                </div>
                <div className="text-center">
                  <div className="bg-white p-2 rounded-lg shadow-lg mb-2 inline-block">
                    <Image
                      src="/images/googlePlayQR.jpg"
                      alt="Google Play QR 코드"
                      width={120}
                      height={120}
                      className="rounded"
                    />
                  </div>
                  <p className="text-sm text-indigo-200">Google Play</p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-indigo-200 reveal" style={{transitionDelay: '0.3s'}}>카메라로 QR코드를 스캔하여<br />앱을 설치할 수 있습니다.</p>
        </div>
      </section>
    </div>
  );
} 