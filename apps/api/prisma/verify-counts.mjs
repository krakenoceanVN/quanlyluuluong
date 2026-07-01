/**
 * Kiểm tra tính đúng của thống kê traffic theo múi giờ nghiệp vụ.
 * In cho từng link: 昨日总量 (DB hôm qua) và 今日实时 (Redis hôm nay, fallback DB),
 * kèm chi tiết theo từng membership để đối chiếu với dữ liệu thô.
 *
 * Chạy trong container:  docker compose exec api node prisma/verify-counts.mjs
 * (hoặc trên host nếu có DATABASE_URL + REDIS_URL trỏ đúng)
 */
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const OFFSET = Number(process.env.BUSINESS_UTC_OFFSET_MIN ?? 480); // UTC+8 mặc định
const dayKey = (d = new Date()) => new Date(d.getTime() + OFFSET * 60000).toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true });

async function main() {
  await redis.connect().catch(() => {});
  const today = dayKey();
  const yesterday = addDays(today, -1);
  console.log(`Múi giờ nghiệp vụ: UTC${OFFSET >= 0 ? '+' : ''}${OFFSET / 60}h  |  hôm nay=${today}  hôm qua=${yesterday}`);
  console.log('='.repeat(78));

  const links = await prisma.link.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    include: { linkAds: { include: { ad: true } } },
  });

  const toDate = (s) => new Date(`${s}T00:00:00.000Z`);
  let gY = 0;
  let gT = 0;

  for (const l of links) {
    if (l.linkAds.length === 0) continue;
    const ids = l.linkAds.map((m) => m.id);

    const yRows = await prisma.trafficDaily.findMany({ where: { linkAdId: { in: ids }, date: toDate(yesterday) } });
    const tRows = await prisma.trafficDaily.findMany({ where: { linkAdId: { in: ids }, date: toDate(today) } });
    const yDb = new Map(yRows.map((r) => [r.linkAdId, r.count]));
    const tDb = new Map(tRows.map((r) => [r.linkAdId, r.count]));

    let yTotal = 0;
    let tTotal = 0;
    const lines = [];
    for (const m of l.linkAds) {
      const rRaw = await redis.get(`flow:${m.id}:${today}`);
      const todayVal = rRaw !== null ? Number(rRaw) : (tDb.get(m.id) ?? 0); // giống getTodayMap
      const yVal = yDb.get(m.id) ?? 0;
      yTotal += yVal;
      tTotal += todayVal;
      lines.push(
        `    - ${m.ad.name.padEnd(12)} 昨日=${String(yVal).padStart(8)}  今日=${String(todayVal).padStart(8)}` +
          `  [redis=${rRaw ?? '·'} dbToday=${tDb.get(m.id) ?? 0}]`,
      );
    }
    gY += yTotal;
    gT += tTotal;
    console.log(`${l.name}  (${l.status ? 'online' : 'offline'})`);
    console.log(`  => 昨日总量=${yTotal}   今日实时=${tTotal}`);
    lines.forEach((x) => console.log(x));
  }

  console.log('='.repeat(78));
  console.log(`TỔNG tất cả link: 昨日总量=${gY}   今日实时=${gT}`);
  await prisma.$disconnect();
  redis.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
