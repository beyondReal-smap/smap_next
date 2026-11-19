import type { Metadata } from "next";
import Image from "next/image";

import AppOpenActions from "@/app/components/AppOpenActions";

/**
 * 비밀번호 재설정 링크 착지 페이지 — 서버가 보내는 https://smap.aiagnt.kr/r?t=<토큰>.
 *
 * 링크(토큰) 방식 재설정 API(/auth/reset-password)는 토큰이 짧고 시도 제한이 없어 관리자 전용으로 닫혀 있다.
 * 그래서 이 페이지는 웹에서 비밀번호를 바꾸지 않고, 앱의 이메일 인증번호 방식으로 안내한다.
 * 토큰(t)은 읽지 않는다.
 */
export const metadata: Metadata = {
  title: "비밀번호 재설정",
  description: "도착했어 비밀번호는 앱의 로그인 화면에서 이메일 인증번호로 바꿀 수 있어요.",
  robots: { index: false, follow: false },
};

export default function PasswordResetGuidePage() {
  return (
    <main className="min-h-screen bg-[#F7F9FC] pt-28 pb-20 px-4">
      <div className="mx-auto max-w-md">
        <div className="space-y-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/images/arrived/app-icon-180.png"
              alt="도착했어 앱 아이콘"
              width={72}
              height={72}
              className="rounded-2xl"
            />
            <h1 className="mt-4 text-2xl font-bold text-gray-900">비밀번호 재설정</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              비밀번호는 앱에서 이메일 인증번호로 바꿀 수 있어요.
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
            <ol className="list-decimal pl-5">
              <li>도착했어 앱을 열어요.</li>
              <li>로그인 화면에서 &lsquo;비밀번호 찾기&rsquo;를 눌러요.</li>
              <li>가입한 이메일로 받은 인증번호를 넣고 새 비밀번호를 정해요.</li>
            </ol>
          </div>

          <AppOpenActions deepLink="smapapp://smap" />
        </div>
      </div>
    </main>
  );
}
