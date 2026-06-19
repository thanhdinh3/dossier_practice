import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LatLngDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

export class ContactDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsEmail() email: string;
  @IsString() phone: string;
}

export class CreateListingDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  fieldOfActivity: string;

  @IsString()
  contractType: string;

  @IsInt()
  @Min(18)
  @Max(65)
  ageMin: number;

  @IsInt()
  @Min(18)
  @Max(65)
  ageMax: number;

  // ----- Employer fields -----
  @IsOptional()
  @ValidateNested()
  @Type(() => LatLngDto)
  point?: LatLngDto;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(200)
  radiusKm?: number;

  // ----- Candidate fields (picked from /geo autocomplete) -----
  @IsOptional()
  @IsString()
  cityLabel?: string;

  @IsOptional()
  @IsNumber()
  cityLat?: number;

  @IsOptional()
  @IsNumber()
  cityLon?: number;

  @IsOptional()
  @IsString()
  cityPlaceId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  contact?: ContactDto;

  @IsOptional()
  @IsBoolean()
  consent?: boolean;
}

/**
 * Partial update — every field is optional. Only the fields present in the
 * body are changed; omitted ones keep their stored value. Role is immutable
 * (derived from the owner), so it is not part of this DTO.
 */
export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  fieldOfActivity?: string;

  @IsOptional()
  @IsString()
  contractType?: string;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(65)
  ageMin?: number;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(65)
  ageMax?: number;

  // ----- Employer fields -----
  @IsOptional()
  @ValidateNested()
  @Type(() => LatLngDto)
  point?: LatLngDto;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(200)
  radiusKm?: number;

  // ----- Candidate fields -----
  @IsOptional()
  @IsString()
  cityLabel?: string;

  @IsOptional()
  @IsNumber()
  cityLat?: number;

  @IsOptional()
  @IsNumber()
  cityLon?: number;

  @IsOptional()
  @IsString()
  cityPlaceId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  contact?: ContactDto;

  @IsOptional()
  @IsBoolean()
  consent?: boolean;
}
