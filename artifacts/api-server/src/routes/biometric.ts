import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/types";
import { eq } from "drizzle-orm";
import { db, employeesTable, biometricCredentialsTable } from "@workspace/db";

const router: IRouter = Router();

const challengeStore = new Map<string, string>();

function getRpInfo(req: Request): { rpID: string; origin: string } {
  const host = (req.get("origin") ?? `https://${req.get("host")}`) as string;
  const url = new URL(host);
  return { rpID: url.hostname, origin: url.origin };
}

router.post("/biometric/register/begin", async (req: Request, res: Response): Promise<void> => {
  const { employeeId } = req.body as { employeeId?: string };
  if (!employeeId) {
    res.status(400).json({ error: "employeeId required" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.employeeId, employeeId));

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const existingCredentials = await db
    .select()
    .from(biometricCredentialsTable)
    .where(eq(biometricCredentialsTable.employeeId, employeeId));

  const { rpID, origin } = getRpInfo(req);
  void origin;

  const options = await generateRegistrationOptions({
    rpName: "Electro Power Attendance",
    rpID,
    userID: new TextEncoder().encode(employee.employeeId),
    userName: employee.employeeId,
    userDisplayName: employee.fullName,
    attestationType: "none",
    excludeCredentials: existingCredentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? (JSON.parse(c.transports) as ("usb" | "ble" | "nfc" | "internal" | "hybrid")[]) : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  challengeStore.set(`reg:${employeeId}`, options.challenge);
  setTimeout(() => challengeStore.delete(`reg:${employeeId}`), 5 * 60 * 1000);

  res.json(options);
});

router.post("/biometric/register/finish", async (req: Request, res: Response): Promise<void> => {
  const { employeeId, credential } = req.body as {
    employeeId?: string;
    credential?: RegistrationResponseJSON;
  };

  if (!employeeId || !credential) {
    res.status(400).json({ error: "employeeId and credential required" });
    return;
  }

  const expectedChallenge = challengeStore.get(`reg:${employeeId}`);
  if (!expectedChallenge) {
    res.status(400).json({ error: "No pending challenge" });
    return;
  }

  const { rpID, origin } = getRpInfo(req);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    res.status(400).json({ error: message });
    return;
  }

  if (!verification.verified || !verification.registrationInfo) {
    res.status(400).json({ error: "Verification failed" });
    return;
  }

  challengeStore.delete(`reg:${employeeId}`);

  const { credential: cred } = verification.registrationInfo;

  await db.insert(biometricCredentialsTable).values({
    employeeId,
    credentialId: cred.id,
    publicKey: Buffer.from(cred.publicKey).toString("base64url"),
    counter: cred.counter,
    transports: credential.response.transports
      ? JSON.stringify(credential.response.transports)
      : null,
  });

  res.json({ verified: true });
});

router.post("/biometric/authenticate/begin", async (req: Request, res: Response): Promise<void> => {
  const { employeeId } = req.body as { employeeId?: string };
  if (!employeeId) {
    res.status(400).json({ error: "employeeId required" });
    return;
  }

  const credentials = await db
    .select()
    .from(biometricCredentialsTable)
    .where(eq(biometricCredentialsTable.employeeId, employeeId));

  if (credentials.length === 0) {
    res.status(404).json({ error: "No biometric registered for this employee" });
    return;
  }

  const { rpID } = getRpInfo(req);

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? (JSON.parse(c.transports) as ("usb" | "ble" | "nfc" | "internal" | "hybrid")[]) : undefined,
    })),
  });

  challengeStore.set(`auth:${employeeId}`, options.challenge);
  setTimeout(() => challengeStore.delete(`auth:${employeeId}`), 5 * 60 * 1000);

  res.json(options);
});

