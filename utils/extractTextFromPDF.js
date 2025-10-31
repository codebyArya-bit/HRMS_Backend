import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function extractTextFromPDF(fileBuffer) {
  try {
    // ✅ Convert Buffer to Uint8Array
    const uint8Array = new Uint8Array(fileBuffer);

    // Load the PDF
    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    let text = '';

    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      text += strings.join(' ') + '\n';
    }

    return text.trim();
  } catch (err) {
    console.error('❌ PDF text extraction failed:', err);
    throw err;
  }
}
