import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Playbook, PlaybookSchema } from './schemas/playbook.schema';
import { PlaybookService } from './playbook.service';
import { PlaybookController } from './playbook.controller';
import { PlaybookRegistry } from './playbook-registry';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Playbook.name, schema: PlaybookSchema },
    ]),
  ],
  controllers: [PlaybookController],
  providers: [PlaybookService, PlaybookRegistry],
  exports: [MongooseModule, PlaybookService, PlaybookRegistry],
})
export class PlaybookModule {}
