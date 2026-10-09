import '@adonisjs/inertia/types'

import type React from 'react'
import type { Prettify } from '@adonisjs/core/types/common'

type ExtractProps<T> =
  T extends React.FC<infer Props>
    ? Prettify<Omit<Props, 'children'>>
    : T extends React.Component<infer Props>
      ? Prettify<Omit<Props, 'children'>>
      : never

declare module '@adonisjs/inertia/types' {
  export interface InertiaPages {
    'account_settings': ExtractProps<(typeof import('../../inertia/pages/account_settings.tsx'))['default']>
    'apps': ExtractProps<(typeof import('../../inertia/pages/apps.tsx'))['default']>
    'audit_logs': ExtractProps<(typeof import('../../inertia/pages/audit_logs.tsx'))['default']>
    'auth_settings': ExtractProps<(typeof import('../../inertia/pages/auth_settings.tsx'))['default']>
    'auth/forgot_password': ExtractProps<(typeof import('../../inertia/pages/auth/forgot_password.tsx'))['default']>
    'auth/login': ExtractProps<(typeof import('../../inertia/pages/auth/login.tsx'))['default']>
    'auth/logout_confirm': ExtractProps<(typeof import('../../inertia/pages/auth/logout_confirm.tsx'))['default']>
    'auth/reset_password': ExtractProps<(typeof import('../../inertia/pages/auth/reset_password.tsx'))['default']>
    'auth/setup_2fa': ExtractProps<(typeof import('../../inertia/pages/auth/setup_2fa.tsx'))['default']>
    'auth/verify_2fa': ExtractProps<(typeof import('../../inertia/pages/auth/verify_2fa.tsx'))['default']>
    'consent': ExtractProps<(typeof import('../../inertia/pages/consent.tsx'))['default']>
    'dashboard': ExtractProps<(typeof import('../../inertia/pages/dashboard.tsx'))['default']>
    'directory': ExtractProps<(typeof import('../../inertia/pages/directory.tsx'))['default']>
    'errors/not_found': ExtractProps<(typeof import('../../inertia/pages/errors/not_found.tsx'))['default']>
    'errors/server_error': ExtractProps<(typeof import('../../inertia/pages/errors/server_error.tsx'))['default']>
    'roles_access': ExtractProps<(typeof import('../../inertia/pages/roles_access.tsx'))['default']>
  }
}
