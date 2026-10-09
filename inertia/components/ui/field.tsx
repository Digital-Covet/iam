import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { NumberField } from '@base-ui/react/number-field'
import { Minus, Plus } from 'lucide-react'
import { cn } from '~/lib/utils'
import { fieldClass, focusRing } from '~/components/directory/shared'

export function FieldError({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null
  return (
    <p id={id} className="text-sm text-error">
      {children}
    </p>
  )
}

type TextFieldProps = {
  label: string
  value: string
  onValueChange: (v: string) => void
  error?: string
  help?: string
  helpId?: string
  className?: string
  inputClassName?: string
} & Omit<React.ComponentProps<typeof Input>, 'value' | 'onValueChange' | 'className'>

/** Labelled Base UI text field with consistent error/help slots. */
export function TextField({
  label,
  value,
  onValueChange,
  error,
  help,
  helpId,
  className,
  inputClassName,
  ...inputProps
}: TextFieldProps) {
  const describedBy = error ? `${helpId ?? label}-error` : helpId
  return (
    <Field.Root className={cn('space-y-1.5', className)}>
      <Field.Label className="text-sm font-medium">{label}</Field.Label>
      <Input
        value={value}
        onValueChange={onValueChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(fieldClass, inputClassName)}
        {...inputProps}
      />
      {help && !error && (
        <p id={helpId} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
      <FieldError id={error ? `${helpId ?? label}-error` : `${label}-error`}>{error}</FieldError>
    </Field.Root>
  )
}

type TextAreaProps = {
  label: string
  value: string
  onValueChange: (v: string) => void
  error?: string
  help?: string
  helpId?: string
  rows?: number
  className?: string
  placeholder?: string
  maxLength?: number
  spellCheck?: boolean
  autoCapitalize?: string
}

/** Labelled multi-line field. Uses Field.Control render=<textarea> so validation stays in Base UI. */
export function TextAreaField({
  label,
  value,
  onValueChange,
  error,
  help,
  helpId,
  rows = 3,
  className,
  ...rest
}: TextAreaProps) {
  return (
    <Field.Root className={cn('space-y-1.5', className)}>
      <Field.Label className="text-sm font-medium">{label}</Field.Label>
      <Field.Control
        render={<textarea rows={rows} />}
        value={value}
        onValueChange={onValueChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${helpId ?? label}-error` : helpId}
        className={cn(fieldClass, 'h-auto py-2')}
        {...rest}
      />
      {help && !error && (
        <p id={helpId} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
      <FieldError id={`${helpId ?? label}-error`}>{error}</FieldError>
    </Field.Root>
  )
}

type NumberProps = {
  label: string
  value: number | null
  onValueChange: (v: number | null) => void
  error?: string
  help?: string
  helpId?: string
  min?: number
  max?: number
  disabled?: boolean
  className?: string
}

/** Labelled Base UI NumberField with stepper buttons. Values stay numeric (no string parsing). */
export function NumberFieldInput({
  label,
  value,
  onValueChange,
  error,
  help,
  helpId,
  min,
  max,
  disabled,
  className,
}: NumberProps) {
  return (
    <Field.Root className={cn('space-y-1.5', className)}>
      <Field.Label className="text-sm font-medium">{label}</Field.Label>
      <NumberField.Root
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        disabled={disabled}
      >
        <NumberField.Group
          className={cn(fieldClass, 'flex items-center justify-between gap-1 p-1 pl-3')}
        >
          <NumberField.Input
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${helpId ?? label}-error` : helpId}
            className="w-full bg-transparent tabular-nums outline-none"
          />
          <span className="flex shrink-0 gap-1">
            <NumberField.Decrement
              aria-label={`Decrease ${label.toLowerCase()}`}
              className={cn(
                'grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground',
                focusRing
              )}
            >
              <Minus size={16} aria-hidden="true" />
            </NumberField.Decrement>
            <NumberField.Increment
              aria-label={`Increase ${label.toLowerCase()}`}
              className={cn(
                'grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground',
                focusRing
              )}
            >
              <Plus size={16} aria-hidden="true" />
            </NumberField.Increment>
          </span>
        </NumberField.Group>
      </NumberField.Root>
      <p id={helpId} className={cn('text-sm', error ? 'text-error' : 'text-muted-foreground')}>
        {error ?? help}
      </p>
    </Field.Root>
  )
}
