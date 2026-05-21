import { Global, Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MetaCloudProvider } from './providers/meta-cloud.provider';
import { SandboxProvider } from './providers/sandbox.provider';
import { TwilioProvider } from './providers/twilio.provider';

@Global()
@Module({
  providers: [MessagingService, SandboxProvider, MetaCloudProvider, TwilioProvider],
  exports: [MessagingService, SandboxProvider, MetaCloudProvider, TwilioProvider],
})
export class MessagingModule {}
