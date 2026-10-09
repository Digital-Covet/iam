import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

/** Absolute link to the set/reset-password page for a token. */
export function setPasswordLink(token: string) {
  return `${env.get('APP_URL').replace(/\/$/, '')}/reset-password/${token}`
}

type Message = { to: string; subject: string; html: string; text: string }

export type TwoFactorEvent =
  | 'enabled'
  | 'disabled'
  | 'backup_codes_regenerated'
  | 'reset_by_admin'
  | 'locked'
  | 'backup_code_used'

const twoFactorCopy: Record<
  TwoFactorEvent,
  (d: { backupCodesRemaining?: number; lockedUntil?: string }) => {
    subject: string
    body: string
  }
> = {
  enabled: () => ({
    subject: 'Two-factor authentication is on',
    body: 'Two-factor authentication was turned on for your Digital Covet account.',
  }),
  disabled: () => ({
    subject: 'Two-factor authentication is off',
    body: 'Two-factor authentication was turned off for your Digital Covet account. Your password alone now signs you in.',
  }),
  backup_codes_regenerated: () => ({
    subject: 'New backup codes were generated',
    body: 'New two-factor backup codes were generated for your Digital Covet account. Your old codes no longer work.',
  }),
  reset_by_admin: () => ({
    subject: 'An administrator reset your two-factor',
    body: 'An administrator turned off two-factor authentication on your Digital Covet account and signed you out everywhere. Set it up again after you sign in.',
  }),
  locked: (d) => ({
    subject: 'Two-factor sign-in is locked',
    body: `Several wrong two-factor codes were entered for your Digital Covet account, so two-factor sign-in is locked${d.lockedUntil ? ` until ${d.lockedUntil} UTC` : ' for a while'}. Someone may know your password.`,
  }),
  backup_code_used: (d) => ({
    subject: 'A backup code was used to sign in',
    body: `A backup code was used to sign in to your Digital Covet account.${d.backupCodesRemaining !== undefined ? ` You have ${d.backupCodesRemaining} left.` : ''}`,
  }),
}

/**
 * Sends transactional email through the ZeptoMail HTTP API. With no token
 * configured (local dev) the message is logged instead so flows stay testable.
 */
export default class MailService {
  static async send({ to, subject, html, text }: Message): Promise<void> {
    const url = env.get('ZEPTOMAIL_URL')
    const token = env.get('ZEPTOMAIL_TOKEN')
    const from = env.get('ZEPTOMAIL_SENDER_ADDRESS')

    if (!url || !token || !from) {
      logger.info({ to, subject }, `[mail:not-configured] ${text}`)
      return
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'authorization': `Zoho-enczapikey ${token}`,
      },
      body: JSON.stringify({
        from: { address: from, name: 'Digital Covet IAM' },
        to: [{ email_address: { address: to } }],
        subject,
        htmlbody: html,
        textbody: text,
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`ZeptoMail responded ${res.status}: ${detail.slice(0, 300)}`)
    }
  }

  static async sendInvite(to: string, link: string, inviterName: string | null) {
    const who = inviterName ? `${inviterName} invited` : 'You have been invited'
    return this.send({
      to,
      subject: 'You’re invited to Digital Covet IAM',
      text: `${who} you to Digital Covet IAM. Set your password: ${link}\nThis link expires in 7 days.`,
      html: layout({
        eyebrow: 'Invitation · Expires in 7 days',
        preheader: 'Set your password to join Digital Covet IAM.',
        title: 'Welcome to Digital Covet',
        body: `${who} you to Digital Covet IAM. Set a password to get started.`,
        cta: 'Set your password',
        link,
        footer: 'This link expires in 7 days.',
      }),
    })
  }

  /** Like `sendTwoFactorNotice`, but a mail failure is logged, never thrown. */
  static async notifyTwoFactor(...args: Parameters<typeof MailService.sendTwoFactorNotice>) {
    try {
      await this.sendTwoFactorNotice(...args)
    } catch (error) {
      logger.error({ err: error, event: args[1] }, 'Two-factor notice email failed')
    }
  }

  /**
   * Tell the account owner about a two-factor change, so a change they did not
   * make is noticed. Never includes codes or secrets.
   */
  static async sendTwoFactorNotice(
    to: string,
    event: TwoFactorEvent,
    detail?: { backupCodesRemaining?: number; lockedUntil?: string }
  ) {
    const copy = twoFactorCopy[event](detail ?? {})
    const link = `${env.get('APP_URL').replace(/\/$/, '')}/account-settings`
    const footer =
      'If this wasn’t you, change your password and contact an administrator right away.'
    const meta: Record<TwoFactorEvent, { eyebrow: string; tone: 'default' | 'alert' }> = {
      enabled: { eyebrow: 'Security notice · Two-factor on', tone: 'default' },
      disabled: { eyebrow: 'Security notice · Two-factor off', tone: 'default' },
      backup_codes_regenerated: { eyebrow: 'Security notice · New backup codes', tone: 'default' },
      reset_by_admin: { eyebrow: 'Action needed · Two-factor reset', tone: 'alert' },
      locked: { eyebrow: 'Action needed · Sign-in locked', tone: 'alert' },
      backup_code_used: { eyebrow: 'Action needed · Backup code used', tone: 'alert' },
    }
    const { eyebrow, tone } = meta[event]
    return this.send({
      to,
      subject: copy.subject,
      text: `${copy.body}\nReview your security settings: ${link}\n${footer}`,
      html: layout({
        eyebrow,
        preheader: copy.subject,
        title: copy.subject,
        body: copy.body,
        cta: 'Review security settings',
        link,
        footer,
        tone,
      }),
    })
  }

