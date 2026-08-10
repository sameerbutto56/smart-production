// Engraving / branding data detection shared by Job Sheet renderers (AllOrders,
// OrderCard, printReport). The skipEngraving flag is unreliable — it can be true
// even when articleNames/nameSpelling/engravingType are filled (e.g. READY_LOGO
// orders) — so these helpers decide purely from actual content.

export const getFilledArticleNames = (c) => {
  if (!c || !Array.isArray(c.articleNames)) return [];
  return c.articleNames.filter(n => n && String(n).trim());
};

// Replacement-order engraving lines ({ type, name, designNotes }) — a line
// counts as filled when either its name or its text/notes is non-empty.
export const getFilledEngravingLines = (c) => {
  if (!c || !Array.isArray(c.engravingLines)) return [];
  return c.engravingLines.filter(l =>
    l && (String(l.name || '').trim() || String(l.designNotes || l.text || l.notes || '').trim())
  );
};

export const hasEngravingData = (c) => {
  if (!c) return false;
  const filledArticles = getFilledArticleNames(c);
  const filledLines = getFilledEngravingLines(c);
  const hasLogos = Array.isArray(c.logos) && c.logos.some(l =>
    l && ((l.name && l.design) ||
      (l.name && String(l.name).trim().length > 2) ||
      (l.design && String(l.design).trim().length > 2))
  );
  return !!(
    c.engravingType ||
    (c.nameSpelling && String(c.nameSpelling).trim()) ||
    c.nameColor ||
    c.logoColor ||
    c.logoPlacement ||
    c.designNotes ||
    c.designReference ||
    hasLogos ||
    filledLines.length > 0 ||
    filledArticles.length > 0
  );
};
