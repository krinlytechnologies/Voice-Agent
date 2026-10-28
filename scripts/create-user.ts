// Creates a local sign-in account, optionally with a new workspace it owns.
// Run: MONA_PASSWORD='...' npm run user:create -- <email> "<full name>" ["<workspace name>"]
// The password comes from the environment so it does not end up in shell history.
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.ts";

const MIN_PASSWORD_LENGTH = 12;

const [rawEmail, fullName, workspaceName] = process.argv.slice(2);
const password = process.env["MONA_PASSWORD"] ?? "";

if (!rawEmail || !fullName) {
  console.error(
    'Usage: MONA_PASSWORD=... npm run user:create -- <email> "<full name>" ["<workspace name>"]',
  );
  process.exit(1);
}
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`MONA_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  process.exit(1);
}

const email = rawEmail.trim().toLowerCase();
const db = new PrismaClient();

try {
  const passwordHash = await hashPassword(password);
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, fullName: fullName.trim(), passwordHash },
      select: { id: true },
    });
    if (workspaceName) {
      const client = await tx.client.create({
        data: { name: workspaceName.trim() },
        select: { id: true },
      });
      await tx.clientMember.create({
        data: { clientId: client.id, userId: created.id, role: "owner" },
      });
    }
    return created;
  });
  console.log(
    `Created user ${email} (${user.id})${workspaceName ? ` with workspace "${workspaceName.trim()}"` : ""}.`,
  );
} catch (error) {
  if (error instanceof Error && "code" in error && error.code === "P2002") {
    console.error(`A user with email ${email} already exists. Nothing was changed.`);
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await db.$disconnect();
}
