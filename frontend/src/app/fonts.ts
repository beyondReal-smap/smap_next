import localFont from 'next/font/local';

// Paperlogy 폰트 로컬 폰트로 정의 (주석 처리)
// export const paperlogy = localFont({
//   src: [
//     {
//       path: '../../public/fonts/Paperlogy-Regular.woff2',
//       weight: '400',
//       style: 'normal',
//     },
//     {
//       path: '../../public/fonts/Paperlogy-Bold.woff2',
//       weight: '700',
//       style: 'normal',
//     },
//   ],
//   variable: '--font-paperlogy',
// });

// 기존 LINE SEED 폰트 정의 활성화
export const lineSeed = localFont({
  src: [
    {
      path: '../../public/fonts/LINESeedKR-Th.woff2',
      weight: '100',
      style: 'normal',
    },
    {
      path: '../../public/fonts/LINESeedKR-Rg.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/LINESeedKR-Bd.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-line-seed',
});

// 시스템 폰트 대신 lineSeed 폰트 사용
export const systemFont = lineSeed; 