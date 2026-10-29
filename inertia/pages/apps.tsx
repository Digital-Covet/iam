import { Head } from '@inertiajs/react'
import { AppWindow, ArrowUpRight } from 'lucide-react'
import { EmptyState } from '~/components/empty-state'
import { PageHeader } from '~/components/page-header'
import { buttonVariants } from '~/components/ui/button'
import { withAppShell } from '~/layouts/app-shell'
import { cn } from '~/lib/utils'

type AppRecord = {
  id: string
  slug: string
  name: string
  description: string | null
  homeUrl: string | null
}

type Props = {
  apps: AppRecord[]
}

/**
 * Everyone's Apps page — `/apps`. Only apps this person has access to, each
 * linking out to where the app lives. Managing apps is a developer surface.
 */
export default function Apps({ apps }: Props) {
  return (
    <>
      <Head title="Apps" />
      <PageHeader
        title="Apps"
        description="The internal apps you can use with your IAM Digital Covet account."
      />

      {apps.length === 0 ? (
        <section className="rounded-xl border border-border bg-surface shadow-card">
          <EmptyState
            icon={AppWindow}
            title="No apps yet"
            description="Your account doesn’t have access to an app right now. Access is granted by an admin from the directory."
          />
        </section>
      ) : (
        <ul aria-label="Your apps" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <li
              key={app.id}
              className="relative flex flex-col rounded-[8px] border border-border bg-surface shadow-card"
            >
              <article aria-labelledby={`app-${app.id}-name`} className="flex flex-1 flex-col p-5">
                <header className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="stamp grid size-10 shrink-0 place-items-center rounded-md text-primary"
                  >
                    <AppWindow size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 id={`app-${app.id}-name`} className="truncate text-base font-semibold">
                      {app.name}
                    </h2>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {app.description || app.slug}
                    </p>
                  </div>
                </header>

                <footer className="mt-auto pt-5">
                  {app.homeUrl ? (
                    <a
                      href={app.homeUrl}
                      className={cn(buttonVariants.primary, 'h-10 w-full')}
                      aria-label={`Open ${app.name}`}
                    >
                      Open {app.name}
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </a>
                  ) : (
                    <p className="rounded-lg border border-dashed border-border px-3 py-2 text-center text-sm text-muted-foreground">
                      Link coming soon
                    </p>
                  )}
                </footer>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

Apps.layout = withAppShell
