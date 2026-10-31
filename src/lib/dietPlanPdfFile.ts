import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ---------------------------------------------------------------------------
// Diet chart HTML (from dietPlanHtml.ts) → A4 PDF file. Shared byte-for-byte
// between PMS and the client PWA, so the PDF made on Publish and the client's
// "Download PDF" are the same file. The HTML is rendered in an isolated iframe
// and cut into pages at row/heading boundaries so table rows aren't split.
// ---------------------------------------------------------------------------

const PAGE_WIDTH_PX = 794; // A4 at 96dpi
const PAGE_HEIGHT_PX = Math.round(PAGE_WIDTH_PX * (297 / 210));

export async function dietPlanHtmlToPdfBlob(html: string): Promise<Blob | null> {
  if (!html) return null;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_WIDTH_PX}px;height:${PAGE_HEIGHT_PX}px;border:0;`;
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    await Promise.all(Array.from(doc.images).map((img) =>
      img.complete ? null : new Promise((resolve) => { img.onload = img.onerror = resolve; })));

    const body = doc.body;
    const totalHeight = body.scrollHeight;
    const topOf = (el: Element) => el.getBoundingClientRect().top;

    // Where a page may end: the top of any row/heading/block. Forced breaks: page-break-before.
    const breakpoints = Array.from(body.querySelectorAll('tr, h1, h2, h3, h4, p, li, .client-details, .intro, .day-notes, .notes-box, [style*="page-break-inside"]'))
      .map(topOf).filter((y) => y > 0).sort((a, b) => a - b);
    const forced = Array.from(body.querySelectorAll('[style*="page-break-before"]'))
      .map(topOf).filter((y) => y > 0).sort((a, b) => a - b);

    const scale = 2;
    const canvas = await html2canvas(body, {
      scale,
      useCORS: true,
      logging: false,
      width: PAGE_WIDTH_PX,
      windowWidth: PAGE_WIDTH_PX,
      height: totalHeight,
      windowHeight: totalHeight,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const mmPerPx = pageW / PAGE_WIDTH_PX;

    let start = 0;
    let firstPage = true;
    while (start < totalHeight - 1) {
      const ideal = start + PAGE_HEIGHT_PX;
      let end: number;
      const forcedBreak = forced.find((y) => y > start + 1 && y <= ideal);
      if (ideal >= totalHeight) end = totalHeight;
      else if (forcedBreak) end = forcedBreak;
      else {
        const candidates = breakpoints.filter((y) => y > start + PAGE_HEIGHT_PX * 0.5 && y <= ideal);
        end = candidates.length ? candidates[candidates.length - 1] : ideal;
      }
      if (end >= totalHeight - 1) end = totalHeight;

      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.round((end - start) * scale);
      const ctx = slice.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, Math.round(start * scale), canvas.width, slice.height, 0, 0, canvas.width, slice.height);

      if (!firstPage) pdf.addPage();
      firstPage = false;
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, (end - start) * mmPerPx);
      start = end;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(iframe);
  }
}

// File name for a downloaded chart, e.g. "Diet Chart 2 - Weight Loss.pdf".
export function dietPlanPdfFileName(planName: string | null | undefined): string {
  const base = (planName || 'Diet Plan').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Diet Plan';
  return `${base}.pdf`;
}
