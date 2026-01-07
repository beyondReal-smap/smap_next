export default function MarketingTermsPublicPage() {
  return (
    <div className="min-h-screen bg-white">
      <iframe
        src="/setting/terms/marketing?embed=1"
        className="w-full h-[100vh] border-0"
        title="마케팅 정보 수집 및 이용 동의"
      />
    </div>
  );
}


