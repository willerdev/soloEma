import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard';
import { DerivService } from './deriv.service';
import { DerivTransferDto, SaveDerivTokenDto } from './deriv.dto';

@Controller('deriv')
@UseGuards(JwtAuthGuard)
export class DerivController {
  constructor(private deriv: DerivService) {}

  @Get('status')
  status(@Request() req: { user: { id: string } }) {
    return this.deriv.status(req.user.id);
  }

  @Put('token')
  @UseGuards(AuthRateLimitGuard)
  saveToken(
    @Request() req: { user: { id: string } },
    @Body() dto: SaveDerivTokenDto,
  ) {
    return this.deriv.saveToken(req.user.id, dto.token);
  }

  @Delete('token')
  disconnect(@Request() req: { user: { id: string } }) {
    return this.deriv.disconnect(req.user.id);
  }

  @Get('accounts')
  accounts(@Request() req: { user: { id: string } }) {
    return this.deriv.accounts(req.user.id);
  }

  @Get('trades')
  trades(@Request() req: { user: { id: string } }) {
    return this.deriv.trades(req.user.id);
  }

  @Post('transfer')
  @UseGuards(AuthRateLimitGuard)
  transfer(
    @Request() req: { user: { id: string } },
    @Body() dto: DerivTransferDto,
  ) {
    return this.deriv.transfer(req.user.id, dto);
  }

  @Post('contracts/:id/sell')
  @UseGuards(AuthRateLimitGuard)
  sell(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.deriv.sellContract(req.user.id, id);
  }
}
