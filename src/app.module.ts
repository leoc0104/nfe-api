import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { NFeModule } from './nfe/nfe.module';

@Module({
  imports: [PrismaModule, AuthModule, NFeModule],
})
export class AppModule {}
