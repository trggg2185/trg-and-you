import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername) {
    console.warn(
      "ADMIN_USERNAME is not set in environment. Skipping admin seed."
    );
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (existing) {
    // Keep ADMIN role, but NEVER overwrite passwordHash if user already linked Google!
    if (existing.googleId) {
      if (existing.role !== "ADMIN") {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: "ADMIN" },
        });
      }
      console.log(
        `Admin user "${adminUsername}" is already linked with Google. Keeping passwordless Google auth.`
      );
      return;
    }

    if (adminPassword) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: "ADMIN",
        },
      });
      console.log(`Updated unlinked ADMIN user: ${adminUsername}`);
    }
    return;
  }

  if (!adminPassword) {
    console.warn(
      "ADMIN_PASSWORD is not set for initial admin bootstrap. Skipping admin seed."
    );
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.create({
    data: {
      username: adminUsername,
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`Created bootstrap ADMIN user: ${adminUsername}`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
