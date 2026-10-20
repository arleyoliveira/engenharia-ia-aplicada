import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { CreateEventDto } from '../dto/create-event.dto';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsService],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create and retrieve an event', () => {
    const dto: CreateEventDto = {
      nome: 'Tech Summit 2026',
      endereco: 'Av. Paulista, 1000 - São Paulo, SP',
      capacidade: 300,
      data: '2026-11-20',
    };

    const created = service.create(dto);
    expect(created.id).toBeDefined();
    expect(created.nome).toBe('Tech Summit 2026');
    expect(created.endereco).toBe('Av. Paulista, 1000 - São Paulo, SP');
    expect(created.capacidade).toBe(300);
    expect(created.data).toBe('2026-11-20');

    const allEvents = service.findAll();
    expect(allEvents.length).toBe(1);
    expect(allEvents[0]).toEqual(created);
  });
});
