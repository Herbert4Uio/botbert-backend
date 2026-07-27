import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VerticalConfigService } from './vertical-config.service';
import { VerticalConfigController } from './vertical-config.controller';
import { VerticalConfig, VerticalConfigSchema } from './schemas/vertical-config.schema';
import { GuardrailsModule } from '../sales/guardrails.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VerticalConfig.name, schema: VerticalConfigSchema },
    ]),
    GuardrailsModule,
  ],
  providers: [VerticalConfigService],
  controllers: [VerticalConfigController],
  exports: [MongooseModule, VerticalConfigService],
})
export class VerticalModule {}
