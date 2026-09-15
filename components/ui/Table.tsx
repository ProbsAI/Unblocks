import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
  /**
   * Stable identity for a row. Defaults to `row.id` when present.
   *
   * React reuses DOM by key, so an array index makes the wrong row keep the
   * previous one's state whenever rows are inserted, removed or reordered —
   * revoking an API key, for instance, leaves the row below it showing the
   * revoked row's open menu or pending spinner.
   */
  getRowKey?: (row: T, index: number) => string | number
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage = 'No data',
  getRowKey = (row, index) =>
    typeof row.id === 'string' || typeof row.id === 'number' ? row.id : index,
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {columns.map((col) => (
              <th key={col.key} className="pb-3 pr-4 font-medium">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={getRowKey(row, i)}
              className="border-b border-border last:border-0"
            >
              {columns.map((col) => (
                <td key={col.key} className="py-3 pr-4 text-foreground">
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
