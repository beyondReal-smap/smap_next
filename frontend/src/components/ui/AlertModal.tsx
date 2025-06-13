'use client';

import React from 'react';
import Modal, { ModalProps } from './Modal';
import { FiAlertTriangle, FiInfo, FiCheckCircle, FiXCircle } from 'react-icons/fi';

export interface AlertModalProps extends Omit<ModalProps, 'children'> {
  message: string;
  description?: string;
  buttonText?: string;
  onConfirm?: () => void;
  type?: 'info' | 'warning' | 'success' | 'error';
}

const AlertModal: React.FC<AlertModalProps> = ({
  message,
  description,
  buttonText = '확인',
  onConfirm,
  type = 'info',
  ...modalProps
}) => {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    modalProps.onClose();
  };

  // 타입별 아이콘과 색상
  const typeConfig = {
    info: {
      icon: FiInfo,
      iconColor: 'text-blue-500',
      buttonColor: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
    },
    warning: {
      icon: FiAlertTriangle,
      iconColor: 'text-yellow-500',
      buttonColor: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
    },
    success: {
      icon: FiCheckCircle,
      iconColor: 'text-green-500',
      buttonColor: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
    },
    error: {
      icon: FiXCircle,
      iconColor: 'text-red-500',
      buttonColor: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
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

        {/* 확인 버튼 */}
        <button
          onClick={handleConfirm}
          className={`w-full px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 ${config.buttonColor}`}
        >
          {buttonText}
        </button>
      </div>
    </Modal>
  );
};

export default AlertModal; 