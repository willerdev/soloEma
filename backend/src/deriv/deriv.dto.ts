import { IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class SaveDerivTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string;
}

export class DerivTransferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  accountFrom: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  accountTo: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  currency: string;
}
