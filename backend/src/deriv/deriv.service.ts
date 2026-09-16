import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { resolveJwtSecret } from '../config/jwt-secret';
import {
  decryptCredential,
  encryptCredential,
} from '../common/credential-crypto.util';
import { DerivWsClient } from './deriv-ws.client';

const transferBuckets = new Map<string, { count: number; resetAt: number }>();

function assertActionRateLimit(userId: string) {
  const now = Date.now();
  const bucket = transferBuckets.get(userId);
  if (!bucket || now > bucket.resetAt) {
    transferBuckets.set(userId, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (bucket.count >= 8) {
    throw new ForbiddenException('Too many Deriv actions. Try again in a minute.');
  }
  bucket.count += 1;
}

function maskToken(token: string): string {
  const t = token.trim();
  if (t.length < 8) return '••••';
  return `${t.slice(0, 4)}••••${t.slice(-2)}`;
}

@Injectable()
export class DerivService {
  private readonly logger = new Logger(DerivService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private cryptoSecret() {
    return resolveJwtSecret(this.config.get<string>('JWT_SECRET'));
  }

  async status(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { derivApiTokenEnc: true, derivConnectedAt: true },
    });
    const connected = Boolean(user?.derivApiTokenEnc);
    return {
      connected,
      connectedAt: user?.derivConnectedAt?.toISOString() ?? null,
      tokenMasked: connected ? '••••••••' : null,
    };
  }

  async saveToken(userId: string, token: string) {
    const trimmed = token.trim();
    if (trimmed.length < 8) {
      throw new BadRequestException('That token looks too short.');
    }

    try {
      const auth = await this.withSession(trimmed, (client) =>
        client.request<{
          authorize?: { loginid?: string; email?: string; balance?: number };
        }>({ authorize: trimmed }),
      );

      const enc = encryptCredential(trimmed, this.cryptoSecret());
      await this.prisma.user.update({
        where: { id: userId },
        data: { derivApiTokenEnc: enc, derivConnectedAt: new Date() },
      });

      this.logger.log(`Deriv token saved for user ${userId}`);
      return {
        connected: true,
        connectedAt: new Date().toISOString(),
        tokenMasked: maskToken(trimmed),
        loginid: auth.authorize?.loginid ?? null,
      };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof ForbiddenException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : 'Could not save Deriv token';
      this.logger.warn(`Deriv saveToken failed: ${msg}`);
      if (/derivApiTokenEnc|Unknown argument|column/i.test(msg)) {
        throw new BadRequestException(
          'Database is missing Deriv columns. Redeploy solo-api so prisma db push runs.',
        );
      }
      throw new BadRequestException(msg);
    }
  }

  async disconnect(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { derivApiTokenEnc: null, derivConnectedAt: null },
    });
    return { connected: false };
  }

  async accounts(userId: string) {
    return this.withUserToken(userId, async (client, token) => {
      await client.request({ authorize: token });
      const [balanceRes, mt5Res] = await Promise.all([
        client.request<{
          balance?: { balance?: number; currency?: string; loginid?: string };
        }>({ balance: 1 }),
        client.request<{
          mt5_login_list?: Array<{
            login?: string;
            balance?: number;
            currency?: string;
            market_type?: string;
            landing_company_short?: string;
            account_type?: string;
            display_balance?: string;
          }>;
        }>({ mt5_login_list: 1 }),
      ]);

      const wallet = balanceRes.balance;
      const mt5 = (mt5Res.mt5_login_list ?? []).map((row) => ({
        login: String(row.login ?? ''),
        kind: 'mt5' as const,
        accountType: row.account_type ?? row.market_type ?? null,
        currency: row.currency ?? 'USD',
        balance: Number(row.balance ?? 0),
      }));

      return {
        wallet: wallet
          ? {
              login: String(wallet.loginid ?? ''),
              kind: 'deriv' as const,
              accountType: 'wallet',
              currency: wallet.currency ?? 'USD',
              balance: Number(wallet.balance ?? 0),
            }
          : null,
        mt5,
      };
    });
  }

  async trades(userId: string) {
    return this.withUserToken(userId, async (client, token) => {
      await client.request({ authorize: token });
      const [portfolioRes, statementRes] = await Promise.all([
        client.request<{
          portfolio?: {
            contracts?: Array<Record<string, unknown>>;
          };
        }>({ portfolio: 1 }),
        client.request<{
          statement?: {
            transactions?: Array<Record<string, unknown>>;
          };
        }>({ statement: 1, limit: 25, offset: 0 }),
      ]);

      return {
        open: portfolioRes.portfolio?.contracts ?? [],
        statement: statementRes.statement?.transactions ?? [],
      };
    });
  }

  async transfer(
    userId: string,
    input: {
      accountFrom: string;
      accountTo: string;
      amount: number;
      currency: string;
    },
  ) {
    assertActionRateLimit(userId);
    if (input.accountFrom === input.accountTo) {
      throw new BadRequestException('Pick two different accounts.');
    }
    return this.withUserToken(userId, async (client, token) => {
      await client.request({ authorize: token });
      const res = await client.request<{
        transfer_between_accounts?: Record<string, unknown>;
      }>({
        transfer_between_accounts: 1,
        account_from: input.accountFrom,
        account_to: input.accountTo,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
      });
      return res.transfer_between_accounts ?? { ok: true };
    });
  }

  async sellContract(userId: string, contractId: string) {
    assertActionRateLimit(userId);
    const id = Number(contractId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException('Invalid contract id.');
    }
    return this.withUserToken(userId, async (client, token) => {
      await client.request({ authorize: token });
      const res = await client.request<{ sell?: Record<string, unknown> }>({
        sell: id,
        price: 0,
      });
      return res.sell ?? { ok: true };
    });
  }

  private async withUserToken<T>(
    userId: string,
    fn: (client: DerivWsClient, token: string) => Promise<T>,
  ): Promise<T> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { derivApiTokenEnc: true },
    });
    if (!user?.derivApiTokenEnc) {
      throw new NotFoundException(
        'Connect a Deriv API token in Settings first.',
      );
    }
    let token: string;
    try {
      token = decryptCredential(user.derivApiTokenEnc, this.cryptoSecret());
    } catch {
      throw new BadRequestException(
        'Saved token could not be decrypted. Save it again in Settings.',
      );
    }
    return this.withSession(token, (client) => fn(client, token));
  }

  private async withSession<T>(
    _token: string,
    fn: (client: DerivWsClient) => Promise<T>,
  ): Promise<T> {
    const { endpoint } = await this.connectionSettings();
    let client: DerivWsClient;
    try {
      client = await DerivWsClient.connect(endpoint);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deriv connection failed';
      throw new BadRequestException(
        `Could not reach Deriv (${msg}). Check DERIV_APP_ID and network.`,
      );
    }
    try {
      return await fn(client);
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof ForbiddenException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Deriv request failed',
      );
    } finally {
      client.close();
    }
  }

  private async connectionSettings() {
    const config = await this.prisma.platformConfig.findUnique({
      where: { id: 'default' },
      select: { derivAppId: true, derivEndpoint: true },
    });
    const appId =
      config?.derivAppId?.trim() ||
      this.config.get<string>('DERIV_APP_ID')?.trim() ||
      '1089';
    const base =
      config?.derivEndpoint?.trim() ||
      this.config.get<string>('DERIV_ENDPOINT')?.trim() ||
      'wss://ws.derivws.com/websockets/v3';
    const endpoint = base.includes('app_id=')
      ? base
      : `${base.replace(/\/$/, '')}?app_id=${encodeURIComponent(appId)}`;
    return { appId, endpoint };
  }
}
