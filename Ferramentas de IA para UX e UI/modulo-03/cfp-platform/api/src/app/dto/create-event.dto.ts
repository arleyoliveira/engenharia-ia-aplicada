import { EventDTO } from '@cfp-platform/shared-types';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateEventDto implements EventDTO {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsString()
  @IsNotEmpty()
  endereco!: string;

  @IsNumber()
  @Min(1)
  capacidade!: number;

  @IsString()
  @IsNotEmpty()
  data!: string;
}
