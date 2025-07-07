'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import TermsStep from './TermsStep';
import PhoneStep from './PhoneStep';
import { RegisterData, RegisterStep, REGISTER_STEPS, TERMS_DATA } from './types';

interface RegisterFormProps {
  currentStep: RegisterStep;
  setCurrentStep: React.Dispatch<React.SetStateAction<RegisterStep>>;
  registerData: RegisterData;
  setRegisterData: React.Dispatch<React.SetStateAction<RegisterData>>;
}

export default function RegisterForm({ 
  currentStep, 
  setCurrentStep, 
  registerData, 
  setRegisterData 
}: RegisterFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  // 소셜 로그인 데이터 초기화
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const socialProvider = urlParams.get('social');
    
    if (socialProvider) {
      const socialData = sessionStorage.getItem('socialLoginData');
      if (socialData) {
        try {
          const parsedData = JSON.parse(socialData);
          setRegisterData(prev => ({
            ...prev,
            mt_id: parsedData.email || '',
            mt_email: parsedData.email || '',
            mt_name: parsedData.name || '',
            mt_nickname: parsedData.nickname || '',
            isSocialLogin: true,
            socialProvider: parsedData.provider,
            socialId: parsedData.kakao_id || parsedData.google_id || ''
          }));
          sessionStorage.removeItem('socialLoginData');
        } catch (error) {
          console.error('소셜 로그인 데이터 파싱 오류:', error);
        }
      }
    }
  }, [setRegisterData]);

  // 단계별 유효성 검사
  const isStepValid = () => {
    switch (currentStep) {
      case REGISTER_STEPS.TERMS:
        return TERMS_DATA.filter(term => term.required)
          .every(term => registerData[term.id as keyof RegisterData] as boolean);
      case REGISTER_STEPS.PHONE:
        return registerData.mt_id.replace(/[^0-9]/g, '').length === 11;
      case REGISTER_STEPS.VERIFICATION:
        return registerData.verification_code.length === 6;
      case REGISTER_STEPS.BASIC_INFO:
        return registerData.mt_pwd.length >= 8 && 
               registerData.mt_name.trim() !== '' && 
               registerData.mt_nickname.trim() !== '';
      case REGISTER_STEPS.PROFILE:
        return registerData.mt_birth !== '' && registerData.mt_gender !== null;
      case REGISTER_STEPS.LOCATION:
        return registerData.mt_lat !== null && registerData.mt_long !== null;
      default:
        return false;
    }
  };

  // 다음 단계
  const handleNext = async () => {
    if (!isStepValid()) return;

    const steps = Object.values(REGISTER_STEPS);
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  // 약관 동의 처리
  const handleTermChange = (termId: string, checked: boolean) => {
    setRegisterData(prev => ({
      ...prev,
      [termId]: checked
    }));
  };

  const handleAllAgree = (checked: boolean) => {
    const updates = TERMS_DATA.reduce((acc, term) => ({
      ...acc,
      [term.id]: checked
    }), {});
    
    setRegisterData(prev => ({
      ...prev,
      ...updates
    }));
  };

  // 전화번호 변경
  const handlePhoneChange = (phone: string) => {
    setRegisterData(prev => ({
      ...prev,
      mt_id: phone
    }));
  };

  // 인증번호 발송
  const handleSendVerification = async () => {
    setIsLoading(true);
    try {
      // TODO: 실제 API 호출
      await new Promise(resolve => setTimeout(resolve, 1000));
      setVerificationSent(true);
    } catch (error) {
      console.error('인증번호 발송 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col pt-16 pb-24 px-4 overflow-y-auto register-main">
      <div className="flex items-center justify-center min-h-[calc(100vh-12rem)]">
        <div className="w-full max-w-md mx-auto">
          <AnimatePresence mode="wait">
            {/* 약관 동의 단계 */}
            {currentStep === REGISTER_STEPS.TERMS && (
              <TermsStep
                key="terms"
                registerData={registerData}
                onTermChange={handleTermChange}
                onAllAgree={handleAllAgree}
              />
            )}

            {/* 전화번호 인증 단계 */}
            {currentStep === REGISTER_STEPS.PHONE && (
              <PhoneStep
                key="phone"
                phoneNumber={registerData.mt_id}
                onPhoneChange={handlePhoneChange}
                onSendVerification={handleSendVerification}
                isLoading={isLoading}
                verificationSent={verificationSent}
                verificationCode={registerData.verification_code}
                onVerificationCodeChange={(code) => setRegisterData(prev => ({ ...prev, verification_code: code }))}
              />
            )}

            {/* 다른 단계들도 여기에 추가 */}
          </AnimatePresence>
          
          {/* 다음 버튼 */}
          <div className="mt-8">
            <motion.button
              onClick={handleNext}
              disabled={!isStepValid()}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all ${
                isStepValid()
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-lg'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
              whileHover={isStepValid() ? { scale: 1.02 } : {}}
              whileTap={isStepValid() ? { scale: 0.98 } : {}}
            >
              다음
            </motion.button>
          </div>
        </div>
      </div>
    </main>
  );
} 