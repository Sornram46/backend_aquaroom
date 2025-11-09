/* เติม slug ให้ categories ที่ยังว่าง และให้ slug ไม่ซ้ำ */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function slugify(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')            // ลบเครื่องหมายกำกับเสียง
    .replace(/[^a-z0-9ก-๙\s-]/g, '')          // อนุญาตตัวอักษร/ตัวเลข/ไทย/เว้นวรรค/ขีด
    .replace(/\s+/g, '-')                      // เว้นวรรค -> ขีด
    .replace(/-+/g, '-')                       // ลดขีดซ้ำ
    .replace(/^-+|-+$/g, '')                   // ตัดขีดหัวท้าย
    .substring(0, 255);
}

(async () => {
  try {
    const cats = await prisma.categories.findMany({ orderBy: { id: 'asc' } });
    for (const c of cats) {
      if (!c.slug || !c.slug.trim()) {
        const base = slugify(c.name) || `cat-${c.id}`;
        let candidate = base;
        let i = 1;
        while (await prisma.categories.findFirst({ where: { slug: candidate } })) {
          candidate = `${base}-${i++}`;
        }
        await prisma.categories.update({ where: { id: c.id }, data: { slug: candidate } });
        console.log(`Set slug ${c.id}: ${c.name} -> ${candidate}`);
      }
    }
    console.log('Done backfill slugs.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();