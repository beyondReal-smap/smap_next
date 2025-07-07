'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiPhone, FiCheck } from 'react-icons/fi';
import { formatPhoneNumber } from './utils';

interface PhoneStepProps {
  phoneNumber: string;
  onPhoneChange: (phone: string) => void;
  onSendVerification: () => void;
  verificationSent: boolean;
  isLoading: boolean;
  verificationCode: string;
  onVerificationCodeChange: (code: string) => void;
}

export default function PhoneStep({ 
  phoneNumber, 
  onPhoneChange, 
  onSendVerification, 
  verificationSent, 
  isLoading,
  verificationCode,
  onVerificationCodeChange
}: PhoneStepProps) {
  const [focused, setFocused] = useState(false);

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    onPhoneChange(formatted);
  };

  const isValidPhone = phoneNumber.replace(/[^0-9]/g, '').length === 11;

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
          <FiPhone className="w-8 h-8 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">전화번호 인증</h2>
        <p className="text-gray-600 leading-relaxed">
          본인 확인을 위해 전화번호를 입력해주세요
        </p>
      </div>

      {/* 전화번호 입력 */}
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            전화번호
          </label>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 flex items-center z-10 pointer-events-none">
              <FiPhone 
                className={`w-5 h-5 transition-colors duration-200 ${
                  focused ? 'text-blue-500' : 'text-gray-400'
                }`} 
              />
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneInput}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="010-1234-5678"
              maxLength={13}
              className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            하이픈(-) 없이 입력하시면 자동으로 추가됩니다
          </p>
        </div>

        {/* 인증번호 발송 완료 메시지 */}
        {verificationSent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <FiCheck className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-800">인증번호가 발송되었습니다</p>
                  <p className="text-sm text-green-600 mt-1">
                    {phoneNumber}로 인증번호를 발송했습니다
                  </p>
                </div>
              </div>
            </div>

            {/* 인증번호 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                인증번호
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => onVerificationCodeChange(e.target.value)}
                placeholder="6자리 숫자 입력"
                maxLength={6}
                className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 text-center tracking-widest"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                SMS로 전송된 6자리 인증번호를 입력해주세요
              </p>
            </div>
          </motion.div>
        )}

        {/* 발송 버튼 */}
        <motion.button
          onClick={onSendVerification}
          disabled={!isValidPhone || isLoading}
          whileHover={{ scale: isValidPhone && !isLoading ? 1.02 : 1 }}
          whileTap={{ scale: isValidPhone && !isLoading ? 0.98 : 1 }}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200 ${
            isValidPhone && !isLoading
              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg hover:shadow-xl'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>발송 중...</span>
            </div>
          ) : (
            '인증번호 발송'
          )}
        </motion.button>

        {/* 안내 메시지 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 text-sm font-bold">i</span>
            </div>
            <div>
              <p className="text-sm text-blue-800 font-medium mb-1">
                인증번호 발송 안내
              </p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• SMS로 인증번호가 발송됩니다</li>
                <li>• 인증번호는 3분간 유효합니다</li>
                <li>• 같은 번호로는 3분 후 재발송 가능합니다</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
} 