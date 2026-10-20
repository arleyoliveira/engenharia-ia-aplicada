import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { SpeakersController } from './speakers.controller';
import { SpeakersService } from './speakers.service';
import { CreateSpeakerDto } from '../dto/create-speaker.dto';

describe('SpeakersController', () => {
  let controller: SpeakersController;
  let service: SpeakersService;
  let validationPipe: ValidationPipe;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpeakersController],
      providers: [SpeakersService],
    }).compile();

    controller = module.get<SpeakersController>(SpeakersController);
    service = module.get<SpeakersService>(SpeakersService);
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
    it('should create and return a speaker submission', () => {
      const dto: CreateSpeakerDto = {
        nome: 'Ada Lovelace',
        email: 'ada@example.com',
        talkTitle: 'First Computer Program',
        isGDE: true,
      };

      const result = controller.create(dto);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.nome).toBe('Ada Lovelace');
      expect(result.email).toBe('ada@example.com');
      expect(result.talkTitle).toBe('First Computer Program');
      expect(result.isGDE).toBe(true);
    });
  });

  describe('findAll', () => {
    it('should return an array of SpeakerDTO', () => {
      service.create({
        nome: 'Grace Hopper',
        email: 'grace@example.com',
        talkTitle: 'Compilers and Beyond',
        isGDE: false,
      });

      const speakers = controller.findAll();
      expect(Array.isArray(speakers)).toBe(true);
      expect(speakers.length).toBeGreaterThanOrEqual(1);
      const found = speakers.find((s) => s.email === 'grace@example.com');
      expect(found).toBeDefined();
      expect(found?.talkTitle).toBe('Compilers and Beyond');
    });
  });

  describe('validation (400 Bad Request)', () => {
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: CreateSpeakerDto,
      data: '',
    };

    it('should pass validation with valid payload', async () => {
      const validPayload = {
        nome: 'Alan Turing',
        email: 'alan@example.com',
        talkTitle: 'Enigma & Computing Machinery',
        isGDE: false,
      };

      const transformed = await validationPipe.transform(validPayload, metadata);
      expect(transformed).toBeInstanceOf(CreateSpeakerDto);
      expect(transformed.nome).toBe(validPayload.nome);
    });

    it('should reject payload missing required fields with 400 Bad Request', async () => {
      const invalidPayload = {
        email: 'alan@example.com',
      };

      await expect(validationPipe.transform(invalidPayload, metadata)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject payload with invalid email with 400 Bad Request', async () => {
      const invalidPayload = {
        nome: 'Alan Turing',
        email: 'not-an-email',
        talkTitle: 'Enigma',
        isGDE: false,
      };

      await expect(validationPipe.transform(invalidPayload, metadata)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject payload with unwhitelisted properties with 400 Bad Request', async () => {
      const invalidPayload = {
        nome: 'Alan Turing',
        email: 'alan@example.com',
        talkTitle: 'Enigma',
        isGDE: false,
        unknownField: 'malicious-data',
      };

      await expect(validationPipe.transform(invalidPayload, metadata)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
