/**
 * Gera um PDF mínimo e válido com texto, usado para documentos fictícios de demonstração
 * (TCE, PAE, relatórios...). Todos são marcados como "EXEMPLO".
 */
function pdfExemplo(linhas) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c).replace(/[^\x20-\x7e]/g, '?');
  const texto = ['DOCUMENTO FICTICIO - EXEMPLO PARA DEMONSTRACAO ACADEMICA', '', ...linhas]
    .map((l, i) => `BT /F1 ${i === 0 ? 13 : 11} Tf 60 ${770 - i * 20} Td (${esc(l)}) Tj ET`)
    .join('\n');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(texto)} >>\nstream\n${texto}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let corpo = '%PDF-1.4\n';
  const offsets = [];
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(corpo));
    corpo += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(corpo);
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  corpo += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(corpo, 'latin1');
}

module.exports = { pdfExemplo };
