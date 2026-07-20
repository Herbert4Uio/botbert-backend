import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BaileysAuth, BaileysAuthSchema } from './schemas/baileys-auth.schema';
import { WhatsappService } from './whatsapp.service';
import { WhatsappGateway } from './whatsapp.gateway';
import { WhatsappController } from './whatsapp.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BaileysAuth.name, schema: BaileysAuthSchema },
    ]),
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappGateway],
  exports: [MongooseModule, WhatsappService],
})
export class WhatsappModule {}
