'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX } from 'react-icons/fi';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  position?: 'center' | 'bottom' | 'top';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  overlayClassName?: string;
  contentClassName?: string;
  zIndex?: number;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  position = 'center',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = '',
  overlayClassName = '',
  contentClassName = '',
  zIndex = 50
}) => {
  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  // 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // 오버레이 클릭 핸들러
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  // 크기별 스타일
  const sizeClasses = {
    sm: 'max-w-sm w-full mx-4',
    md: 'max-w-md w-full mx-4',
    lg: 'max-w-lg w-full mx-4',
    xl: 'max-w-xl w-full mx-4',
    full: 'w-full h-full'
  };

  // 위치별 스타일
  const positionClasses = {
    center: 'flex items-center justify-center',
    bottom: 'flex items-end justify-center pb-4',
    top: 'flex items-start justify-center pt-4'
  };

  // 애니메이션 variants
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  const modalVariants = {
    center: {
      hidden: { opacity: 0, scale: 0.95, y: 20 },
      visible: { 
        opacity: 1, 
        scale: 1, 
        y: 0,
        transition: {
          type: "spring" as const,
          stiffness: 300,
          damping: 25,
          duration: 0.3
        }
      },
      exit: { 
        opacity: 0, 
        scale: 0.95, 
        y: 20,
        transition: { duration: 0.2 }
      }
    },
    bottom: {
      hidden: { opacity: 0, y: '100%' },
      visible: { 
        opacity: 1, 
        y: 0,
        transition: {
          type: "spring" as const,
          stiffness: 300,
          damping: 30,
          duration: 0.3
        }
      },
      exit: { 
        opacity: 0, 
        y: '100%',
        transition: { duration: 0.2 }
      }
    },
    top: {
      hidden: { opacity: 0, y: '-100%' },
      visible: { 
        opacity: 1, 
        y: 0,
        transition: {
          type: "spring" as const,
          stiffness: 300,
          damping: 30,
          duration: 0.3
        }
      },
      exit: { 
        opacity: 0, 
        y: '-100%',
        transition: { duration: 0.2 }
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={`fixed inset-0 bg-black/50 backdrop-blur-sm ${positionClasses[position]} z-${zIndex} ${overlayClassName}`}
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={handleOverlayClick}
          style={{ zIndex }}
        >
          <motion.div
            className={`bg-white rounded-xl shadow-2xl ${sizeClasses[size]} ${className}`}
            variants={modalVariants[position]}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                {title && (
                  <h2 className="text-lg font-semibold text-gray-900">
                    {title}
                  </h2>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                    aria-label="모달 닫기"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* 콘텐츠 */}
            <div className={`${contentClassName}`}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal; 