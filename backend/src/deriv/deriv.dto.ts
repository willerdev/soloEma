import { IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class SaveDerivTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  token: string;
}

export class DerivTransferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  accountFrom: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  accountTo: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  currency: string;
}
