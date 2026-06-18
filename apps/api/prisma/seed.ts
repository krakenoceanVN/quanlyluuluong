import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Date (UTC midnight) N days before today. */
function dayOffset(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (existing) {
    console.log('[seed] admin user already present — skipping seed (idempotent).');
    return;
  }

  console.log('[seed] seeding fresh demo data…');

  // ── User ── (password can be overridden via ADMIN_PASSWORD for production)
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  await prisma.user.create({
    data: {
      username: adminUsername,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: Role.ADMIN,
    },
  });

  // ── Trackers (统计) ──
  const tracker1 = await prisma.tracker.create({
    data: {
      name: '11-02-01',
      description: '51la_v6',
      code: '<script src="//js.users.51.la/xxxx1.js"></script>',
    },
  });
  const tracker2 = await prisma.tracker.create({
    data: {
      name: '11-02-02',
      description: '51la_v6',
      code: '<script src="//js.users.51.la/xxxx2.js"></script>',
    },
  });

  // ── Ads (广告) ──
  const adData = [
    { name: 'sm-251', targetUrl: 'https://aj02.opnews.net', description: 'sly-0517上线', status: true },
    { name: 'sm-bz13', targetUrl: 'https://aj03.opnews.net', description: 'bz-0427上线', status: true },
    { name: 'sm-gy168', targetUrl: 'https://aj05.opnews.net', description: 'sly-0517上线', status: true },
    { name: 'sm-bz14', targetUrl: 'https://aj06.opnews.net', description: 'bz-0427上线', status: false },
    { name: 'sm-631', targetUrl: 'https://aj08.opnews.net', description: 'xy-0307上线', status: true },
    { name: 'sm-xh174', targetUrl: 'https://aj09.opnews.net', description: 'xh-0520上线', status: true },
  ];
  const ads = [];
  for (const a of adData) ads.push(await prisma.ad.create({ data: a }));

  // ── Links (广告单链接) ──
  const link1 = await prisma.link.create({
    data: {
      name: '11-02-01',
      description: 'android-天气',
      note: '1000-541-238',
      shortCode: 'o702jib0',
      status: true,
      trackers: { create: [{ trackerId: tracker1.id }] },
    },
  });
  const link2 = await prisma.link.create({
    data: {
      name: '11-02-02',
      description: 'android-天气',
      note: '1000-532-219',
      shortCode: '0s94k1ss',
      status: true,
      trackers: { create: [{ trackerId: tracker2.id }] },
    },
  });

  // ── LinkAd memberships (link1 gets two ads) ──
  const la1 = await prisma.linkAd.create({
    data: {
      linkId: link1.id,
      adId: ads[0].id, // sm-251
      weight: 50,
      dailyLimit: 50000,
      note: 'sly-0517上线',
      status: true,
      sortOrder: 0,
    },
  });
  const la2 = await prisma.linkAd.create({
    data: {
      linkId: link1.id,
      adId: ads[1].id, // sm-bz13
      weight: 50,
      dailyLimit: 50000,
      note: 'bz-0427上线',
      status: true,
      sortOrder: 1,
    },
  });

  // ── TrafficDaily: last 7 days for link1's two memberships ──
  for (const la of [la1, la2]) {
    for (let n = 6; n >= 0; n--) {
      const base = 42000 + Math.floor(Math.random() * 8000);
      // today (n=0) is partial
      const count = n === 0 ? Math.floor(base * 0.6) : base;
      await prisma.trafficDaily.create({
        data: { linkAdId: la.id, date: dayOffset(n), count },
      });
    }
  }

  // keep link2 empty (mirrors prototype: "暂无广告")
  void link2;

  console.log(`[seed] done. Login with ${adminUsername} / ${adminPassword === 'admin123' ? 'admin123 (đổi ngay ở production!)' : '(mật khẩu từ ADMIN_PASSWORD)'}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
