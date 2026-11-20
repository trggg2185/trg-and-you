import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1. If any SUPERADMIN already exists, keep everything untouched (never create duplicates).
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: "SUPERADMIN" },
    select: { id: true, username: true },
  });

  if (existingSuperAdmin) {
    console.log(
      `Existing SUPERADMIN account "${existingSuperAdmin.username}" found. Skipping seed.`
    );
    return;
  }

  // 2. Migration path for existing deployments: promote the primary (oldest) ADMIN to SUPERADMIN.
  const primaryAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true },
  });

  if (primaryAdmin) {
    await prisma.user.update({
      where: { id: primaryAdmin.id },
      data: { role: "SUPERADMIN" },
    });
    console.log(
      `Promoted primary ADMIN "${primaryAdmin.username}" to SUPERADMIN.`
    );
    return;
  }

  // 3. Brand-new empty DB bootstrap: create the initial SUPERADMIN.
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminUsername = process.env.ADMIN_USERNAME?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail) {
    const byEmail = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (byEmail) {
      await prisma.user.update({
        where: { id: byEmail.id },
        data: { role: "SUPERADMIN" },
      });
      console.log(`Promoted existing Google user "${byEmail.username}" to SUPERADMIN.`);
      return;
    }

    const fallbackName =
      adminUsername ||
      adminEmail
        .split("@")[0]
        .replace(/[^a-zA-Z0-9_.-]+/g, "_")
        .slice(0, 28) ||
      "superadmin";

    await prisma.user.create({
      data: {
        username: fallbackName,
        email: adminEmail,
        passwordHash: null,
        role: "SUPERADMIN",
      },
    });
    console.log(`Created Google-ready SUPERADMIN user: ${fallbackName} (${adminEmail})`);
    return;
  }

  if (!adminUsername || !adminPassword) {
    console.warn(
      "ADMIN_USERNAME or ADMIN_PASSWORD is not set in environment. Skipping superadmin seed."
    );
    return;
  }

  const existingByUsername = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  if (existingByUsername) {
    await prisma.user.update({
      where: { id: existingByUsername.id },
      data: {
        role: "SUPERADMIN",
        ...(existingByUsername.googleId ? {} : { passwordHash }),
      },
    });
    console.log(`Promoted existing user "${adminUsername}" to SUPERADMIN.`);
    return;
  }

  await prisma.user.create({
    data: {
      username: adminUsername,
      passwordHash,
      role: "SUPERADMIN",
    },
  });
  console.log(`Created bootstrap SUPERADMIN user: ${adminUsername}`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
