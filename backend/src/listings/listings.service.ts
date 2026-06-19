import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Listing, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeoService } from '../geo/geo.service';
import { CreateListingDto, UpdateListingDto } from './dto';

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
  ) {}

  async create(user: User, dto: CreateListingDto): Promise<Listing> {
    if (dto.ageMin > dto.ageMax) {
      throw new BadRequestException('ageMin cannot be greater than ageMax.');
    }

    const data: Prisma.ListingCreateInput = {
      owner: { connect: { id: user.id } },
      role: user.role,
      title: dto.title,
      fieldOfActivity: dto.fieldOfActivity,
      contractType: dto.contractType,
      ageMin: dto.ageMin,
      ageMax: dto.ageMax,
      status: 'ACTIVE',
      consent: false,
    };

    if (user.role === 'EMPLOYER') {
      if (!dto.point || dto.radiusKm == null) {
        throw new BadRequestException(
          'Employer listing requires a point (lat/lng) and radiusKm.',
        );
      }
      data.point = { lat: dto.point.lat, lng: dto.point.lng };
      data.radiusKm = dto.radiusKm;
    } else {
      // CANDIDATE: resolve the chosen region into a stored polygon.
      if (!dto.cityPlaceId) {
        throw new BadRequestException(
          'Candidate listing requires a region (cityPlaceId from autocomplete).',
        );
      }
      if (!dto.consent) {
        throw new BadRequestException(
          'You must consent to disclose your details to employers.',
        );
      }
      if (!dto.contact) {
        throw new BadRequestException('Candidate listing requires contact info.');
      }
      const poly = await this.geo.cityPolygon(
        dto.cityPlaceId,
        dto.cityLabel,
        dto.cityLat,
        dto.cityLon,
      );
      data.cityLabel = poly.label;
      data.cityCenter = poly.center as unknown as Prisma.InputJsonValue;
      data.cityPolygon = poly.polygon as unknown as Prisma.InputJsonValue;
      data.contact = dto.contact as unknown as Prisma.InputJsonValue;
      data.consent = true;
    }

    return this.prisma.listing.create({ data });
  }

  async update(
    user: User,
    id: string,
    dto: UpdateListingDto,
  ): Promise<Listing> {
    const existing = await this.prisma.listing.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Listing not found.');
    }
    if (existing.ownerId !== user.id) {
      throw new ForbiddenException('You can only edit your own listings.');
    }

    // Validate the age range against the *resulting* values (merge with stored).
    const ageMin = dto.ageMin ?? existing.ageMin;
    const ageMax = dto.ageMax ?? existing.ageMax;
    if (ageMin > ageMax) {
      throw new BadRequestException('ageMin cannot be greater than ageMax.');
    }

    const data: Prisma.ListingUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.fieldOfActivity !== undefined)
      data.fieldOfActivity = dto.fieldOfActivity;
    if (dto.contractType !== undefined) data.contractType = dto.contractType;
    if (dto.ageMin !== undefined) data.ageMin = dto.ageMin;
    if (dto.ageMax !== undefined) data.ageMax = dto.ageMax;

    if (existing.role === 'EMPLOYER') {
      if (dto.point) {
        data.point = { lat: dto.point.lat, lng: dto.point.lng };
      }
      if (dto.radiusKm !== undefined) data.radiusKm = dto.radiusKm;
    } else {
      // CANDIDATE: only re-resolve the polygon when a new region is picked.
      if (dto.cityPlaceId) {
        const poly = await this.geo.cityPolygon(
          dto.cityPlaceId,
          dto.cityLabel,
          dto.cityLat,
          dto.cityLon,
        );
        data.cityLabel = poly.label;
        data.cityCenter = poly.center as unknown as Prisma.InputJsonValue;
        data.cityPolygon = poly.polygon as unknown as Prisma.InputJsonValue;
      }
      if (dto.contact !== undefined) {
        data.contact = dto.contact as unknown as Prisma.InputJsonValue;
      }
      if (dto.consent !== undefined) data.consent = dto.consent;
    }

    return this.prisma.listing.update({ where: { id }, data });
  }

  findMine(userId: string): Promise<Listing[]> {
    return this.prisma.listing.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
