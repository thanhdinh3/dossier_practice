import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { User } from '@prisma/client';
import { FeedService } from './feed.service';

class SwipeDto {
  @IsString()
  listingId: string;

  @IsIn(['LEFT', 'RIGHT'])
  direction: 'LEFT' | 'RIGHT';
}

@UseGuards(AuthGuard)
@Controller()
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get('feed')
  getFeed(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.feed.getFeed(user, {
      limit: limit ? parseInt(limit, 10) || undefined : undefined,
      cursor,
    });
  }

  @Post('swipe')
  swipe(@CurrentUser() user: User, @Body() dto: SwipeDto) {
    return this.feed.swipe(user, dto.listingId, dto.direction);
  }
}
