import { Module } from '@nestjs/common';
import { FingerprintController } from './fingerprint.controller';
import { FingerprintService } from './fingerprint.service';

@Module({
  controllers: [FingerprintController],
  providers: [FingerprintService],
})
export class FingerprintModule {}
