import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { CreateEventDto } from '../dto/create-event.dto';

describe('EventsController', () => {
  let controller: EventsController;
  let service: EventsService;
  let validationPipe: ValidationPipe;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [EventsService],
    }).compile();

    controller = module.get<EventsController>(EventsController);
    service = module.get<EventsService>(EventsService);
    validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('create (success flow)', () => {
    it('should create and return an event', () => {
      const dto: CreateEventDto = {
        nome: 'Conference 2026',
        endereco: 'Rua Vergueiro, 500 - São Paulo, SP',
        capacidade: 250,
        data: '2026-12-01',
      };

      const result = controller.create(dto);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.nome).toBe('Conference 2026');
      expect(result.endereco).toBe('Rua Vergueiro, 500 - São Paulo, SP');
      expect(result.capacidade).toBe(250);
      expect(result.data).toBe('2026-12-01');
    });
  });

  describe('findAll', () => {
    it('should return an array of EventDTO', () => {
      service.create({
        nome: 'Meetup Dev',
        endereco: 'Rua Augusta, 100',
        capacidade: 50,
        data: '2026-10-25',
      });

      const events = controller.findAll();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThanOrEqual(1);
      const found = events.find((e) => e.nome === 'Meetup Dev');
      expect(found).toBeDefined();
    });
  });

  describe('validation (400 Bad Request)', () => {
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: CreateEventDto,
      data: '',
    };

    it('should pass validation with valid payload', async () => {
      const validPayload = {
        nome: 'Angular Summit',
        endereco: 'Av. Brigadeiro Faria Lima, 2000',
        capacidade: 500,
        data: '2026-11-10',
      };

      const transformed = await validationPipe.transform(validPayload, metadata);
      expect(transformed).toBeInstanceOf(CreateEventDto);
      expect(transformed.nome).toBe(validPayload.nome);
    });

    it('should reject payload missing required fields with 400 Bad Request', async () => {
      const invalidPayload = {
        nome: 'Angular Summit',
      };

      await expect(validationPipe.transform(invalidPayload, metadata)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject payload with capacity less than 1', async () => {
      const invalidPayload = {
        nome: 'Angular Summit',
        endereco: 'Av. Brigadeiro Faria Lima, 2000',
        capacidade: 0,
        data: '2026-11-10',
      };

      await expect(validationPipe.transform(invalidPayload, metadata)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
