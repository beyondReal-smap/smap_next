'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FaUsers, FaDownload, FaApple, FaGooglePlay, FaExternalLinkAlt } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import Image from 'next/image';
import groupService from '@/services/groupService';
import { useAuth } from '@/contexts/AuthContext';
import IOSCompatibleSpinner from '../../../components/common/IOSCompatibleSpinner';

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
  const { user } = useAuth();
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const groupId = params.id as string;

  // 플랫폼 감지
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = () => /Android/.test(navigator.userAgent);
  const isMobile = () => isIOS() || isAndroid();

  // 앱 스토어 링크
  const APP_STORE_URL = 'https://apps.apple.com/kr/app/smap-%EC%9C%84%EC%B9%98%EC%B6%94%EC%A0%81-%EC%9D%B4%EB%8F%99%EA%B2%BD%EB%A1%9C-%EC%9D%BC%EC%A0%95/id6480279658?platform=iphone';
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dmonster.smap&hl=ko';

  // 앱 스토어 링크 (그룹 ID 포함)
  const getAppStoreUrl = () => {
    const groupParams = `group_id=${groupId}&group_title=${encodeURIComponent(groupInfo?.sgt_title || '')}&source=group_invite`;
    
    if (isIOS()) {
      return `${APP_STORE_URL}&${groupParams}`;
    } else if (isAndroid()) {
      return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(`group_invite_${groupId}`)}&utm_source=group_invite&utm_medium=web&utm_campaign=group_${groupId}`;
    }
    return APP_STORE_URL;
  };

  // 앱 설치 여부 감지 (간접적 방법)
  const checkAppInstalled = () => {
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('앱이 설치되어 있지 않은 것으로 판단됩니다.');
        resolve(false);
      }, 2500);
      
      const startTime = Date.now();
      
      // 앱이 열리면 페이지가 숨겨지거나 blur 이벤트 발생
      const handleVisibilityChange = () => {
        if (document.hidden) {
          const timeDiff = Date.now() - startTime;
          if (timeDiff < 2000) { // 2초 이내에 숨겨지면 앱이 열린 것으로 판단
            clearTimeout(timeout);
            console.log('앱이 성공적으로 열렸습니다.');
            resolve(true);
          }
        }
      };
      
      const handleBlur = () => {
        const timeDiff = Date.now() - startTime;
        if (timeDiff < 2000) {
          clearTimeout(timeout);
          console.log('앱이 성공적으로 열렸습니다 (blur).');
          resolve(true);
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleBlur);
      
      // 앱 스키마 실행 (딥링크)
      try {
        if (isIOS()) {
          // iOS: 커스텀 URL 스키마 (더 상세한 정보 포함)
          const deepLink = `smap://group/${groupId}/join?title=${encodeURIComponent(groupInfo?.sgt_title || '')}&content=${encodeURIComponent(groupInfo?.sgt_content || '')}&memo=${encodeURIComponent(groupInfo?.sgt_memo || '')}&memberCount=${groupInfo?.memberCount || 0}`;
          console.log('iOS 딥링크 시도:', deepLink);
          window.location.href = deepLink;
        } else if (isAndroid()) {
          // Android: Intent URL (더 상세한 정보 포함)
          const fallbackUrl = getAppStoreUrl(); // 그룹 정보가 포함된 앱스토어 URL 사용
          const deepLink = `intent://group/${groupId}/join?title=${encodeURIComponent(groupInfo?.sgt_title || '')}&content=${encodeURIComponent(groupInfo?.sgt_content || '')}&memo=${encodeURIComponent(groupInfo?.sgt_memo || '')}&memberCount=${groupInfo?.memberCount || 0}#Intent;scheme=smap;package=com.dmonster.smap;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
          console.log('Android 딥링크 시도:', deepLink);
          window.location.href = deepLink;
        }
      } catch (error) {
        console.error('앱 스키마 실행 오류:', error);
        clearTimeout(timeout);
        resolve(false);
      }
      
      // 정리 함수
      setTimeout(() => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleBlur);
      }, 3000);
    });
  };

  // 그룹 정보 조회
  useEffect(() => {
    const fetchGroupInfo = async () => {
      try {
        setLoading(true);
        console.log(`[GroupJoin] 그룹 정보 조회 시작 - groupId: ${groupId}`);
        
        // 여러 방법으로 그룹 정보 조회 시도
        let group = null;
        
        try {
          // 방법 1: 직접 그룹 ID로 조회
          console.log(`[GroupJoin] 방법 1: getGroupById 시도`);
          const response: any = await groupService.getGroupById(parseInt(groupId));
          console.log(`[GroupJoin] getGroupById 응답:`, response);
          
          if (response.success && response.data) {
            group = response.data;
          } else if (response.sgt_idx) {
            group = response;
          }
        } catch (directError) {
          console.log(`[GroupJoin] 방법 1 실패:`, directError);
        }
        
        if (!group) {
          try {
            // 방법 2: 전체 그룹 목록에서 찾기
            console.log(`[GroupJoin] 방법 2: getAllGroups에서 찾기 시도`);
            const allGroups = await groupService.getAllGroups(0, 1000);
            console.log(`[GroupJoin] 전체 그룹 목록:`, allGroups);
            
            const foundGroup = allGroups.find(g => g.sgt_idx === parseInt(groupId));
            if (foundGroup) {
              group = foundGroup;
              console.log(`[GroupJoin] 전체 목록에서 그룹 발견:`, group);
            }
          } catch (listError) {
            console.log(`[GroupJoin] 방법 2 실패:`, listError);
          }
        }
        
        if (!group) {
          throw new Error(`그룹 ID ${groupId}를 찾을 수 없습니다.`);
        }
        
        console.log(`[GroupJoin] 최종 그룹 데이터:`, group);
        
        // 그룹 멤버 수 조회
        let memberCount = group.member_count || group.memberCount || 0;
        
        try {
          console.log(`[GroupJoin] 그룹 멤버 수 조회 시도`);
          const members = await groupService.getGroupMembers(parseInt(groupId));
          memberCount = members.length;
          console.log(`[GroupJoin] 그룹 멤버 수:`, memberCount);
        } catch (memberError) {
          console.log(`[GroupJoin] 멤버 수 조회 실패, 기본값 사용:`, memberError);
        }
        
        setGroupInfo({
          sgt_idx: group.sgt_idx,
          sgt_title: group.sgt_title,
          sgt_content: group.sgt_content,
          sgt_memo: group.sgt_memo,
          memberCount: memberCount
        });
      } catch (error) {
        console.error('그룹 정보 조회 오류:', error);
        console.error('오류 상세:', error instanceof Error ? error.message : String(error));
        setError(error instanceof Error ? error.message : '그룹 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (groupId) {
      fetchGroupInfo();
    }
  }, [groupId]);

  // 로그인 후 자동 그룹 가입 처리
  useEffect(() => {
    const handleAutoJoin = async () => {
      // localStorage에서 리다이렉트 정보 확인
      const redirectAfterLogin = localStorage.getItem('redirectAfterLogin');
      
      if (user && redirectAfterLogin === `/group/${groupId}/join`) {
        // 리다이렉트 정보 삭제
        localStorage.removeItem('redirectAfterLogin');
        
        // 자동으로 그룹 가입 시도
        try {
          await groupService.joinGroup(parseInt(groupId));
          
          // 가입 성공 후 그룹 페이지로 이동
          router.push('/group');
        } catch (error) {
          console.error('자동 그룹 가입 오류:', error);
          // 자동 가입 실패 시 사용자에게 수동 가입 옵션 제공
        }
      }
    };

    handleAutoJoin();
  }, [user, groupId, router]);

  // 앱으로 이동 시도
  const handleOpenApp = async () => {
    // 앱 설치 후 자동 그룹 가입을 위해 그룹 정보 저장 (더 상세한 정보)
    const groupJoinData = {
      groupId: parseInt(groupId),
      groupTitle: groupInfo?.sgt_title,
      groupContent: groupInfo?.sgt_content,
      groupMemo: groupInfo?.sgt_memo,
      memberCount: groupInfo?.memberCount,
      timestamp: Date.now(),
      source: 'group_invite_link',
      deepLink: `smap://group/${groupId}/join?title=${encodeURIComponent(groupInfo?.sgt_title || '')}&content=${encodeURIComponent(groupInfo?.sgt_content || '')}&memo=${encodeURIComponent(groupInfo?.sgt_memo || '')}&memberCount=${groupInfo?.memberCount || 0}`
    };
    
    localStorage.setItem('pendingGroupJoin', JSON.stringify(groupJoinData));
    
    // 앱 설치 여부 확인을 위한 추가 정보도 저장
    localStorage.setItem('appInstallRedirect', JSON.stringify({
      groupId: parseInt(groupId),
      timestamp: Date.now(),
      returnUrl: window.location.href,
      appStoreUrl: getAppStoreUrl()
    }));
    
    // URL 파라미터로도 그룹 정보 저장 (앱에서 URL 스키마로 접근할 때)
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('pending_group_id', groupId);
    urlParams.set('pending_group_title', groupInfo?.sgt_title || '');
    urlParams.set('pending_group_timestamp', Date.now().toString());
    
    // 현재 URL에 파라미터 추가 (브라우저 히스토리에 저장)
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.replaceState({}, '', newUrl);
    
    console.log('앱 열기 시도 중...', groupJoinData);
    
    try {
      const appInstalled = await checkAppInstalled();
      
      if (!appInstalled) {
        console.log('앱이 설치되어 있지 않음, 스토어로 이동');
        
        // 스토어로 이동하기 전에 사용자에게 안내
        const shouldProceed = confirm(
          'SMAP 앱이 설치되어 있지 않습니다.\n\n' +
          '1. 앱스토어에서 SMAP을 설치해주세요\n' +
          '2. 설치 후 앱을 열고 회원가입/로그인을 해주세요\n' +
          '3. 자동으로 초대받은 그룹에 가입됩니다\n\n' +
          '앱스토어로 이동하시겠습니까?'
        );
        
        if (shouldProceed) {
          if (isIOS()) {
            window.open(getAppStoreUrl(), '_blank');
          } else if (isAndroid()) {
            window.open(getAppStoreUrl(), '_blank');
          } else {
            alert('SMAP은 모바일 앱으로 제공됩니다. 모바일 기기에서 접속해주세요.');
          }
        }
      } else {
        console.log('앱이 성공적으로 열림');
        // 앱이 열렸으므로 성공 메시지 표시
        alert('SMAP 앱이 열렸습니다!\n\n앱에서 회원가입/로그인 후 자동으로 그룹에 가입됩니다.');
      }
    } catch (error) {
      console.error('앱 열기 중 오류:', error);
      // 오류 발생 시 스토어로 이동
      if (isIOS()) {
        window.open(getAppStoreUrl(), '_blank');
      } else if (isAndroid()) {
        window.open(getAppStoreUrl(), '_blank');
      }
    }
  };

  // 웹에서 그룹 가입 (register 페이지로 이동)
  const handleJoinGroup = async () => {
    // 로그인 여부와 관계없이 register 페이지로 이동하면서 그룹 정보 저장
    localStorage.setItem('redirectAfterRegister', `/group/${groupId}/join`);
    localStorage.setItem('pendingGroupJoin', JSON.stringify({
      groupId: groupId,
      groupTitle: groupInfo?.sgt_title,
      timestamp: Date.now()
    }));
    router.push('/register');
  };

  // 앱 설치 후 자동 그룹 가입 처리 (페이지 로드 시 체크)
  useEffect(() => {
    const checkPendingGroupJoin = () => {
      try {
        const pendingGroupJoin = localStorage.getItem('pendingGroupJoin');
        const appInstallRedirect = localStorage.getItem('appInstallRedirect');
        
        // URL 파라미터에서도 그룹 정보 확인
        const urlParams = new URLSearchParams(window.location.search);
        const pendingGroupId = urlParams.get('pending_group_id');
        const pendingGroupTitle = urlParams.get('pending_group_title');
        const pendingGroupTimestamp = urlParams.get('pending_group_timestamp');
        
        let groupData = null;
        
        // 1. localStorage에서 그룹 정보 확인
        if (pendingGroupJoin) {
          groupData = JSON.parse(pendingGroupJoin);
          console.log('[자동 그룹 가입] localStorage에서 그룹 정보 발견:', groupData);
        }
        // 2. URL 파라미터에서 그룹 정보 확인 (localStorage보다 우선)
        else if (pendingGroupId && pendingGroupTitle && pendingGroupTimestamp) {
          groupData = {
            groupId: parseInt(pendingGroupId),
            groupTitle: pendingGroupTitle,
            timestamp: parseInt(pendingGroupTimestamp),
            source: 'url_parameter'
          };
          console.log('[자동 그룹 가입] URL 파라미터에서 그룹 정보 발견:', groupData);
          
          // URL 파라미터 정보를 localStorage에도 저장
          localStorage.setItem('pendingGroupJoin', JSON.stringify(groupData));
        }
        
        if (groupData) {
          // 24시간 이내의 데이터인지 확인
          const isRecent = (Date.now() - groupData.timestamp) < (24 * 60 * 60 * 1000);
          
          if (isRecent && user) {
            console.log('[자동 그룹 가입] 사용자 로그인 확인, 그룹 가입 시도');
            
            // 자동 그룹 가입 시도
            groupService.joinGroup(groupData.groupId)
              .then(() => {
                console.log('[자동 그룹 가입] 성공');
                localStorage.removeItem('pendingGroupJoin');
                localStorage.removeItem('appInstallRedirect');
                
                // URL 파라미터도 정리
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, '', cleanUrl);
                
                // 성공 메시지 표시
                alert(`🎉 "${groupData.groupTitle}" 그룹에 성공적으로 가입되었습니다!`);
                
                // 그룹 페이지로 이동
                router.push('/group');
              })
              .catch((error) => {
                console.error('[자동 그룹 가입] 실패:', error);
                
                // 실패 시 사용자에게 수동 가입 안내
                const shouldRetry = confirm(
                  `자동 그룹 가입에 실패했습니다.\n\n` +
                  `그룹: ${groupData.groupTitle}\n` +
                  `오류: ${error.message || '알 수 없는 오류'}\n\n` +
                  `수동으로 다시 시도하시겠습니까?`
                );
                
                if (shouldRetry) {
                  // 현재 페이지에서 그룹 가입 시도
                  router.push(`/group/${groupData.groupId}/join`);
                }
              });
          } else if (!isRecent) {
            console.log('[자동 그룹 가입] 24시간이 지난 데이터, 삭제');
            localStorage.removeItem('pendingGroupJoin');
            localStorage.removeItem('appInstallRedirect');
            
            // URL 파라미터도 정리
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, '', cleanUrl);
          }
        }
      } catch (error) {
        console.error('[자동 그룹 가입] 처리 중 오류:', error);
        localStorage.removeItem('pendingGroupJoin');
        localStorage.removeItem('appInstallRedirect');
        
        // URL 파라미터도 정리
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    };

    // 페이지 로드 시 체크
    checkPendingGroupJoin();
    
    // 사용자 로그인 상태 변경 시에도 체크
    if (user) {
      checkPendingGroupJoin();
    }
  }, [user, router]);

  if (loading) {
    return (
      <>
        {/* 네비게이션 바 강제 숨김 CSS */}
        <style jsx global>{`
          #bottom-navigation-bar {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
          
          /* 하단 네비게이션이 있던 공간 확보 */
          body {
            padding-bottom: 0 !important;
          }
        `}</style>
        
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
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
        {/* 네비게이션 바 강제 숨김 CSS */}
        <style jsx global>{`
          #bottom-navigation-bar {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
          
          /* 하단 네비게이션이 있던 공간 확보 */
          body {
            padding-bottom: 0 !important;
          }
        `}</style>
        
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">😕</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">그룹을 찾을 수 없습니다</h1>
            <p className="text-gray-600 mb-6">{error || '유효하지 않은 초대 링크입니다.'}</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
      {/* 네비게이션 바 강제 숨김 CSS */}
      <style jsx global>{`
        #bottom-navigation-bar {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        
        /* 하단 네비게이션이 있던 공간 확보 */
        body {
          padding-bottom: 0 !important;
        }
      `}</style>
      
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="container mx-auto px-4 pt-24 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-md mx-auto"
          >
          {/* 헤더 */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 mx-auto mb-4 relative"
            >
              <Image
                src="/images/smap_logo.webp"
                alt="SMAP 로고"
                width={80}
                height={80}
                className="rounded-full object-cover"
                priority
              />
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">그룹 초대</h1>
            <p className="text-gray-600">SMAP에서 함께해요!</p>
          </div>

          {/* 그룹 정보 카드 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-lg p-6 mb-6"
          >
            <div className="text-center">
              <HiSparkles className="text-yellow-500 text-3xl mx-auto mb-3" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">{groupInfo.sgt_title}</h2>
              {(groupInfo.sgt_content || groupInfo.sgt_memo) && (
                <p className="text-gray-600 text-sm mb-4">
                  {groupInfo.sgt_content || groupInfo.sgt_memo}
                </p>
              )}
              <div className="flex items-center justify-center text-sm text-gray-500">
                <FaUsers className="mr-1" />
                <span>멤버 {groupInfo.memberCount}명</span>
              </div>
            </div>
          </motion.div>

          {/* 액션 버튼들 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            {isMobile() && (
              <>
                <motion.button
                  onClick={handleOpenApp}
                  className="w-full bg-[#0113A3] text-white py-4 rounded-xl font-semibold flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FaExternalLinkAlt />
                  <span>SMAP 앱에서 열기</span>
                </motion.button>
                
                <div className="text-center text-xs text-gray-500 px-4">
                  <p>📱 <strong>앱 설치 후 자동 가입</strong></p>
                  <p>1. 앱스토어에서 SMAP 설치</p>
                  <p>2. 앱에서 회원가입/로그인</p>
                  <p>3. 자동으로 이 그룹에 가입됩니다!</p>
                </div>
              </>
            )}

            {/* 앱 다운로드 링크 */}
            {!isMobile() && (
              <div className="text-center pt-4">
                <p className="text-gray-600 text-sm mb-2">📱 모바일에서 더 편리하게 이용하세요</p>
                <p className="text-gray-500 text-xs mb-4">앱 설치 후 로그인하면 자동으로 그룹에 가입됩니다</p>
                <div className="flex space-x-4 justify-center">
                  <a
                    href={getAppStoreUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <FaApple />
                    <span className="text-sm">App Store</span>
                  </a>
                  <a
                    href={getAppStoreUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <FaGooglePlay />
                    <span className="text-sm">Play Store</span>
                  </a>
                </div>
              </div>
            )}
          </motion.div>

          {/* 푸터 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mt-8 text-gray-500 text-sm"
          >
            <p>© 2025 SMAP. 함께하는 위치 공유 서비스</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
    </>
  );
} 