"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PrivacyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/setting/terms/privacy");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <p className="text-sm text-gray-600">
        개인정보 처리방침 페이지가 이동되었습니다. 자동으로 이동하지 않으면
        <a href="/setting/terms/privacy" className="ml-1 text-indigo-600 underline">여기를 클릭</a>하세요.
      </p>
    </div>
  );
}

