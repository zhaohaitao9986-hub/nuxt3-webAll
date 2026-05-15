const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const totalCount = await prisma.trafficLog.count();
    const last10 = await prisma.trafficLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        type: true,
        url: true,
        uid: true,
        sid: true,
        utmSource: true,
      }
    });

    const typeDistribution = await prisma.trafficLog.groupBy({
      by: ['type'],
      _count: {
        type: true
      }
    });

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24hCount = await prisma.trafficLog.count({
      where: {
        createdAt: {
          gte: oneDayAgo
        }
      }
    });

    process.stdout.write(JSON.stringify({
      totalCount,
      last10,
      typeDistribution,
      last24hCount
    }, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

  } catch (e) {
    console.error(e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
