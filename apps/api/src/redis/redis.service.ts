import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger('Redis');
  readonly client: Redis;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
    this.client.on('error', (e) => this.logger.error(`redis error: ${e.message}`));
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
