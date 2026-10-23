import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpeakersController } from './speakers/speakers.controller';
import { SpeakersService } from './speakers/speakers.service';
import { EventsController } from './events/events.controller';
import { EventsService } from './events/events.service';

@Module({
  imports: [],
  controllers: [AppController, SpeakersController, EventsController],
  providers: [AppService, SpeakersService, EventsService],
})
export class AppModule {}
