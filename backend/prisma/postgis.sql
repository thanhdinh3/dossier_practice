-- PostGIS setup for geospatial feed matching.
--
-- Idempotent: safe to run repeatedly. Run AFTER `prisma db push` (the
-- point_geog / region_geog columns must already exist). The `db:setup`
-- npm script wires up the correct order; see backend/package.json.
--
-- What this does:
--   1. Enables the PostGIS extension.
--   2. Installs a BEFORE INSERT/UPDATE trigger that derives the geography
--      columns from the JSON `point` / `cityPolygon` columns, so app code
--      never has to touch them.
--   3. Backfills existing rows.
--   4. Creates GIST indexes so ST_DWithin can prune candidates by index
--      instead of scanning every opposite-role listing.

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1 + 2. Derive geography columns from the JSON source of truth.
CREATE OR REPLACE FUNCTION listings_fill_geog() RETURNS trigger AS $$
BEGIN
  -- Employer hiring point: { "lat": .., "lng": .. }  ->  geography(Point)
  IF NEW.point IS NOT NULL AND (NEW.point ? 'lat') AND (NEW.point ? 'lng') THEN
    NEW.point_geog := ST_SetSRID(
      ST_MakePoint((NEW.point->>'lng')::float8, (NEW.point->>'lat')::float8),
      4326
    )::geography;
  ELSE
    NEW.point_geog := NULL;
  END IF;

  -- Candidate region: GeoJSON geometry  ->  geography(Geometry)
  IF NEW."cityPolygon" IS NOT NULL THEN
    BEGIN
      NEW.region_geog := ST_SetSRID(
        ST_GeomFromGeoJSON(NEW."cityPolygon"::text),
        4326
      )::geography;
    EXCEPTION WHEN others THEN
      -- Malformed geometry must not block the write; the row just won't match.
      NEW.region_geog := NULL;
    END;
  ELSE
    NEW.region_geog := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS listings_fill_geog_trg ON listings;
CREATE TRIGGER listings_fill_geog_trg
  BEFORE INSERT OR UPDATE OF point, "cityPolygon" ON listings
  FOR EACH ROW EXECUTE FUNCTION listings_fill_geog();

-- 3. Backfill any rows that predate the trigger. Re-running the trigger via a
--    no-op UPDATE keeps the logic in one place.
UPDATE listings
SET point = point
WHERE point IS NOT NULL OR "cityPolygon" IS NOT NULL;

-- 4. Spatial indexes used by ST_DWithin in the feed query.
CREATE INDEX IF NOT EXISTS listings_point_geog_gix  ON listings USING GIST (point_geog);
CREATE INDEX IF NOT EXISTS listings_region_geog_gix ON listings USING GIST (region_geog);
