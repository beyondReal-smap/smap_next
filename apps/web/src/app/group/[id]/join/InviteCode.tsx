"use client";

import { useState } from "react";

/** 초대 코드 표시 + 복사. 앱을 새로 설치한 사람은 딥링크가 사라지므로 코드를 직접 넣어야 한다. */
export default function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // 클립보드 권한이 막힌 브라우저 — 코드는 화면에 그대로 보이니 직접 옮겨 적으면 된다.
      console.warn("초대 코드 복사 실패", error);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-xl bg-[#F1F4FB] px-4 py-3">
      <div>
        <p className="text-xs text-gray-500">초대 코드</p>
        <p className="font-mono text-xl font-bold tracking-widest text-[#1A2B6D]">{code}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#1A2B6D] shadow-sm"
      >
        {copied ? "복사됨" : "복사"}
      </button>
    </div>
  );
}
