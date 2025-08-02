// import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();

// async function main() {
//   await prisma.product.create({
//     data: {
//       name: 'ปลาทอง',
//       description: 'ปลาทองสวยงาม',
//       price: 250.00,
//       category: 'ปลาสวยงาม', 
//       stock: 10,
//       imageUrl: '/images/goldfish.jpg'
//     }
//   });
  
//   console.log('เพิ่มข้อมูลทดสอบแล้ว');
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });