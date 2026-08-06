// Engraving / branding data detection shared by Job Sheet renderers (AllOrders,
// OrderCard, printReport). The skipEngraving flag is unreliable — it can be true
// even when articleNames/nameSpelling/engravingType are filled (e.g. READY_LOGO
// orders) — so these helpers decide purely from actual content.

export const getFilledArticleNames = (c) => {
  if (!c || !Array.isArray(c.articleNames)) return [];
  return c.articleNames.filter(n => n && String(n).trim());
};

export const hasEngravingData = (c) => {
  if (!c) return false;
  const filledArticles = getFilledArticleNames(c);
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
    filledArticles.length > 0
  );
};
