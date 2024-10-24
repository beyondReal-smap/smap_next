import ResetPasswordForm from '@/components/ResetPasswordForm'

export default function ResetPasswordPage({
  params: { token }
}: {
  params: { token: string }
}) {
  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <ResetPasswordForm token={token} />
    </div>
  )
}
