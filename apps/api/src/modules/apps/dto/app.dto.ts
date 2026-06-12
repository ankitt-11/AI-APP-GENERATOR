import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateAppDto {
  @IsString()
  @MinLength(2, { message: 'App name must be at least 2 characters' })
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

export class UpdateAppDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
