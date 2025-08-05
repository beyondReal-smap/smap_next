'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMapPin, FiSettings, FiX, FiCheck } from 'react-icons/fi';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';

interface LocationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onSettings?: () => void;
}

export default function LocationPermissionModal({
  isOpen,
  onClose,
  onConfirm,
  onSettings
}: LocationPermissionModalProps) {
  
  console.log('[LocationPermissionModal] 렌더링:', { isOpen });
  
  // 🚨 강제 로그 (모달이 열려있을 때)
  if (isOpen) {
    console.log('🚨 [LocationPermissionModal] 강제 로그 - 위치 권한 모달이 열려있습니다!');
  }
  
  const handleConfirm = () => {
    triggerHapticFeedback(HapticFeedbackType.SUCCESS, '권한 요청', { action: 'location-permission' });
    onConfirm();
  };

  const handleClose = () => {
    triggerHapticFeedback(HapticFeedbackType.LIGHT, '모달 닫기', { action: 'location-permission' });
    onClose();
  };

  const handleSettings = () => {
    triggerHapticFeedback(HapticFeedbackType.MEDIUM, '설정으로 이동', { action: 'location-permission' });
    onSettings?.();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ 
              type: "spring", 
              damping: 25, 
              stiffness: 300,
              duration: 0.3 
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-md">
              {/* Modal Content */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-3xl shadow-2xl overflow-hidden"
              >
                {/* Header */}
                <div className="relative bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
                  {/* Close Button */}
                  <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm"
                  >
                    <FiX size={16} />
                  </button>
                  
                  {/* Icon */}
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <FiMapPin size={28} className="text-white" />
                    </div>
                  </div>
                  
                  {/* Title */}
                  <h2 className="text-xl font-bold text-center text-gray-800 mb-2">
                    위치 권한이 필요해요
                  </h2>
                  
                  {/* Subtitle */}
                  <p className="text-sm text-center text-gray-600 mb-2">
                    서비스 이용을 위해 위치 권한이 꼭 필요합니다.<br />
                    설정에서 위치 권한을 허용해 주세요.
                  </p>
                </div>
                
                {/* Content */}
                <div className="p-6">
                  {/* Benefits */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiCheck size={12} className="text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">실시간 위치 추적</p>
                        <p className="text-xs text-gray-500">정확한 이동 경로를 기록합니다</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiCheck size={12} className="text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">체류 시간 분석</p>
                        <p className="text-xs text-gray-500">각 장소에서의 머문 시간을 분석합니다</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiCheck size={12} className="text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">개인정보 보호</p>
                        <p className="text-xs text-gray-500">안전하게 암호화되어 저장됩니다</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="space-y-3 mt-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSettings}
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2"
                    >
                      <FiSettings size={16} />
                      <span>설정에서 권한 변경하기</span>
                    </motion.button>
                  </div>
                  
                  {/* Privacy Notice */}
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-700 text-center">
                      위치 정보는 서비스 제공 목적으로만 사용되며, 
                      언제든지 설정에서 권한을 변경할 수 있습니다.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
} 