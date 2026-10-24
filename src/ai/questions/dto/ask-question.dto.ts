import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const MAX_QUESTION_LENGTH = 1000;

export class AskQuestionDto {
  @ApiProperty({
    maxLength: MAX_QUESTION_LENGTH,
    example: '¿Cuánto suman las facturas de Tecnosuministros?',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_QUESTION_LENGTH)
  question: string;
}
