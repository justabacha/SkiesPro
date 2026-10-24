export interface CsvColumn<T> {
  key: keyof T;
  header: string;
}

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  const escaped = text.replace(/"/g, '""');
  return /[",\r\n]/.test(text) ? `"${escaped}"` : escaped;
};

export function exportToCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename: string
): void {
  const content = [
    columns.map((column) => formatCell(column.header)).join(','),
    ...rows.map((row) =>
      columns.map((column) => formatCell(row[column.key])).join(',')
    ),
  ].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
