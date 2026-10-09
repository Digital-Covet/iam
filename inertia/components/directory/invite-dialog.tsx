import { useEffect, type FormEvent } from 'react'
import { CheckBox } from '~/components/directory/shared'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { useForm } from '@inertiajs/react'
import { Dialog } from '@base-ui/react/dialog'
import { Loader2, X } from 'lucide-react'
import { usePermissions } from '~/hooks/use-permissions'
import {
  btnPrimary,
  btnSecondary,
  dialogBackdrop,
  SelectField,
  fieldClass,
  focusRing,
  type AppOption,
  type RoleOption,
} from './shared'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: RoleOption[]
  apps: AppOption[]
}

export function InviteDialog({ open, onOpenChange, roles, apps }: Props) {
  const { isSuperadmin, can } = usePermissions()
  // Only superadmins may hand out the superadmin role; the server enforces it too.
  const assignable = roles.filter((r) => isSuperadmin || r.name.toLowerCase() !== 'superadmin')
  const defaultRole =
    assignable.find((r) => r.name.toLowerCase() === 'employee')?.name ?? assignable[0]?.name ?? ''
  const canGrant = can('entitlements.grant')

  const { data, setData, post, processing, errors, reset, clearErrors, transform } = useForm({
    email: '',
    role: defaultRole,
    apps: [] as string[],
  })
  transform((values) => ({ ...values, email: values.email.trim() }))

  useEffect(() => {
    if (!open) {
      reset()
      clearErrors()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function toggleApp(slug: string, on: boolean) {
    setData('apps', on ? [...data.apps, slug] : data.apps.filter((s) => s !== slug))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (processing) return
    post('/directory/invite', {
      preserveScroll: true,
      // The server redirects back even when it refuses (e.g. duplicate email);
      // keep the dialog open so the person can correct it.
      onSuccess: (page) => {
        if (!page.flash?.error) onOpenChange(false)
      },
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={dialogBackdrop} />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface-raised p-6 shadow-float transition-[opacity,translate] duration-180 data-ending-style:opacity-0 data-starting-style:-translate-y-[calc(50%+8px)] data-starting-style:opacity-0 motion-reduce:transition-none">
          <div className="ledger-rule flex items-start justify-between gap-3 pb-4">
            <div>
              <Dialog.Title className="text-xl leading-tight font-semibold">
                Invite user
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                They’ll get an email with a link to set their password.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className={`grid size-10 shrink-0 place-items-center rounded-md hover:bg-hover ${focusRing}`}
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form onSubmit={submit} noValidate className="mt-5 space-y-5">
            <Field.Root className="space-y-1.5">
              <Field.Label className="text-sm font-medium">Email</Field.Label>
              <Input
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                placeholder="name@digitalcovet.com"
                value={data.email}
                onValueChange={(v) => setData('email', v)}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'invite-email-error' : undefined}
                className={fieldClass}
              />
              {errors.email && (
                <p id="invite-email-error" className="text-sm text-error">
                  {errors.email}
                </p>
              )}
            </Field.Root>

            <div>
              <SelectField
                label="Role"
                value={data.role}
                onValueChange={(role) => setData('role', role)}
                invalid={!!errors.role}
                options={assignable.map((r) => ({ value: r.name, label: r.name }))}
              />
              {errors.role && <p className="mt-1.5 text-sm text-error">{errors.role}</p>}
            </div>

            {canGrant && apps.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">App access (optional)</legend>
                {apps.map((app) => (
                  <label
                    key={app.slug}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border-strong px-3 text-sm"
                  >
                    <CheckBox
                      checked={data.apps.includes(app.slug)}
                      onCheckedChange={(next) => toggleApp(app.slug, next)}
                    />
                    {app.name}
                  </label>
                ))}
              </fieldset>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Dialog.Close className={btnSecondary}>Cancel</Dialog.Close>
              <button
                type="submit"
                disabled={processing || !data.email.trim()}
                className={btnPrimary}
              >
                {processing ? (
                  <>
                    <Loader2
                      size={18}
                      aria-hidden="true"
                      className="animate-spin motion-reduce:animate-none"
                    />
                    Sending…
                  </>
                ) : (
                  'Send invitation'
                )}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
