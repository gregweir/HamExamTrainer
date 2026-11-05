/**
 * Progress store — IndexedDB, keyed by content identity (see ident.ts).
 *
 * Layered strictly: storage (IndexedDB) + records + exam sessions + settings.
 * NO scheduling math here (that's sm2.ts, pure): recordAnswer carries the
 * caller-computed schedule fields.
 */

import { openDB, type IDBPDatabase } from 'idb';

/** One question's spaced-repetition state. */
export interface ProgressRecord {
  identity: string;
  /** SM-2 correctness factor (ident.ts identity → record). */
  ease: number;
  intervalDays: number;
  dueAt: number; // epoch ms
  attempts: number;
  correctCount: number;
  wrongCount: number;
  lastStudiedAt: number;
}

/** One submitted mock exam's verdict, for the exam history list. */
export interface ExamAttempt {
  /** Key: the session's startedAt epoch ms (one verdict per session). */
  id: number;
  bank: string;
  submittedAt: number;
  correct: number;
  total: number;
  /** Whole percent, floor-truncated the way real exams count. */
  percent: number;
  passed: boolean;
  honours?: boolean;
}

/** Caller-supplied schedule fields (computed by sm2.nextSchedule). */
export interface ScheduleUpdate {
  ease?: number;
  intervalDays: number;
  dueAt: number;
}

/** A resumable mock-exam session. */
export interface ExamSession {
  bank: string;
  startedAt: number;
  savedAt: number;
  position: number; // index into questionIdentities the user is on
  questionIdentities: string[];
  answers: (number | null)[]; // chosen choice index per question
}

export interface ExportBundle {
  version: 1;
  records: Record<string, ProgressRecord>;
  examSessions: ExamSession[];
  attempts: ExamAttempt[];
  settings: Record<string, unknown>;
}


export class ProgressStore {
  private readonly dbName: string;
  private db: IDBPDatabase | null = null;
  private opening: Promise<IDBPDatabase> | null = null;

  constructor(dbName = 'hamexam-trainer') {
    this.dbName = dbName;
  }

  private async get(): Promise<IDBPDatabase> {
    if (this.db) return this.db;
    this.opening ??= openDB(this.dbName, 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('records', { keyPath: 'identity' });
          db.createObjectStore('sessions', { keyPath: 'bank' });
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('attempts', { keyPath: 'id' });
        }
      },
    });
    this.db = await this.opening;
    return this.db;
  }

  /** Wipe this database outright. Works before any open (no prior get() needed). */
  async reset(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.opening = null;
    }
    if (typeof indexedDB !== 'undefined' && indexedDB.deleteDatabase) {
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(this.dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    }
  }

  async getRecord(identity: string): Promise<ProgressRecord | null> {
    const db = await this.get();
    return (await db.get('records', identity)) ?? null;
  }

  async recordAnswer(identity: string, correct: boolean, at: number, schedule?: ScheduleUpdate): Promise<void> {
    const db = await this.get();
    const existing = ((await db.get('records', identity)) ?? null) as ProgressRecord | null;
    const next: ProgressRecord = {
      identity,
      ease: schedule?.ease ?? existing?.ease ?? 2.5,
      intervalDays: schedule?.intervalDays ?? existing?.intervalDays ?? 0,
      dueAt: schedule?.dueAt ?? (at + 1), // no schedule: due soon by default
      attempts: (existing?.attempts ?? 0) + 1,
      correctCount: (existing?.correctCount ?? 0) + (correct ? 1 : 0),
      wrongCount: (existing?.wrongCount ?? 0) + (correct ? 0 : 1),
      lastStudiedAt: at,
    };
    await db.put('records', next);
  }

  /** Questions from one bank whose dueAt <= now, earliest first. */
  async dueQueue(bank: string, limit: number, now: number): Promise<ProgressRecord[]> {
    const db = await this.get();
    const all = (await db.getAll('records')) as ProgressRecord[];
    return all
      .filter(r => r.identity.startsWith(bank + ':') && r.dueAt <= now)
      .sort((a, b) => a.dueAt - b.dueAt)
      .slice(0, limit);
  }

  /** Every stored record for one bank (identity keys are "<bank>:..."), for aggregation. */
  async bankRecords(bank: string): Promise<ProgressRecord[]> {
    const db = await this.get();
    return ((await db.getAll('records')) as ProgressRecord[])
      .filter(r => r.identity.startsWith(bank + ':'));
  }

  async saveExamSession(session: ExamSession): Promise<void> {
    const db = await this.get();
    await db.put('sessions', { ...session, savedAt: Date.now() });
  }

  async loadExamSession(bank: string): Promise<ExamSession | null> {
    const db = await this.get();
    return (await db.get('sessions', bank)) ?? null;
  }

  async clearExamSession(bank: string): Promise<void> {
    const db = await this.get();
    await db.delete('sessions', bank);
  }

  /** Persist one submitted mock exam's verdict (keyed by session start time). */
  async saveExamAttempt(attempt: ExamAttempt): Promise<void> {
    const db = await this.get();
    await db.put('attempts', attempt);
  }

  /** One bank's verdicts, newest first (by submittedAt), at most `limit`. */
  async bankAttempts(bank: string, limit = 10): Promise<ExamAttempt[]> {
    const db = await this.get();
    return ((await db.getAll('attempts')) as unknown as ExamAttempt[])
      .filter(a => a.bank === bank)
      .sort((a, b) => b.submittedAt - a.submittedAt)
      .slice(0, limit);
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    const db = await this.get();
    await db.put('settings', { key, value });
  }

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const db = await this.get();
    const row = await db.get('settings', key);
    return row ? (row.value as T) : fallback;
  }

  /** Portable export for device moves (user-owned JSON). */
  async exportAll(): Promise<ExportBundle> {
    const db = await this.get();
    const records: Record<string, ProgressRecord> = {};
    for (const r of (await db.getAll('records')) as ProgressRecord[]) {
      records[r.identity] = r;
    }
    return {
      version: 1,
      records,
      examSessions: (await db.getAll('sessions')) as ExamSession[],
      attempts: (await db.getAll('attempts')) as ExamAttempt[],
      settings: Object.fromEntries(
        ((await db.getAll('settings')) as { key: string; value: unknown }[]).map(s => [s.key, s.value])
      ),
    };
  }

  async importAll(bundle: ExportBundle): Promise<void> {
    const db = await this.get();
    if (bundle.version !== 1) throw new Error(`Unsupported export version: ${bundle.version}`);
    for (const r of Object.values(bundle.records ?? {})) {
      await db.put('records', r);
    }
    for (const s of bundle.examSessions ?? []) {
      await db.put('sessions', s);
    }
    for (const a of bundle.attempts ?? []) {
      await db.put('attempts', a);
    }
    for (const [key, value] of Object.entries(bundle.settings ?? {})) {
      await db.put('settings', { key, value });
    }
  }
}
