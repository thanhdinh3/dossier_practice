import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
  getFeed(@CurrentUser() user: User) {
    return this.feed.getFeed(user);
  }

  @Post('swipe')
  swipe(@CurrentUser() user: User, @Body() dto: SwipeDto) {
    return this.feed.swipe(user, dto.listingId, dto.direction);
  }
}
