-- Copy the current recommended bag count and sticks per bag from the
-- embedded Paperform on https://www.applicationcms.com/david3b.
-- Historical inventory line snapshots are intentionally left unchanged.
UPDATE products
SET recommended_bags = CASE source_number
      WHEN 1 THEN 2
      WHEN 2 THEN 4
      WHEN 3 THEN 2
      WHEN 4 THEN 2
      WHEN 5 THEN 1
      WHEN 6 THEN 2
      WHEN 7 THEN 1
      WHEN 8 THEN 2
      WHEN 9 THEN 2
      WHEN 10 THEN 2
      WHEN 12 THEN 2
      WHEN 13 THEN 1
      WHEN 14 THEN 1
      WHEN 15 THEN 1
      WHEN 16 THEN 1
      WHEN 17 THEN 2
      WHEN 18 THEN 1
      WHEN 19 THEN 3
      WHEN 20 THEN 2
      WHEN 21 THEN 3
      WHEN 22 THEN 1
    END,
    items_per_bag = CASE source_number
      WHEN 1 THEN 32
      WHEN 2 THEN 28
      WHEN 3 THEN 28
      WHEN 4 THEN 21
      WHEN 5 THEN 15
      WHEN 6 THEN 22
      WHEN 7 THEN 19
      WHEN 8 THEN 17
      WHEN 9 THEN 22
      WHEN 10 THEN 20
      WHEN 12 THEN 15
      WHEN 13 THEN 30
      WHEN 14 THEN 12
      WHEN 15 THEN 36
      WHEN 16 THEN 28
      WHEN 17 THEN 19
      WHEN 18 THEN 18
      WHEN 19 THEN 18
      WHEN 20 THEN 29
      WHEN 21 THEN 14
      WHEN 22 THEN 28
    END,
    version = version + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE source_number IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22)
  AND stock_unit = 'ไม้'
  AND purchase_unit = 'ถุง';

INSERT INTO audit_events (id, actor_email, action, entity_type, entity_id, details_json)
SELECT lower(hex(randomblob(16))),
       'system:reference-sync',
       'SYNC_PACKAGING_RECOMMENDATIONS',
       'product',
       id,
       json_object(
         'source', 'https://www.applicationcms.com/david3b',
         'source_number', source_number,
         'recommended_bags', recommended_bags,
         'items_per_bag', items_per_bag
       )
  FROM products
 WHERE source_number IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22)
   AND stock_unit = 'ไม้'
   AND purchase_unit = 'ถุง';
