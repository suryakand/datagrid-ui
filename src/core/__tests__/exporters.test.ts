import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard, downloadCsv, toCsv, toDelimited, toTsv } from '../exporters';
import type { ColumnDef } from '../../types';

interface Row {
  name: string;
  note: string;
  amount: number;
  secret?: string;
}

const col = (definition: ColumnDef<Row, never>): ColumnDef<Row, never> => definition;

const columns = [
  col({ field: 'name', header: 'Name' }),
  col({ field: 'note', header: 'Note' }),
  col({ field: 'amount', header: 'Amount' }),
];

describe('toCsv', () => {
  it('writes a header line followed by one line per row, joined with CRLF', () => {
    const csv = toCsv(
      [
        { name: 'Ada', note: 'first', amount: 1 },
        { name: 'Bob', note: 'second', amount: 2 },
      ],
      columns
    );
    expect(csv).toBe('Name,Note,Amount\r\nAda,first,1\r\nBob,second,2');
  });

  it('writes only the header line for an empty row set', () => {
    expect(toCsv([], columns)).toBe('Name,Note,Amount');
  });

  it('quotes a value containing the separator', () => {
    const csv = toCsv([{ name: 'Doe, Jane', note: '', amount: 1 }], columns);
    expect(csv).toBe('Name,Note,Amount\r\n"Doe, Jane",,1');
  });

  it('doubles embedded quotes, per RFC 4180', () => {
    const csv = toCsv([{ name: 'He said "hi"', note: '', amount: 1 }], columns);
    expect(csv).toBe('Name,Note,Amount\r\n"He said ""hi""",,1');
  });

  it('quotes values containing LF or CR', () => {
    const csv = toCsv([{ name: 'line1\nline2', note: 'a\rb', amount: 1 }], columns);
    expect(csv).toBe('Name,Note,Amount\r\n"line1\nline2","a\rb",1');
  });

  it('leaves an empty value unquoted', () => {
    expect(toCsv([{ name: '', note: '', amount: 0 }], columns)).toBe(
      'Name,Note,Amount\r\n,,0'
    );
  });

  it('honours a custom separator, including when quoting', () => {
    const csv = toCsv([{ name: 'a;b', note: 'plain, text', amount: 3 }], columns, ';');
    // The comma is no longer special; the semicolon now is.
    expect(csv).toBe('Name;Note;Amount\r\n"a;b";plain, text;3');
  });

  it('skips columns marked suppressExport', () => {
    const csv = toCsv(
      [{ name: 'Ada', note: 'n', amount: 1, secret: 'hidden' }],
      [...columns, col({ field: 'secret', header: 'Secret', suppressExport: true })]
    );
    expect(csv).toBe('Name,Note,Amount\r\nAda,n,1');
    expect(csv).not.toContain('hidden');
  });

  it('uses exportValue over a cellRenderer-driven column', () => {
    const csv = toCsv(
      [{ name: 'Ada', note: 'n', amount: 1 }],
      [
        col({
          colId: 'badge',
          header: 'Badge',
          cellRenderer: () => null,
          exportValue: (row) => `<${row.name}>`,
        }),
      ]
    );
    expect(csv).toBe('Badge\r\n<Ada>');
  });

  it('uses headerName for the header line when header is a node', () => {
    const csv = toCsv(
      [{ name: 'Ada', note: 'n', amount: 1 }],
      [col({ field: 'name', header: null, headerName: 'Full name' })]
    );
    expect(csv.split('\r\n')[0]).toBe('Full name');
  });

  it('quotes a header that contains the separator', () => {
    const csv = toCsv([], [col({ field: 'name', header: 'Last, First' })]);
    expect(csv).toBe('"Last, First"');
  });

  it('emits the columns in the order it is given, not the definition order', () => {
    const csv = toCsv(
      [{ name: 'Ada', note: 'n', amount: 1 }],
      [columns[2], columns[0], columns[1]]
    );
    expect(csv).toBe('Amount,Name,Note\r\n1,Ada,n');
  });

  it('formats nullish and boolean values the way the cells do', () => {
    const csv = toCsv(
      [{ name: 'Ada', note: 'n', amount: 1 }],
      [
        col({ colId: 'nothing', header: 'Nothing', valueGetter: () => null }),
        col({ colId: 'flag', header: 'Flag', valueGetter: () => true }),
      ]
    );
    expect(csv).toBe('Nothing,Flag\r\n,Yes');
  });
});

