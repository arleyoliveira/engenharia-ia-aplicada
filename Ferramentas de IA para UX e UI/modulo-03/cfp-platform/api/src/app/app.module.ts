import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpeakersController } from './speakers/speakers.controller';
import { SpeakersService } from './speakers/speakers.service';

@Module({
  imports: [],
  controllers: [AppController, SpeakersController],
  providers: [AppService, SpeakersService],
})
export class AppModule {}
