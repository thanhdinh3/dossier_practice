import { BadRequestException, Injectable } from '@nestjs/common';
import { Listing, Role, SwipeDirection, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { listingsMatch } from './matching';

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Feed is built from ALL of the current user's active listings combined:
   * a target (opposite-role) listing appears if it matches at least one of
   * the user's own listings. Already-swiped targets are excluded.
   */
  async getFeed(user: User) {
    const myListings = await this.prisma.listing.findMany({
      where: { ownerId: user.id, status: 'ACTIVE' },
    });
    if (myListings.length === 0) {
      return { items: [], reason: 'NO_LISTINGS' };
    }

    const oppositeRole: Role =
      user.role === 'EMPLOYER' ? 'CANDIDATE' : 'EMPLOYER';

    const swiped = await this.prisma.swipe.findMany({
      where: { swiperId: user.id },
      select: { listingId: true },
    });
    const swipedIds = swiped.map((s) => s.listingId);

    const candidates = await this.prisma.listing.findMany({
      where: {
        role: oppositeRole,
        status: 'ACTIVE',
        ownerId: { not: user.id },
        ...(swipedIds.length ? { id: { notIn: swipedIds } } : {}),
      },
    });

    const items: Array<{ listing: Listing; matchedWith: string[] }> = [];
    for (const target of candidates) {
      const matchedWith: string[] = [];
      for (const mine of myListings) {
        const [employer, candidate] =
          user.role === 'EMPLOYER' ? [mine, target] : [target, mine];
        if (listingsMatch(employer, candidate)) {
          matchedWith.push(mine.id);
        }
      }
      if (matchedWith.length > 0) {
        items.push({ listing: target, matchedWith });
      }
    }

    // Priority 2 (WBS): same field of activity ranks higher.
    const myFields = new Set(myListings.map((l) => l.fieldOfActivity));
    items.sort((a, b) => {
      const aField = myFields.has(a.listing.fieldOfActivity) ? 1 : 0;
      const bField = myFields.has(b.listing.fieldOfActivity) ? 1 : 0;
      if (aField !== bField) return bField - aField;
      return b.matchedWith.length - a.matchedWith.length;
    });

    return {
      items: items.map((i) => ({
        ...this.publicListing(i.listing),
        matchedWithListingIds: i.matchedWith,
      })),
    };
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
  private publicListing(l: Listing) {
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
