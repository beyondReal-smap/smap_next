import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import AppOpenActions from "@/app/components/AppOpenActions";

import InviteCode from "./InviteCode";

/**
 * 그룹 초대 링크 착지 페이지 — 앱이 보내는 https://smap.aiagnt.kr/group/{id}/join?code=XXXX.
 *
 * 그룹 이름 등은 보여 주지 않는다(링크만 가진 사람에게 그룹 정보를 노출하지 않기 위해).
 * 앱이 있으면 smap:// 딥링크로 열어 앱이 가입을 처리하고, 없으면 설치 후 코드를 넣게 안내한다.
 */
export const metadata: Metadata = {
  title: "그룹 초대",
  description: "도착했어 그룹에 초대받았어요. 앱에서 참여하면 가족 위치와 일정을 함께 볼 수 있어요.",
  robots: { index: false, follow: false },
};

const GROUP_ID = /^[1-9][0-9]{0,9}$/;
const INVITE_CODE = /^[A-Za-z0-9]{4,20}$/;

export default async function GroupJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const { id } = await params;
  if (!GROUP_ID.test(id)) notFound();

  const raw = (await searchParams).code;
  const code = typeof raw === "string" && INVITE_CODE.test(raw) ? raw.toUpperCase() : null;
  const deepLink = `smap://group/${id}/join${code ? `?code=${code}` : ""}`;

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
            <h1 className="mt-4 text-2xl font-bold text-gray-900">그룹 초대를 받았어요</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              도착했어 앱에서 그룹에 참여하면
              <br />
              가족 위치와 일정을 함께 볼 수 있어요.
            </p>
          </div>

          {code && <InviteCode code={code} />}

          <AppOpenActions deepLink={deepLink} />

          <div className="rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
            <p className="font-semibold text-gray-900">앱이 없다면</p>
            <ol className="mt-1 list-decimal pl-5">
              <li>위 버튼으로 앱을 설치하고 로그인해요.</li>
              <li>그룹 화면에서 &lsquo;코드로 참여&rsquo;를 눌러요.</li>
              <li>{code ? "위 초대 코드를 붙여 넣어요." : "초대한 사람에게 받은 초대 코드를 넣어요."}</li>
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
}
