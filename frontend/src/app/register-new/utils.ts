import { PasswordStrength } from './types';

export const formatPhoneNumber = (value: string): string => {
  const numbers = value.replace(/[^0-9]/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
};

export const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): PasswordStrength => {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };
};

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
export const isAndroid = () => /Android/.test(navigator.userAgent);
export const isMobile = () => isIOS() || isAndroid();

export const getPasswordStrengthColor = (strength: PasswordStrength) => {
  const validCount = Object.values(strength).filter(Boolean).length;
  if (validCount <= 2) return 'bg-red-500';
  if (validCount <= 3) return 'bg-yellow-500';
  if (validCount <= 4) return 'bg-blue-500';
  return 'bg-green-500';
};

export const getPasswordStrengthText = (strength: PasswordStrength) => {
  const validCount = Object.values(strength).filter(Boolean).length;
  if (validCount <= 2) return '매우 약함';
  if (validCount <= 3) return '약함';
  if (validCount <= 4) return '보통';
  return '강함';
}; 