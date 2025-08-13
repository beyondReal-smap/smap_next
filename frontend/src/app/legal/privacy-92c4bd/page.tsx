export default function PrivacyPublicPage() {
  return (
    <div className="min-h-screen bg-white">
      <iframe
        src="/setting/terms/privacy?embed=1"
        className="w-full h-[100vh] border-0"
        title="개인정보 처리방침"
      />
    </div>
  );
}


