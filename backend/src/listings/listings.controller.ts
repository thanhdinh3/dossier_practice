import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { User } from '@prisma/client';
import { CreateListingDto, UpdateListingDto } from './dto';
import { ListingsService } from './listings.service';

@UseGuards(AuthGuard)
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateListingDto) {
    return this.listings.create(user, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: User) {
    return this.listings.findMine(user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listings.update(user, id, dto);
  }
}
