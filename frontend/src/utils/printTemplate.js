const LOGO_URL = window.location.origin + '/logo.png';

export function getPrintLogoHTML() {
  return `<div class="print-logo" style="text-align:center;margin-bottom:6px;padding-bottom:6px;border-bottom:2px solid #ccc;">
    <img src="${LOGO_URL}" alt="ENAMELS" style="width:170px;height:auto;display:inline-block;">
  </div>`;
}

export function getPrintFooterHTML() {
  return `<div class="print-footer" style="text-align:center;font-size:10px;color:#888;margin-top:15px;padding-top:6px;border-top:1px solid #ccc;">
    <p style="margin:0;">Software is developed by Sameer Butt</p>
  </div>`;
}

export function getCompletePrintHTML({ title = 'ENAMELS', bodyHTML = '', extraCSS = '', isRtl = false } = {}) {
  const dir = isRtl ? ' dir="rtl" class="rtl"' : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; background: #fff; font-size: 14px; line-height: 1.4; padding: 0; direction: ${isRtl ? 'rtl' : 'ltr'}; }
  ${extraCSS}
</style></head><body${dir}>
  ${getPrintLogoHTML()}
  ${bodyHTML}
  ${getPrintFooterHTML()}
</body></html>`;
}
