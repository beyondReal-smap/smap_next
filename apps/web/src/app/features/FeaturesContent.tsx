import { FEATURES } from '@/content/features';
import { DownloadSection, Icon, MapPreview, SchedulePreview } from '../components/Marketing';

const featureIcons: Record<string, string> = {
  'private-group': 'shield', 'route-guidance': 'route', 'smart-notification': 'bell',
  'location-history': 'clock', 'schedule-management': 'calendar', 'group-management': 'users', 'daily-summary': 'calendar',
};

export default function FeaturesContent() {
  return (
    <main id="main-content" className="features-page" tabIndex={-1}>
      <section className="page-heading site-container"><span className="eyebrow">우리 가족을 위한 기능</span><h1>위치에서 일정까지,<br /><span>하나로 연결되는 하루.</span></h1><p>지금 어디에 있는지부터 다음 약속까지.<br />가족을 챙기는 일, SMAP으로 더 간편하게.</p><a href="#feature-list" className="button button-primary">기능 살펴보기 <Icon name="arrow" /></a></section>
      <div className="feature-navigation"><nav className="site-container" aria-label="기능 바로가기">{FEATURES.map((feature) => <a key={feature.id} href={`#${feature.id}`}><Icon name={featureIcons[feature.id]} />{feature.category}</a>)}</nav></div>
      <div className="site-container feature-details" id="feature-list">
        {FEATURES.map((feature, index) => <section key={feature.id} id={feature.id} className="feature-detail section-anchor" aria-labelledby={`${feature.id}-title`}><div className="feature-detail-copy"><span className="eyebrow">{String(index + 1).padStart(2, '0')} / {feature.category}</span><h2 id={`${feature.id}-title`}>{feature.title}</h2><p>{feature.summary}</p><ul>{feature.details.map((detail) => <li key={detail.title}><Icon name="check" /><div><h3>{detail.title}</h3><p>{detail.description}</p></div></li>)}</ul></div><div className={`feature-detail-visual visual-${feature.id}`}>
          {['route-guidance', 'location-history'].includes(feature.id) ? <><MapPreview route /><p className="preview-footnote">기능 이해를 위한 예시 화면입니다.</p></> : ['schedule-management', 'daily-summary'].includes(feature.id) ? <SchedulePreview /> : feature.id === 'smart-notification' ? <div className="notification-demo"><span className="demo-large-icon"><Icon name="bell" /></span><h3>중요한 순간을 놓치지 않게</h3><div><span className="notice-icon"><Icon name="pin" /></span><p><strong>학교에 잘 도착했어요</strong><small>지우 · 학교 도착 알림</small></p><small>방금</small></div><div><span className="notice-icon peach"><Icon name="calendar" /></span><p><strong>피아노 학원, 30분 전이에요</strong><small>오늘 15:00 · 일정 알림</small></p><small>14:30</small></div><p className="preview-footnote">기능 이해를 위한 예시입니다.</p></div> : <div className="family-demo"><span className="demo-large-icon"><Icon name={featureIcons[feature.id]} /></span><h3>{feature.id === 'private-group' ? '초대받은 가족만 함께해요' : '함께하는 사람에 맞춰서'}</h3><div className="family-members"><span><span className="avatar avatar-green">엄</span>엄마</span><span><span className="avatar avatar-blue">아</span>아빠</span><span><span className="avatar avatar-peach">지</span>지우</span></div><div className="family-demo-caption"><Icon name="shield" />{feature.id === 'private-group' ? '우리 가족 · 비공개 그룹' : '가족 그룹 · 구성원별 권한 설정'}</div><p className="preview-footnote">기능 이해를 위한 예시입니다.</p></div>}
        </div></section>)}
      </div>
      <DownloadSection />
    </main>
  );
}