  static async sendReset(to: string, link: string) {
    return this.send({
      to,
      subject: 'Reset your Digital Covet password',
      text: `Reset your password: ${link}\nThis link expires in 1 hour. If you did not ask for this, ignore this email.`,
      html: layout({
        eyebrow: 'Password reset · Expires in 1 hour',
        preheader: 'Choose a new password for your Digital Covet account.',
        title: 'Reset your password',
        body: 'We got a request to reset your password.',
        cta: 'Choose a new password',
        link,
        footer:
          'This link expires in 1 hour. If you did not ask for this, you can ignore this email.',
      }),
    })
  }
}

type LayoutOptions = {
  eyebrow: string
  preheader: string
  title: string
  body: string
  cta: string
  link: string
  footer: string
  tone?: 'default' | 'alert'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Ledger Posting email shell: table-based and fully inline-styled so it holds
 * up in Outlook/Gmail/Apple Mail. Warm-paper canvas, white card with a hairline
 * border, mono eyebrow, serif title, bulletproof cobalt CTA, ledger rule, and
 * a plain-URL fallback line. No external fonts, no CSS variables, no motion.
 */
function layout({
  eyebrow,
  preheader,
  title,
  body,
  cta,
  link,
  footer,
  tone = 'default',
}: LayoutOptions) {
  const safe = {
    eyebrow: escapeHtml(eyebrow),
    preheader: escapeHtml(preheader),
    title: escapeHtml(title),
    body: escapeHtml(body),
    cta: escapeHtml(cta),
    link: escapeHtml(link),
    footer: escapeHtml(footer),
  }
  const alert = tone === 'alert'
  const eyebrowColor = alert ? '#b91c1c' : '#1d4ed8'
  const chip = alert
    ? `<div style="margin:0 0 12px"><span style="display:inline-block;border:1px solid #b91c1c;border-radius:4px;padding:2px 8px;font-family:Consolas,Menlo,monospace;font-size:12px;font-weight:700;color:#b91c1c">Action needed</span></div>`
    : ''
  return (
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${safe.preheader}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background-color:#f2f1ec">` +
    `<tr><td align="center" style="padding:32px 16px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #d9d6cc;border-radius:8px">` +
    `<tr><td style="padding:24px 28px 0">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>` +
    `<td align="left" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#1b1f2a"><span style="display:inline-block;border:1px solid #7f7b6d;border-radius:4px;padding:2px 6px;font-size:12px;letter-spacing:0.04em">DC</span>&nbsp;&nbsp;Digital Covet IAM</td>` +
    `<td align="right" style="font-family:Consolas,Menlo,monospace;font-size:11px;letter-spacing:0.08em;color:#5a5f6b">IAM</td>` +
    `</tr></table>` +
    `</td></tr>` +
    `<tr><td style="padding:20px 28px 0"><p style="margin:0;font-family:Consolas,Menlo,monospace;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${eyebrowColor}">${safe.eyebrow}</p></td></tr>` +
    `<tr><td style="padding:12px 28px 0">${chip}<h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;font-weight:700;color:#1b1f2a">${safe.title}</h1></td></tr>` +
    `<tr><td style="padding:12px 28px 0"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1b1f2a">${safe.body}</p></td></tr>` +
    `<tr><td align="center" style="padding:24px 28px 0">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td align="center" bgcolor="#1d4ed8" style="border-radius:6px;background-color:#1d4ed8"><a href="${safe.link}" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${safe.cta}</a></td></tr></table>` +
    `</td></tr>` +
    `<tr><td style="padding:16px 28px 0"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#5a5f6b">Button not working? Paste this link into your browser:<br><a href="${safe.link}" style="color:#1d4ed8;word-break:break-all">${safe.link}</a></p></td></tr>` +
    `<tr><td style="padding:24px 28px 0"><div style="width:56px;height:2px;background-color:#1d4ed8;font-size:0;line-height:0">&nbsp;</div><div style="border-top:1px solid #d9d6cc;font-size:0;line-height:0">&nbsp;</div></td></tr>` +
    `<tr><td style="padding:12px 28px 28px"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#5a5f6b">${safe.footer}</p></td></tr>` +
    `</table>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto"><tr><td align="center" style="padding:16px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#5a5f6b">You received this because you have a Digital Covet IAM account.<br>This is a transactional message; please do not reply.</td></tr></table>` +
    `</td></tr></table>`
  )
}
