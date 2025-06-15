'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface GoogleLoginFallbackProps {
  onClose: () => void;
  onAlternativeLogin: () => void;
}

const GoogleLoginFallback: React.FC<GoogleLoginFallbackProps> = ({ 
  onClose, 
  onAlternativeLogin 
}) => {
  const [isIOSWebView, setIsIOSWebView] = useState(false);

  useEffect(() => {
    // iOS WebView 감지
    const isIOS = !!(window as any).webkit && !!(window as any).webkit.messageHandlers;
    setIsIOSWebView(isIOS);
  }, []);

  const handleOpenInSafari = () => {
    // iOS 앱에 Safari에서 열기 요청
    try {
      if ((window as any).webkit?.messageHandlers?.openInSafari) {
        (window as any).webkit.messageHandlers.openInSafari.postMessage({
          url: window.location.href,
          action: 'openInSafari'
        });
      }
    } catch (e) {
      console.error('Failed to open in Safari:', e);
      // 폴백: 사용자에게 수동으로 Safari에서 열도록 안내
      alert('Safari 브라우저에서 이 페이지를 열어주세요.');
    }
  };

  const handleUsePhoneLogin = () => {
    onAlternativeLogin();
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            구글 로그인 제한
          </h3>
          
          <p className="text-gray-600 text-sm mb-6">
            보안상의 이유로 앱 내에서 구글 로그인이 제한됩니다. 
            다른 방법으로 로그인해주세요.
          </p>
          
          <div className="space-y-3">
            {isIOSWebView && (
              <button
                onClick={handleOpenInSafari}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Safari에서 열기
              </button>
            )}
            
            <button
              onClick={handleUsePhoneLogin}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              전화번호로 로그인
            </button>
            
            <button
              onClick={onClose}
              className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              취소
            </button>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-xs text-yellow-800">
              💡 <strong>팁:</strong> Safari 브라우저에서는 구글 로그인이 정상적으로 작동합니다.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default GoogleLoginFallback; 