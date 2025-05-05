import localFont from 'next/font/local';

// LINE SEED 폰트 로컬 폰트로 정의
export const suite = localFont({
  src: [
    {
      path: '../../public/fonts/LINESeedKR-Rg.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/LINESeedKR-Bd.woff2',
      weight: '700',
      style: 'normal',
    }
  ],
  variable: '--font-lineseed',
  display: 'swap',
});

// 시스템 폰트 대신 Suite 폰트 사용
export const systemFont = suite; 