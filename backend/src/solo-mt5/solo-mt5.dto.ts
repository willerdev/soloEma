import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SaveMetaApiTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8192)
  token: string;
}
