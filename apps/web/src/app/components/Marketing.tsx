import Image from 'next/image';
import type { ReactNode } from 'react';
import { APP_DISTRIBUTION, PRICING } from '@/content/site';

const iconPaths: Record<string, ReactNode> = {
  arrow: <><path d="M4 12h16M14 6l6 6-6 6" /></>,
  pin: <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 5h3" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  play: <path d="m9 5 11 7-11 7V5Z" />,
  route: <><circle cx="5" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 6h9a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h6" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 7 9 6 9-6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
};

export function Icon({ name, className = '' }: { name: keyof typeof iconPaths; className?: string }) {
  return <svg className={`smap-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

export function MapPreview({ route = false }: { route?: boolean }) {
  return (
    <div className={`map-preview ${route ? 'map-preview-route' : ''}`} role="img" aria-label={route ? '집에서 학교를 거쳐 학원으로 이어지는 이동 경로 예시' : '가족의 현재 위치와 학교 도착 알림을 함께 보여주는 지도 예시'}>
      <svg className="neighborhood-map" viewBox="0 0 600 440" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <rect width="600" height="440" fill="#F0F1E8" />
        <g fill="#E4E7DC" stroke="#DADFD1" strokeWidth="1.5">
          <rect x="26" y="28" width="88" height="70" rx="13" /><rect x="135" y="22" width="71" height="79" rx="10" />
          <rect x="246" y="24" width="102" height="68" rx="13" /><rect x="378" y="26" width="100" height="71" rx="12" />
          <rect x="20" y="135" width="74" height="75" rx="12" /><rect x="132" y="139" width="83" height="71" rx="12" />
          <rect x="378" y="130" width="101" height="96" rx="12" /><rect x="513" y="29" width="78" height="67" rx="12" />
          <rect x="514" y="133" width="66" height="69" rx="12" /><rect x="19" y="253" width="85" height="65" rx="12" />
          <rect x="135" y="254" width="72" height="91" rx="12" /><rect x="19" y="359" width="86" height="65" rx="12" />
          <rect x="247" y="367" width="104" height="56" rx="12" /><rect x="386" y="358" width="88" height="66" rx="12" />
        </g>
        <path d="M-30 371C112 343 180 405 292 340S466 271 643 344" stroke="#C9E4E7" strokeWidth="44" />
        <path d="M-30 371C112 343 180 405 292 340S466 271 643 344" stroke="#E1F0EB" strokeWidth="2" strokeDasharray="5 8" />
        <g stroke="#FFFFFF" strokeWidth="17">
          <path d="M-10 117h630M-10 235h630M119-10v470M230-10v470M365-10v470M497-10v470" />
        </g>
        <rect x="256" y="143" width="86" height="70" rx="23" fill="#CDDEC0" />
        <g fill="#AAC79E"><circle cx="275" cy="163" r="11" /><circle cx="311" cy="170" r="15" /><circle cx="289" cy="193" r="9" /></g>
        <path d="M119 293V235H230V117H425" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M119 293V235H230V117H425" stroke="#297457" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={route ? undefined : '7 7'} />
        <circle cx="230" cy="117" r="36" fill="#277656" fillOpacity=".1" /><circle cx="230" cy="117" r="21" fill="#277656" fillOpacity=".12" />
        <circle cx="230" cy="117" r="8" fill="#277656" stroke="white" strokeWidth="4" />
      </svg>
      <span className="map-place map-park">우리동네 공원</span>
      <span className="map-place map-river">한강 산책길</span>
      <span className="map-label map-home"><Icon name="pin" /> 우리 집</span>
      <span className="map-label map-school"><Icon name="pin" /> 학교</span>
      <div className="map-person"><span className="avatar avatar-peach">지</span><span>지우<small>학교에 있어요</small></span><span className="online-dot" /></div>
      <div className="map-notice"><span className="notice-icon"><Icon name="check" /></span><span><strong>{route ? '오늘의 이동 기록' : '학교에 잘 도착했어요'}</strong><small>{route ? '집 → 학교 → 학원' : '지우 · 학교 도착 알림'}</small></span><span className="notice-time">{route ? '예시' : '방금'}</span></div>
    </div>
  );
}

export function SchedulePreview() {
  return (
    <div className="schedule-preview">
      <div className="schedule-heading"><span>오늘의 가족 일정</span><Icon name="calendar" /></div>
      <div className="calendar-week" aria-label="일정 예시의 주간 달력">
        {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => <div key={day} className={i === 2 ? 'selected-day' : ''}><span>{day}</span><strong>{12 + i}</strong>{i === 2 && <i />}</div>)}
      </div>
      <div className="schedule-event"><span className="event-time">08:30</span><span className="event-line" /><div><small>지우의 일정</small><strong>학교 가는 시간</strong><span>학교 · 도착 알림 설정</span></div><span className="event-check"><Icon name="check" /></span></div>
      <div className="schedule-event"><span className="event-time">15:00</span><span className="event-line peach" /><div><small>지우의 일정</small><strong>피아노 학원</strong><span>일정 시작 30분 전 알림</span></div><Icon name="bell" /></div>
      <div className="schedule-event"><span className="event-time">18:00</span><span className="event-line blue" /><div><small>가족 일정</small><strong>다 함께 저녁 먹기</strong><span>우리 집</span></div><Icon name="users" /></div>
      <p className="preview-footnote">기능 이해를 위한 예시입니다.</p>
    </div>
  );
}

export function DownloadSection({ id = 'app-download' }: { id?: string }) {
  return (
    <section id={id} className="download-section section-anchor" aria-labelledby={`${id}-title`}>
      <div className="site-container download-inner">
        <div className="download-copy"><span className="eyebrow">우리 가족을 연결하는 첫걸음</span><h2 id={`${id}-title`}>마음이 놓이는 일상,<br />지금 시작해 보세요.</h2><p>가족의 위치도, 오늘의 일정도.<br />SMAP 하나로 조금 더 가깝게.</p><p className="download-pricing">{PRICING.summary}</p></div>
        <div className="store-options">
          {Object.entries(APP_DISTRIBUTION).map(([key, store]) => (
            <a key={key} href={store.url} className="store-option" target="_blank" rel="noopener noreferrer" aria-label={`${store.platform} 앱 다운로드, ${store.store} 새 창`}>
              <Image src={key === 'ios' ? '/images/appStoreQR.jpg' : '/images/googlePlayQR.jpg'} alt={`${store.platform} 설치 페이지 QR 코드`} width={180} height={180} className="store-qr" />
              <span className="store-option-copy"><small>{key === 'ios' ? '아이폰에서 시작하기' : '안드로이드에서 시작하기'}</small><strong>{store.store}</strong><span>앱 다운로드 <Icon name="arrow" /></span></span>
            </a>
          ))}
          <p className="qr-help">휴대전화 카메라로 QR 코드를 비추거나<br />스토어 버튼을 눌러 설치해 주세요.</p>
        </div>
      </div>
    </section>
  );
}
