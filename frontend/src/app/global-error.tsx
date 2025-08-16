'use client';

import React from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 flex items-center justify-center px-4">
          <div className="text-center max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-red-100">
              {/* 에러 아이콘 */}
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>

              {/* 제목 */}
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                예상치 못한 오류가 발생했습니다
              </h1>

              {/* 에러 메시지 */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-red-800 font-medium mb-2">에러 상세:</p>
                <p className="text-xs text-red-700 font-mono break-all">
                  {error.message || '알 수 없는 오류'}
                </p>
                {error.digest && (
                  <p className="text-xs text-red-600 mt-2">
                    에러 ID: {error.digest}
                  </p>
                )}
              </div>

              {/* 설명 */}
              <p className="text-gray-600 mb-8 leading-relaxed">
                죄송합니다. 예상치 못한 오류가 발생했습니다.
                <br />
                아래 버튼을 클릭하여 다시 시도하거나 홈으로 돌아가주세요.
              </p>

              {/* 버튼들 */}
              <div className="space-y-4">
                {/* 다시 시도 */}
                <button
                  onClick={reset}
                  className="block w-full bg-gradient-to-r from-red-500 to-pink-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-red-600 hover:to-pink-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  다시 시도
                </button>

                {/* 홈으로 돌아가기 */}
                <Link
                  href="/"
                  className="block w-full bg-white text-gray-700 font-semibold py-3 px-6 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 transform hover:scale-105"
                >
                  홈으로 돌아가기
                </Link>
              </div>

              {/* 추가 정보 */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  문제가 지속되면{' '}
                  <Link href="/setting" className="text-red-600 hover:text-red-700 underline">
                    설정
                  </Link>
                  에서 도움을 받을 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
