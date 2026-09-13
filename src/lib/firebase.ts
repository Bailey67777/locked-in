import { getApps, initializeApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

/** A private path segment. Anyone without it cannot guess where your data lives. */
export const DATA_KEY = process.env.NEXT_PUBLIC_DATA_KEY || "default";
export const DATA_PATH = `spaces/${DATA_KEY}`;

export const cloudConfigured = Boolean(databaseURL);

let db: Database | null = null;

export function getDb(): Database | null {
  if (!databaseURL) return null;
  if (db) return db;
  const options: Record<string, string> = { databaseURL };
  if (apiKey) options.apiKey = apiKey;
  if (projectId) options.projectId = projectId;
  const app = getApps()[0] ?? initializeApp(options);
  db = getDatabase(app);
  return db;
}
