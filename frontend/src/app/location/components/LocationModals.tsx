'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 기본 모달 컴포넌트
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type,
  onConfirm,
  confirmText = '확인',
  cancelText = '취소'
}) => {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className={`px-6 py-4 border-b ${getTypeStyles()}`}>
              <h3 className="text-lg font-semibold">{title}</h3>
            </div>

            {/* 내용 */}
            <div className="px-6 py-4">
              <p className="text-gray-700">{message}</p>
            </div>

            {/* 버튼 */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-3">
              {onConfirm && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {cancelText}
                </button>
              )}
              <button
                onClick={onConfirm ? handleConfirm : onClose}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${
                  onConfirm
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : type === 'success'
                    ? 'bg-green-600 hover:bg-green-700'
                    : type === 'error'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// 장소 삭제 확인 모달
interface LocationDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  location: any;
  isDeleting: boolean;
}

export const LocationDeleteModal: React.FC<LocationDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  location,
  isDeleting
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="px-6 py-4 border-b border-red-200 bg-red-50">
              <h3 className="text-lg font-semibold text-red-800">장소 삭제</h3>
            </div>

            {/* 내용 */}
            <div className="px-6 py-4">
              <p className="text-gray-700 mb-4">
                <strong>"{location?.name || '이름 없는 장소'}"</strong>를 삭제하시겠습니까?
              </p>
              <p className="text-sm text-gray-500">
                이 작업은 되돌릴 수 없습니다.
              </p>
            </div>

            {/* 버튼 */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-3">
              <button
                onClick={onClose}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={onConfirm}
                disabled={isDeleting}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    삭제 중...
                  </>
                ) : (
                  '삭제'
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// 토스트 모달
interface ToastModalProps {
  isOpen: boolean;
  type: 'success' | 'error' | 'loading';
  title: string;
  message: string;
  progress?: number;
  autoClose?: boolean;
  onClose?: () => void;
}

export const ToastModal: React.FC<ToastModalProps> = ({
  isOpen,
  type,
  title,
  message,
  progress = 0,
  autoClose = true,
  onClose
}) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50 text-green-800';
      case 'error':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'loading':
        return 'border-blue-200 bg-blue-50 text-blue-800';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'loading':
        return (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          className="fixed top-4 right-4 z-50 max-w-sm w-full"
        >
          <div className={`border rounded-lg shadow-lg p-4 ${getTypeStyles()}`}>
            {/* 헤더 */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                {getIcon()}
                <div>
                  <h4 className="font-semibold">{title}</h4>
                  <p className="text-sm opacity-90">{message}</p>
                </div>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* 프로그레스 바 */}
            {type === 'loading' && progress !== undefined && (
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
