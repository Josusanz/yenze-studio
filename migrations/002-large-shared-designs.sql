-- A PostgreSQL btree cannot index an entire image-containing JSON selection.
-- Use a fixed-size digest for deduplication; reads still compare the full selection.
ALTER TABLE shared_selections DROP CONSTRAINT IF EXISTS shared_selections_product_id_version_selection_key;
CREATE UNIQUE INDEX IF NOT EXISTS shared_selections_identity
  ON shared_selections(product_id, version, md5(selection));
INSERT INTO yenze_migrations(version) VALUES(2) ON CONFLICT DO NOTHING;
