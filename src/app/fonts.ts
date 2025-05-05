import localFont from 'next/font/local';
import { Inter } from 'next/font/google';

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

// Inter 웹 폰트 사용 (Noto Sans KR 대신)
export const systemFont = Inter({
  subsets: ['latin'],
  variable: '--font-system',
  display: 'swap',
}); 