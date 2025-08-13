export default function ThirdPartyConsentPublicPage() {
  return (
    <div className="min-h-screen bg-white">
      <iframe
        src="/setting/terms/third-party?embed=1"
        className="w-full h-[100vh] border-0"
        title="개인정보 제3자 제공 동의"
      />
    </div>
  );
}


