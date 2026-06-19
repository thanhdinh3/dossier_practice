import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GeoModule } from '../geo/geo.module';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [AuthModule, GeoModule],
  controllers: [ListingsController],
  providers: [ListingsService],
})
export class ListingsModule {}
