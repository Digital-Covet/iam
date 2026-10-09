import { useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { AlertCircle, Loader2, LogOut } from 'lucide-react'
import {
  StatusCard,
  StatusFrame,
  statusPrimaryButton,
  statusSecondaryButton,
} from '~/components/status-page'

type Props = { appName: string | null; email: string } | { invalid: true; reason: string }

export default function LogoutConfirm(props: Props) {
  if ('invalid' in props) {
    return (
      <StatusFrame title="Sign-out unavailable">
        <StatusCard icon={AlertCircle} heading="This sign-out request can't be completed">
          <p>{props.reason}</p>
          <p>
            Nothing was signed out. Return to the app and start sign-out again, or{' '}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              go to sign-in
            </Link>
            .
          </p>
        </StatusCard>
      </StatusFrame>
    )
  }

  return <ConfirmSignOut appName={props.appName} email={props.email} />
}

function ConfirmSignOut({ appName, email }: { appName: string | null; email: string }) {
  const { post, processing } = useForm({})

  function confirm() {
    if (processing) return
    post('/oauth/logout')
  }

  return (
    <StatusFrame title="Confirm sign-out">
      <StatusCard icon={LogOut} heading="Sign out?">
        <p>
          {appName
            ? `${appName} asked to sign you out of IAM Digital Covet.`
            : 'An application asked to sign you out of IAM Digital Covet.'}
        </p>
        <p>
          Signed in as <span className="font-medium break-all text-foreground">{email}</span>.
          Confirming ends this session everywhere it is used.
        </p>
      </StatusCard>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
        <Link href="/dashboard" className={statusSecondaryButton}>
          Stay signed in
        </Link>
        <button
          type="button"
          disabled={processing}
          onClick={confirm}
          className={statusPrimaryButton}
        >
          {processing ? (
            <>
              <Loader2
                size={18}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
              Signing out…
            </>
          ) : (
            'Sign out'
          )}
        </button>
      </div>
    </StatusFrame>
  )
}
