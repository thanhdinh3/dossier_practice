import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { GeoModule } from './geo/geo.module';
import { ListingsModule } from './listings/listings.module';
import { FeedModule } from './feed/feed.module';

@Module({
  imports: [PrismaModule, AuthModule, GeoModule, ListingsModule, FeedModule],
})
export class AppModule {}
