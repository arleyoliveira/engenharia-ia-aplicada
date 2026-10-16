import { Injectable } from '@nestjs/common';
import { SpeakerDTO } from '@cfp-platform/shared-types';
import { CreateSpeakerDto } from '../dto/create-speaker.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class SpeakersService {
  private readonly speakers: SpeakerDTO[] = [];

  create(dto: CreateSpeakerDto): SpeakerDTO {
    const speaker: SpeakerDTO = {
      id: dto.id || randomUUID(),
      nome: dto.nome,
      email: dto.email,
      talkTitle: dto.talkTitle,
      isGDE: dto.isGDE,
    };

    this.speakers.push(speaker);
    return speaker;
  }

  findAll(): SpeakerDTO[] {
    return [...this.speakers];
  }
}
