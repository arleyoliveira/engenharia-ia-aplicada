import { Body, Controller, Get, Post } from '@nestjs/common';
import { SpeakerDTO } from '@cfp-platform/shared-types';
import { CreateSpeakerDto } from '../dto/create-speaker.dto';
import { SpeakersService } from './speakers.service';

@Controller(['speakers', 'cfp'])
export class SpeakersController {
  constructor(private readonly speakersService: SpeakersService) {}

  @Post()
  create(@Body() dto: CreateSpeakerDto): SpeakerDTO {
    return this.speakersService.create(dto);
  }

  @Get()
  findAll(): SpeakerDTO[] {
    return this.speakersService.findAll();
  }
}

export { SpeakersController as CfpController };
