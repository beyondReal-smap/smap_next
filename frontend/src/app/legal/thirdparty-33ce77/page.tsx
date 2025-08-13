export default function ThirdPartyConsentPublicPage() {
  return (
    <div className="fixed inset-0 bg-white">
      <iframe
        src="/setting/terms/third-party?embed=1"
        className="w-full h-full border-0"
        title="개인정보 제3자 제공 동의"
      />
    </div>
  );
}


