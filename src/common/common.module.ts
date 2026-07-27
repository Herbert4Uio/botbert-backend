import { Module, Global } from '@nestjs/common';
import { RegexBuilder } from './utils/regex-builder';
import { TextNormalizer } from './utils/text-normalizer';

const regexProvider = {
  provide: 'REGEX_BUILDER',
  useValue: RegexBuilder,
};

const normalizerProvider = {
  provide: 'TEXT_NORMALIZER',
  useValue: TextNormalizer,
};

@Global()
@Module({
  providers: [regexProvider, normalizerProvider],
  exports: [regexProvider, normalizerProvider],
})
export class CommonModule {}
