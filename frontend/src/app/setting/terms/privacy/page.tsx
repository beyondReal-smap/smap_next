"use client";
import Header from '@/components/Header';
import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <Header title="개인정보 처리방침" />
      <div className="flex-1 px-4 py-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-6 text-sm leading-relaxed">
          <h1 className="text-xl font-bold mb-4">개인정보처리방침</h1>
          <p className="mb-4">
            비욘드리얼 ("회사"라 함)는 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 개인정보보호법, 통신비밀보호법, 전기통신사업법, 등 정보통신서비스제공자가 준수하여야 할 관련 법령상의 개인정보보호 규정을 준수하며, 관련 법령에 의거한 개인정보처리방침을 정하여 이용자 권익 보호에 최선을 다하고 있습니다.
          </p>
          <p className="mb-4">
            본 개인정보처리방침은 회사가 제공하는 "홈페이지(www.smap.co.kr)" 및 "어플리케이션 (smap)" (이하에서는 홈페이지 및 어플리케이션을 이하 '서비스'라 합니다.) 이용에 적용되며 다음과 같은 내용을 담고 있습니다.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">개인정보 수집 항목 및 이용목적</h2>
          <p className="mb-4">
            "회사"는 회원가입, 원활한 고객상담, 각종 서비스의 제공을 위해 아래와 같은 최소한의 개인정보를 필수항목으로 수집하고 있습니다.<br />
            "회사"는 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보 보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
          </p>
          <ol className="mb-4 list-decimal pl-5">
            <li>"회사"는 서비스 제공을 위하여 수집한 모든 개인정보와 생성 정보를 아래의 목적으로 이용합니다.
              <ul className="list-disc pl-5">
                <li>회원식별 및 가입의사 확인, 회원관리</li>
                <li>민원처리 및 고객 상담</li>
                <li>서비스 이용 과정 중 본인식별, 인증, 실명확인 및 각종 안내/고지</li>
                <li>불법, 부정이용 방지 및 비인가 사용방침</li>
                <li>결제서비스(거래승인)</li>
                <li>서비스 방문 및 이용기록 및 통계</li>
                <li>다양한 서비스 및 신규 서비스 제공</li>
                <li>알림 서비스</li>
              </ul>
            </li>
            <li>이용자(이하 "회원"이라 함) 개인정보의 수집·이용 목적과 개인정보 항목은 아래와 같습니다.</li>
          </ol>

          {/* 표: 개인정보 수집 항목 */}
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full text-xs border border-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1">구분</th>
                  <th className="border px-2 py-1">수집방법</th>
                  <th className="border px-2 py-1">이용목적</th>
                  <th className="border px-2 py-1">수집항목</th>
                  <th className="border px-2 py-1">수집이용기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-1" rowSpan={5}>회원가입</td>
                  <td className="border px-2 py-1">공통<br />회원가입 시</td>
                  <td className="border px-2 py-1">회원 가입 및 회원관리</td>
                  <td className="border px-2 py-1">이메일, 이름, 휴대폰번호, 생년월일, 성별, 닉네임</td>
                  <td className="border px-2 py-1" rowSpan={7}>서비스 회원 탈퇴 및 이용계약 종료 시(단,관련법령에 따라 별도 보관되는 정보는 예외)</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">일반회원</td>
                  <td className="border px-2 py-1">회원 가입 및 회원관리</td>
                  <td className="border px-2 py-1">이메일, 이름, 휴대폰번호, 생년월일, 성별, 닉네임</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">카카오 계정으로 가입</td>
                  <td className="border px-2 py-1">소셜 연동 회원관리</td>
                  <td className="border px-2 py-1">카카오 연동ID, 카카오 토큰, 프로필/닉네임, 이메일, 전화번호, CI, 생년월일, 성별</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">페이스북 계정으로 가입</td>
                  <td className="border px-2 py-1">소셜 연동 회원관리</td>
                  <td className="border px-2 py-1">페이스북 연동ID, 페이스북 토큰, 성명, 프로필사진</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">네이버 계정으로 가입</td>
                  <td className="border px-2 py-1">소셜 연동 회원관리</td>
                  <td className="border px-2 py-1">네이버 연동ID, 네이버 토큰, 별명, 프로필사진, 성별, 생일</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">멤버십 서비스</td>
                  <td className="border px-2 py-1">멤버십회원 가입시</td>
                  <td className="border px-2 py-1">멤버십 서비스 이용</td>
                  <td className="border px-2 py-1">결제내역</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">이벤트 응모 및 기타 문의사항(선택)</td>
                  <td className="border px-2 py-1">이벤트 응모 및 기타 문의사항 신청시</td>
                  <td className="border px-2 py-1">이벤트 응모 및 당첨자 선정, 당첨 안내 및 경품 지급, 서비스 문의 안내</td>
                  <td className="border px-2 py-1">이름, 전화번호, 이메일, 주소</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">기타서비스</td>
                  <td className="border px-2 py-1">기타 서비스 이용을 위해 회원이 직접 입력시</td>
                  <td className="border px-2 py-1">기타 서비스 이용</td>
                  <td className="border px-2 py-1">건강피드, 처방전 복약관리 등 기타 서비스 이용시 회원이 직접 입력하는 항목</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-lg font-semibold mt-6 mb-2">개인정보의 제3자에 대한 제공</h2>
          <p className="mb-4">
            1. "회사"는 회원들의 개인정보를 "개인정보의 수집 및 이용목적"에서 고지한 범위 내에서 사용하며, 회원의 사전 동의 없이는 동 범위를 초과하여 이용하거나 원칙적으로 회원의 개인정보를 외부에 공개하지 않습니다. 다만 다음의 경우에는 회원의 개인정보를 제3자에게 제공(공유를 포함)할 수 있습니다.<br />
            2. 다음의 경우<br />
            - 회원이 개인정보의 수집 및 이용에 대한 동의와 별도로 제3자 제공에 사전 동의한 경우: 회사는 회원에게 개인정보를 제공받는 자의 성명과 연락처, 제공받는 자의 개인정보 이용 목적, 제공하는 개인정보의 항목, 제공받는 자의 개인정보 보유 및 이용 기간, 동의 거부권이 존재한다는 사실 및 동의 거부에 따른 불이익의 내용을 미리 알립니다.<br />
            - 법률규정이 있거나 법령상 의무준수를 위해 불가피한 경우<br />
            - 수사기관이 수사목적을 위해 관계법령이 정한 절차를 거쳐 요구하는 경우<br />
            - 통계작성 및 학술연구 등의 목적을 위해 필요한 경우로서 특정 개인을 알아볼 수 없는 형태로 개인정보를 제공하는 경우
          </p>

          {/* 표: 제3자 제공 현황 */}
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full text-xs border border-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1">제공 받는 자</th>
                  <th className="border px-2 py-1">제공 목적</th>
                  <th className="border px-2 py-1">제공하는 개인정보 항목</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-1">보험사(한화손해보험)</td>
                  <td className="border px-2 py-1">텔레마케팅, 휴대폰문자서비스, 이메일서비스 등을 활용한 자사 및 타사 상품/서비스에 대한 제반 마케팅 활동 (업무대행 포함)</td>
                  <td className="border px-2 py-1">이메일, 성명, 생년월일, 성별</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-lg font-semibold mt-6 mb-2">개인정보 처리의 위탁</h2>
          <p className="mb-4">
            1. 회사는 서비스 향상을 위해서 회원의 개인정보를 외부 전문업체에 위탁하여 처리할 수 있습니다. 개인정보의 처리를 위탁하는 경우에는 미리 그 사실을 회원에게 공지하여 회원의 동의를 받을 것입니다.<br />
            2. 회원의 개인정보의 위탁 처리하는 경우에는 위탁계약(위탁업무 수행 목적 외 개인정보 처리 금지, 개인정보의 기술적 관리적 보호조치, 위탁업무의 목적 및 범위, 재위탁 제한, 개인정보에 대한 접근 제한 등 안정성 확보 조치, 위탁업무와 관련하여 보유하고 있는 개인정보의 관리 현황 점검 등 감독, 수탁자가 준수하여야 할 의무를 위반한 경우의 손해배상 등이 내용이 포함됨)을 통하여 서비스제공자의 개인정보보호 관련 지시엄수, 개인정보에 관한 비밀유지, 제3자 제공의 금지 및 사고시의 책임부담 등을 명확히 규정하고 당해 계약내용을 서면 또는 전자적으로 보관할 것입니다.<br />
            3. 이 경우에 회사는 위탁업무의 내용, 개인정보 처리업무를 위탁 받아 처리하는 자(수탁자)를 회원이 언제든지 쉽게 확인할 수 있도록 회사의 '서비스'에 지속적으로 게재하여 공개합니다.<br />
            4. 회사는 업무 위탁으로 인하여 회원의 개인정보가 분실, 도난, 유출, 변조, 훼손되지 아니하도록 수탁자를 교육하고 수탁자가 개인정보를 안전하게 처리하는 지를 감독할 것입니다.
          </p>

          {/* 표: 수탁업체 현황 */}
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full text-xs border border-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1">수탁업체</th>
                  <th className="border px-2 py-1">위탁업무내용</th>
                  <th className="border px-2 py-1">위탁항목</th>
                  <th className="border px-2 py-1">개인정보의 보유 및 이용기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-1">아이지에이웍스</td>
                  <td className="border px-2 py-1">마케팅 성과 분석, 행태정보 수집/분석, 맞춤형 알림, 서비스(앱푸시, 문자, 이메일, 카카오톡)발송을 위한 마케팅 솔루션(디파이너리)의 제공 및 기술 지원</td>
                  <td className="border px-2 py-1">유저ID, 이름, 생년월일, 전화번호, 광고식별값</td>
                  <td className="border px-2 py-1">서비스 회원 탈퇴 및 이용계약 종료 시(단,관련법령에 따라 별도 보관되는 정보는 예외)</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">나이스평가정보</td>
                  <td className="border px-2 py-1">본인명의 인증</td>
                  <td className="border px-2 py-1">이름, 생년월일, 통신사, 성별, 전화번호</td>
                  <td className="border px-2 py-1">-</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">네이버클라우드</td>
                  <td className="border px-2 py-1">데이터 보관 및 시스템 운영</td>
                  <td className="border px-2 py-1">서비스 제공 과정에서 수집한 모든 개인정보</td>
                  <td className="border px-2 py-1">-</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-lg font-semibold mt-6 mb-2">개인정보 수집 및 이용에 대한 동의</h2>
          <p className="mb-4">
            회사는 회원들이 회사의 개인정보 보호정책 또는 이용약관의 내용에 대하여 "동의" 버튼을 클릭할 수 있는 절차를 마련하여, "동의" 버튼을 클릭하면 개인정보 수집 및 이용에 대해 동의한 것으로 봅니다.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">개인정보의 처리 및 보유 기간</h2>
          <p className="mb-4">
            1. 회원의 개인정보는 그 수집목적 또는 제공받은 목적이 달성되거나 회원이 이용계약 해지(회원탈퇴)를 요청한 경우 파기하는 것을 원칙으로 하며, 이 경우 회원의 개인정보는 재생할 수 없는 방법에 의하여 시스템에서 완전히 삭제되며 어떠한 용도로도 열람 또는 이용할 수 없도록 처리됩니다. 또한, 일시적인 목적(설문조사 등)으로 입력 받은 개인정보는 그 목적이 달성된 이후에는 동일한 방법으로 사후 재생이 불가능한 방법으로 처리됩니다.<br />
            2. 회사는 불량 회원의 부정한 이용의 재발을 방지하기 위해 이용계약 해지일(회원탈퇴일)로부터 2년간 해당 회원의 개인정보를 보유할 수 있습니다. 그리고 상법, 전자상거래 등에서의 소비자보호에 관한 법률 등 관계법령의 규정에 의하여 보존할 필요가 있는 경우 회사는 관계법령에서 정한 일정한 기간 동안 회원정보를 보관합니다. 이 경우 회사는 보관하는 정보를 그 보관의 목적으로만 이용하며 보존기간은 아래와 같습니다.
          </p>

          {/* 표: 회사 내부 정책에 의한 보존 */}
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full text-xs border border-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1">구분</th>
                  <th className="border px-2 py-1">항목</th>
                  <th className="border px-2 py-1">기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-1">회사 내부 정책(부정 이용 방지 등 회사 방침에 의한 보존)</td>
                  <td className="border px-2 py-1">아이디, DI, CI</td>
                  <td className="border px-2 py-1">회원 탈퇴 후 2년</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 표: 법령에 의한 보존 */}
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full text-xs border border-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1">근거법령</th>
                  <th className="border px-2 py-1">보존항목</th>
                  <th className="border px-2 py-1">보존기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-1" rowSpan={4}>전자상거래 등에서의 소비자 보호에 관한 법률</td>
                  <td className="border px-2 py-1">계약 또는 청약철회 등에 관한 기록</td>
                  <td className="border px-2 py-1">5년</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">대금결제 및 재화 등의 공급에 관한 기록</td>
                  <td className="border px-2 py-1">5년</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">소비자의 불만 또는 분쟁처리에 관한 기록</td>
                  <td className="border px-2 py-1">3년</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">표시/광고에 관한 기록</td>
                  <td className="border px-2 py-1">6개월</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">신용정보의 이용 및 보호에 관한 법률</td>
                  <td className="border px-2 py-1">신용정보의 수집/처리 및 이용 등에 관한 기록</td>
                  <td className="border px-2 py-1">3년</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">통신비밀보호법</td>
                  <td className="border px-2 py-1">로그 기록</td>
                  <td className="border px-2 py-1">3개월</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">전자금융거래법</td>
                  <td className="border px-2 py-1">전자금융 거래에 관한 기록</td>
                  <td className="border px-2 py-1">5년</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mb-4">
            1. 이용약관 및 관계법령을 위반한 회원의 경우 다른 회원을 보호하고 사법기관 수사의뢰 시 증거자료로 활용하기 위해 회원탈퇴 후 2년 까지 회원정보를 보관할 수 있습니다.<br />
            2. 2020년 5월 6일 이후 가입한 회원이 1년간 서비스 거래기록이 없을 시, 서비스 미사용 회원의 개인정보는 '정보통신망 이용촉진 및 정보보호 등에 관한 법률 제29조' 에 근거하여 회원에게 사전통지하고 개인정보를 파기하거나 별도로 분리하여 저장 관리합니다. 고객의 요청이 있을 경우에는 위 기간을 달리 정할 수 있습니다. 단, 통신비밀보호법, 전자상거래 등에서의 소비자보호에 관한 법률 등의 관계법령의 규정에 의하여 보존할 필요가 있는 경우 관계법령에서 규정한 일정한 기간 동안 회원 개인정보를 보관합니다. 회사는 위의 1년의 기간 만료 30일 전까지 개인정보가 파기되거나 분리되어 저장•관리되는 사실과 기간 만료일 및 해당 개인정보의 항목을 전자우편 등의 방법으로 고객에게 알립니다. 이를 위해 고객은 정확한 연락처 정보를 제공/수정하여야 합니다.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">만 14세 미만 아동의 가입제한</h2>
          <p className="mb-4">
            회사는 법정 대리인의 동의가 필요한 만 14세미만 아동의 서비스 이용 및 회원가입을 제한하고 있습니다.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">개인정보 파기절차 및 방법</h2>
          <p className="mb-4">
            회원의 개인정보는 원칙적으로 보유기간의 경과, 개인정보의 수집 및 이용목적 달성 등 그 개인정보가 불필요하게 되었을 때에는 지체 없이 파기합니다. 회사의 개인정보 파기절차 및 방법은 다음과 같습니다.
          </p>

          <h3 className="font-semibold mt-4 mb-2">1. 파기절차</h3>
          <p className="mb-4">
            - 회사는 개인정보의 파기에 관한 사항을 기록하고 관리하며, 파기는 개인정보 보호책임자의 책임하에 수행되며, 개인정보 보호책임자는 파기 결과를 확인합니다.<br />
            - 회사는 다른 법령에 따라 보존해야 하는 경우에는 예외적으로 회원의 개인정보를 파기하지 않을 수 있습니다.
          </p>

          <h3 className="font-semibold mt-4 mb-2">2. 파기방법</h3>
          <p className="mb-4">
            - 종이나 그 밖의 기록매체에 저장된 개인정보는 파쇄하거나 소각합니다.<br />
            - 전자적 파일 형태로 저장된 개인정보는 복원이 불가능한 방법(내지 기록을 재생할 수 없는 기술적 방법)으로 영구 삭제합니다.
          </p>

          <h3 className="font-semibold mt-4 mb-2">3. 미파기 정보의 보존방법</h3>
          <p className="mb-4">
            회사는 법령에 따라 개인정보를 파기하지 않고 보존하는 경우에 해당 개인정보 또는 개인정보파일을 다른 개인정보와 분리하여 저장 관리합니다. 회사는 별도 DB로 옮긴 개인정보를 법률에 의한 경우가 아니고서는 보유하는 이외의 다른 목적으로 이용하지 않습니다.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">개인정보주체의 권리와 의무 및 그 행사방법</h2>
          <p className="mb-4">
            1. 회원은 언제든지 회사에 "SMAP" 서비스를 통하여 등록되어 있는 자신의 개인정보, 회사가 회원의 개인정보를 이용하거나 제3자에게 제공한 현황, 회사에게 개인정보 수집, 이용, 제공 등의 동의를 한 현황에 대하여 열람이나 제공을 요구할 수 있고, 오류가 있는 경우에는 그 정정을 요구할 수 있으며, 삭제 내지 가입해지를 요구할 수도 있습니다.<br />
            2. 회원의 개인정보 조회, 수정을 위해서는 '개인정보변경'(또는 '회원정보수정' 등)을, 가입해지(동의철회)를 위해서는 "회원탈퇴"를 클릭하여 본인 확인 절차를 거치신 후 직접 열람, 정정 또는 탈퇴가 가능합니다.<br />
            3. 이 경우에 회사는 지체 없이 그 개인정보를 조사하여 회원의 요구에 따라 정정, 삭제 등 필요한 조치를 한 후 그 결과를 회원에게 알립니다. 회사는 필요한 조치를 할 때까지는 해당 개인정보를 이용하거나 제공하지 않습니다.<br />
            4. 회원은 언제든지 회사에 자신의 개인정보 처리의 정지를 요구할 수 있으며, 이 경우에 회사는 지체 없이 그 요구에 따라 개인정보 처리의 전부 내지 일부를 정지하며, 처리가 정지된 개인정보에 대하여 지체 없이 그 개인정보의 파기 등 필요한 조치를 취합니다.<br />
            5. 개인정보와 관련하여 의의나 의견이 있으신 분은 개인정보 보호책임자 및 담당자에게 서면, 전화 또는 E-mail로 연락하시면 접수 즉시 처리하고 결과를 안내해 드리겠습니다. 로그온(log-on)한 상태에서는 주위의 다른 사람에게 개인정보가 유출되지 않도록 특별히 주의를 기울이시기 바랍니다.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">개인정보 자동 수집 장치의 설치/운영 및 거부에 관한 사항</h2>
          <p className="mb-4">
            회사는 회원들에게 특화된 맞춤서비스를 제공하기 위해서 회원들의 정보를 저장하고 수시로 불러오는 '쿠키(cookie)'를 사용합니다. 쿠키는 웹사이트를 운영하는데 이용되는 서버(HTTP)가 회원의 컴퓨터 브라우저에게 보내는 소량의 정보이며 회원들의 PC 컴퓨터내의 하드디스크에 저장되기도 합니다.
          </p>

          <h3 className="font-semibold mt-4 mb-2">1. 쿠키의 사용 목적</h3>
          <p className="mb-4">
            회원들이 방문한 "SMAP"의 각 서비스와 웹 사이트들에 대한 방문 및 이용형태, 인기 검색어, 보안접속 여부, 회원 규모 등을 파악하여 회원에게 최적화된 정보 제공을 위하여 사용합니다.
          </p>

          <h3 className="font-semibold mt-4 mb-2">2. 쿠키의 설치/운영 및 거부</h3>
          <p className="mb-4">
            ① 회원은 쿠키 설치에 대한 선택권을 가지고 있습니다. 따라서, 회원은 웹브라우저에서 옵션을 설정함으로써 모든 쿠키를 허용하거나, 쿠키가 저장될 때마다 확인을 거치거나, 아니면 모든 쿠키의 저장을 거부할 수도 있습니다.<br />
            ② 쿠키 설정을 거부하는 방법으로는 회원이 사용하는 웹 브라우저의 옵션을 선택함으로써 모든 쿠키를 허용하거나 쿠키를 저장할 때마다 확인을 거치거나, 모든 쿠키의 저장을 거부할 수 있습니다.<br />
            ③ 설정방법 예(인터넷 익스플로어의 경우) : 웹 브라우저 상단의 도구 &gt; 인터넷 옵션 &gt; 개인정보<br />
            ④ 다만, 쿠키의 저장을 거부할 경우에는 로그인이 필요한 일부 서비스는 이용에 어려움이 있을 수 있습니다.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">개인정보의 안전성 확보조치</h2>
          <p className="mb-4">
            1. 회사는 회원들의 개인정보를 취급함에 있어 개인정보가 분실, 도난, 유출, 변조 또는 훼손되지 않도록 안전성 확보를 위하여 다음과 같은 기술적 대책을 강구하고 있습니다.<br />
            - 회원의 개인정보는 비밀번호에 의해 보호되며 파일 및 전송데이터를 암호화하거나 파일 잠금기능(Lock)을 사용하여 중요한 데이터는 별도의 보안기능을 통해 보호되고 있습니다.<br />
            - 회사는 백신프로그램을 이용하여 컴퓨터바이러스에 의한 피해를 방지하기 위한 조치를 취하고 있습니다. 백신프로그램은 주기적으로 업데이트되며 갑작스런 바이러스가 출현할 경우 백신이 나오는 즉시 이를 제공함으로써 개인정보가 침해되는 것을 방지하고 있습니다.<br />
            - 해킹 등 외부침입에 대비하여 각 서버마다 침입차단시스템 및 취약점 분석시스템 등을 이용하여 보안에 만전을 기하고 있습니다.<br />
            2. 관리적인 대책<br />
            - 위와 같은 노력 이외에 회원님 스스로도 제3자에게 비밀번호 등이 노출되지 않도록 주의하셔야 합니다. 특히 비밀번호 등이 공공장소에 설치한 PC를 통해 유출되지 않도록 항상 유의하시기 바랍니다. 회원님의 ID와 비밀번호는 반드시 본인만 사용하고 비밀번호를 정기적으로 바꿔주시는 것이 좋습니다.<br />
            - 회사는 회원의 개인정보에 대한 접근권한을 최소한의 인원으로 제한하고 있으며 회원을 직접 상대로 하여 마케팅 업무를 수행하는 자, 개인정보 보호책임자 및 담당자 등 개인정보관리업무를 수행하는 자, 기타 업무상 개인정보의 취급이 불가피한 자 외에는 접근을 엄격히 제한하고 담당직원에 대한 수시 교육을 통하여 본 정책의 준수를 강조하고 있습니다.
          </p>

          <p className="mb-4">
            단, 회원 본인의 부주의나 인터넷상의 문제로 ID, 비밀번호, 주민등록번호 등 개인정보가 유출해 발생한 문제에 대해 회사는 일체의 책임을 지지 않습니다.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">개인정보관련 의견수렴 및 침해, 불만처리에 관한 사항</h2>
          <p className="mb-4">
            "회사"는 개인정보보호와 관련하여 "회원"의 의견을 수렴하고 있으며 불만을 처리하기 위하여 모든 절차와 방법을 마련하고 있습니다. "회원"은 회사의 서비스 이용 중 발생한 모든 개인정보 보호 관련 문의, 불만처리, 피해구제 등에 관한 사항을 아래 개인정보 보호책임자 및 담당자에게 문의할 수 있습니다. "회사"는 "회원"의 신고사항에 대하여 신속하게 처리하여 답변해 드립니다.
          </p>

          <ul className="mb-4 list-disc pl-5">
            <li>▶ 개인정보 보호책임자<br />- 담 당: 정진<br />- 전화번호: 070-8065-2207<br />- 이 메 일: admin@smap.site</li>
            <li>▶ 개인정보 보호담당자<br />- 담 당: 정진<br />- 전화번호: 070-8065-2207<br />- 이 메 일: admin@smap.site</li>
          </ul>

          <p className="mb-4">
            "회원"은 개인정보침해로 인한 구제를 받기 위하여 개인정보분쟁조정위원회, 한국인터넷진흥원 개인정보침해신고센터 등에 분쟁해결이나 상담 등을 신청할 수 있습니다. 기타 개인정보침해의 신고, 상담에 대하여는 아래의 기관에 문의하시기 바랍니다.
          </p>

          <ul className="mb-4 list-disc pl-5">
            <li>▶ 개인정보 침해신고센터 (한국인터넷진흥원 운영)<br />- 소관업무: 개인정보 침해사실 신고, 상담 신청<br />- 홈페이지: privacy.kisa.or.kr<br />- 전 화: (국번없이) 118<br />- 주 소: (58324) 전남 나주시 진흥길 9, 3층 개인정보침해신고센터 (빛가람동 301-2)</li>
            <li>▶ 개인정보 분쟁조정위원회<br />- 소관업무: 개인정보 분쟁조정신청, 집단분쟁조정 (민사적 해결)<br />- 홈페이지: www.kopico.go.kr<br />- 전화: (국번없이) 1833-6972<br />- 주소: (03171) 서울특별시 종로구 세종대로 209 정부서울청사 4층</li>
            <li>▶ 대검찰청 사이버범죄수사단: 02-3480-3573 (www.spo.go.kr)</li>
            <li>▶ 경찰청 사이버안전국: 182 (http://cyberbureau.police.go.kr)</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 