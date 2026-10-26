import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DEFAULT_LIST_LIMIT,
  MAX_CURSOR_LENGTH,
  MAX_LIST_LIMIT,
} from '../documents.constants.js';

export class ListDocumentsQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_LIST_LIMIT,
    default: DEFAULT_LIST_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit: number = DEFAULT_LIST_LIMIT;

  @ApiPropertyOptional({
    description:
      'The `nextCursor` of the previous page; omit it for the first page',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CURSOR_LENGTH)
  cursor?: string;
}
