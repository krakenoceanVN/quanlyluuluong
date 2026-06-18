import { Global, Module } from '@nestjs/common';
import { FlowService } from './flow.service';

@Global()
@Module({
  providers: [FlowService],
  exports: [FlowService],
})
export class FlowModule {}
