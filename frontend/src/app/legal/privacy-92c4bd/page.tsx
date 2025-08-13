export default function PrivacyPublicPage() {
  return (
    <div className="fixed inset-0 bg-white">
      <iframe
        src="/setting/terms/privacy?embed=1"
        className="w-full h-full border-0"
        title="개인정보 처리방침"
      />
    </div>
  );
}


