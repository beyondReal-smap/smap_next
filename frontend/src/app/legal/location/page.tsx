export default function LocationTermsPublicPage() {
  return (
    <div className="min-h-screen bg-white">
      <iframe
        src="/setting/terms/location?embed=1"
        className="w-full h-[100vh] border-0"
        title="위치기반서비스 이용약관"
      />
    </div>
  );
}


