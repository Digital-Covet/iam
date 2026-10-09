import { Link } from '@adonisjs/inertia/react'
import { FileQuestion } from 'lucide-react'
import { StatusCard, StatusFrame, statusPrimaryButton } from '~/components/status-page'

export default function NotFound() {
  return (
    <StatusFrame title="Page not found">
      <StatusCard icon={FileQuestion} heading="This page doesn't exist">
        <p>The address may be mistyped, or the page was moved or removed.</p>
        <p>Use the dashboard to find your way back.</p>
      </StatusCard>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
        <Link href="/dashboard" className={statusPrimaryButton}>
          Go to dashboard
        </Link>
      </div>
    </StatusFrame>
  )
}
