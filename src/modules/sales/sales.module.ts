import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { AiAudit, AiAuditSchema } from './schemas/ai-audit.schema';
import { SalesService } from './sales.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AiModule } from '../ai/ai.module';
import { BranchModule } from '../branch/branch.module';
import { CustomerModule } from '../customer/customer.module';
import { CatalogModule } from '../catalog/catalog.module';
import { OrderModule } from '../order/order.module';
import { TenantModule } from '../tenant/tenant.module';

import { SalesController } from './sales.controller';
import { SalesToolsService } from './sales-tools.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: AiAudit.name, schema: AiAuditSchema }
    ]),
    WhatsappModule,
    AiModule,
    TenantModule,
    BranchModule,
    CustomerModule,
    CatalogModule,
    OrderModule,
  ],
  controllers: [SalesController],
  providers: [SalesService, SalesToolsService],
  exports: [MongooseModule, SalesService],
})
export class SalesModule {}
