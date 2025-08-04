'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { FiPlus, FiUser, FiX } from 'react-icons/fi';

export interface FloatingButtonProps {
  // 기본 props
  onClick: () => void;
  
  // 페이지별 커스터마이징
  variant?: 'home' | 'group' | 'schedule' | 'location' | 'activelog' | 'custom';
  
  // 커스텀 설정 (variant가 'custom'일 때 사용)
  icon?: React.ReactNode;
  backgroundColor?: string;
  position?: {
    bottom?: string;
    right?: string;
  };
  
  // 상태 관리 (home, location, activelog 페이지용)
  isOpen?: boolean;
  
  // 배지 표시 (home 페이지용)
  badgeCount?: number;
  
  // 애니메이션 설정
  delay?: number;
  disabled?: boolean;
  
  // 추가 스타일
  className?: string;
  style?: React.CSSProperties;
}

const FloatingButton: React.FC<FloatingButtonProps> = ({
  onClick,
  variant = 'custom',
  icon,
  backgroundColor = '#0113A3',
  position = { bottom: '90px', right: '16px' },
  isOpen = false,
  badgeCount,
  delay = 0.2,
  disabled = false,
  className = '',
  style = {}
}) => {

  // hooks는 항상 같은 순서로 호출되어야 함
  const pathname = usePathname();

  // 페이지별 기본 설정
  const getVariantConfig = () => {
    switch (variant) {
      case 'home':
        return {
          icon: isOpen ? (
            <FiX className="w-6 h-6" />
          ) : (
            <FiUser className="w-6 h-6" />
          ),
          position: { bottom: '90px', right: '16px' },
          backgroundColor: '#0113A3'
        };
      
      case 'group':
        return {
          icon: <FiPlus className="w-6 h-6 stroke-2" />,
          position: { bottom: '90px', right: '16px' },
          backgroundColor: '#0113A3'
        };
      
      case 'schedule':
        return {
          icon: <FiPlus className="w-6 h-6" style={{ display: 'block', margin: 'auto' }} />,
          position: { bottom: '90px', right: '16px' },
          backgroundColor: '#0113A3'
        };
      
      case 'location':
        return {
          icon: isOpen ? (
            <FiX className="w-6 h-6" />
          ) : (
            <FiUser className="w-6 h-6" />
          ),
          position: { bottom: '90px', right: '16px' },
          backgroundColor: '#0113A3'
        };
      
      case 'activelog':
        return {
          icon: isOpen ? (
            <FiX className="w-6 h-6" />
          ) : (
            <FiUser className="w-6 h-6" />
          ),
          position: { bottom: '90px', right: '16px' },
          backgroundColor: '#0113A3'
        };
      
      default:
        return {
          icon: icon || <FiPlus className="w-6 h-6" />,
          position,
          backgroundColor
        };
    }
  };

  const config = getVariantConfig();

  // 애니메이션 variants
  const buttonVariants = {
    initial: { 
      y: 100, 
      opacity: 0, 
      scale: 0.8 
    },
    animate: { 
      y: 0, 
      opacity: 1, 
      scale: 1,
      transition: {
        delay,
        type: "spring" as const,
        stiffness: 120,
        damping: 25,
        duration: 1.0
      }
    },
    hover: { 
      scale: 1.1,
      y: -2,
      transition: { duration: 0.2 }
    },
    tap: { 
      scale: 0.9 
    }
  };

  return (
    <motion.button
      variants={buttonVariants}
      initial="initial"
      animate="animate"
      whileHover={!disabled ? "hover" : undefined}
      whileTap={!disabled ? "tap" : undefined}
      onClick={disabled ? undefined : onClick}
      className={`fixed w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white touch-optimized ${className}`}
      disabled={disabled}
      style={{
        background: config.backgroundColor,
        boxShadow: '0 8px 25px rgba(1, 19, 163, 0.3)',
        zIndex: 1000,
        position: 'fixed',
        bottom: config.position.bottom,
        right: config.position.right,
        pointerEvents: disabled ? 'none' : 'auto',
        opacity: disabled ? 0.5 : 1,
        // 아이콘 중앙 정렬을 위한 flex 스타일
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        visibility: 'visible',
        ...style
      }}
      data-floating-button="true"
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        position: 'relative',
        zIndex: 1
      }}>
        {config.icon}
      </div>
      
      {/* 배지 표시 (home 페이지용) */}
      {badgeCount !== undefined && badgeCount > 0 && !isOpen && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center"
        >
          <span className="text-xs font-bold text-white">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        </motion.div>
      )}
      
      {/* 펄스 효과 (home, location, activelog 페이지의 닫힌 상태용) */}
      {(variant === 'home' || variant === 'location' || variant === 'activelog') && !isOpen && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: config.backgroundColor }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.6, 0, 0.6]
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}
    </motion.button>
  );
};

export default FloatingButton; 