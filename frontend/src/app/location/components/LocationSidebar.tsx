'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LocationSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

export const LocationSidebar: React.FC<LocationSidebarProps> = ({
  isOpen,
  onToggle,
  children,
  className = ''
}) => {
  return (
    <>
      {/* 사이드바 오버레이 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      {/* 사이드바 */}
      <motion.div
        initial={false}
        animate={{
          x: isOpen ? 0 : '-100%',
          transition: { type: 'spring', stiffness: 300, damping: 30 }
        }}
        className={`fixed left-0 top-0 h-full w-80 bg-white shadow-xl z-50 lg:relative lg:translate-x-0 ${className}`}
      >
        {/* 사이드바 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">위치 정보</h2>
          <button
            onClick={onToggle}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 사이드바 내용 */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </>
  );
};
