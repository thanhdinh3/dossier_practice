import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { GeoService } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  // Candidate region autocomplete (Geoapify).
  @Get('autocomplete')
  autocomplete(@Query('text') text: string) {
    return this.geo.autocomplete(text || '');
  }

  // Employer point autocomplete (Google Places).
  @Get('places/autocomplete')
  placesAutocomplete(@Query('text') text: string) {
    return this.geo.placesAutocomplete(text || '');
  }

  @Get('places/details')
  placeDetails(@Query('placeId') placeId: string) {
    if (!placeId) throw new BadRequestException('placeId is required.');
    return this.geo.placeDetails(placeId);
  }

  @Get('city-polygon')
  async cityPolygon(
    @Query('placeId') placeId: string,
    @Query('label') label?: string,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
  ) {
    if (!placeId) {
      throw new BadRequestException('placeId is required.');
    }
    const latN = lat != null && lat !== '' ? Number(lat) : undefined;
    const lonN = lon != null && lon !== '' ? Number(lon) : undefined;
    return this.geo.cityPolygon(placeId, label, latN, lonN);
  }
}