describe('toTsv', () => {
  it('separates with tabs', () => {
    expect(toTsv([{ name: 'Ada', note: 'n', amount: 1 }], columns)).toBe(
      'Name\tNote\tAmount\r\nAda\tn\t1'
    );
  });

  it('quotes a value that itself contains a tab', () => {
    expect(toTsv([{ name: 'a\tb', note: '', amount: 1 }], columns)).toBe(
      'Name\tNote\tAmount\r\n"a\tb"\t\t1'
    );
  });

  it('does not quote a comma, since the comma is not the separator', () => {
    expect(toTsv([{ name: 'Doe, Jane', note: '', amount: 1 }], columns)).toContain(
      'Doe, Jane'
    );
  });
});

describe('toDelimited', () => {
  it('is what toCsv and toTsv are both built on', () => {
    const rows = [{ name: 'Ada', note: 'n', amount: 1 }];
    expect(toDelimited(rows, columns, ',')).toBe(toCsv(rows, columns));
    expect(toDelimited(rows, columns, '\t')).toBe(toTsv(rows, columns));
  });
});

/**
 * jsdom's Blob has no `text()`, and `readAsText` strips the BOM on decode --
 * which is exactly the byte under test -- so read the raw bytes instead.
 */
function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe('downloadCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function captureAnchor() {
    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => undefined);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return anchor;
      return Reflect.apply(
        HTMLDocument.prototype.createElement,
        document,
        [tag]
      ) as HTMLElement;
    });
    return { anchor, click };
  }

  it('appends the .csv extension when it is missing', () => {
    const { anchor, click } = captureAnchor();
    downloadCsv('a,b', 'report');
    expect(anchor.download).toBe('report.csv');
    expect(click).toHaveBeenCalledOnce();
  });

  it('leaves an existing .csv extension alone', () => {
    const { anchor } = captureAnchor();
    downloadCsv('a,b', 'report.csv');
    expect(anchor.download).toBe('report.csv');
  });

  it('prepends a UTF-8 BOM, which is what makes Excel read it as UTF-8', async () => {
    captureAnchor();
    const blobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return 'blob:test';
    });
    downloadCsv('Name\r\nAda', 'x');

    const bytes = await readBlobBytes(blobs[0]);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('Name\r\nAda');
    expect(blobs[0].type).toBe('text/csv;charset=utf-8;');
  });

  it('revokes the object URL and removes the anchor again', () => {
    const { anchor } = captureAnchor();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    downloadCsv('a', 'x');
    expect(revoke).toHaveBeenCalledWith('blob:test');
    expect(document.body.contains(anchor)).toBe(false);
  });
});

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses the async clipboard API when it is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await copyToClipboard('a\tb');
    expect(writeText).toHaveBeenCalledWith('a\tb');
  });

  it('falls back to a hidden textarea when the clipboard API is absent', async () => {
    vi.stubGlobal('navigator', {});
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
      writable: true,
    });

    let seen: HTMLTextAreaElement | null = null;
    const append = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node: Node) => {
        if (node instanceof HTMLTextAreaElement) seen = node;
        return node;
      });
    const remove = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node: Node) => node);

    await copyToClipboard('fallback text');

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(seen).not.toBeNull();
    expect((seen as unknown as HTMLTextAreaElement).value).toBe('fallback text');
    expect(append).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });
});
