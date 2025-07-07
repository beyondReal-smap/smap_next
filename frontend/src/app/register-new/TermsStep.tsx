'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiArrowRight, FiFileText } from 'react-icons/fi';
import { RegisterData, TermData, TERMS_DATA } from './types';

interface TermsStepProps {
  registerData: RegisterData;
  onTermChange: (termId: string, checked: boolean) => void;
  onAllAgree: (checked: boolean) => void;
}

export default function TermsStep({ registerData, onTermChange, onAllAgree }: TermsStepProps) {
  const allTermsAgreed = TERMS_DATA.every(term => registerData[term.id as keyof RegisterData] as boolean);
  const requiredTermsAgreed = TERMS_DATA.filter(term => term.required)
    .every(term => registerData[term.id as keyof RegisterData] as boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-md mx-auto pb-24"
    >
      {/* 헤더 */}
      <div className="text-center mb-8">
        <motion.div 
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mx-auto mb-4"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <FiFileText className="w-8 h-8 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {registerData.isSocialLogin ? 
            `${registerData.socialProvider === 'google' ? '구글' : '카카오'} 회원가입` : 
            '서비스 이용약관'
          }
        </h2>
        <p className="text-gray-600 leading-relaxed">
          {registerData.isSocialLogin ? 
            `${registerData.socialProvider === 'google' ? '구글' : '카카오'} 계정으로 간편 회원가입을 진행합니다` :
            'SMAP 서비스 이용을 위해 약관에 동의해주세요'
          }
        </p>
        
        {registerData.isSocialLogin && (
          <motion.div 
            className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-sm text-blue-700">
              📧 <strong>{registerData.mt_email}</strong><br/>
              전화번호 인증 없이 간편하게 가입할 수 있습니다
            </p>
          </motion.div>
        )}
      </div>

      {/* 약관 목록 */}
      <div className="space-y-3">
        {/* 전체 동의 */}
        <motion.div 
          className="bg-white rounded-xl p-4 border-2 border-blue-100 shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <label className="flex items-center space-x-4 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={allTermsAgreed}
                onChange={(e) => onAllAgree(e.target.checked)}
                className="sr-only"
              />
              <motion.div 
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                  allTermsAgreed ? 'bg-gradient-to-br from-blue-500 to-purple-500 border-transparent' : 'border-gray-300'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {allTermsAgreed && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <FiCheck className="w-4 h-4 text-white" />
                  </motion.div>
                )}
              </motion.div>
            </div>
            <span className="font-semibold text-gray-900 text-lg">전체 동의</span>
          </label>
        </motion.div>

        {/* 개별 약관 */}
        {TERMS_DATA.map((term, index) => (
          <motion.div 
            key={term.id}
            className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.1 }}
          >
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center space-x-4 flex-1">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={registerData[term.id as keyof RegisterData] as boolean}
                    onChange={(e) => onTermChange(term.id, e.target.checked)}
                    className="sr-only"
                  />
                  <motion.div 
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      registerData[term.id as keyof RegisterData] 
                        ? 'bg-gradient-to-br from-blue-500 to-purple-500 border-transparent' 
                        : 'border-gray-300'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {registerData[term.id as keyof RegisterData] && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      >
                        <FiCheck className="w-3 h-3 text-white" />
                      </motion.div>
                    )}
                  </motion.div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {term.title}
                    </span>
                    {term.required && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">
                        필수
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {term.content}
                  </p>
                </div>
              </div>
              <motion.div 
                className="text-gray-400"
                whileHover={{ x: 2 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <FiArrowRight className="w-4 h-4" />
              </motion.div>
            </label>
          </motion.div>
        ))}
      </div>

      {/* 안내 메시지 */}
      {!requiredTermsAgreed && (
        <motion.div 
          className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-sm text-orange-700 text-center">
            필수 약관에 동의해주세요
          </p>
        </motion.div>
      )}
    </motion.div>
  );
} 