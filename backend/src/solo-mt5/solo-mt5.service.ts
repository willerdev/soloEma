import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TradeDirection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  MetaApiAccount,
  MetaApiOrder,
  MetaApiPosition,
  MetaApiService,
} from '../metaapi/metaapi.service';
import { roundToSymbolDigits } from '../metaapi/metaapi-order.util';
import { normalizeDerivSymbol } from '../ai/deriv-symbols';
import { computeOneToOnePrice } from '../common/rr.util';
import {
  defaultMt5ChartSlPips,
  getPipSize,
} from '../common/pip.util';
import {
  ModifyMt5PositionStopsDto,
  PlaceMt5MarketOrderDto,
} from '../common/dto';

function normalizeChartSymbol(raw: string): string {
  return normalizeDerivSymbol(raw);
}

function isSellType(type: string): boolean {
  return type.toLowerCase().includes('sell');
}

@Injectable()
export class SoloMt5Service {
  private readonly logger = new Logger(SoloMt5Service.name);

  constructor(
    private prisma: PrismaService,
    private metaApi: MetaApiService,
  ) {}

  async terminal(userId: string) {
    const linked = await this.linkedAccountId(userId);
    if (!this.metaApi.isConfigured) {
      return this.emptyTerminal(
        'Set METAAPI_TOKEN on solo-api, then connect your MT5 login.',
      );
    }
    if (!linked) {
      return this.emptyTerminal(
        'Connect your MT5 account (login, password, server) to load live charts and pin trades.',
      );
    }

    try {
      const account = await this.metaApi.ensureAccountReady(linked);
      const [information, positions, orders] = await Promise.all([
        this.metaApi.getAccountInformation(account),
        this.metaApi.getPositions(account),
        this.metaApi.getOrders(account),
      ]);
      const running = positions.map((p) => this.mapPosition(p));
      const limits = orders.map((o) => this.mapOrder(o));
      const trades = [...running, ...limits];
      const floatingProfit = running.reduce((sum, t) => sum + (t.profit ?? 0), 0);
      const startingBalance = information.balance - floatingProfit;

      return {
        configured: true,
        accountSource: 'linked_live' as const,
        account: {
          startingBalance,
          currency: information.currency || 'USD',
          realizedProfit: 0,
          floatingProfit,
          totalProfit: floatingProfit,
          equity: information.equity,
        },
        investor: {
          investmentDeposited: 0,
          investmentBalance: 0,
          enrollmentPaid: 0,
          walletDeposited: 0,
          walletBalance: 0,
          mt5Balance: information.balance,
          mt5Equity: information.equity,
          currency: information.currency || 'USD',
        },
        setups: { items: [], count: 0, claimableCount: 0 },
        trades,
        history: { items: [], count: 0 },
        stats: {
          openSetupCount: 0,
          limitCount: limits.length,
          runningCount: running.length,
          floatingProfit,
          historyCount: 0,
        },
        refreshedAt: new Date().toISOString(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load MT5';
      this.logger.warn(`Solo MT5 terminal failed: ${msg}`);
      return this.emptyTerminal(msg);
    }
  }

  async quotes(userId: string) {
    const ctx = await this.readyAccountOrNull(userId);
    if (!ctx) {
      return { items: [], refreshedAt: new Date().toISOString() };
    }
    const [positions, orders] = await Promise.all([
      this.metaApi.getPositions(ctx.account),
      this.metaApi.getOrders(ctx.account),
    ]);
    const symbols = [
      ...new Set(
        [...positions, ...orders]
          .map((row) => normalizeChartSymbol(row.symbol))
          .filter(Boolean),
      ),
    ].slice(0, 32);

    const items = await Promise.all(
      symbols.map(async (symbol) => {
        const pos = positions.find(
          (p) => normalizeChartSymbol(p.symbol) === symbol,
        );
        try {
          const price = await this.metaApi.getSymbolPrice(ctx.account, symbol);
          const bid = price.bid;
          const ask = price.ask;
          const mid = (bid + ask) / 2;
          const entryMid = pos?.openPrice ?? mid;
          return {
            signalId: pos?.id ?? symbol,
            symbol,
            direction: pos
              ? isSellType(pos.type)
                ? 'SELL'
                : 'BUY'
              : 'BUY',
            entryMin: entryMid,
            entryMax: entryMid,
            entryMid,
            bid,
            ask,
            mid,
            spread: ask - bid,
            change: mid - entryMid,
            changePct: entryMid !== 0 ? ((mid - entryMid) / entryMid) * 100 : 0,
            time: price.time,
            submittedAt: new Date().toISOString(),
          };
        } catch {
          return {
            signalId: symbol,
            symbol,
            direction: 'BUY',
            entryMin: 0,
            entryMax: 0,
            entryMid: 0,
            bid: null,
            ask: null,
            mid: null,
            spread: null,
            change: null,
            changePct: null,
            time: null,
            submittedAt: new Date().toISOString(),
          };
        }
      }),
    );

    return { items, refreshedAt: new Date().toISOString() };
  }

  async quote(userId: string, symbol: string) {
    const canonical = normalizeChartSymbol(symbol?.trim() || '');
    if (!canonical) {
      throw new BadRequestException('symbol is required');
    }
    const ctx = await this.requireAccount(userId);
    const price = await this.metaApi.getSymbolPrice(ctx.account, canonical);
    const bid = price.bid;
    const ask = price.ask;
    return {
      symbol: canonical,
      resolvedSymbol: price.symbol,
      bid,
      ask,
      mid: (bid + ask) / 2,
      spread: ask - bid,
      time: price.time,
      refreshedAt: new Date().toISOString(),
    };
  }

  async ohlc(
    userId: string,
    symbol: string,
    timeframe: string,
    limit?: number,
  ) {
    const canonical = normalizeChartSymbol(symbol?.trim() || '');
    if (!canonical) {
      throw new BadRequestException('symbol is required');
    }
    if (!timeframe?.trim()) {
      throw new BadRequestException('timeframe is required');
    }
    const ctx = await this.requireAccount(userId);
    const bars = await this.metaApi.getHistoricalCandles(
      ctx.account,
      canonical,
      timeframe.trim(),
      Math.min(limit ?? 400, 500),
    );
    return {
      symbol: canonical,
      timeframe: timeframe.trim().toUpperCase(),
      bars,
      source: 'metaapi' as const,
      refreshedAt: new Date().toISOString(),
    };
  }

  async running(userId: string) {
    const terminal = await this.terminal(userId);
    const trades = (terminal.trades ?? []).filter((t) => t.kind === 'running');
    return {
      trades,
      account: terminal.account,
      accountSource: terminal.accountSource,
      stats: {
        runningCount: trades.length,
        floatingProfit: terminal.stats.floatingProfit,
      },
      refreshedAt: terminal.refreshedAt,
    };
  }

  async batchQuotes(userId: string, symbols: string[]) {
    const unique = [
      ...new Set(
        symbols.map((s) => normalizeChartSymbol(s?.trim() || '')).filter(Boolean),
      ),
    ].slice(0, 32);
    if (unique.length === 0) {
      return { items: [], refreshedAt: new Date().toISOString() };
    }
    const ctx = await this.readyAccountOrNull(userId);
    if (!ctx) {
      return { items: [], refreshedAt: new Date().toISOString() };
    }
    const items = await Promise.all(
      unique.map(async (symbol) => {
        try {
          const price = await this.metaApi.getSymbolPrice(ctx.account, symbol);
          const bid = price.bid;
          const ask = price.ask;
          return {
            symbol,
            resolvedSymbol: price.symbol,
            bid,
            ask,
            mid: (bid + ask) / 2,
            spread: ask - bid,
            time: price.time,
          };
        } catch {
          return {
            symbol,
            resolvedSymbol: symbol,
            bid: null,
            ask: null,
            mid: null,
            spread: null,
            time: null,
          };
        }
      }),
    );
    return { items, refreshedAt: new Date().toISOString() };
  }

  async previewOrder(
    userId: string,
    symbolRaw: string,
    directionRaw: string,
    volumeRaw?: number,
  ) {
    const symbol = normalizeChartSymbol(symbolRaw?.trim() || '');
    if (!symbol) throw new BadRequestException('Symbol is required');
    const direction =
      directionRaw?.toUpperCase() === 'SELL'
        ? TradeDirection.SELL
        : directionRaw?.toUpperCase() === 'BUY'
          ? TradeDirection.BUY
          : null;
    if (!direction) {
      throw new BadRequestException('Direction must be BUY or SELL');
    }
    const ctx = await this.requireAccount(userId);
    const price = await this.metaApi.getSymbolPrice(ctx.account, symbol);
    const spec = await this.metaApi.getSymbolSpecification(ctx.account, symbol);
    const digits = spec.digits ?? 5;
    const entry = direction === TradeDirection.BUY ? price.ask : price.bid;
    const pipSize = getPipSize(symbol);
    const slDistance = defaultMt5ChartSlPips(symbol) * pipSize;
    const stopLoss = roundToSymbolDigits(
      direction === TradeDirection.BUY ? entry - slDistance : entry + slDistance,
      digits,
    );
    const takeProfit = roundToSymbolDigits(
      computeOneToOnePrice(direction, entry, entry, stopLoss),
      digits,
    );
    const volume =
      volumeRaw != null && Number.isFinite(volumeRaw) && volumeRaw > 0
        ? volumeRaw
        : 0.01;
    const info = await this.metaApi.getAccountInformation(ctx.account);

    return {
      symbol,
      direction,
      entry,
      stopLoss,
      takeProfit,
      defaultSlPips: defaultMt5ChartSlPips(symbol),
      riskRewardRatio: 1,
      quote: price,
      risk: {
        volume,
        riskPercent: 1,
        riskAmount: Math.abs(entry - stopLoss) * volume,
        estimatedLossAtSl: Math.abs(entry - stopLoss) * volume,
        accountEquity: info.equity,
        currency: info.currency || 'USD',
      },
      refreshedAt: new Date().toISOString(),
    };
  }

  async placeOrder(userId: string, dto: PlaceMt5MarketOrderDto) {
    const ctx = await this.requireAccount(userId);
    const symbol = normalizeChartSymbol(dto.symbol);
    const { trade, price } = await this.metaApi.placeMarketOrder({
      account: ctx.account,
      symbol,
      direction: dto.direction,
      volume: dto.volume ?? 0.01,
      stopLoss: dto.stopLoss,
      takeProfit: dto.takeProfit,
    });
    return {
      status: 'placed',
      signalId: trade.positionId ?? trade.orderId ?? symbol,
      symbol,
      direction: dto.direction,
      entryPrice: dto.direction === TradeDirection.BUY ? price.ask : price.bid,
      stopLoss: dto.stopLoss,
      takeProfit: dto.takeProfit,
      pending: Boolean(trade.orderId && !trade.positionId),
      quote: price,
      risk: {
        volume: dto.volume ?? 0.01,
        riskPercent: 1,
        riskAmount: 0,
        estimatedLossAtSl: 0,
        accountEquity: 0,
        currency: 'USD',
        aiManaged: false,
        notes: [],
      },
      metaApi: {
        accountId: ctx.account.id,
        accountName: ctx.account.name,
        orderId: trade.orderId,
        positionId: trade.positionId,
        message: trade.message,
      },
    };
  }

  async modifyStops(
    userId: string,
    positionId: string,
    dto: ModifyMt5PositionStopsDto,
  ) {
    if (dto.stopLoss === undefined && dto.takeProfit === undefined) {
      throw new BadRequestException('Provide stopLoss and/or takeProfit to update');
    }
    const ctx = await this.requireAccount(userId);
    const positions = await this.metaApi.getPositions(ctx.account);
    const pos = positions.find((p) => p.id === positionId);
    if (pos) {
      const spec = await this.metaApi.getSymbolSpecification(
        ctx.account,
        pos.symbol,
      );
      const nextSl = dto.stopLoss !== undefined ? dto.stopLoss : pos.stopLoss;
      const nextTp =
        dto.takeProfit !== undefined ? dto.takeProfit : pos.takeProfit;
      this.assertStops(
        isSellType(pos.type) ? 'SELL' : 'BUY',
        pos.openPrice,
        dto.stopLoss !== undefined ? nextSl : undefined,
        dto.takeProfit !== undefined ? nextTp : undefined,
      );
      await this.metaApi.modifyPositionStops(ctx.account, {
        positionId,
        stopLoss: nextSl,
        takeProfit: nextTp,
        specDigits: spec.digits,
      });
      return {
        ok: true,
        positionId,
        stopLoss: nextSl ?? null,
        takeProfit: nextTp ?? null,
        message: 'Stop levels updated on broker',
      };
    }

    const orders = await this.metaApi.getOrders(ctx.account);
    const order = orders.find((o) => o.id === positionId);
    if (!order) {
      throw new NotFoundException('Position or pending order not found');
    }
    const spec = await this.metaApi.getSymbolSpecification(
      ctx.account,
      order.symbol,
    );
    const nextSl = dto.stopLoss !== undefined ? dto.stopLoss : order.stopLoss;
    const nextTp =
      dto.takeProfit !== undefined ? dto.takeProfit : order.takeProfit;
    await this.metaApi.modifyPendingOrderStops(ctx.account, {
      orderId: positionId,
      stopLoss: nextSl,
      takeProfit: nextTp,
      specDigits: spec.digits,
    });
    return {
      ok: true,
      positionId,
      stopLoss: nextSl ?? null,
      takeProfit: nextTp ?? null,
      message: 'Pending order stop levels updated on broker',
    };
  }

  async closePosition(userId: string, positionId: string) {
    const ctx = await this.requireAccount(userId);
    const positions = await this.metaApi.getPositions(ctx.account);
    if (positions.some((p) => p.id === positionId)) {
      await this.metaApi.closePositionById(ctx.account, positionId);
      return { ok: true, positionId, status: 'closed' };
    }
    const orders = await this.metaApi.getOrders(ctx.account);
    if (orders.some((o) => o.id === positionId)) {
      await this.metaApi.cancelPendingOrder(ctx.account, positionId);
      return { ok: true, positionId, status: 'cancelled' };
    }
    throw new NotFoundException('Position or pending order not found');
  }

  async closeAll(userId: string) {
    const ctx = await this.requireAccount(userId);
    const positions = await this.metaApi.getPositions(ctx.account);
    const results: {
      symbol: string;
      positionId?: string;
      status: string;
      error?: string;
    }[] = [];
    for (const pos of positions) {
      try {
        await this.metaApi.closePositionById(ctx.account, pos.id);
        results.push({
          symbol: pos.symbol,
          positionId: pos.id,
          status: 'closed',
        });
      } catch (err) {
        results.push({
          symbol: pos.symbol,
          positionId: pos.id,
          status: 'error',
          error: err instanceof Error ? err.message : 'close failed',
        });
      }
    }
    return { ok: true, results };
  }

  private emptyTerminal(message: string) {
    return {
      configured: this.metaApi.isConfigured,
      message,
      accountSource: undefined as 'linked_live' | undefined,
      account: undefined as
        | {
            startingBalance: number;
            currency: string;
            realizedProfit: number;
            floatingProfit: number;
            totalProfit: number;
            equity: number;
          }
        | undefined,
      setups: { items: [] as never[], count: 0, claimableCount: 0 },
      trades: [] as ReturnType<SoloMt5Service['mapPosition']>[],
      history: { items: [] as never[], count: 0 },
      stats: {
        openSetupCount: 0,
        limitCount: 0,
        runningCount: 0,
        floatingProfit: 0,
        historyCount: 0,
      },
      refreshedAt: new Date().toISOString(),
    };
  }

  private mapPosition(pos: MetaApiPosition) {
    const pnl = Number(pos.unrealizedProfit || pos.profit || 0);
    return {
      signalId: null as string | null,
      symbol: pos.symbol,
      direction: isSellType(pos.type) ? 'SELL' : 'BUY',
      kind: 'running' as const,
      status: 'open' as const,
      stopLoss: pos.stopLoss,
      takeProfit: pos.takeProfit,
      volume: pos.volume,
      openPrice: pos.openPrice,
      currentPrice: pos.currentPrice,
      profit: pnl,
      positionId: pos.id,
      canClose: true,
      canAdjustStops: true,
      canPartialClose: pos.volume > 0,
      executionLabel: 'Running on your linked MT5',
    };
  }

  private mapOrder(order: MetaApiOrder) {
    return {
      signalId: null as string | null,
      symbol: order.symbol,
      direction: isSellType(order.type) ? 'SELL' : 'BUY',
      kind: 'limit' as const,
      status: 'pending' as const,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      volume: order.currentVolume ?? order.volume,
      openPrice: order.openPrice,
      currentPrice: order.currentPrice,
      orderId: order.id,
      orderType: order.type,
      canClose: true,
      canAdjustStops: true,
      executionLabel: 'Pending on your linked MT5',
    };
  }

  private assertStops(
    direction: 'BUY' | 'SELL',
    openPrice: number,
    stopLoss?: number,
    takeProfit?: number,
  ) {
    if (stopLoss != null) {
      const ok =
        direction === 'BUY' ? stopLoss < openPrice : stopLoss > openPrice;
      if (!ok) {
        throw new BadRequestException(
          'Stop loss must be below entry for buys and above entry for sells.',
        );
      }
    }
    if (takeProfit != null) {
      const ok =
        direction === 'BUY' ? takeProfit > openPrice : takeProfit < openPrice;
      if (!ok) {
        throw new BadRequestException(
          'Take profit must be above entry for buys and below entry for sells.',
        );
      }
    }
  }

  private async linkedAccountId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metaApiAccountId: true },
    });
    return user?.metaApiAccountId?.trim() || null;
  }

  private async readyAccountOrNull(userId: string): Promise<{
    account: MetaApiAccount;
  } | null> {
    if (!this.metaApi.isConfigured) return null;
    const id = await this.linkedAccountId(userId);
    if (!id) return null;
    try {
      const account = await this.metaApi.ensureAccountReady(id);
      return { account };
    } catch (err) {
      this.logger.warn(
        `Solo MT5 account not ready: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  private async requireAccount(userId: string) {
    if (!this.metaApi.isConfigured) {
      throw new ServiceUnavailableException(
        'Set METAAPI_TOKEN on solo-api to enable live MT5 charts.',
      );
    }
    const id = await this.linkedAccountId(userId);
    if (!id) {
      throw new BadRequestException(
        'Connect your MT5 account first (login, password, server).',
      );
    }
    const account = await this.metaApi.ensureAccountReady(id);
    return { account };
  }
}
