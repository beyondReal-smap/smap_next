'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUsers, FiUserPlus, FiX, FiPlus } from 'react-icons/fi';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import groupService from '@/services/groupService';
import { useLocationPermission } from '@/hooks/useLocationPermission';
import LocationPermissionModal from '@/components/ui/LocationPermissionModal';

interface GroupInitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const GroupInitModal: React.FC<GroupInitModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { user } = useAuth();
  
  console.log('[GroupInitModal] 컴포넌트 렌더링:', { 
    isOpen, 
    user: user?.mt_idx,
    timestamp: new Date().toISOString(),
    componentMounted: true
  });
  const { forceRefreshGroups } = useUser();
  const {
    permissionState,
    showPermissionModal,
    requestPermission,
    openSettings,
    closePermissionModal
  } = useLocationPermission();

  // 디버깅을 위한 로그
  console.log('[GroupInitModal] 권한 상태:', permissionState);
  console.log('[GroupInitModal] 모달 표시 상태:', showPermissionModal);

  // 네비게이션 바 숨김/표시 관리
  useEffect(() => {
    const bottomNavBar = document.getElementById('bottom-navigation-bar');
    
    if (isOpen && bottomNavBar) {
      console.log('[GroupInitModal] 네비게이션 바 숨김 시작');
      
      // 모달이 열릴 때 네비게이션 바 숨기기 (강제 적용)
      bottomNavBar.style.setProperty('display', 'none', 'important');
      bottomNavBar.style.setProperty('visibility', 'hidden', 'important');
      bottomNavBar.style.setProperty('opacity', '0', 'important');
      bottomNavBar.style.setProperty('pointer-events', 'none', 'important');
      bottomNavBar.style.setProperty('transform', 'translateY(100%)', 'important');
      bottomNavBar.style.setProperty('z-index', '0', 'important');
      bottomNavBar.style.setProperty('position', 'fixed', 'important');
      bottomNavBar.style.setProperty('bottom', '0px', 'important');
      bottomNavBar.style.setProperty('left', '0px', 'important');
      bottomNavBar.style.setProperty('right', '0px', 'important');
      bottomNavBar.style.setProperty('width', '100%', 'important');
      bottomNavBar.style.setProperty('background', 'transparent', 'important');
      bottomNavBar.style.setProperty('border-top', 'none', 'important');
      bottomNavBar.style.setProperty('box-shadow', 'none', 'important');
      
      // 추가적으로 CSS 클래스로도 숨김 처리
      bottomNavBar.classList.add('modal-open-hidden');
      
      // 내부 요소들도 숨김
      const navElements = bottomNavBar.querySelectorAll('*');
      navElements.forEach(element => {
        if (element instanceof HTMLElement) {
          element.style.setProperty('display', 'none', 'important');
          element.style.setProperty('visibility', 'hidden', 'important');
          element.style.setProperty('opacity', '0', 'important');
          element.style.setProperty('pointer-events', 'none', 'important');
        }
      });
      
      console.log('[GroupInitModal] 네비게이션 바 숨김 완료');
    } else if (!isOpen && bottomNavBar) {
      console.log('[GroupInitModal] 네비게이션 바 표시 시작');
      
      // 모달이 닫힐 때 네비게이션 바 다시 표시
      bottomNavBar.style.removeProperty('display');
      bottomNavBar.style.removeProperty('visibility');
      bottomNavBar.style.removeProperty('opacity');
      bottomNavBar.style.removeProperty('pointer-events');
      bottomNavBar.style.removeProperty('transform');
      bottomNavBar.style.removeProperty('z-index');
      bottomNavBar.style.removeProperty('position');
      bottomNavBar.style.removeProperty('bottom');
      bottomNavBar.style.removeProperty('left');
      bottomNavBar.style.removeProperty('right');
      bottomNavBar.style.removeProperty('width');
      bottomNavBar.style.removeProperty('background');
      bottomNavBar.style.removeProperty('border-top');
      bottomNavBar.style.removeProperty('box-shadow');
      
      // CSS 클래스 제거
      bottomNavBar.classList.remove('modal-open-hidden');
      
      // 내부 요소들도 복원
      const navElements = bottomNavBar.querySelectorAll('*');
      navElements.forEach(element => {
        if (element instanceof HTMLElement) {
          element.style.removeProperty('display');
          element.style.removeProperty('visibility');
          element.style.removeProperty('opacity');
          element.style.removeProperty('pointer-events');
        }
      });
      
      console.log('[GroupInitModal] 네비게이션 바 표시 완료');
    }

    // 컴포넌트 언마운트 시 네비게이션 바 복원
    return () => {
      if (bottomNavBar) {
        console.log('[GroupInitModal] 컴포넌트 언마운트 - 네비게이션 바 복원');
        bottomNavBar.style.removeProperty('display');
        bottomNavBar.style.removeProperty('visibility');
        bottomNavBar.style.removeProperty('opacity');
        bottomNavBar.style.removeProperty('pointer-events');
        bottomNavBar.style.removeProperty('transform');
        bottomNavBar.style.removeProperty('z-index');
        bottomNavBar.style.removeProperty('position');
        bottomNavBar.style.removeProperty('bottom');
        bottomNavBar.style.removeProperty('left');
        bottomNavBar.style.removeProperty('right');
        bottomNavBar.style.removeProperty('width');
        bottomNavBar.style.removeProperty('background');
        bottomNavBar.style.removeProperty('border-top');
        bottomNavBar.style.removeProperty('box-shadow');
        bottomNavBar.classList.remove('modal-open-hidden');
        
        // 내부 요소들도 복원
        const navElements = bottomNavBar.querySelectorAll('*');
        navElements.forEach(element => {
          if (element instanceof HTMLElement) {
            element.style.removeProperty('display');
            element.style.removeProperty('visibility');
            element.style.removeProperty('opacity');
            element.style.removeProperty('pointer-events');
          }
        });
      }
    };
  }, [isOpen]);

  // 그룹 생성 핸들러
  const handleCreateGroup = useCallback(async () => {
    console.log('[GroupInitModal] 그룹 생성 버튼 클릭됨');
    
    if (!groupName.trim()) {
      console.log('[GroupInitModal] 그룹명이 비어있음');
      setError('그룹명을 입력해주세요.');
      return;
    }

    if (!user?.mt_idx) {
      setError('사용자 정보를 찾을 수 없습니다.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('[GroupInitModal] 그룹 생성 시도:', { groupName, mt_idx: user.mt_idx });
      
      const newGroup = await groupService.createGroup({
        sgt_title: groupName.trim(),
        mt_idx: user.mt_idx,
        sgt_show: 'Y'
      });

      console.log('[GroupInitModal] 그룹 생성 성공:', newGroup);

      // UserContext 그룹 데이터 강제 새로고침
      await forceRefreshGroups();
      
      // 추가적인 데이터 새로고침을 위한 지연 실행
      setTimeout(async () => {
        console.log('[GroupInitModal] 그룹 생성 후 추가 데이터 새로고침');
        await forceRefreshGroups();
      }, 300);

      onSuccess();
      
      // 위치 권한 요청 (iOS/Android에서 권한이 없거나 제한된 경우)
      console.log('[GroupInitModal] 그룹 생성 후 권한 상태:', permissionState);
      
      // 안드로이드 환경 감지
      const isAndroid = /Android/.test(navigator.userAgent);
      console.log('[GroupInitModal] 안드로이드 환경:', isAndroid);
      
      // 안드로이드에서는 무조건 권한 요청 시도
      if (isAndroid) {
        console.log('[GroupInitModal] 안드로이드 - 위치 권한 요청 강제 실행');
        setTimeout(() => {
          requestPermission();
        }, 1000); // 안드로이드에서는 더 긴 지연
      } else if (permissionState.status === 'denied' || permissionState.status === 'prompt') {
        console.log('[GroupInitModal] iOS - 위치 권한 요청 시작');
        setTimeout(() => {
          requestPermission();
        }, 500);
      } else {
        console.log('[GroupInitModal] 권한 상태가 허용됨 또는 확인 불가:', permissionState.status);
        // 권한 상태가 unknown인 경우에도 요청해보기
        setTimeout(() => {
          requestPermission();
        }, 500);
      }
    } catch (error) {
      console.error('[GroupInitModal] 그룹 생성 실패:', error);
      setError(error instanceof Error ? error.message : '그룹 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [groupName, user?.mt_idx, forceRefreshGroups, onSuccess, permissionState.status, requestPermission]);

  // 그룹 가입 핸들러
  const handleJoinGroup = useCallback(async () => {
    console.log('[GroupInitModal] 그룹 가입 버튼 클릭됨');
    
    if (!inviteCode.trim()) {
      console.log('[GroupInitModal] 초대 코드가 비어있음');
      setError('초대 코드를 입력해주세요.');
      return;
    }

    if (inviteCode.trim().length !== 6) {
      setError('초대 코드는 6자리여야 합니다.');
      return;
    }

    if (!user?.mt_idx) {
      setError('사용자 정보를 찾을 수 없습니다.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('[GroupInitModal] 그룹 가입 시도:', { inviteCode: inviteCode.trim() });

      // 초대 코드로 그룹 정보 조회
      const groupInfo = await groupService.getGroupByCode(inviteCode.trim());
      console.log('[GroupInitModal] 그룹 정보 조회 성공:', groupInfo);

      // 그룹 가입
      const joinResult = await groupService.joinNewMemberToGroup(groupInfo.sgt_idx, user.mt_idx);
      
      if (!joinResult.success) {
        throw new Error(joinResult.message || '그룹 가입에 실패했습니다.');
      }

      console.log('[GroupInitModal] 그룹 가입 성공:', joinResult);

      // UserContext 그룹 데이터 강제 새로고침
      await forceRefreshGroups();
      
      // 추가적인 데이터 새로고침을 위한 지연 실행
      setTimeout(async () => {
        console.log('[GroupInitModal] 그룹 가입 후 추가 데이터 새로고침');
        await forceRefreshGroups();
      }, 300);

      onSuccess();
      
      // 위치 권한 요청 (iOS/Android에서 권한이 없거나 제한된 경우)
      console.log('[GroupInitModal] 그룹 가입 후 권한 상태:', permissionState);
      
      // 안드로이드 환경 감지
      const isAndroid = /Android/.test(navigator.userAgent);
      console.log('[GroupInitModal] 안드로이드 환경:', isAndroid);
      
      // 안드로이드에서는 무조건 권한 요청 시도
      if (isAndroid) {
        console.log('[GroupInitModal] 안드로이드 - 위치 권한 요청 강제 실행');
        setTimeout(() => {
          requestPermission();
        }, 1000); // 안드로이드에서는 더 긴 지연
      } else if (permissionState.status === 'denied' || permissionState.status === 'prompt') {
        console.log('[GroupInitModal] iOS - 위치 권한 요청 시작');
        setTimeout(() => {
          requestPermission();
        }, 500);
      } else {
        console.log('[GroupInitModal] 권한 상태가 허용됨 또는 확인 불가:', permissionState.status);
        // 권한 상태가 unknown인 경우에도 요청해보기
        setTimeout(() => {
          requestPermission();
        }, 500);
      }
    } catch (error) {
      console.error('[GroupInitModal] 그룹 가입 실패:', error);
      setError(error instanceof Error ? error.message : '그룹 가입에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [inviteCode, user?.mt_idx, forceRefreshGroups, onSuccess, permissionState.status, requestPermission]);

  const resetForm = () => {
    setGroupName('');
    setInviteCode('');
    setError('');
    setActiveTab('create');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) {
    console.log('[GroupInitModal] 모달이 닫혀있음 - 렌더링하지 않음');
    return null;
  }
  
  console.log('[GroupInitModal] 모달이 열려있음 - 렌더링 시작');
  
  // 🚨 강제 로그 (항상 표시)
  console.log('🚨 [GroupInitModal] 강제 로그 - 모달이 열려있습니다!');
  console.log('🚨 [GroupInitModal] 현재 상태:', {
    isOpen,
    user: user?.mt_idx,
    activeTab,
    groupName,
    inviteCode,
    isLoading,
    error
  });

    return (
    <>
      {console.log('[GroupInitModal] JSX 렌더링 시작')}
      {/* 🚨 DOM에 직접 로그 표시 */}
      {/* <div style={{
        position: 'fixed',
        top: '10px',
        left: '10px',
        background: 'red',
        color: 'white',
        padding: '10px',
        zIndex: 10000,
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        GroupInitModal 렌더링됨
        <br />
        isOpen: {String(isOpen)}
        <br />
        user: {user?.mt_idx || '없음'}
        <br />
        activeTab: {activeTab}
      </div> */}
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* 배경 오버레이 */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* 모달 콘텐츠 */}
          <motion.div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-[#0113A3] to-[#001a8a] px-6 py-2 text-white relative">
              <div className="text-center">
                <motion.div
                  className="inline-flex items-center justify-center w-16 h-16 bg-[#0113A3]/20 rounded-full"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                >
                  <Image
                    src="/images/smap_logo_nobackground.png"
                    alt="SMAP Logo"
                    width={32}
                    height={32}
                    className="w-12 h-12"
                  />
                </motion.div>
                
                <h2 className="text-2xl font-bold mb-1">SMAP 시작하기</h2>
                <p className="text-white opacity-90">
                  그룹을 만들거나 초대받은 그룹에 참여해보세요!
                </p>
              </div>
            </div>

            {/* 탭 버튼 */}
            <div className="flex bg-gray-100 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('create')}
                className={`flex-1 py-4 px-6 font-medium transition-colors relative ${
                  activeTab === 'create'
                    ? 'bg-white text-[#0113A3] border-b-2 border-[#0113A3] shadow-sm'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <FiPlus className="w-5 h-5 inline mr-2" />
                그룹 만들기
              </button>
              <button
                onClick={() => setActiveTab('join')}
                className={`flex-1 py-4 px-6 font-medium transition-colors relative ${
                  activeTab === 'join'
                    ? 'bg-white text-[#0113A3] border-b-2 border-[#0113A3] shadow-sm'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <FiUserPlus className="w-5 h-5 inline mr-2" />
                그룹 참여하기
              </button>
            </div>

            {/* 콘텐츠 */}
            <div className="px-6 pt-4 pb-0 min-h-[180px]">
              <AnimatePresence mode="wait">
                {activeTab === 'create' ? (
                  <motion.div
                    key="create"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4 h-full flex flex-col"
                  >
                    <div className="flex-1 bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        그룹명
                      </label>
                      <div className="relative">
                        <FiUsers className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          placeholder="예: 우리 가족, 직장 동료들"
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0113A3] focus:border-[#0113A3] outline-none transition-colors bg-white"
                          maxLength={20}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        최대 20자까지 입력 가능합니다.
                      </p>
                    </div>

                    <button
                      onClick={handleCreateGroup}
                      disabled={isLoading || !groupName.trim()}
                      className="w-full bg-gradient-to-r from-[#0113A3] to-[#001a8a] text-white py-3 rounded-xl font-medium hover:from-[#001a8a] hover:to-[#0113A3] disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-auto"
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          그룹 생성 중...
                        </div>
                      ) : (
                        '그룹 만들기'
                      )}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="join"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4 h-full flex flex-col"
                  >
                    <div className="flex-1 bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        초대 코드
                      </label>
                      <div className="relative">
                        <FiUserPlus className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          value={inviteCode}
                          onChange={(e) => {
                            const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                            if (value.length <= 6) {
                              setInviteCode(value);
                            }
                          }}
                          placeholder="6자리 초대 코드 입력"
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0113A3] focus:border-[#0113A3] outline-none transition-colors bg-white"
                          maxLength={6}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        그룹 관리자로부터 받은 6자리 코드를 입력하세요.
                      </p>
                    </div>

                    <button
                      onClick={handleJoinGroup}
                      disabled={isLoading || inviteCode.length !== 6}
                      className="w-full bg-gradient-to-r from-[#0113A3] to-[#001a8a] text-white py-3 rounded-xl font-medium hover:from-[#001a8a] hover:to-[#0113A3] disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-auto"
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          그룹 가입 중...
                        </div>
                      ) : (
                        '그룹 참여하기'
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 에러 메시지 */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <p className="text-sm text-red-600">{error}</p>
                </motion.div>
              )}
            </div>

            {/* 푸터 */}
            <div className="px-6 pb-6">
              <p className="text-xs text-gray-500 text-center">
                나중에 그룹을 추가하거나 변경할 수 있습니다.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
      
      {/* 위치 권한 모달 */}
      <LocationPermissionModal
        isOpen={showPermissionModal}
        onClose={closePermissionModal}
        onConfirm={requestPermission}
        onSettings={openSettings}
      />
    </>
  );
};

export default GroupInitModal;