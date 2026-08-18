import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tag, TagSchema } from './schemas/tag.schema';
import { Pipeline, PipelineSchema } from './schemas/pipeline.schema';
import { Deal, DealSchema } from './schemas/deal.schema';
import { Customer, CustomerSchema } from '../customer/schemas/customer.schema';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tag.name, schema: TagSchema },
      { name: Pipeline.name, schema: PipelineSchema },
      { name: Deal.name, schema: DealSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
