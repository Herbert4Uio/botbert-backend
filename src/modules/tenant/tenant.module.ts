import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant, TenantSchema } from './schemas/tenant.schema';

import { UserModule } from '../user/user.module';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tenant.name, schema: TenantSchema }]),
    UserModule,
  ],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [MongooseModule, TenantService],
})
export class TenantModule {}
