import { useEffect, useRef } from 'react'
import { flexRender, type Row, type Table } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '~/lib/utils'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    /** Classes for both the <th> and every <td> (responsive hiding, widths). */
    className?: string
    /** Extra classes for body cells only. */
    cellClassName?: string
    /** Extra classes for the header cell only. */
    headClassName?: string
  }
}

type Props<T> = {
  table: Table<T>
  caption: React.ReactNode
  /** Total rows on the server, announced to assistive tech. */
  ariaRowCount?: number
  onRowClick?: (row: Row<T>) => void
  /** Optional extra classes per body row, e.g. to flag exceptions. */
  rowClassName?: (row: Row<T>) => string | undefined
  /** Fixed row height in px; enables windowing when `virtualize` is set. */
  rowHeight?: number
  virtualize?: boolean
  /** Called once the last rendered row is within `endThreshold` rows of the end. */
  onNearEnd?: () => void
  endThreshold?: number
  /** Scroll container classes; must constrain height when virtualizing. */
  className?: string
}

const headBase = 'ledger-head px-4 py-3 text-left text-xs font-semibold'

/**
 * Semantic <table> driven by TanStack Table, optionally windowed with TanStack
 * Virtual. Windowing keeps real table markup by padding with spacer rows
 * instead of absolutely positioning cells.
 */
export function DataTable<T>({
  table,
  caption,
  ariaRowCount,
  onRowClick,
  rowClassName,
  rowHeight = 52,
  virtualize = false,
  onNearEnd,
  endThreshold = 5,
  className,
}: Props<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows
  const colCount = table.getVisibleLeafColumns().length

  const virtualizer = useVirtualizer({
    count: virtualize ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  })

  const items = virtualize ? virtualizer.getVirtualItems() : []
  const lastIndex = items.length > 0 ? items[items.length - 1].index : -1

  const nearEndRef = useRef(onNearEnd)
  nearEndRef.current = onNearEnd
  useEffect(() => {
    if (virtualize && lastIndex >= 0 && lastIndex >= rows.length - 1 - endThreshold) {
      nearEndRef.current?.()
    }
  }, [virtualize, lastIndex, rows.length, endThreshold])

  const padTop = items.length > 0 ? items[0].start : 0
  const padBottom = items.length > 0 ? virtualizer.getTotalSize() - items[items.length - 1].end : 0
  const visibleRows = virtualize
    ? items.map((item) => ({ row: rows[item.index], index: item.index }))
    : rows.map((row, index) => ({ row, index }))

  return (
    <div ref={scrollRef} className={cn('max-h-[70vh] overflow-auto', className)}>
      <table
        className="w-full min-w-120 border-collapse text-sm"
        aria-rowcount={ariaRowCount ?? rows.length + 1}
      >
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-[1] bg-[color-mix(in_oklab,var(--background)_55%,var(--surface))] text-muted-foreground">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} aria-rowindex={1}>
              {group.headers.map((header) => {
                const meta = header.column.columnDef.meta
                const sorted = header.column.getIsSorted()
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      header.column.getCanSort()
                        ? sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : 'none'
                        : undefined
                    }
                    className={cn(headBase, meta?.className, meta?.headClassName)}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-border">
          {padTop > 0 && (
            <tr aria-hidden="true" style={{ height: padTop }}>
              <td colSpan={colCount} />
            </tr>
          )}
          {visibleRows.map(({ row, index }) => (
            <tr
              key={row.id}
              aria-rowindex={index + 2}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{ height: rowHeight }}
              className={cn(
                onRowClick && 'cursor-pointer',
                'transition-colors duration-140 hover:bg-hover motion-reduce:transition-none',
                rowClassName?.(row)
              )}
            >
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta
                return (
                  <td
                    key={cell.id}
                    className={cn('px-4 py-2', meta?.className, meta?.cellClassName)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                )
              })}
            </tr>
          ))}
          {padBottom > 0 && (
            <tr aria-hidden="true" style={{ height: padBottom }}>
              <td colSpan={colCount} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
