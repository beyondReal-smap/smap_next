'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import IOSCompatibleSpinner from '../../../../components/common/IOSCompatibleSpinner';
import AnimatedHeader from '../../../../components/common/AnimatedHeader';
import Image from 'next/image';
import { FaUsers, FaDownload } from 'react-icons/fa';
import { HiSparkles, HiDevicePhoneMobile, HiOutlineChevronLeft } from 'react-icons/hi2';
import { IoSparklesSharp } from 'react-icons/io5';

interface GroupInfo {
  sgt_idx: number;
  sgt_title: string;
  sgt_content?: string;
  sgt_memo?: string;
  sgt_code?: string;
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

  // 앱 설치 여부 확인 (iOS)
  const checkAppInstalled = () => {
    if (typeof window === 'undefined') return false;

    try {
      // iOS에서 앱 설치 여부 확인
      if (isIOS()) {
        // Safari에서 앱 설치 여부를 확인하는 방법
        const testLink = 'smap://test';
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = testLink;
        document.body.appendChild(iframe);

        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 100);

        // 실제로는 정확한 확인이 어려우므로 false 반환 (안전하게)
        return false;
      }
      return false;
    } catch (e) {
      console.log('[GROUP_JOIN] 앱 설치 확인 실패:', e);
      return false;
    }
  };

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
          sgt_code: group.sgt_code,
          memberCount: group.memberCount || 0
        });

        // ✅ 정보 로드 후 모바일이면 자동으로 앱 열기 시도
        if (isMobile()) {
          // 약간의 지연 시간을 주어 페이지 렌더링 후 실행
          setTimeout(() => {
            handleOpenApp();
          }, 1000);
        }

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

    console.log(`[GROUP_JOIN] 앱 열기 시작 - 그룹 ID: ${groupId}`);

    // 그룹 정보 저장
    const groupJoinData = {
      groupId: parseInt(groupId),
      groupTitle: groupInfo?.sgt_title,
      timestamp: Date.now()
    };

    localStorage.setItem('pendingGroupJoin', JSON.stringify(groupJoinData));
    console.log('[GROUP_JOIN] localStorage에 그룹 정보 저장:', groupJoinData);

    // 딥링크 시도
    try {
      if (isIOS()) {
        // iOS Safari에서 안전한 딥링크 처리
        const deepLink = `smap://group/${groupId}/join`;
        const fallbackUrl = APP_STORE_URL;

        console.log(`[GROUP_JOIN] iOS 딥링크 시도: ${deepLink}`);

        // iOS에서 더 안전한 딥링크 처리 방법
        let appOpened = false;
        let fallbackTimeout: NodeJS.Timeout;

        // 페이지 가시성 변화를 감지하여 앱이 열렸는지 확인
        const handleVisibilityChange = () => {
          if (document.hidden) {
            appOpened = true;
            console.log('[GROUP_JOIN] iOS 앱이 열림 감지됨');
            if (fallbackTimeout) {
              clearTimeout(fallbackTimeout);
            }
          }
        };

        // 페이지 포커스 변화를 감지
        const handleFocus = () => {
          if (appOpened) {
            console.log('[GROUP_JOIN] iOS 앱이 열린 후 포커스 복귀');
          }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        // 딥링크 시도 (Safari 오류 방지를 위한 안전한 방법)
        try {
          // 방법 1: iframe 사용 (가장 안전한 방법)
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.style.position = 'absolute';
          iframe.style.left = '-9999px';
          iframe.style.top = '-9999px';
          iframe.src = deepLink;
          document.body.appendChild(iframe);

          // 100ms 후 iframe 제거
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 100);
        } catch (e) {
          console.log('[GROUP_JOIN] iOS iframe 방법 실패:', e);

          // 방법 2: window.open 사용 (대안)
          try {
            const newWindow = window.open(deepLink, '_blank');
            if (newWindow) {
              setTimeout(() => {
                newWindow.close();
              }, 100);
            }
          } catch (e2) {
            console.log('[GROUP_JOIN] iOS window.open 방법도 실패:', e2);
          }
        }

        // 2초 후 앱이 열리지 않았으면 앱스토어로 이동
        fallbackTimeout = setTimeout(() => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('focus', handleFocus);

          if (!appOpened) {
            console.log('[GROUP_JOIN] iOS 앱이 열리지 않음, 앱스토어로 이동');
            window.open(fallbackUrl, '_blank');
          }
        }, 2000);

      } else if (isAndroid()) {
        // 안드로이드에서 더 안정적인 방법 사용
        const deepLink = `smap://group/${groupId}/join`;
        console.log(`[GROUP_JOIN] Android 딥링크 시도: ${deepLink}`);
        let appOpened = false;

        // 페이지 가시성 변화를 감지하여 앱이 열렸는지 확인
        const handleVisibilityChange = () => {
          if (document.hidden) {
            appOpened = true;
            console.log('[GROUP_JOIN] Android 앱이 열림 감지됨');
          }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 1. 딥링크 시도 (iframe 사용으로 안전하게)
        try {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = deepLink;
          document.body.appendChild(iframe);

          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 100);
        } catch (e) {
          console.log('[GROUP_JOIN] Android iframe 방법 실패:', e);
        }

        // 2초 후 앱이 열리지 않았으면 플레이스토어로 이동
        setTimeout(() => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          if (!appOpened) {
            console.log('[GROUP_JOIN] Android 앱이 열리지 않음, 플레이스토어로 이동');
            window.open(PLAY_STORE_URL, '_blank');
          }
        }, 2000);
      } else {
        // 데스크톱에서는 바로 스토어로
        console.log('[GROUP_JOIN] 데스크톱에서 앱스토어로 이동');
        window.open(APP_STORE_URL, '_blank');
      }
    } catch (error) {
      console.error('[GROUP_JOIN] 앱 열기 오류:', error);
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
      <>
        {/* 헤더 */}
        <div className="min-h-screen flex items-center justify-center bg-white">
          <IOSCompatibleSpinner
            message="그룹 정보를 불러오는 중..."
            size="lg"
          />
        </div>
      </>
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-center p-6 bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl max-w-sm w-full"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
              className="text-5xl mb-4"
            >
              😕
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="text-xl font-bold text-gray-800 mb-2"
            >
              그룹을 찾을 수 없습니다
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.4 }}
              className="text-gray-600 text-sm mb-6"
            >
              {error || '유효하지 않은 초대 링크입니다.'}
            </motion.p>
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.4 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/')}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium text-sm shadow-lg hover:shadow-xl transition-all"
            >
              홈으로 돌아가기
            </motion.button>
          </motion.div>
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
        <motion.div
          className="absolute inset-0 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          <motion.div
            className="absolute top-20 left-10 w-32 h-32 bg-white/20 rounded-full blur-xl"
            animate={{
              y: [0, -10, 0],
              rotate: [0, 180, 360]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          ></motion.div>
          <motion.div
            className="absolute bottom-20 right-10 w-40 h-40 bg-white/20 rounded-full blur-xl"
            animate={{
              x: [0, 10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          ></motion.div>
          <motion.div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-white/10 rounded-full blur-xl"
            animate={{
              rotate: [0, 360],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "linear"
            }}
          ></motion.div>
        </motion.div>

        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <motion.div
            className="w-full max-w-xs"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            {/* 메인 카드 */}
            <motion.div
              className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              {/* 로고 및 헤더 */}
              <motion.div
                className="text-center mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                {/* <motion.div
                  className="w-16 h-16 mx-auto mb-4 relative"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.7, duration: 0.6, type: "spring", stiffness: 200 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-xl opacity-20 blur-md"></div>
                  <Image
                    src="/images/smap_logo.webp"
                    alt="SMAP 로고"
                    width={64}
                    height={64}
                    className="rounded-xl object-cover relative z-10 border-2 border-white shadow-lg"
                    priority
                  />
                </motion.div> */}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.4 }}
                >
                  <div className="flex items-center justify-center mb-2">
                    <Image
                      src="/images/smap_logo.webp"
                      alt="SMAP 로고"
                      width={44}
                      height={40}
                      className="rounded-md object-cover"
                    />
                    <h1 className="text-lg font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                      그룹 초대
                    </h1>
                    {/* <IoSparklesSharp className="text-yellow-500 text-lg ml-1" /> */}
                  </div>
                  <p className="text-gray-600 text-sm">SMAP에서 함께해요!</p>
                </motion.div>
              </motion.div>

              {/* 그룹 정보 */}
              <motion.div
                className="text-center mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.5 }}
              >
                <motion.div
                  className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-2xl p-4 mb-4"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.0, duration: 0.4 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <motion.h2
                    className="text-xl font-bold text-gray-800 mb-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1, duration: 0.4 }}
                  >
                    {groupInfo.sgt_title}
                  </motion.h2>

                  {(groupInfo.sgt_content || groupInfo.sgt_memo) && (
                    <motion.p
                      className="text-gray-600 text-sm mb-3 leading-relaxed"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.2, duration: 0.4 }}
                    >
                      {groupInfo.sgt_content || groupInfo.sgt_memo}
                    </motion.p>
                  )}

                  <motion.div
                    className="flex items-center justify-center bg-white rounded-xl py-2 px-3 shadow-sm mb-3"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.3, duration: 0.4 }}
                  >
                    <FaUsers className="mr-2 text-indigo-500 text-sm" />
                    <span className="text-gray-700 font-medium text-sm">멤버 {groupInfo.memberCount}명</span>
                  </motion.div>

                  {/* 초대 코드 표시 */}
                  {groupInfo.sgt_code && (
                    <motion.div
                      className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-200"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 1.4, duration: 0.4 }}
                    >
                      <p className="text-xs text-blue-600 font-medium mb-1 text-center">초대 코드</p>
                      <div className="flex items-center justify-center">
                        <code className="text-lg font-mono font-bold text-blue-700 bg-white px-3 py-2 rounded-lg border border-blue-300 text-center shadow-sm">
                          {groupInfo.sgt_code}
                        </code>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>

              {/* 앱 열기 버튼 */}
              {isMobile() && (
                <motion.div
                  className="mb-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.4, duration: 0.5 }}
                >
                  <motion.button
                    onClick={handleOpenApp}
                    className="w-full bg-gradient-to-r from-indigo-400 to-purple-500 text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center space-x-2 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden"
                    whileHover={{
                      scale: 1.02,
                      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
                    }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.5, duration: 0.4, type: "spring" }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 hover:opacity-100 transition-opacity"></div>
                    <motion.div
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <HiDevicePhoneMobile className="text-xl relative z-10" />
                    </motion.div>
                    <span className="relative z-10">{isMobile() ? 'SMAP 앱에서 열기' : '앱 다운로드'}</span>
                  </motion.button>

                  <motion.p
                    className="text-center text-xs text-gray-500 mt-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.6, duration: 0.4 }}
                  >
                    💡 앱이 없다면 자동으로 스토어로 이동해요
                  </motion.p>
                </motion.div>
              )}

              {/* 앱 다운로드 */}
              {/* <div
              >
                <div className="text-center mb-3">
                  <FaDownload className="text-lg text-gray-600 mx-auto mb-1" />
                  <h3 className="text-sm font-bold text-gray-800">
                    {isMobile() ? '앱 다운로드' : 'SMAP 앱 다운로드'}
                  </h3>
                </div>
                
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
              </div> */}
            </motion.div>

            {/* 하단 안내 (데스크톱만) */}
            {!isMobile() && (
              <motion.div
                className="text-center bg-white/20 backdrop-blur-sm rounded-2xl p-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.4 }}
              >
                <p className="text-gray-500 text-xs">
                  📱 이 링크를 모바일에서 열면<br />
                  SMAP 앱에서 바로 그룹에 참여할 수 있어요
                </p>
              </motion.div>
            )}

            {/* 푸터 */}
            <motion.div
              className="text-center mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.4 }}
            >
              <p className="text-gray-700 text-xs">
                © 2025 SMAP All rights reserved.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </>
  );
} 