import { Module } from '@nestjs/common';
import { NFeService } from './nfe.service';
import { NFeController } from './nfe.controller';

@Module({
  providers: [NFeService],
  controllers: [NFeController],
})
export class NFeModule {}
