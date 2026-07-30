import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { createXlsxBlob } from './xlsxExport';

describe('createXlsxBlob', () => {
  it('creates a valid OOXML workbook with escaped values', async () => {
    const blob = createXlsxBlob([
      {
        name: 'Vendas/Julho',
        rows: [
          { Cliente: 'João & Maria', Valor: 450000, Confirmada: true },
        ],
      },
    ]);

    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(files['[Content_Types].xml']).toBeDefined();
    expect(files['xl/workbook.xml']).toBeDefined();
    expect(files['xl/worksheets/sheet1.xml']).toBeDefined();

    const workbook = strFromU8(files['xl/workbook.xml']);
    const worksheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(workbook).toContain('Vendas Julho');
    expect(worksheet).toContain('João &amp; Maria');
    expect(worksheet).toContain('<v>450000</v>');
    expect(worksheet).toContain('t="b"><v>1</v>');
  });
});
