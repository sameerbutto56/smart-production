SELECT 
  (SELECT COUNT(*) FROM "public"."Order" WHERE "createdById" IS NOT NULL AND "createdAt" >= '2026-07-29'::date AND "createdAt" < '2026-07-30'::date) as total_orders_today,
  (SELECT COUNT(*) FROM "public"."Order" o JOIN "public"."User" u ON o."createdById" = u."id" WHERE u.role = 'FAISAL' AND o."createdAt" >= '2026-07-29'::date AND o."createdAt" < '2026-07-30'::date) as faisal_orders_today,
  (SELECT COUNT(*) FROM "public"."Order" o JOIN "public"."User" u ON o."createdById" = u."id" WHERE u.role = 'FAISAL') as faisal_orders_all,
  (SELECT COUNT(*) FROM "public"."Order") as total_orders;
