'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import IOSCompatibleSpinner from '../../../../components/common/IOSCompatibleSpinner';
import Image from 'next/image';
import { FaUsers, FaDownload } from 'react-icons/fa';
import { HiSparkles, HiDevicePhoneMobile } from 'react-icons/hi2';
import { IoSparklesSharp } from 'react-icons/io5';

interface GroupInfo {
  sgt_idx: number;
  sgt_title: string;
  sgt_content?: string;
  sgt_memo?: string;
  memberCount: number;
}

export default function GroupJoinPage() {
  const params = useParams();
  const router = useRouter();
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState<number>(0);

  // body 스타일 초기화 (다른 페이지에서 설정된 잘못된 스타일 제거)
  useEffect(() => {
    // body에 잘못 적용된 position: fixed 등의 스타일 제거
    if (typeof document !== 'undefined') {
      const resetBodyStyles = () => {
        // body 스타일 초기화
        const bodyStyle = document.body.style;
        const htmlStyle = document.documentElement.style;
        
        // 모든 잘못된 스타일 속성들 제거
        const badStyles = [
          'position', 'bottom', 'left', 'right', 'top', 'z-index', 
          'background', 'backdrop-filter', 'transform', 'will-change', 
          'perspective', 'backface-visibility', 'overflow', 'height', 'width'
        ];
        
        badStyles.forEach(prop => {
          bodyStyle.removeProperty(prop);
          htmlStyle.removeProperty(prop);
        });
        
        // 정상적인 기본 스타일 강제 설정
        bodyStyle.setProperty('position', 'static', 'important');
        bodyStyle.setProperty('overflow', 'visible', 'important');
        bodyStyle.setProperty('top', 'auto', 'important');
        bodyStyle.setProperty('left', 'auto', 'important');
        bodyStyle.setProperty('right', 'auto', 'important');
        bodyStyle.setProperty('bottom', 'auto', 'important');
        bodyStyle.setProperty('width', 'auto', 'important');
        bodyStyle.setProperty('height', 'auto', 'important');
        bodyStyle.setProperty('transform', 'none', 'important');
        bodyStyle.setProperty('z-index', 'auto', 'important');
        
        htmlStyle.setProperty('position', 'static', 'important');
        htmlStyle.setProperty('overflow', 'visible', 'important');
        htmlStyle.setProperty('top', 'auto', 'important');
        htmlStyle.setProperty('left', 'auto', 'important');
        htmlStyle.setProperty('right', 'auto', 'important');
        htmlStyle.setProperty('bottom', 'auto', 'important');
        htmlStyle.setProperty('width', 'auto', 'important');
        htmlStyle.setProperty('height', 'auto', 'important');
        htmlStyle.setProperty('transform', 'none', 'important');
        htmlStyle.setProperty('z-index', 'auto', 'important');
      };
      
      // 즉시 실행
      resetBodyStyles();
      
      // 약간의 지연 후에도 실행 (다른 스크립트가 덮어쓰는 경우 대비)
      const timeouts = [
        setTimeout(resetBodyStyles, 100),
        setTimeout(resetBodyStyles, 500),
        setTimeout(resetBodyStyles, 1000)
      ];
      
      // 컴포넌트 언마운트 시 정리
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
        if (typeof document !== 'undefined') {
          document.body.style.position = 'static';
          document.body.style.overflow = 'visible';
          document.documentElement.style.position = 'static';
          document.documentElement.style.overflow = 'visible';
        }
      };
    }
  }, []);

  const groupId = params.id as string;

  // 플랫폼 감지 함수들
  const isIOS = () => {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  };
  
  const isAndroid = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android/.test(navigator.userAgent);
  };
  
  const isMobile = () => isIOS() || isAndroid();

  // 앱 스토어 링크
  const APP_STORE_URL = 'https://apps.apple.com/kr/app/smap-%EC%9C%84%EC%B9%98%EC%B6%94%EC%A0%81-%EC%9D%B4%EB%8F%99%EA%B2%BD%EB%A1%9C-%EC%9D%BC%EC%A0%95/id6480279658?platform=iphone';
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dmonster.smap&hl=ko';

  // 그룹 정보 조회
  useEffect(() => {
    const fetchGroupInfo = async () => {
      if (!groupId) return;
      
      try {
        setLoading(true);
        console.log(`[GroupJoin] 그룹 정보 조회 시작 - groupId: ${groupId}`);
        
        // 공개 그룹 정보 조회
        const response = await fetch(`/api/groups/${groupId}/public`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const responseData = await response.json();
        console.log(`[GroupJoin] 공개 그룹 정보 응답:`, responseData);
        
        if (!responseData.success || !responseData.data) {
          throw new Error('그룹 정보를 찾을 수 없습니다.');
        }
        
        const group = responseData.data;
        setGroupInfo({
          sgt_idx: group.sgt_idx,
          sgt_title: group.sgt_title,
          sgt_content: group.sgt_content,
          sgt_memo: group.sgt_memo,
          memberCount: group.memberCount || 0
        });
        
      } catch (error) {
        console.error('그룹 정보 조회 오류:', error);
        setError(error instanceof Error ? error.message : '그룹 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchGroupInfo();
  }, [groupId]);

  // 앱 열기 시도
  const handleOpenApp = () => {
    if (typeof window === 'undefined') return;
    
    // 그룹 정보 저장
    const groupJoinData = {
      groupId: parseInt(groupId),
      groupTitle: groupInfo?.sgt_title,
      timestamp: Date.now()
    };
    
    localStorage.setItem('pendingGroupJoin', JSON.stringify(groupJoinData));
    
    // 딥링크 시도
    try {
      if (isIOS()) {
        const deepLink = `smap://group/${groupId}/join`;
        window.location.href = deepLink;
        
        // 3초 후 앱스토어로 이동
        setTimeout(() => {
          window.open(APP_STORE_URL, '_blank');
        }, 3000);
      } else if (isAndroid()) {
        const intentUrl = `intent://group/${groupId}/join#Intent;scheme=smap;package=com.dmonster.smap;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
        window.location.href = intentUrl;
      } else {
        // 데스크톱에서는 바로 스토어로
        window.open(APP_STORE_URL, '_blank');
      }
    } catch (error) {
      console.error('앱 열기 오류:', error);
      // 오류 시 스토어로 이동
      if (isIOS()) {
        window.open(APP_STORE_URL, '_blank');
      } else {
        window.open(PLAY_STORE_URL, '_blank');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <IOSCompatibleSpinner 
          message="그룹 정보를 불러오는 중..."
          size="lg"
        />
      </div>
    );
  }

  if (error || !groupInfo) {
    return (
      <>
        {/* 네비게이션 바 숨김 */}
        <style jsx global>{`
          #bottom-navigation-bar,
          .bottom-navigation,
          nav,
          .nav-bar,
          .navigation {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
          
          body {
            padding-bottom: 0 !important;
            margin-bottom: 0 !important;
          }
        `}</style>
        
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
          <div 
            className="text-center p-6 bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl max-w-sm w-full"
          >
            <div className="text-5xl mb-4">😕</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">그룹을 찾을 수 없습니다</h1>
            <p className="text-gray-600 text-sm mb-6">{error || '유효하지 않은 초대 링크입니다.'}</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium text-sm shadow-lg hover:shadow-xl transition-all"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* 강제로 body 스타일 재설정 */}
      <style jsx global>{`
        /* body의 모든 잘못된 스타일 강제 재설정 */
        body {
          position: static !important;
          top: auto !important;
          left: auto !important;
          right: auto !important;
          bottom: auto !important;
          width: auto !important;
          height: auto !important;
          overflow: visible !important;
          background: transparent !important;
          backdrop-filter: none !important;
          transform: none !important;
          will-change: auto !important;
          perspective: none !important;
          backface-visibility: visible !important;
          z-index: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        html {
          position: static !important;
          top: auto !important;
          left: auto !important;
          right: auto !important;
          bottom: auto !important;
          width: auto !important;
          height: auto !important;
          overflow: visible !important;
          background: transparent !important;
          backdrop-filter: none !important;
          transform: none !important;
          will-change: auto !important;
          perspective: none !important;
          backface-visibility: visible !important;
          z-index: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* 페이지가 정상적으로 보이도록 보장 */
        .min-h-screen {
          min-height: 100vh !important;
        }
      `}</style>
      
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-200 to-pink-200 relative overflow-hidden">
        {/* 배경 장식 */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-32 h-32 bg-white/20 rounded-full blur-xl"></div>
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-white/20 rounded-full blur-xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
        </div>

        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <div
            className="w-full max-w-xs"
          >
            {/* 메인 카드 */}
            <div
              className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-4"
            >
              {/* 로고 및 헤더 */}
              <div className="text-center mb-6">
                <div
                  className="w-16 h-16 mx-auto mb-4 relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-full opacity-20 blur-md"></div>
                  <Image
                    src="/images/smap_logo.webp"
                    alt="SMAP 로고"
                    width={64}
                    height={64}
                    className="rounded-full object-cover relative z-10 border-3 border-white shadow-lg"
                    priority
                  />
                </div>
                
                <div
                >
                  <div className="flex items-center justify-center mb-2">
                    <IoSparklesSharp className="text-yellow-500 text-lg mr-1" />
                    <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      그룹 초대
                    </h1>
                    <IoSparklesSharp className="text-yellow-500 text-lg ml-1" />
                  </div>
                  <p className="text-gray-600 text-sm">SMAP에서 함께해요!</p>
                </div>
              </div>

              {/* 그룹 정보 */}
              <div
                className="text-center mb-6"
              >
                <div className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-2xl p-4 mb-4">
                  <h2 className="text-xl font-bold text-gray-800 mb-2">{groupInfo.sgt_title}</h2>
                  
                  {(groupInfo.sgt_content || groupInfo.sgt_memo) && (
                    <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                      {groupInfo.sgt_content || groupInfo.sgt_memo}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-center bg-white rounded-xl py-2 px-3 shadow-sm">
                    <FaUsers className="mr-2 text-indigo-500 text-sm" />
                    <span className="text-gray-700 font-medium text-sm">멤버 {groupInfo.memberCount}명</span>
                  </div>
                </div>
              </div>

              {/* 앱 열기 버튼 */}
              {isMobile() && (
                <div
                  className="mb-4"
                >
                  <button
                    onClick={handleOpenApp}
                    className="w-full bg-gradient-to-r from-indigo-400 to-purple-500 text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center space-x-2 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 hover:opacity-100 transition-opacity"></div>
                    <HiDevicePhoneMobile className="text-xl relative z-10" />
                    <span className="relative z-10">SMAP 앱에서 열기</span>
                  </button>
                  
                  <p className="text-center text-xs text-gray-500 mt-2">
                    💡 앱이 없다면 자동으로 스토어로 이동해요
                  </p>
                </div>
              )}

              {/* 앱 다운로드 */}
              <div
              >
                {/* <div className="text-center mb-3">
                  <FaDownload className="text-lg text-gray-600 mx-auto mb-1" />
                  <h3 className="text-sm font-bold text-gray-800">
                    {isMobile() ? '앱 다운로드' : 'SMAP 앱 다운로드'}
                  </h3>
                </div> */}
                
                <div className="flex space-x-3">
                  <a
                    href={APP_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Image
                      src="/images/app-store-badge.png"
                      alt="Download on the App Store"
                      width={320}
                      height={95}
                      className="w-full h-auto rounded-lg hover:scale-105 transition-transform"
                    />
                  </a>
                  
                  <a
                    href={PLAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Image
                      src="/images/google-play-badge.png"
                      alt="Get it on Google Play"
                      width={245}
                      height={95}
                      className="w-full h-auto rounded-lg hover:scale-105 transition-transform"
                    />
                  </a>
                </div>
              </div>
            </div>

            {/* 하단 안내 (데스크톱만) */}
            {!isMobile() && (
              <div
                className="text-center bg-white/20 backdrop-blur-sm rounded-2xl p-4"
              >
                <p className="text-white text-xs">
                  📱 이 링크를 모바일에서 열면<br />
                  SMAP 앱에서 바로 그룹에 참여할 수 있어요
                </p>
              </div>
            )}

            {/* 푸터 */}
            <div
              className="text-center mt-4"
            >
              <p className="text-gray-700 text-xs">
                © 2025 SMAP All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 