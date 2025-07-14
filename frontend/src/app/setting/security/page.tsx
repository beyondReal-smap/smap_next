'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiShield, FiKey, FiLock, FiEye, FiEyeOff, FiSmartphone, FiCheck } from 'react-icons/fi';
import AnimatedHeader from '../../../components/common/AnimatedHeader';

export default function SecurityPage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, 400);
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      alert('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    
    setIsSaving(true);
    // 모의 저장
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    
    // 입력 필드 초기화
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    alert('비밀번호가 성공적으로 변경되었습니다.');
  };

  const isPasswordValid = currentPassword && newPassword && confirmPassword && newPassword === confirmPassword;

  return (
    <>
      <style jsx global>{`
        html, body {
          /* iOS WebView 최적화 */
          -webkit-text-size-adjust: 100%;
          -webkit-overflow-scrolling: touch;
          /* iOS safe-area 완전 무시 */
          padding-top: 0px !important;
          margin-top: 0px !important;
        }

        /* iOS 전용 스타일 */
        @supports (-webkit-touch-callout: none) {
          html, body {
            position: fixed !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
          }
          
          #__next {
            height: 100% !important;
            overflow: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          
            #setting-page-container {
    height: 100vh !important;
    height: -webkit-fill-available !important;
    overflow: hidden !important;
  }
  
  .content-area {
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }
          
          /* iOS 헤더 강제 표시 */
          header, .glass-effect, .header-fixed {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 999999 !important;
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            transform: translateZ(0) translateY(0) !important;
            will-change: transform !important;
            background: rgba(255, 255, 255, 0.98) !important;
            backdrop-filter: blur(10px) !important;
            -webkit-backdrop-filter: blur(10px) !important;
            height: 56px !important;
            min-height: 56px !important;
            max-height: 56px !important;
            width: 100% !important;
            margin: 0 !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          
          /* iOS 헤더 내부 요소 */
          header * {
            pointer-events: auto !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
        }

        @keyframes slideInFromRight {
          from {
            transform: translateX(30px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOutToRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(-30px);
            opacity: 0;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideInFromRight {
          animation: slideInFromRight 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }

        .animate-slideOutToRight {
          animation: slideOutToRight 0.4s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }

        .initial-hidden {
          opacity: 0;
          transform: translateX(100%);
        }

        .glass-effect {
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          background: rgba(255, 255, 255, 0.7);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
        }

        .input-focus {
          transition: all 0.2s ease;
        }

        .input-focus:focus {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.15);
        }
      `}</style>
      
      <div className={`flex flex-col h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 ${
        isExiting ? 'animate-slideOutToRight' : 
        (shouldAnimate && isPageLoaded) ? 'animate-slideInFromRight' : 
        shouldAnimate ? 'initial-hidden' : ''
      }`}>
        {/* 통일된 헤더 애니메이션 */}
        <AnimatedHeader 
          variant="enhanced"
          className="setting-header"
        >
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="setting-header-content"
          >
            <motion.button 
              onClick={handleBack}
              disabled={isExiting}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="setting-back-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
            <div className="setting-header-text">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">보안 설정</h1>
              <p className="text-xs text-gray-500 leading-tight">비밀번호 및 보안 관리</p>
            </div>
          </motion.div>
        </AnimatedHeader>

        {/* 메인 콘텐츠 */}
        <div className="flex-1 overflow-y-auto pt-[56px] pb-6 px-4">
          {/* 비밀번호 변경 섹션 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <FiKey className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">비밀번호 변경</h3>
                <p className="text-sm text-gray-500">계정 보안을 위해 정기적으로 변경하세요</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* 현재 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">현재 비밀번호</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-gray-50 rounded-xl px-4 py-4 pr-12 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 input-focus"
                    placeholder="현재 비밀번호를 입력하세요"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* 새 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-gray-50 rounded-xl px-4 py-4 pr-12 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 input-focus"
                    placeholder="새 비밀번호를 입력하세요"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* 새 비밀번호 확인 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호 확인</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-50 rounded-xl px-4 py-4 pr-12 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 input-focus"
                    placeholder="새 비밀번호를 다시 입력하세요"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">비밀번호가 일치하지 않습니다</p>
                )}
              </div>

              <motion.button
                onClick={handlePasswordChange}
                disabled={!isPasswordValid || isSaving}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl py-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                whileHover={{ scale: isPasswordValid ? 1.02 : 1 }}
                whileTap={{ scale: isPasswordValid ? 0.98 : 1 }}
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <FiCheck className="w-5 h-5" />
                    <span>비밀번호 변경</span>
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>

          {/* 2단계 인증 섹션 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <FiSmartphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">2단계 인증</h3>
                  <p className="text-sm text-gray-500">추가 보안을 위한 2단계 인증</p>
                </div>
              </div>
              <motion.button
                onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  twoFactorEnabled ? 'bg-green-600' : 'bg-gray-200'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </motion.button>
            </div>
            {twoFactorEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 p-4 bg-green-50 rounded-xl"
              >
                <p className="text-sm text-green-700">
                  2단계 인증이 활성화되었습니다. 로그인 시 추가 인증이 필요합니다.
                </p>
              </motion.div>
            )}
          </motion.div>

          {/* 보안 팁 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6"
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <FiLock className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">보안 팁</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start space-x-2">
                <FiCheck className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>8자 이상의 복잡한 비밀번호를 사용하세요</span>
              </li>
              <li className="flex items-start space-x-2">
                <FiCheck className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>정기적으로 비밀번호를 변경하세요</span>
              </li>
              <li className="flex items-start space-x-2">
                <FiCheck className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>다른 서비스와 동일한 비밀번호를 사용하지 마세요</span>
              </li>
              <li className="flex items-start space-x-2">
                <FiCheck className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>2단계 인증을 활성화하여 보안을 강화하세요</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </>
  );
} 