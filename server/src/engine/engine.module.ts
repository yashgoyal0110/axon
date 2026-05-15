import { Global, Module } from '@nestjs/common';
import { GeminiService } from '../ai/gemini.service';
import { EngineService } from './engine.service';

@Global()
@Module({
  providers: [EngineService, GeminiService],
  exports: [EngineService, GeminiService],
})
export class EngineModule {}
