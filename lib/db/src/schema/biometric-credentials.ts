import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const biometricCredentialsTable = pgTable("biometric_credentials", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: text("transports"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BiometricCredential = typeof biometricCredentialsTable.$inferSelect;
