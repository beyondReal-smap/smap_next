'use client';

import React from 'react';
import Modal, { ModalProps } from './Modal';
import { FiAlertTriangle, FiInfo, FiCheckCircle, FiXCircle } from 'react-icons/fi';

export interface ConfirmModalProps extends Omit<ModalProps, 'children'> {
  message: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  type?: 'info' | 'warning' | 'success' | 'error';
  isLoading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  message,
  description,
  confirmText = '확인',
  cancelText = '취소',
  onConfirm,
  onCancel,
  type = 'info',
  isLoading = false,
  ...modalProps
}) => {
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      modalProps.onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm();
  };

  // 타입별 아이콘과 색상
  const typeConfig = {
    info: {
      icon: FiInfo,
      iconColor: 'text-blue-500',
      confirmButtonColor: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
    },
    warning: {
      icon: FiAlertTriangle,
      iconColor: 'text-yellow-500',
      confirmButtonColor: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
    },
    success: {
      icon: FiCheckCircle,
      iconColor: 'text-green-500',
      confirmButtonColor: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
    },
    error: {
      icon: FiXCircle,
      iconColor: 'text-red-500',
      confirmButtonColor: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    }
  };

  const config = typeConfig[type];
  const IconComponent = config.icon;

  return (
    <Modal
      {...modalProps}
      size="sm"
      showCloseButton={false}
      contentClassName="p-6"
    >
      <div className="text-center">
        {/* 아이콘 */}
        <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
          <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
        </div>

        {/* 메시지 */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2" style={{ wordBreak: 'break-all' }}>
          {message}
        </h3>

        {/* 설명 */}
        {description && (
          <p className="text-sm text-gray-600 mb-6" style={{ wordBreak: 'break-all' }}>
            {description}
          </p>
        )}

        {/* 버튼들 */}
        <div className="flex space-x-3">
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ${config.confirmButtonColor}`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                처리 중...
              </div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal; 