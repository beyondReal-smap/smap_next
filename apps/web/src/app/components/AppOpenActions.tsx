"use client";

import { useEffect, useState } from "react";

import { APP_DISTRIBUTION } from "@/content/site";

type Platform = "ios" | "android" | "other";

/**
 * "앱에서 열기" + 스토어 버튼 (초대 링크·비밀번호 재설정 안내 페이지 공용).
 *
 * deepLink 는 앱이 처리하는 스킴 주소(smap://…). 앱 두 곳 모두 smap://group/{id}/join?code= 를 받는다.
 * Android 에서는 intent:// 로 열어 앱이 없으면 Play 스토어로 바로 넘어가게 한다
 * (smap:// 를 그냥 열면 앱이 없을 때 아무 반응이 없다). iOS 는 스킴이 없으면 Safari 가 오류를 띄우므로
 * App Store 버튼을 함께 보여 준다.
 */
export default function AppOpenActions({ deepLink }: { deepLink: string }) {
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) setPlatform("android");
    else if (/iphone|ipad|ipod/i.test(ua) || (ua.includes("Mac") && "ontouchend" in document)) setPlatform("ios");
  }, []);

  const openHref = platform === "android" ? androidIntent(deepLink) : deepLink;

  return (
    <div className="space-y-3">
      <a
        href={openHref}
        className="block w-full rounded-xl bg-[#1A2B6D] px-4 py-3.5 text-center text-base font-semibold text-white"
      >
        앱에서 열기
      </a>
      <div className="grid grid-cols-2 gap-3">
        <a
          href={APP_DISTRIBUTION.ios.url}
          className={storeButtonClass(platform === "ios")}
          target="_blank"
          rel="noopener noreferrer"
        >
          App Store
        </a>
        <a
          href={APP_DISTRIBUTION.android.url}
          className={storeButtonClass(platform === "android")}
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Play
        </a>
      </div>
    </div>
  );
}

function storeButtonClass(highlight: boolean): string {
  const base = "block rounded-xl border px-4 py-3 text-center text-sm font-semibold";
  return highlight
    ? `${base} border-[#1A2B6D] text-[#1A2B6D]`
    : `${base} border-gray-200 text-gray-700`;
}

/** smap://group/1/join?code=X → intent://group/1/join?code=X#Intent;scheme=smap;package=…;S.browser_fallback_url=…;end */
function androidIntent(deepLink: string): string {
  const [scheme, rest] = deepLink.split("://", 2);
  const fallback = encodeURIComponent(APP_DISTRIBUTION.android.url);
  return `intent://${rest}#Intent;scheme=${scheme};package=${APP_DISTRIBUTION.android.packageName};S.browser_fallback_url=${fallback};end`;
}
