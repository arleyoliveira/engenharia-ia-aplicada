import { Body, Controller, Get, Post } from '@nestjs/common';
import { EventDTO } from '@cfp-platform/shared-types';
import { CreateEventDto } from '../dto/create-event.dto';
import { EventsService } from './events.service';

@Controller(['events', 'event'])
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@Body() dto: CreateEventDto): EventDTO {
    return this.eventsService.create(dto);
  }

  @Get()
  findAll(): EventDTO[] {
    return this.eventsService.findAll();
  }
}