router.post("/biometric/authenticate/finish", async (req: Request, res: Response): Promise<void> => {
  const { employeeId, credential } = req.body as {
    employeeId?: string;
    credential?: AuthenticationResponseJSON;
  };

  if (!employeeId || !credential) {
    res.status(400).json({ error: "employeeId and credential required" });
    return;
  }

  const expectedChallenge = challengeStore.get(`auth:${employeeId}`);
  if (!expectedChallenge) {
    res.status(400).json({ error: "No pending challenge" });
    return;
  }

  const [storedCred] = await db
    .select()
    .from(biometricCredentialsTable)
    .where(eq(biometricCredentialsTable.credentialId, credential.id));

  if (!storedCred) {
    res.status(400).json({ error: "Credential not found" });
    return;
  }

  const { rpID, origin } = getRpInfo(req);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: storedCred.credentialId,
        publicKey: Buffer.from(storedCred.publicKey, "base64url"),
        counter: storedCred.counter,
        transports: storedCred.transports
          ? (JSON.parse(storedCred.transports) as ("usb" | "ble" | "nfc" | "internal" | "hybrid")[])
          : undefined,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    res.status(400).json({ error: message });
    return;
  }

  if (!verification.verified) {
    res.status(400).json({ error: "Biometric verification failed" });
    return;
  }

  await db
    .update(biometricCredentialsTable)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(biometricCredentialsTable.credentialId, storedCred.credentialId));

  challengeStore.delete(`auth:${employeeId}`);

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.employeeId, storedCred.employeeId));

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  res.json(employee);
});

router.post("/biometric/discover/begin", async (req: Request, res: Response): Promise<void> => {
  const { rpID } = getRpInfo(req);
  const discoverKey = randomUUID();

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: [],
  });

  challengeStore.set(`discover:${discoverKey}`, options.challenge);
  setTimeout(() => challengeStore.delete(`discover:${discoverKey}`), 5 * 60 * 1000);

  res.json({ ...options, discoverKey });
});

router.post("/biometric/discover/finish", async (req: Request, res: Response): Promise<void> => {
  const { discoverKey, credential } = req.body as {
    discoverKey?: string;
    credential?: AuthenticationResponseJSON;
  };

  if (!discoverKey || !credential) {
    res.status(400).json({ error: "discoverKey and credential required" });
    return;
  }

  const expectedChallenge = challengeStore.get(`discover:${discoverKey}`);
  if (!expectedChallenge) {
    res.status(400).json({ error: "No pending challenge or it has expired" });
    return;
  }

  const [storedCred] = await db
    .select()
    .from(biometricCredentialsTable)
    .where(eq(biometricCredentialsTable.credentialId, credential.id));

  if (!storedCred) {
    res.status(400).json({ error: "Biometric not recognized. Please enter your Employee ID instead." });
    return;
  }

  const { rpID, origin } = getRpInfo(req);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: storedCred.credentialId,
        publicKey: Buffer.from(storedCred.publicKey, "base64url"),
        counter: storedCred.counter,
        transports: storedCred.transports
          ? (JSON.parse(storedCred.transports) as ("usb" | "ble" | "nfc" | "internal" | "hybrid")[])
          : undefined,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    res.status(400).json({ error: message });
    return;
  }

  if (!verification.verified) {
    res.status(400).json({ error: "Biometric verification failed" });
    return;
  }

  await db
    .update(biometricCredentialsTable)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(biometricCredentialsTable.credentialId, storedCred.credentialId));

  challengeStore.delete(`discover:${discoverKey}`);

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.employeeId, storedCred.employeeId));

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  res.json(employee);
});

router.get("/biometric/status/:employeeId", async (req: Request, res: Response): Promise<void> => {
  const employeeId = req.params.employeeId as string;

  const credentials = await db
    .select()
    .from(biometricCredentialsTable)
    .where(eq(biometricCredentialsTable.employeeId, employeeId));

  res.json({
    registered: credentials.length > 0,
    credentialCount: credentials.length,
  });
});

export default router;
