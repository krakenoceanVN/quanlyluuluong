import { Module } from '@nestjs/common';
import { TrackersController } from './trackers.controller';
import { TrackersService } from './trackers.service';

@Module({
  controllers: [TrackersController],
  providers: [TrackersService],
  exports: [TrackersService],
})
export class TrackersModule {}
