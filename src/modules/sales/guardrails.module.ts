import { Module } from '@nestjs/common';
import { ContentValidatorService } from './content-validator.service';

@Module({
  providers: [ContentValidatorService],
  exports: [ContentValidatorService],
})
export class GuardrailsModule {}
