                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    "use client";

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import AnimatedHeader from '../../../components/common/AnimatedHeader';
import { triggerHapticFeedback, HapticFeedbackType } from '@/utils/haptic';

// 모바일 최적화된 CSS 애니메이션 (setting/manual/page.tsx 참고)
const pageAnimations = `
html, body {
  width: 100%;
  overflow-x: hidden;
  position: relative;
}

@keyframes slideInFromRight {
  from { transform: translateX(30px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn { animation: fadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }

.glass-effect {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 9999 !important;
  background: rgba(255, 255, 255, 0.8) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08) !important;
}
`;

export default function ServiceTermsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbed = (searchParams?.get('embed') === '1');

  useEffect(() => {
    // iPad/iOS WebView 최적화 스타일 적용
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isEmbed) {
      // embed 모드일 때는 내부 웹뷰처럼 작동
      document.body.style.position = 'relative';
      document.body.style.overflow = 'auto';
      document.body.style.height = 'auto';
      document.body.style.minHeight = '100vh';
      document.body.style.background = 'white';
      document.documentElement.style.position = 'relative';
      document.documentElement.style.overflow = 'auto';
      document.documentElement.style.height = 'auto';
      
      // iOS에서 추가 최적화
      if (isIOS) {
        document.body.style.setProperty('-webkit-overflow-scrolling', 'touch');
        document.body.style.setProperty('-webkit-transform', 'translateZ(0)');
        document.body.style.setProperty('-webkit-backface-visibility', 'hidden');
      }
    } else {
      document.body.style.overflowY = 'auto';
      document.documentElement.style.overflowY = 'auto';
    }
    
    return () => {
      document.body.style.position = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.body.style.minHeight = '';
      document.body.style.background = '';
      document.body.style.removeProperty('-webkit-overflow-scrolling');
      document.body.style.removeProperty('-webkit-transform');
      document.body.style.removeProperty('-webkit-backface-visibility');
      document.documentElement.style.position = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.documentElement.style.overflowY = '';
    };
  }, [isEmbed]);

  const handleBack = () => {
    triggerHapticFeedback(HapticFeedbackType.SELECTION, '서비스 이용약관 뒤로가기', {
      component: 'setting-service-terms',
      action: 'back-navigation'
    });
    router.push('/setting');
  };

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div
        className={`${isEmbed ? 'min-h-screen overflow-auto bg-white' : 'fixed inset-0 overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 main-container'}`}
        id="setting-service-terms-container"
        style={{ paddingTop: '0px', marginTop: '0px', top: '0px' }}
      >
        {!isEmbed && (
          <AnimatedHeader variant="enhanced" className="setting-header glass-effect">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="setting-header-content motion-div"
            >
              <motion.button
                onClick={handleBack}
                className="setting-back-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="뒤로가기"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              <div className="setting-header-text">
                <h1 className="text-lg font-bold text-gray-900 leading-tight">서비스 이용약관</h1>
                <p className="text-xs text-gray-500 leading-tight">서비스 이용에 관한 약관을 확인하세요</p>
              </div>
            </motion.div>
          </AnimatedHeader>
        )}

        {/* 컨텐츠 영역 - 헤더 고정 기준으로 스크롤 */}
        <motion.div
          initial="initial"
          animate="in"
          exit="out"
          className={`${isEmbed ? '' : 'absolute inset-0'} px-4 space-y-6 content-area ${isEmbed ? '' : 'hide-scrollbar'} ${isEmbed ? 'pt-6' : 'pt-20'}`}
          style={isEmbed ? undefined : { overflow: 'hidden', overflowY: 'auto' }}
        >
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn">
            <div className="p-6 text-sm leading-relaxed max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-center">서비스 이용약관</h2>
              <p className="text-sm text-gray-500 mb-8 text-center">시행일: 2024-05-30</p>

              <div className="space-y-6 text-gray-800 leading-7">
                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제1조(목적)</h3>
                  <p>이 약관은 비욘드리얼(이하 “회사”)가 제공하는 제반 서비스의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.</p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제2조(정의)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>“서비스”라 함은 구현되는 단말기(PC, TV, 휴대형단말기 등의 각종 유무선 장치를 포함)와 상관없이 이용자가 이용할 수 있는 회사의 제반 서비스를 의미합니다.
                      <ol className="list-decimal pl-5 mt-1">
                        <li>smap 서비스</li>
                        <li>기타 회사가 정하는 서비스</li>
                      </ol>
                    </li>
                    <li>“smap 서비스”라 함은 실시간 위치조회, 위치와 일정 기반 알림 등 회사가 이용자에게 제공하는 서비스를 말합니다.</li>
                    <li>“이용자”란 회사가 제공하는 서비스를 받는 개인회원과 비회원을 말합니다.</li>
                    <li>“개인회원”은 회사에 개인정보를 제공하여 회원등록을 한 사람으로, 회사로부터 지속적으로 정보를 제공받고 서비스를 계속적으로 이용할 수 있는 자를 말합니다.</li>
                    <li>“비회원”은 회원가입 없이 회사가 제공하는 서비스를 이용하는 자를 말합니다.</li>
                    <li>“아이디(ID)”란 회원의 식별과 서비스 이용을 위하여 회원이 정하고 회사가 승인하는 문자 또는 문자와 숫자의 조합을 의미합니다.</li>
                    <li>“비밀번호”란 회원이 부여받은 아이디와 일치되는 회원임을 확인하고 비밀의 보호를 위해 회원이 정한 문자(특수문자 포함)와 숫자의 조합을 의미합니다.</li>
                    <li>“유료서비스”란 회사가 유료로 제공하는 제반 서비스를 의미합니다.</li>
                    <li>“결제”란 회사가 제공하는 유료서비스를 이용하기 위하여 회원이 지불수단을 선택하고 금융정보를 입력하는 행위를 말합니다.</li>
                    <li>“할인쿠폰”은 이용자가 회사의 서비스를 이용하면서 그 대가를 지급하는 데 사용하기 위하여 회사가 발행 및 관리하는 지급수단을 말합니다.</li>
                    <li>“콘텐츠”란 정보통신망법에 따라 정보통신망에서 사용되는 부호·문자·음성·음향·이미지 또는 영상 등으로 정보 형태의 글, 사진, 동영상 및 각종 파일과 링크 등을 말합니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제3조(약관 외 준칙)</h3>
                  <p className="text-sm">이 약관에서 정하지 아니한 사항은 법령 또는 회사가 정한 서비스의 개별약관, 운영정책 및 규칙 등(이하 “세부지침”)의 규정에 따르며, 본 약관과 세부지침이 충돌할 경우 세부지침이 우선합니다.</p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제4조(약관의 효력과 변경)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>이 약관은 회사가 제공하는 모든 인터넷서비스에 게시하여 공시합니다. 회사는 전자상거래법, 약관규제법, 정보통신망법 등 관련 법령에 위배되지 않는 범위에서 본 약관을 변경할 수 있으며, 변경 시 최소 7일(불리하거나 중대한 사항은 30일) 이전부터 공지합니다. 기존 이용자에게는 전자적 수단(전자우편, 문자메시지, 서비스 내 알림 등)으로 개별 통지할 수 있습니다. 변경된 약관은 시행일부터 효력이 발생합니다.</li>
                    <li>회사는 개정약관 공지 또는 통지 시, ‘변경에 동의하지 아니한 경우 공지일 또는 통지를 받은 날로부터 7일(불리하거나 중대한 사항은 30일) 내 해지 가능하며, 해지 의사표시가 없으면 동의한 것으로 간주’됨을 함께 통지합니다.</li>
                    <li>이용자가 전항의 기간 내 거절 의사를 표시하지 않을 때에는 개정 약관에 동의한 것으로 봅니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제5조(이용자에 대한 통지)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>회사는 이 약관에 별도 규정이 없는 한 전자우편, 문자(SMS), 전자쪽지, 푸시 알림 등의 전자적 수단으로 통지할 수 있습니다.</li>
                    <li>이용자 전체에 대한 통지는 7일 이상 서비스 내 공지 게시로 갈음할 수 있습니다. 다만, 회원 개별 거래에 중대한 영향을 미치는 사항은 개별 통지합니다.</li>
                    <li>연락처 미기재, 변경 후 미수정, 오기재 등으로 개별 통지가 어려운 경우 공지로 개별 통지를 갈음한 것으로 간주합니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제6조(이용계약의 체결)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>회원가입 시, 이용자가 약관에 동의하고 가입 신청을 하며 회사가 이를 승낙한 때</li>
                    <li>비회원 유료 이용의 경우, 결제가 완료된 때</li>
                    <li>무료 서비스인 경우, 관련 부가 기능 이용에 필요한 절차 진행 시</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제7조(회원가입에 대한 승낙)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>회사는 이용계약 요청이 있으면 원칙적으로 승낙합니다.</li>
                    <li>필요 시 실명확인 및 본인인증을 요청할 수 있습니다.</li>
                    <li>설비 부족, 기술·업무상 문제 등으로 승낙을 유보할 수 있습니다.</li>
                    <li>승낙 거절·유보 시 원칙적으로 신청자에게 알립니다(불가피한 경우 예외).</li>
                    <li>계약 성립 시점은 가입완료(또는 결제완료) 표시 시점입니다.</li>
                    <li>회사 정책에 따라 등급별로 이용시간·횟수·메뉴 등에 차등을 둘 수 있습니다.</li>
                    <li>관련 법령에 따른 연령·등급 제한을 둘 수 있습니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제8조(회원정보의 변경)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>회원은 개인정보관리화면에서 개인정보를 열람·수정할 수 있습니다(실명, 아이디 등은 제한될 수 있음).</li>
                    <li>회원가입 시 기재 사항 변경 시 온라인 또는 전자우편 등으로 회사에 알려야 합니다.</li>
                    <li>변경 미통지로 인한 불이익은 회원에게 책임이 있습니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제9조(회원정보의 관리 및 보호)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>아이디와 비밀번호 관리책임은 회원에게 있으며, 제3자 이용을 허용해서는 안 됩니다.</li>
                    <li>아이디가 부적절하거나 오인 우려가 있는 경우 회사는 이용을 제한할 수 있습니다.</li>
                    <li>도용 또는 제3자 사용 인지 시 즉시 회사에 통지하고 안내에 따라야 합니다.</li>
                    <li>통지 의무 불이행 또는 미이행으로 발생한 불이익에 대해 회사는 책임지지 않습니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제10조(회사의 의무)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>장애·멸실 시 지체 없이 수리·복구하며, 불가피한 경우 예고 없이 일시 중지할 수 있고 사후 공지합니다.
                      <ol className="list-decimal pl-5 mt-1">
                        <li>시스템 긴급점검·증설·교체·보수·공사 등 필요 시</li>
                        <li>새로운 서비스 제공을 위한 시스템 교체</li>
                        <li>설비 장애, 유무선 네트워크 장애 등으로 정상 제공 불가</li>
                        <li>국가비상사태, 정전, 불가항력 등</li>
                      </ol>
                    </li>
                    <li>계약 체결·변경·해지 등 절차에서 이용자 편의를 제공합니다.</li>
                    <li>대표자 성명, 상호, 주소, 연락처, 약관, 개인정보처리방침 등을 초기화면에 게시합니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제11조(개인정보보호)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>회사는 관련 법규를 준수하며 개인정보보호정책을 통해 처리현황을 고지합니다.</li>
                    <li>1년 미사용 시 분리 보관할 수 있으며, 탈퇴·삭제 요청 시까지 보관합니다.</li>
                    <li>개인정보 처리에는 회사의 개인정보처리방침이 적용되며, 외부 링크 페이지에는 적용되지 않습니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제12조(이용자의 의무)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>가입 신청은 사실에 근거해야 하며, 허위 또는 타인 정보 등록 시 권리를 주장할 수 없습니다.</li>
                    <li>약관·정책·공지 준수 및 회사 업무·명예 훼손 금지</li>
                    <li>정보 변경 시 즉시 수정해야 하며, 미수정으로 발생한 책임은 이용자에게 있습니다.</li>
                    <li>아이디·비밀번호는 이용자가 직접 관리하며, 관리 소홀에 대한 책임은 이용자에게 있습니다.</li>
                    <li>명칭 선정 시 다음을 금지합니다.
                      <ol className="list-decimal pl-5 mt-1">
                        <li>운영자 사칭 또는 혼란 유발</li>
                        <li>선정적·음란한 명칭</li>
                        <li>타인의 권리를 침해할 가능성이 있는 명칭</li>
                        <li>타인의 명예 훼손 또는 업무 방해 우려가 있는 명칭</li>
                        <li>반사회적·법령 저촉 내용</li>
                      </ol>
                    </li>
                    <li>서비스 이용 권한 등은 회사 동의 없이 처분할 수 없습니다.</li>
                    <li>위반 시 서비스 이용제한, 민형사상 책임 등 불이익이 발생할 수 있습니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제13조(서비스의 제공)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>연중무휴 24시간 제공을 원칙으로 하나, 유지보수 등으로 일시 중단될 수 있습니다.</li>
                    <li>개별 서비스 안내사항은 해당 화면에서 확인합니다.</li>
                    <li>회사 제공 서비스는 다음과 같습니다.
                      <ol className="list-decimal pl-5 mt-1">
                        <li>웹 페이지 등을 이용하여 제공되는 서비스</li>
                        <li>회원 정보 및 이용내역에 따른 맞춤 서비스</li>
                        <li>직접 개발하거나 제휴를 통해 제공되는 서비스</li>
                        <li>기타 이용자 편의를 위한 서비스</li>
                      </ol>
                    </li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제14조(서비스의 제한 등)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>전시, 사변, 천재지변, 기간통신사업자 중지 등 불가피한 사유 발생 시 제한 또는 중지할 수 있습니다.</li>
                    <li>무료서비스는 운영정책 등에 따라 제한·중지되거나 유료 전환될 수 있습니다.</li>
                    <li>제한 또는 정지 시 사유, 기간 등을 지체 없이 알립니다.</li>
                    <li>무료→유료 전환 시 사전 통지 및 동의를 받습니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제15조(서비스의 해제·해지 및 탈퇴 절차)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>회원은 서비스 내 탈퇴 기능을 통해 해지할 수 있으며, 부정이용 방지 등을 위해 즉시 탈퇴가 제한될 수 있습니다.</li>
                    <li>약관 위반, 부당 이용, 금지 프로그램 사용, 명예 훼손 게시물 작성 등이 2회 이상 누적될 경우 통지 후 계약을 해지할 수 있습니다.</li>
                    <li>청약철회·해제·해지 의사표시 수신 후 회사는 통지한 방법으로 회신합니다(연락처 부재 시 생략 가능).</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제16조(손해배상)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>상대방의 귀책으로 손해 발생 시 손해배상을 청구할 수 있습니다. 단, 무료서비스 장애·중단·자료 멸실/삭제/변조로 인한 손해는 회사의 고의 또는 중과실이 없는 한 책임지지 않습니다.</li>
                    <li>운영정책, 개인정보보호정책, 개별 약관을 준수하는 범위에서 회사는 손해에 대해 책임지지 않습니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제17조(면책사항)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>천재지변 등 불가항력 시 서비스 제공 책임이 면제됩니다.</li>
                    <li>이용자 귀책으로 인한 장애에 대해 책임지지 않습니다.</li>
                    <li>기대 이익 상실 및 자료로 인한 손해 등에 대해 책임지지 않습니다.</li>
                    <li>이용자가 게재한 내용의 신뢰도·정확성 등에 대해 책임지지 않으며, 분쟁에 개입하지 않습니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제18조(정보의 제공 및 광고의 게재)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>배너, 전자우편, 문자, 전화, 우편 등으로 정보 및 광고를 제공할 수 있으며, 이용자는 수신을 거부할 수 있습니다.</li>
                    <li>필수 고지는 수신 거부와 무관하게 제공될 수 있습니다.</li>
                    <li>수신 거부로 거래 관련 정보 전달 실패 시 회사는 책임을 지지 않습니다.</li>
                    <li>정보통신망법 시행령에 따라 2년마다 영리 목적 광고 정보 수신동의를 재확인합니다.</li>
                    <li>광고주 판촉 활동 참여로 발생한 손실 또는 손해에 대해 회사는 책임지지 않습니다.</li>
                    <li>할인쿠폰은 사용 또는 만료 시 소멸하며 현금 환급되지 않습니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제19조(유료서비스의 결제 등)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>유료서비스 이용 시 이용대금을 납부하며, 결제방법은 다음과 같습니다.
                      <ol className="list-decimal pl-5 mt-1">
                        <li>카드결제(선불/직불/신용)</li>
                        <li>계좌이체(폰뱅킹, 인터넷뱅킹, 무통장입금 등)</li>
                      </ol>
                    </li>
                    <li>결제수단의 정당한 사용 권한을 확인할 수 있으며, 확인 전까지 거래 중지 또는 취소될 수 있습니다.</li>
                    <li>정책 및 결제업체 기준에 따라 월 누적 결제액/한도가 제한될 수 있습니다.</li>
                    <li>결제 정보의 정확성에 대한 책임은 이용자에게 있습니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제20조(환불)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>이용자 귀책으로 취소·환불 시
                      <ol className="list-decimal pl-5 mt-1">
                        <li>1회성 이용/구매 완료 서비스: 환불 불가</li>
                        <li>지속 이용 서비스: 이용일수 차감 후 환불</li>
                      </ol>
                    </li>
                    <li>다음의 경우 전액 환불합니다: 이용 내역 없음, 회사 귀책에 의한 미이용, 제공 미이행, 표시/광고와 상이, 결함으로 현저히 이용 불가 등</li>
                    <li>환불은 원칙적으로 결제수단과 동일한 방법으로 진행합니다.</li>
                    <li>환불 의무 발생 후 3영업일 내 절차를 진행하며, 이용자 귀책으로 지연되는 경우 지연이자를 부담하지 않습니다.</li>
                    <li>환불 비용은 귀책 당사자가 부담합니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제21조(권리의 귀속)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>서비스에 대한 저작권 등 지식재산권은 회사에 귀속됩니다.</li>
                    <li>이용자에게는 이용 권한만 부여되며, 이를 양도·판매·담보 제공 등 처분할 수 없습니다.</li>
                    <li>이용자가 직접 작성한 콘텐츠 및 제휴 제공 저작물의 권리는 회사에 귀속되지 않습니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제22조(콘텐츠의 관리)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>회원 콘텐츠가 법령 또는 권리를 침해하는 경우 게시중단·삭제 등 조치를 요청할 수 있으며, 회사는 관련 법에 따라 조치합니다.</li>
                    <li>권리 침해가 인정될 사유가 있거나 정책·법에 위반되는 경우 회사는 임시조치를 취할 수 있습니다.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제23조(콘텐츠의 저작권)</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>게시된 콘텐츠의 저작권은 해당 저작자에게 귀속됩니다.</li>
                    <li>회사는 서비스 운영·전시·전송·배포·홍보 등을 목적으로 공정한 범위 내에서 회원 콘텐츠를 사용할 수 있습니다.
                      <ol className="list-decimal pl-5 mt-1">
                        <li>서비스 운영·홍보·개선 및 신규 서비스 개발을 위한 사용</li>
                      </ol>
                    </li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3 text-blue-900">제24조(관할법원 및 준거법)</h3>
                  <p className="text-sm">서비스와 관련하여 분쟁이 발생한 경우 관할법원은 민사소송법에 따른 관할법원으로 정하며, 준거법은 대한민국 법령을 적용합니다.</p>
                </section>

                <div className="bg-gray-50 p-4 rounded-lg border-t-4 border-blue-500 mt-6">
                  <h4 className="font-semibold mb-2 text-sm">부칙</h4>
                  <p className="text-xs text-gray-700">본 약관은 2024-05-30부터 시행합니다.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}


