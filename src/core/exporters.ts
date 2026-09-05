import type { ColumnDef, ResolvedColumn } from '../types';
import { exportValue, headerText } from './values';

/** RFC 4180: quote when the value contains the separator, a quote or a newline. */
function escapeCsv(value: string, separator: string): string {
  if (value === '') return '';
  const needsQuotes =
    value.includes(separator) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r');
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toDelimited<T>(
  rows: T[],
  columns: Array<ResolvedColumn<T, never> | ColumnDef<T, never>>,
  separator: string
): string {
  const exportable = columns.filter((column) => !column.suppressExport);

  const lines: string[] = [
    exportable.map((c) => escapeCsv(headerText(c), separator)).join(separator),
  ];

  for (const row of rows) {
    lines.push(
      exportable
        .map((column) => escapeCsv(exportValue(row, column), separator))
        .join(separator)
    );
  }

  return lines.join('\r\n');
}

export function toCsv<T>(
  rows: T[],
  columns: Array<ResolvedColumn<T, never> | ColumnDef<T, never>>,
  separator = ','
): string {
  return toDelimited(rows, columns, separator);
}

/** Tab-separated, which is what spreadsheets expect from the clipboard. */
export function toTsv<T>(
  rows: T[],
  columns: Array<ResolvedColumn<T, never> | ColumnDef<T, never>>
): string {
  return toDelimited(rows, columns, '\t');
}

export function downloadCsv(content: string, fileName: string): void {
  // The BOM is what makes Excel read the file as UTF-8 rather than ANSI.
  const blob = new Blob(['﻿' + content], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Older browsers and non-secure origins have no async clipboard API.
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
