import { Injectable } from '@nestjs/common';
import { EventDTO } from '@cfp-platform/shared-types';
import { CreateEventDto } from '../dto/create-event.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class EventsService {
  private readonly events: EventDTO[] = [];

  create(dto: CreateEventDto): EventDTO {
    const event: EventDTO = {
      id: dto.id || randomUUID(),
      nome: dto.nome,
      endereco: dto.endereco,
      capacidade: Number(dto.capacidade),
      data: dto.data,
    };

    this.events.push(event);
    return event;
  }

  findAll(): EventDTO[] {
    return [...this.events];
  }
}
