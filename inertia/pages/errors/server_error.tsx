import { Link } from '@adonisjs/inertia/react'
import { TriangleAlert } from 'lucide-react'
import { StatusCard, StatusFrame, statusPrimaryButton } from '~/components/status-page'

export default function ServerError() {
  return (
    <StatusFrame title="Something went wrong">
      <StatusCard icon={TriangleAlert} heading="Something went wrong">
        <p>An unexpected error occurred on our side. Nothing was changed by this request.</p>
        <p>Try again — if it keeps happening, contact your administrator.</p>
      </StatusCard>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
        <Link href="/dashboard" className={statusPrimaryButton}>
          Go to dashboard
        </Link>
      </div>
    </StatusFrame>
  )
}
