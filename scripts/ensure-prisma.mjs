import fs from "fs";
import path from "path";
import { execSync } from "child_process";

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, "");
  }
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return "";
  const content = fs.readFileSync(envPath, "utf8");
  const match = content.match(/^DATABASE_URL\s*=\s*(.+)$/m);
  if (!match) return "";
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function getGeneratedSchema() {
  const generatedPath = path.join(
    process.cwd(),
    "node_modules",
    ".prisma",
    "client",
    "schema.prisma"
  );
  if (!fs.existsSync(generatedPath)) return "";
  return fs.readFileSync(generatedPath, "utf8").trim();
}

function clientPointsToPrismaDir() {
  const indexPath = path.join(
    process.cwd(),
    "node_modules",
    ".prisma",
    "client",
    "index.js"
  );
  if (!fs.existsSync(indexPath)) return false;
  const content = fs.readFileSync(indexPath, "utf8");
  return /"relativePath"\s*:\s*"\.\.\/\.\.\/prisma"/.test(content);
}

const dbUrl = readDatabaseUrl();
const isSqlite = dbUrl.startsWith("file:");
const mainSchemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const mainSchema = fs.readFileSync(mainSchemaPath, "utf8");

if (isSqlite) {
  // Put temp SQLite schema inside prisma/ so relative "file:./dev.db" resolves to prisma/dev.db
  const sqliteSchemaPath = path.join(
    process.cwd(),
    "prisma",
    ".sqlite-schema.prisma"
  );
  const sqliteContent = mainSchema.replace(
    /provider\s*=\s*"postgresql"/,
    'provider = "sqlite"'
  );

  fs.writeFileSync(sqliteSchemaPath, sqliteContent, "utf8");

  execSync(`npx prisma db push --skip-generate --schema="${sqliteSchemaPath}"`, {
    stdio: "inherit",
  });

  if (
    getGeneratedSchema() !== sqliteContent.trim() ||
    !clientPointsToPrismaDir()
  ) {
    try {
      execSync(`npx prisma generate --schema="${sqliteSchemaPath}"`, {
        stdio: "inherit",
      });
    } catch (err) {
      console.error(
        "\n[ensure-prisma] Không thể ghi đè Prisma Client do `npm run dev` đang chạy giữ file DLL. Hãy nhấn Ctrl+C tắt server rồi chạy lại `npm run dev`.\n"
      );
      throw err;
    }
  }
} else if (
  getGeneratedSchema() !== mainSchema.trim() ||
  !clientPointsToPrismaDir()
) {
  execSync("npx prisma generate", { stdio: "inherit" });
}
