import Link from 'next/link';
import { SITE } from '@/content/site';
import { FAQS } from '@/content/faq';
import { DownloadSection, Icon } from '../components/Marketing';
import ContactForm from './ContactForm';

export default function ContactSection() {
  return (
    <main id="main-content" className="contact-page" tabIndex={-1}>
      <section className="page-heading site-container"><span className="eyebrow">가까이에서 듣겠습니다</span><h1>무엇을 도와드릴까요?</h1><p>사용 중 궁금한 점이나 더 나은 서비스를 위한 제안,<br />SMAP에 편하게 남겨주세요.</p></section>
      <section className="site-container contact-grid"><div className="contact-form-card"><span className="eyebrow">문의 작성</span><h2>이야기를 들려주세요.</h2><p className="form-description">작성 후 버튼을 누르면 이메일 앱이 열립니다.<br />메일 내용을 확인하고 전송해 주세요.</p><ContactForm /></div><aside className="contact-sidebar"><div className="contact-email-card"><span className="demo-large-icon"><Icon name="mail" /></span><h2>이메일로 문의하기</h2><p>이메일 앱이 열리지 않으면<br />아래 주소로 직접 보내주세요.</p><a href={`mailto:${SITE.email}`} className="text-link">{SITE.email} <Icon name="arrow" /></a></div><div className="contact-faq-card"><h2>먼저 확인해 보세요.</h2>{FAQS.filter((faq) => ['supported-devices', 'pricing'].includes(faq.id)).map((faq) => <div key={faq.id}><h3>{faq.question}</h3><p>{faq.answer}</p></div>)}<Link href="/faq" className="text-link">자주 묻는 질문 전체 보기 <Icon name="arrow" /></Link></div></aside></section>
      <DownloadSection id="download-section" />
    </main>
  );
}
