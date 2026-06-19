import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Role, SwipeDirection, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** One row returned by the raw feed query. */
interface FeedRow {
  id: string;
  role: Role;
  title: string;
  fieldOfActivity: string;
  contractType: string;
  ageMin: number;
  ageMax: number;
  point: Prisma.JsonValue;
  radiusKm: number | null;
  cityLabel: string | null;
  cityCenter: Prisma.JsonValue;
  cityPolygon: Prisma.JsonValue;
  createdAt: Date;
  matchedWith: string[];
  matchCount: number;
  sameField: boolean;
}

/** Cursor encodes the last row's full sort key for keyset pagination. */
interface FeedCursor {
  sameField: boolean;
  matchCount: number;
  createdAt: string;
  id: string;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Feed is built from ALL of the current user's active listings combined:
   * a target (opposite-role) listing appears if it matches at least one of
   * the user's own listings. Already-swiped targets are excluded.
   *
   * Everything (spatial match, swipe exclusion, ranking, paging) runs in a
   * single PostGIS query so the DB can prune by GIST index instead of the
   * app loading every opposite-role listing into memory. Geometry matching:
   * an employer point+radius matches a candidate region when the region is
   * within `radiusKm` of the point — i.e. the hiring circle intersects it.
   */
  async getFeed(user: User, opts: { limit?: number; cursor?: string } = {}) {
    const take = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const cursor = this.decodeCursor(opts.cursor);

    // Preserve the explicit "you have no listings" signal.
    const myCount = await this.prisma.listing.count({
      where: { ownerId: user.id, status: 'ACTIVE' },
    });
    if (myCount === 0) {
      return { items: [], nextCursor: null, reason: 'NO_LISTINGS' };
    }

    const isEmployer = user.role === 'EMPLOYER';
    const oppositeRole: Role = isEmployer ? 'CANDIDATE' : 'EMPLOYER';

    // The point+radius always lives on the employer side, the region on the
    // candidate side — so which alias holds which flips with the viewer.
    const myGeomFilter = isEmployer
      ? Prisma.sql`point_geog IS NOT NULL AND "radiusKm" IS NOT NULL`
      : Prisma.sql`region_geog IS NOT NULL`;
    const candGeomFilter = isEmployer
      ? Prisma.sql`c.region_geog IS NOT NULL`
      : Prisma.sql`c.point_geog IS NOT NULL AND c."radiusKm" IS NOT NULL`;
    const matchCond = isEmployer
      ? Prisma.sql`ST_DWithin(c.region_geog, my.point_geog, my."radiusKm" * 1000)`
      : Prisma.sql`ST_DWithin(c.point_geog, my.region_geog, c."radiusKm" * 1000)`;

    // Keyset pagination: rows strictly "after" the cursor in the sort order.
    // Sort is all-DESC, so the next page is everything < the cursor tuple.
    const cursorCond = cursor
      ? Prisma.sql`AND (agg.same_field, agg.match_count, c."createdAt", c.id) < (${cursor.sameField}, ${cursor.matchCount}, ${cursor.createdAt}::timestamptz, ${cursor.id})`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<FeedRow[]>(Prisma.sql`
      WITH my AS (
        SELECT id, point_geog, region_geog, "radiusKm", "fieldOfActivity"
        FROM listings
        WHERE "ownerId" = ${user.id} AND status = 'ACTIVE' AND ${myGeomFilter}
      ),
      -- Drive from my (few) listings so ST_DWithin uses the GIST index on the
      -- candidate side; one row per (candidate, matching-own-listing) pair.
      hits AS (
        SELECT c.id AS cid,
               my.id AS mid,
               (my."fieldOfActivity" = c."fieldOfActivity") AS same_field
        FROM my
        JOIN listings c
          ON c.role = ${oppositeRole}::"Role"
         AND c.status = 'ACTIVE'
         AND c."ownerId" <> ${user.id}
         AND ${candGeomFilter}
         AND ${matchCond}
      ),
      agg AS (
        SELECT cid,
               array_agg(mid)      AS matched_with,
               count(*)::int       AS match_count,
               bool_or(same_field) AS same_field
        FROM hits
        GROUP BY cid
      )
      SELECT c.id, c.role, c.title, c."fieldOfActivity", c."contractType",
             c."ageMin", c."ageMax", c.point, c."radiusKm",
             c."cityLabel", c."cityCenter", c."cityPolygon", c."createdAt",
             agg.matched_with AS "matchedWith",
             agg.match_count  AS "matchCount",
             agg.same_field   AS "sameField"
      FROM agg
      JOIN listings c ON c.id = agg.cid
      LEFT JOIN swipes s ON s."listingId" = c.id AND s."swiperId" = ${user.id}
      WHERE s.id IS NULL
      ${cursorCond}
      -- Priority 2 (WBS): same field ranks higher, then more matches.
      ORDER BY agg.same_field DESC, agg.match_count DESC, c."createdAt" DESC, c.id DESC
      LIMIT ${take}
    `);

    const items = rows.map((r) => ({
      ...this.publicListing(r),
      matchedWithListingIds: r.matchedWith,
    }));

    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === take && last ? this.encodeCursor(last) : null;

    return { items, nextCursor };
  }

  private encodeCursor(row: FeedRow): string {
    const c: FeedCursor = {
      sameField: row.sameField,
      matchCount: row.matchCount,
      createdAt: row.createdAt.toISOString(),
      id: row.id,
    };
    return Buffer.from(JSON.stringify(c)).toString('base64url');
  }

  private decodeCursor(raw?: string): FeedCursor | null {
    if (!raw) return null;
    try {
      const c = JSON.parse(Buffer.from(raw, 'base64url').toString());
      if (
        typeof c.sameField === 'boolean' &&
        typeof c.matchCount === 'number' &&
        typeof c.createdAt === 'string' &&
        typeof c.id === 'string'
      ) {
        return c;
      }
    } catch {
      /* fall through */
    }
    throw new BadRequestException('Invalid cursor.');
  }

  async swipe(user: User, listingId: string, direction: SwipeDirection) {
    if (direction !== 'LEFT' && direction !== 'RIGHT') {
      throw new BadRequestException('direction must be LEFT or RIGHT.');
    }
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (!listing) throw new BadRequestException('Listing not found.');

    const result = await this.prisma.swipe.upsert({
      where: { swiperId_listingId: { swiperId: user.id, listingId } },
      update: { direction },
      create: { swiperId: user.id, listingId, direction },
    });
    return { ok: true, id: result.id };
  }

  // Employers viewing candidate cards do NOT see contact until "swipe right"
  // (subscription gate in the real product). Demo: hide contact in the feed.
  private publicListing(
    l: Pick<
      FeedRow,
      | 'id'
      | 'role'
      | 'title'
      | 'fieldOfActivity'
      | 'contractType'
      | 'ageMin'
      | 'ageMax'
      | 'point'
      | 'radiusKm'
      | 'cityLabel'
      | 'cityCenter'
      | 'cityPolygon'
    >,
  ) {
    return {
      id: l.id,
      role: l.role,
      title: l.title,
      fieldOfActivity: l.fieldOfActivity,
      contractType: l.contractType,
      ageMin: l.ageMin,
      ageMax: l.ageMax,
      point: l.point,
      radiusKm: l.radiusKm,
      cityLabel: l.cityLabel,
      cityCenter: l.cityCenter,
      cityPolygon: l.cityPolygon,
    };
  }
}
