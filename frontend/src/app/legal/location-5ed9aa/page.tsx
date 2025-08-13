export default function LocationTermsPublicPage() {
  return (
    <div className="fixed inset-0 bg-white">
      <iframe
        src="/setting/terms/location?embed=1"
        className="w-full h-full border-0"
        title="위치기반서비스 이용약관"
      />
    </div>
  );
}


