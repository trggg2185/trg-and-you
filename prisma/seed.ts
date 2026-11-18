import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    console.warn(
      "ADMIN_USERNAME or ADMIN_PASSWORD is not set in environment. Skipping admin seed."
    );
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  if (existing) {
    await prisma.user.update({
      where: { username: adminUsername },
      data: {
        passwordHash,
        role: "ADMIN",
      },
    });
    console.log(`Updated existing ADMIN user: ${adminUsername}`);
  } else {
    await prisma.user.create({
      data: {
        username: adminUsername,
        passwordHash,
        role: "ADMIN",
      },
    });
    console.log(`Created ADMIN user: ${adminUsername}`);
  }
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
