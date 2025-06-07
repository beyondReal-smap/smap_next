'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiMail, FiSend, FiUser, FiMessageSquare, FiCheck } from 'react-icons/fi';

const INQUIRY_CATEGORIES = [
  { value: 'general', label: '일반 문의', icon: '💬' },
  { value: 'technical', label: '기술 지원', icon: '🔧' },
  { value: 'account', label: '계정 문제', icon: '👤' },
  { value: 'billing', label: '결제 문의', icon: '💳' },
  { value: 'feature', label: '기능 요청', icon: '✨' },
  { value: 'bug', label: '버그 신고', icon: '🐛' }
];

export default function InquiryPage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

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

  const handleSubmit = async () => {
    if (!category || !subject || !message || !email) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    setIsSending(true);
    // 모의 전송
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSending(false);
    
    alert('문의가 성공적으로 전송되었습니다. 빠른 시일 내에 답변드리겠습니다.');
    
    // 폼 초기화
    setCategory('');
    setSubject('');
    setMessage('');
    setEmail('');
  };

  const isFormValid = category && subject && message && email;

  return (
    <>
      <style jsx global>{`
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
      
      <div className={`bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen pb-10 ${
        isExiting ? 'animate-slideOutToRight' : 
        (shouldAnimate && isPageLoaded) ? 'animate-slideInFromRight' : 
        shouldAnimate ? 'initial-hidden' : ''
      }`} style={{ 
        position: 'relative',
        width: '100%',
        overflow: shouldAnimate && !isPageLoaded ? 'hidden' : 'visible'
      }}>
        {/* 개선된 헤더 */}
        <motion.header 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-0 left-0 right-0 z-50 glass-effect"
        >
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center space-x-3">
              <motion.button 
                onClick={handleBack}
                disabled={isExiting}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 disabled:opacity-50"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              <div className="flex items-center space-x-3">
                <motion.div
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                  className="p-2 bg-orange-600 rounded-xl"
                >
                  <FiMail className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">1:1 문의</h1>
                  <p className="text-xs text-gray-500">궁금한 점을 문의하세요</p>
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* 메인 콘텐츠 */}
        <div className="px-4 pt-20 pb-6 space-y-6">
          {/* 문의 양식 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                <FiMessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">문의하기</h3>
                <p className="text-sm text-gray-500">자세한 내용을 작성해주시면 빠르게 답변드리겠습니다</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* 문의 유형 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">문의 유형</label>
                <div className="grid grid-cols-2 gap-3">
                  {INQUIRY_CATEGORIES.map((cat) => (
                    <motion.button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        category === cat.value
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="text-2xl mb-1">{cat.icon}</div>
                      <div className="text-sm font-medium text-gray-900">{cat.label}</div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-50 rounded-xl px-4 py-4 pl-12 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 input-focus"
                    placeholder="답변받을 이메일을 입력하세요"
                  />
                  <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-gray-50 rounded-xl px-4 py-4 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 input-focus"
                  placeholder="문의 제목을 입력하세요"
                />
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="w-full bg-gray-50 rounded-xl px-4 py-4 text-base border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 input-focus resize-none"
                  placeholder="문의 내용을 자세히 작성해주세요"
                />
              </div>

              {/* 전송 버튼 */}
              <motion.button
                onClick={handleSubmit}
                disabled={!isFormValid || isSending}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl py-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                whileHover={{ scale: isFormValid ? 1.02 : 1 }}
                whileTap={{ scale: isFormValid ? 0.98 : 1 }}
              >
                {isSending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <FiSend className="w-5 h-5" />
                    <span>문의 전송</span>
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>

          {/* 문의 안내 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6"
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <FiCheck className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">문의 안내</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start space-x-2">
                <FiCheck className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>평일 09:00 ~ 18:00 내에 답변드립니다</span>
              </li>
              <li className="flex items-start space-x-2">
                <FiCheck className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>주말 및 공휴일은 답변이 지연될 수 있습니다</span>
              </li>
              <li className="flex items-start space-x-2">
                <FiCheck className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>긴급한 문의는 고객센터(1588-0000)로 연락주세요</span>
              </li>
              <li className="flex items-start space-x-2">
                <FiCheck className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>문의 내용을 자세히 작성해주시면 더 정확한 답변이 가능합니다</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </>
  );
} 