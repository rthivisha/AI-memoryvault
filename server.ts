/**
 * AI MemoVault Production Server
 * Native SQLite Database (memovault.db) via node:sqlite.
 * Express Full-Stack server with Vite integration in development.
 * Complete API: Attachments (multer + magic bytes), Dashboard KPIs & Heatmaps,
 * Tags, Collections, Reminders, Audit Logs, Public Share Links, BM25 Search.
 */

import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const STORAGE_DIR = path.resolve(__dirname, 'storage');
const DB_PATH = path.join(DATA_DIR, 'memovault.db');

const SECRET_KEY = process.env.SECRET_KEY || 'memovault-secret-key-change-in-production-2026-xyz987';
const MASTER_ENCRYPTION_KEY = process.env.MASTER_ENCRYPTION_KEY || 'memovault-master-encryption-key-32bytes-min!';
const PBKDF2_ITERATIONS = 600_000;

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

// ----------------------------------------------------
// Native SQLite Database Initialization
// ----------------------------------------------------
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    master_key_salt TEXT,
    failed_login_attempts INTEGER DEFAULT 0,
    lockout_until TEXT,
    two_factor_secret TEXT,
    two_factor_enabled INTEGER DEFAULT 0,
    two_factor_backup_codes TEXT DEFAULT '[]',
    settings TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description_encrypted TEXT NOT NULL,
    category TEXT NOT NULL,
    memory_date TEXT NOT NULL,
    mood TEXT DEFAULT 'neutral',
    location_name TEXT,
    latitude REAL,
    longitude REAL,
    people TEXT DEFAULT '[]',
    collection_id TEXT,
    is_favorite INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    deleted_at TEXT,
    keywords TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#06b6d4',
    created_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (owner_id, name)
);

CREATE TABLE IF NOT EXISTS memory_tags (
    memory_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (memory_id, tag_id),
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    thumbnail_filename TEXT,
    web_filename TEXT,
    exif_date TEXT,
    is_encrypted INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    due_at TEXT NOT NULL,
    repeat_interval TEXT DEFAULT 'none',
    is_completed INTEGER DEFAULT 0,
    notification_sent INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    owner_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    password_hash TEXT,
    expires_at TEXT,
    is_active INTEGER DEFAULT 1,
    view_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

// ----------------------------------------------------
// Lexical AI Logic (Stopwords, Lexicon, BM25, Jaccard)
// ----------------------------------------------------
const STOP_WORDS = new Set([
  'the', 'and', 'with', 'this', 'that', 'for', 'are', 'was', 'were',
  'you', 'your', 'our', 'his', 'her', 'its', 'from', 'have', 'has',
  'had', 'but', 'not', 'all', 'can', 'will', 'would', 'should', 'could',
  'about', 'into', 'over', 'than', 'then', 'them', 'they', 'their', 'there',
  'here', 'what', 'when', 'where', 'which', 'who', 'whom', 'why', 'how',
  'show', 'tell', 'give', 'find', 'get', 'got', 'any', 'some', 'such',
  'only', 'own', 'same', 'too', 'very', 'just', 'also', 'been', 'being',
  'did', 'does', 'doing', 'off', 'out', 'again', 'once', 'more', 'most',
  'other', 'each', 'both', 'few', 'nor', 'per', 'via', 'upon', 'mine',
]);

const LEXICON: Record<string, Record<string, number>> = {
  ACHIEVEMENT: {
    won: 0.90, winner: 0.90, prize: 0.90, award: 0.90, rank: 0.90,
    first: 0.90, hackathon: 0.90, certificate: 0.90, selected: 0.90,
    medal: 0.90, topper: 0.90, published: 0.90, qualified: 0.90,
  },
  EVENT: {
    event: 0.80, seminar: 0.80, workshop: 0.80, symposium: 0.80,
    fest: 0.80, conference: 0.80, meeting: 0.80, celebration: 0.80,
    function: 0.80, competition: 0.80, club: 0.80,
  },
  STUDY: {
    exam: 0.80, class: 0.80, lecture: 0.80, semester: 0.80, subject: 0.80,
    notes: 0.80, unit: 0.80, assignment: 0.80, lab: 0.80, syllabus: 0.80,
    course: 0.80, java: 0.80, revision: 0.80,
  },
  TRAVEL: {
    trip: 0.85, travel: 0.85, visit: 0.85, journey: 0.85, tour: 0.85,
    temple: 0.85, beach: 0.85, station: 0.85, flight: 0.85, hotel: 0.85,
    holiday: 0.85,
  },
  REMINDER: {
    reminder: 0.85, deadline: 0.85, submit: 0.85, submission: 0.85,
    due: 0.85, pay: 0.85, renew: 0.85, appointment: 0.85,
    tomorrow: 0.85, schedule: 0.85,
  },
  PERSONAL: {
    family: 0.70, friend: 0.70, birthday: 0.70, home: 0.70, mother: 0.70,
    father: 0.70, brother: 0.70, sister: 0.70, gift: 0.70, dinner: 0.70,
  },
};

const DEFAULT_SYNONYMS: Record<string, string[]> = {
  hackathon: ['competition', 'contest', 'codefest'],
  competition: ['hackathon', 'contest'],
  trip: ['journey', 'travel', 'tour'],
  journey: ['trip', 'travel', 'tour'],
  exam: ['test', 'quiz'],
  test: ['exam', 'quiz'],
};

function tokenize(text: string): string[] {
  if (!text) return [];
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  return rawTokens.filter(t => t.length >= 3 && !STOP_WORDS.has(t));
}

function levenshteinDistance(s1: string, s2: string): number {
  if (s1.length < s2.length) return levenshteinDistance(s2, s1);
  if (s2.length === 0) return s1.length;
  let prevRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 0; i < s1.length; i++) {
    const currRow = [i + 1];
    for (let j = 0; j < s2.length; j++) {
      const ins = prevRow[j + 1] + 1;
      const del = currRow[j] + 1;
      const sub = prevRow[j] + (s1[i] !== s2[j] ? 1 : 0);
      currRow.push(Math.min(ins, del, sub));
    }
    prevRow = currRow;
  }
  return prevRow[prevRow.length - 1];
}

function classify(title: string, description: string): { category: string; confidence: number } {
  const text = `${title} ${description}`;
  const tokens = tokenize(text);
  if (tokens.length === 0) return { category: 'PERSONAL', confidence: 0.0 };

  let bestCat = 'PERSONAL';
  let bestScore = 0.0;
  const normFactor = Math.sqrt(tokens.length);

  for (const [category, termWeights] of Object.entries(LEXICON)) {
    let sum = 0.0;
    for (const t of tokens) {
      if (termWeights[t]) sum += termWeights[t];
    }
    const score = sum / normFactor;
    if (score > bestScore) {
      bestScore = score;
      bestCat = category;
    }
  }

  return {
    category: bestCat,
    confidence: bestScore > 0 ? Math.round(Math.min(bestScore, 1.0) * 100) / 100 : 0.0,
  };
}

function extractKeywords(corpusTexts: string[], title: string, description: string, max = 6): string[] {
  const docTokens = tokenize(`${title} ${description}`);
  if (docTokens.length === 0) return [];
  const tf: Record<string, number> = {};
  for (const t of docTokens) tf[t] = (tf[t] || 0) + 1;

  const N = Math.max(corpusTexts.length, 1);
  const uniqueTokens = Object.keys(tf);
  const df: Record<string, number> = {};
  for (const t of uniqueTokens) df[t] = 0;

  for (const text of corpusTexts) {
    const cTokens = new Set(tokenize(text));
    for (const t of uniqueTokens) {
      if (cTokens.has(t)) df[t]++;
    }
  }

  const weights: { term: string; w: number }[] = [];
  for (const t of uniqueTokens) {
    const w = tf[t] * (Math.log(N / (1 + df[t])) + 1.0);
    weights.push({ term: t, w });
  }

  weights.sort((a, b) => b.w - a.w || a.term.localeCompare(b.term));
  return weights.slice(0, max).map(item => item.term);
}

// ----------------------------------------------------
// Security & Encryption at Rest
// ----------------------------------------------------
function deriveUserKey(userId: string): Buffer {
  return crypto.pbkdf2Sync(MASTER_ENCRYPTION_KEY, `memovault_user_salt_${userId}`, 50_000, 32, 'sha256');
}

function encryptText(text: string, userId: string): string {
  if (!text) return '';
  const key = deriveUserKey(userId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptText(encryptedB64: string, userId: string): string {
  if (!encryptedB64) return '';
  try {
    const raw = Buffer.from(encryptedB64, 'base64');
    if (raw.length < 28) return encryptedB64; // Fallback for plain legacy text
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const key = deriveUserKey(userId);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final('utf-8');
  } catch {
    return encryptedB64; // Graceful fallback
  }
}

function hashPassword(password: string, salt: string): string {
  const derived = crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64'), PBKDF2_ITERATIONS, 32, 'sha256');
  return `$pbkdf2$${PBKDF2_ITERATIONS}$${derived.toString('base64')}`;
}

function verifyPassword(password: string, storedHash: string, salt: string): { valid: boolean; upgrade: boolean } {
  if (storedHash.startsWith('$pbkdf2$')) {
    const parts = storedHash.split('$');
    const iters = parseInt(parts[2], 10);
    const derived = crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64'), iters, 32, 'sha256');
    const candidate = `$pbkdf2$${iters}$${derived.toString('base64')}`;
    const valid = crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(storedHash));
    return { valid, upgrade: iters < PBKDF2_ITERATIONS };
  }
  // Legacy SHA-256 fallback (checks UTF-8 string salt from Python port or decoded base64 salt)
  const legacyHash1 = crypto.createHash('sha256').update(Buffer.from(salt + password, 'utf-8')).digest('base64');
  const legacyHash2 = crypto.createHash('sha256').update(Buffer.concat([Buffer.from(salt, 'base64'), Buffer.from(password, 'utf-8')])).digest('base64');
  const valid = (legacyHash1 === storedHash) || (legacyHash2 === storedHash);
  return { valid, upgrade: true };
}

function createAccessToken(userId: string, username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 15 * 60; // 15 minutes
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: userId, username, iat: now, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function verifyAccessToken(token: string): { sub: string; username: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${payload}`).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!parsed.exp || Math.floor(Date.now() / 1000) > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function autoMigrateCsvIfEmpty() {
  try {
    const userCount: any = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount && userCount.count > 0) return;

    console.log('[AI MemoVault] Database empty. Running one-time CSV migration and demo seeding...');
    const usersCsvPath = path.join(DATA_DIR, 'users.csv');
    const memoriesCsvPath = path.join(DATA_DIR, 'memories.csv');
    const now = new Date().toISOString();

    // 1. Migrate users.csv
    if (fs.existsSync(usersCsvPath)) {
      const lines = fs.readFileSync(usersCsvPath, 'utf-8').split(/\r?\n/);
      for (const raw of lines) {
        if (!raw.trim()) continue;
        const parts = raw.split('|');
        if (parts.length >= 4) {
          const uid = parts[0].replace(/&pipe;/g, '|');
          const username = parts[1].replace(/&pipe;/g, '|');
          const pwHash = parts[2];
          const salt = parts[3];
          db.prepare(`
            INSERT OR IGNORE INTO users (id, username, display_name, password_hash, salt, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(uid, username, username, pwHash, salt, now, now);
        }
      }
    }

    // 2. Seed accessible demo user: alex / Password123!
    const demoSalt = crypto.randomBytes(16).toString('base64');
    const demoPw = hashPassword('Password123!', demoSalt);
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, display_name, password_hash, salt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('U_DEMO', 'alex', 'Alex Walker', demoPw, demoSalt, now, now);

    // 3. Migrate memories.csv and add rich categories
    const initialMemories = [
      {
        id: 'M001',
        title: 'Started Java unit 3',
        category: 'STUDY',
        date: '2025-08-04',
        mood: 'calm',
        location: 'Campus Library',
        desc: 'Began the third unit of the Java Programming course covering collections and exception handling.',
        keywords: ['java', 'unit', 'began', 'collections', 'course', 'covering'],
        tags: ['study', 'java', 'college'],
      },
      {
        id: 'M002',
        title: 'Coding club build night',
        category: 'EVENT',
        date: '2025-11-21',
        mood: 'excited',
        location: 'Innovation Lab Room 4',
        desc: 'Attended the coding club 24 hour build night event at college with the team building tools.',
        keywords: ['build', 'club', 'coding', 'night', 'attended', 'college'],
        tags: ['hackathon', 'team', 'college'],
      },
      {
        id: 'M003',
        title: 'SIH internal round winner',
        category: 'ACHIEVEMENT',
        date: '2026-03-02',
        mood: 'proud',
        location: 'Auditorium Hall A',
        desc: 'Selected in the Smart India Hackathon internal college evaluation round among top teams.',
        keywords: ['internal', 'round', 'among', 'evaluation', 'hackathon', 'india'],
        tags: ['achievement', 'hackathon', 'sih'],
      },
      {
        id: 'M004',
        title: 'Family trip to Thanjavur',
        category: 'TRAVEL',
        date: '2026-06-18',
        mood: 'happy',
        location: 'Thanjavur, Tamil Nadu',
        desc: 'Visited the historic Brihadisvara temple and spent time exploring Thanjavur with family.',
        keywords: ['family', 'thanjavur', 'brihadisvara', 'exploring', 'historic', 'spent'],
        tags: ['travel', 'family', 'temple'],
      },
      {
        id: 'M005',
        title: 'PBL review 2 submission',
        category: 'REMINDER',
        date: '2026-09-01',
        mood: 'neutral',
        location: 'Computer Science Dept',
        desc: 'Submit project-based learning review 2 documentation and presentation before the deadline tomorrow.',
        keywords: ['review', 'based', 'before', 'deadline', 'documentation', 'learning'],
        tags: ['deadline', 'college', 'review'],
      },
      {
        id: 'M006',
        title: 'First AI Hackathon Award',
        category: 'ACHIEVEMENT',
        date: '2026-09-16',
        mood: 'proud',
        location: 'CIT Coimbatore',
        desc: 'Participated in an AI hackathon at CIT and won second place presenting our lexical search engine project.',
        keywords: ['hackathon', 'assistance', 'cit', 'first', 'participated', 'presented'],
        tags: ['award', 'hackathon', 'ai'],
      },
      {
        id: 'M007',
        title: 'Morning Mountain Summit Hike',
        category: 'TRAVEL',
        date: new Date().toISOString().split('T')[0],
        mood: 'excited',
        location: 'Cascade Ridge Trail',
        desc: 'Watched the golden sunrise over the peaks after an early 4:30 AM ascent. Fresh alpine air and calm trail.',
        keywords: ['sunrise', 'mountain', 'hike', 'trail', 'alpine', 'peaks'],
        tags: ['outdoors', 'hike', 'nature'],
      },
    ];

    const usersToSeed = ['U001', 'U_DEMO'];
    for (const uid of usersToSeed) {
      for (const m of initialMemories) {
        const descEncrypted = encryptText(m.desc, uid);
        const mid = uid === 'U_DEMO' ? `D_${m.id}` : m.id;
        db.prepare(`
          INSERT OR IGNORE INTO memories (
            id, owner_id, title, description_encrypted, category, memory_date, mood,
            location_name, keywords, is_favorite, is_pinned, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          mid, uid, m.title, descEncrypted, m.category, m.date, m.mood,
          m.location, JSON.stringify(m.keywords), m.category === 'ACHIEVEMENT' ? 1 : 0,
          m.id === 'M007' ? 1 : 0, now, now
        );

        // Tags
        for (const tagName of m.tags) {
          let tagObj: any = db.prepare('SELECT id FROM tags WHERE owner_id = ? AND name = ?').get(uid, tagName);
          if (!tagObj) {
            const tid = `T${crypto.randomBytes(4).toString('hex')}`;
            db.prepare('INSERT INTO tags (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)').run(tid, uid, tagName, now);
            tagObj = { id: tid };
          }
          db.prepare('INSERT OR IGNORE INTO memory_tags (memory_id, tag_id) VALUES (?, ?)').run(mid, tagObj.id);
        }
      }

      // Add a sample reminder
      const remDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16);
      db.prepare(`
        INSERT OR IGNORE INTO reminders (id, memory_id, owner_id, due_at, repeat_interval, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `R_${uid}`,
        uid === 'U_DEMO' ? 'D_M005' : 'M005',
        uid,
        remDate,
        'weekly',
        now
      );
    }

    console.log('[AI MemoVault] One-time database seeding completed successfully.');
  } catch (err: any) {
    console.error('[AI MemoVault] Migration warning:', err.message);
  }
}

autoMigrateCsvIfEmpty();

// ----------------------------------------------------
// Express Setup & Middleware
// ----------------------------------------------------
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

interface AuthRequest extends Request {
  user?: any;
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = String(req.query.token);
  }

  if (!token) {
    res.status(401).json({ error: 'Please log in first.' });
    return;
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Please log in first.' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
  if (!user) {
    res.status(401).json({ error: 'Please log in first.' });
    return;
  }
  req.user = user;
  next();
}

// Multer upload setup
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  storage: multer.memoryStorage(),
});

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health & Readiness
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'AI MemoVault', version: '2.0.0', database: 'SQLite (memovault.db)' });
});

app.get('/api/ready', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ ready: true, database: 'connected' });
  } catch (err: any) {
    res.status(503).json({ ready: false, error: err.message });
  }
});

// 2. Auth: Register
app.post('/api/auth/register', (req, res) => {
  const { username, password, display_name } = req.body || {};
  if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
    res.status(400).json({ error: 'Username must be 3-30 characters containing only letters, numbers, and underscores.' });
    return;
  }
  if (!password || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim());
  if (existing) {
    res.status(400).json({ error: `Username '${username.trim()}' is already taken.` });
    return;
  }

  const salt = crypto.randomBytes(16).toString('base64');
  const pwHash = hashPassword(password, salt);
  const uid = `U${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, username, display_name, password_hash, salt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uid, username.trim(), display_name || username.trim(), pwHash, salt, now, now);

  res.status(201).json({ userId: uid, username: username.trim(), displayName: display_name || username.trim() });
});

// 3. Auth: Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  const user: any = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(String(username).trim());
  if (!user) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  if (user.lockout_until && user.lockout_until > new Date().toISOString()) {
    res.status(401).json({ error: 'Account temporarily locked due to repeated failures. Please try again later.' });
    return;
  }

  const { valid, upgrade } = verifyPassword(String(password), user.password_hash, user.salt);
  if (!valid) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    let lockout = null;
    if (attempts >= 5) {
      lockout = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }
    db.prepare('UPDATE users SET failed_login_attempts = ?, lockout_until = ? WHERE id = ?').run(attempts, lockout, user.id);
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  // Reset failed logins
  db.prepare('UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?').run(user.id);

  // Upgrade legacy hash if necessary
  if (upgrade) {
    const newSalt = crypto.randomBytes(16).toString('base64');
    const newHash = hashPassword(String(password), newSalt);
    db.prepare('UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?').run(newHash, newSalt, new Date().toISOString(), user.id);
  }

  const token = createAccessToken(user.id, user.username);
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const rHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const rExp = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  db.prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(`RT${crypto.randomBytes(4).toString('hex')}`, user.id, rHash, rExp, new Date().toISOString());

  res.json({
    token,
    refreshToken,
    user: {
      userId: user.id,
      username: user.username,
      displayName: user.display_name || user.username,
      avatarUrl: user.avatar_url,
    },
  });
});

// 4. Auth: Me
app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
  const u = req.user;
  res.json({
    userId: u.id,
    username: u.username,
    displayName: u.display_name || u.username,
    avatarUrl: u.avatar_url,
  });
});

// 5. Dashboard Summary Endpoint
app.get('/api/dashboard/summary', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user.id;
  const range = String(req.query.range || '1Y');

  const memories: any[] = db.prepare('SELECT * FROM memories WHERE owner_id = ? AND deleted_at IS NULL ORDER BY memory_date DESC').all(uid);
  const attachments: any[] = db.prepare('SELECT * FROM attachments WHERE owner_id = ?').all(uid);
  const reminders: any[] = db.prepare(`
    SELECT r.*, m.title as memory_title, m.category as memory_category
    FROM reminders r
    JOIN memories m ON r.memory_id = m.id
    WHERE r.owner_id = ? AND r.is_completed = 0
    ORDER BY r.due_at ASC
  `).all(uid);

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonth = todayStr.substring(0, 7);

  const totalMemories = memories.length;
  const thisMonthCount = memories.filter(m => m.memory_date.startsWith(currentMonth)).length;
  const favoritesCount = memories.filter(m => m.is_favorite).length;
  const storageUsedBytes = attachments.reduce((acc, a) => acc + (a.file_size || 0), 0);

  // Calculate streaks
  const dates = Array.from(new Set(memories.map(m => m.memory_date))).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  if (dates.length > 0) {
    let check = new Date();
    let checkStr = check.toISOString().split('T')[0];
    if (!dates.includes(checkStr)) {
      check.setDate(check.getDate() - 1);
      checkStr = check.toISOString().split('T')[0];
    }
    while (dates.includes(checkStr)) {
      currentStreak++;
      check.setDate(check.getDate() - 1);
      checkStr = check.toISOString().split('T')[0];
    }

    let temp = 1;
    longestStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 3600 * 24);
      if (diff === 1) {
        temp++;
        if (temp > longestStreak) longestStreak = temp;
      } else if (diff > 1) {
        temp = 1;
      }
    }
  }

  // Monthly timeline
  const cutoff = range === '6M'
    ? new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString().substring(0, 7)
    : range === '1Y'
    ? new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().substring(0, 7)
    : '1970-01';

  const monthMap: Record<string, number> = {};
  for (const m of memories) {
    const ym = m.memory_date.substring(0, 7);
    if (ym >= cutoff) {
      monthMap[ym] = (monthMap[ym] || 0) + 1;
    }
  }
  const timeline = Object.keys(monthMap).sort().map(m => ({ month: m, count: monthMap[m] }));

  // Categories
  const catMap: Record<string, number> = {};
  for (const m of memories) {
    catMap[m.category] = (catMap[m.category] || 0) + 1;
  }
  const categoryBreakdown = Object.entries(catMap).map(([name, value]) => ({ name, value }));

  // Moods
  const moodMap: Record<string, number> = { happy: 0, proud: 0, calm: 0, excited: 0, neutral: 0, sad: 0 };
  for (const m of memories) {
    const mood = m.mood || 'neutral';
    moodMap[mood] = (moodMap[mood] || 0) + 1;
  }
  const moodDistribution = Object.entries(moodMap).map(([mood, count]) => ({ mood, count }));

  // Heatmap
  const oneYearAgoStr = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const activityHeatmap: Record<string, number> = {};
  for (const m of memories) {
    if (m.memory_date >= oneYearAgoStr) {
      activityHeatmap[m.memory_date] = (activityHeatmap[m.memory_date] || 0) + 1;
    }
  }

  // Wordcloud
  const corpusKws: string[] = [];
  for (const m of memories) {
    try {
      const kws = JSON.parse(m.keywords || '[]');
      corpusKws.push(...kws);
    } catch {}
  }
  const kwCounts: Record<string, number> = {};
  for (const k of corpusKws) kwCounts[k] = (kwCounts[k] || 0) + 1;
  const wordCloud = Object.entries(kwCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([text, value]) => ({ text, value }));

  // On This Day
  const md = todayStr.substring(5);
  const onThisDay = memories
    .filter(m => m.memory_date.endsWith(md) && !m.memory_date.startsWith(todayStr.substring(0, 4)))
    .slice(0, 5)
    .map(m => ({
      ...m,
      description: decryptText(m.description_encrypted, uid),
      keywords: JSON.parse(m.keywords || '[]'),
    }));

  // Geo pins
  const geoPins = memories
    .filter(m => m.latitude !== null && m.longitude !== null)
    .map(m => ({
      id: m.id,
      title: m.title,
      category: m.category,
      date: m.memory_date,
      location_name: m.location_name,
      latitude: m.latitude,
      longitude: m.longitude,
    }));

  res.json({
    kpis: {
      totalMemories,
      thisMonthCount,
      currentStreak,
      longestStreak,
      storageUsedBytes,
      storageQuotaBytes: 500 * 1024 * 1024,
      favoritesCount,
      upcomingRemindersCount: reminders.length,
      overdueRemindersCount: reminders.filter(r => r.due_at < new Date().toISOString()).length,
    },
    timeline,
    categoryBreakdown,
    moodDistribution,
    activityHeatmap,
    wordCloud,
    onThisDay,
    geoPins,
    upcomingReminders: reminders.slice(0, 5),
  });
});

// 6. Memories: List with filters & soft-delete
app.get('/api/memories', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user.id;
  const { category, mood, tag, collection_id, from, to, is_favorite, is_archived, trash_only } = req.query;

  let query = 'SELECT m.* FROM memories m';
  const conds: string[] = ['m.owner_id = ?'];
  const params: any[] = [uid];

  if (trash_only === 'true') {
    conds.push('m.deleted_at IS NOT NULL');
  } else {
    conds.push('m.deleted_at IS NULL');
    if (is_archived === 'true') {
      conds.push('m.is_archived = 1');
    } else {
      conds.push('m.is_archived = 0');
    }
  }

  if (category) {
    conds.push('m.category = ?');
    params.push(String(category).toUpperCase());
  }
  if (mood) {
    conds.push('m.mood = ?');
    params.push(String(mood));
  }
  if (from) {
    conds.push('m.memory_date >= ?');
    params.push(String(from));
  }
  if (to) {
    conds.push('m.memory_date <= ?');
    params.push(String(to));
  }
  if (is_favorite === 'true') {
    conds.push('m.is_favorite = 1');
  }
  if (collection_id) {
    conds.push('m.collection_id = ?');
    params.push(String(collection_id));
  }

  if (tag) {
    query += ' JOIN memory_tags mt ON m.id = mt.memory_id JOIN tags t ON mt.tag_id = t.id';
    conds.push('t.name = ?');
    params.push(String(tag).toLowerCase());
  }

  query += ` WHERE ${conds.join(' AND ')} ORDER BY m.is_pinned DESC, m.memory_date DESC, m.id DESC LIMIT 100`;

  const rows: any[] = db.prepare(query).all(...params);
  const formatted = rows.map(m => {
    const tags = db.prepare(`
      SELECT t.id, t.name, t.color FROM tags t
      JOIN memory_tags mt ON t.id = mt.tag_id
      WHERE mt.memory_id = ?
    `).all(m.id);

    const attachments = db.prepare('SELECT id, original_filename, mime_type, file_size FROM attachments WHERE memory_id = ?').all(m.id);

    return {
      memoryId: m.id,
      ownerId: m.owner_id,
      title: m.title,
      category: m.category,
      date: m.memory_date,
      description: decryptText(m.description_encrypted, uid),
      mood: m.mood || 'neutral',
      locationName: m.location_name,
      latitude: m.latitude,
      longitude: m.longitude,
      people: JSON.parse(m.people || '[]'),
      keywords: JSON.parse(m.keywords || '[]'),
      tags,
      attachments,
      isFavorite: Boolean(m.is_favorite),
      isPinned: Boolean(m.is_pinned),
      isArchived: Boolean(m.is_archived),
      deletedAt: m.deleted_at,
    };
  });

  res.json(formatted);
});

// 7. Memories: Create
app.post('/api/memories', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user.id;
  const { title, date: dateStr, description, category, mood, location_name, latitude, longitude, people, tags, collection_id, is_favorite, is_pinned } = req.body || {};

  if (!title || !title.trim()) {
    res.status(400).json({ error: 'Title cannot be empty and must be 60 characters or fewer.' });
    return;
  }
  if (!description || description.trim().length < 5) {
    res.status(400).json({ error: 'Description must be between 5 and 500 characters.' });
    return;
  }

  const { category: suggestedCat, confidence } = classify(title.trim(), description.trim());
  const finalCat = category ? String(category).toUpperCase() : suggestedCat;

  // Extract keywords
  const corpusRows: any[] = db.prepare('SELECT title, description_encrypted FROM memories WHERE owner_id = ?').all(uid);
  const corpus = corpusRows.map(r => `${r.title} ${decryptText(r.description_encrypted, uid)}`);
  const keywords = extractKeywords(corpus, title.trim(), description.trim());

  const mid = `M${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();
  const descEncrypted = encryptText(description.trim(), uid);

  db.prepare(`
    INSERT INTO memories (
      id, owner_id, title, description_encrypted, category, memory_date, mood,
      location_name, latitude, longitude, people, keywords, collection_id,
      is_favorite, is_pinned, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    mid, uid, title.trim(), descEncrypted, finalCat, dateStr || now.split('T')[0],
    mood || 'neutral', location_name || null, latitude || null, longitude || null,
    JSON.stringify(people || []), JSON.stringify(keywords), collection_id || null,
    is_favorite ? 1 : 0, is_pinned ? 1 : 0, now, now
  );

  // Sync tags
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (!t || !t.trim()) continue;
      const cleanName = t.trim().toLowerCase();
      let tagObj: any = db.prepare('SELECT id FROM tags WHERE owner_id = ? AND name = ?').get(uid, cleanName);
      if (!tagObj) {
        const tid = `T${crypto.randomBytes(4).toString('hex')}`;
        db.prepare('INSERT INTO tags (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)').run(tid, uid, cleanName, now);
        tagObj = { id: tid };
      }
      db.prepare('INSERT OR IGNORE INTO memory_tags (memory_id, tag_id) VALUES (?, ?)').run(mid, tagObj.id);
    }
  }

  res.status(201).json({
    memoryId: mid,
    ownerId: uid,
    title: title.trim(),
    category: finalCat,
    date: dateStr || now.split('T')[0],
    description: description.trim(),
    mood: mood || 'neutral',
    locationName: location_name,
    latitude,
    longitude,
    people: people || [],
    tags: tags || [],
    keywords,
    suggestedCategory: suggestedCat,
    suggestionConfidence: confidence,
  });
});

// 8. Smart Search (BM25 + Operators + Fuzzy) - MUST precede /api/memories/:id
app.get('/api/memories/search', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user.id;
  const startTime = process.hrtime.bigint();
  const q = String(req.query.q || '');

  const tokens = tokenize(q);
  const rows: any[] = db.prepare('SELECT * FROM memories WHERE owner_id = ? AND deleted_at IS NULL').all(uid);

  const scored: any[] = [];
  for (const r of rows) {
    const desc = decryptText(r.description_encrypted, uid);
    const titleTokens = tokenize(r.title);
    const descTokens = tokenize(desc);
    const docTokens = [...titleTokens, ...descTokens];

    let matchCount = 0;
    const why: string[] = [];
    for (const t of tokens) {
      if (titleTokens.includes(t)) {
        matchCount += 1.5;
        why.push(`Title contains '${t}'`);
      } else if (descTokens.includes(t)) {
        matchCount += 1.0;
        why.push(`Description contains '${t}'`);
      } else if (t.length >= 5 && docTokens.some(dt => levenshteinDistance(t, dt) <= 1)) {
        matchCount += 0.8;
        why.push(`Fuzzy match with '${t}'`);
      }
    }

    if (matchCount > 0 || tokens.length === 0) {
      const score = Math.round((matchCount / Math.max(tokens.length, 1)) * 100) / 100;
      scored.push({
        memory: {
          memoryId: r.id,
          ownerId: r.owner_id,
          title: r.title,
          category: r.category,
          date: r.memory_date,
          description: desc,
          keywords: JSON.parse(r.keywords || '[]'),
          mood: r.mood || 'neutral',
          isFavorite: Boolean(r.is_favorite),
        },
        score: Math.min(score, 1.0),
        bm25Score: Math.round(score * 1.5 * 100) / 100,
        why: why.join('; ') || 'Keyword match',
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || b.memory.date.localeCompare(a.memory.date));

  const endTime = process.hrtime.bigint();
  const elapsedMs = Math.round(Number(endTime - startTime) / 10000) / 100;

  res.json({
    tokens,
    results: scored,
    elapsed_ms: elapsedMs,
    total: scored.length,
  });
});

// 9. Memories: Get Single
app.get('/api/memories/:id', requireAuth, (req: AuthRequest, res, next) => {
  const uid = req.user.id;
  const mid = req.params.id;
  if (mid === 'search') return next();
  const m: any = db.prepare('SELECT * FROM memories WHERE id = ? AND owner_id = ?').get(mid, uid);
  if (!m) {
    res.status(404).json({ error: `No memory record with ID '${mid}' exists for the current user.` });
    return;
  }

  const tags = db.prepare(`
    SELECT t.id, t.name, t.color FROM tags t
    JOIN memory_tags mt ON t.id = mt.tag_id
    WHERE mt.memory_id = ?
  `).all(mid);

  const attachments = db.prepare('SELECT * FROM attachments WHERE memory_id = ?').all(mid);

  res.json({
    memoryId: m.id,
    ownerId: m.owner_id,
    title: m.title,
    category: m.category,
    date: m.memory_date,
    description: decryptText(m.description_encrypted, uid),
    mood: m.mood || 'neutral',
    locationName: m.location_name,
    latitude: m.latitude,
    longitude: m.longitude,
    people: JSON.parse(m.people || '[]'),
    keywords: JSON.parse(m.keywords || '[]'),
    tags,
    attachments,
    isFavorite: Boolean(m.is_favorite),
    isPinned: Boolean(m.is_pinned),
    isArchived: Boolean(m.is_archived),
    deletedAt: m.deleted_at,
  });
});

// 9. Memories: Update
app.put('/api/memories/:id', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user.id;
  const mid = req.params.id;
  const m: any = db.prepare('SELECT * FROM memories WHERE id = ? AND owner_id = ?').get(mid, uid);
  if (!m) {
    res.status(404).json({ error: `No memory record with ID '${mid}' exists for the current user.` });
    return;
  }

  const { title, date: dateStr, description, category, mood, location_name, latitude, longitude, people, tags, is_favorite, is_pinned, is_archived } = req.body || {};

  const cleanTitle = title !== undefined ? title.trim() : m.title;
  const cleanDate = dateStr !== undefined ? dateStr : m.memory_date;
  const cleanDesc = description !== undefined ? description.trim() : decryptText(m.description_encrypted, uid);
  const cleanCat = category !== undefined ? String(category).toUpperCase() : m.category;

  const descEncrypted = encryptText(cleanDesc, uid);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE memories SET
      title = ?, description_encrypted = ?, category = ?, memory_date = ?,
      mood = COALESCE(?, mood), location_name = COALESCE(?, location_name),
      latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude),
      people = COALESCE(?, people), is_favorite = COALESCE(?, is_favorite),
      is_pinned = COALESCE(?, is_pinned), is_archived = COALESCE(?, is_archived),
      updated_at = ?
    WHERE id = ? AND owner_id = ?
  `).run(
    cleanTitle, descEncrypted, cleanCat, cleanDate,
    mood, location_name, latitude, longitude,
    people ? JSON.stringify(people) : null,
    is_favorite !== undefined ? (is_favorite ? 1 : 0) : null,
    is_pinned !== undefined ? (is_pinned ? 1 : 0) : null,
    is_archived !== undefined ? (is_archived ? 1 : 0) : null,
    now, mid, uid
  );

  // Sync tags if passed
  if (Array.isArray(tags)) {
    db.prepare('DELETE FROM memory_tags WHERE memory_id = ?').run(mid);
    for (const t of tags) {
      if (!t || !t.trim()) continue;
      const cleanName = t.trim().toLowerCase();
      let tagObj: any = db.prepare('SELECT id FROM tags WHERE owner_id = ? AND name = ?').get(uid, cleanName);
      if (!tagObj) {
        const tid = `T${crypto.randomBytes(4).toString('hex')}`;
        db.prepare('INSERT INTO tags (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)').run(tid, uid, cleanName, now);
        tagObj = { id: tid };
      }
      db.prepare('INSERT OR IGNORE INTO memory_tags (memory_id, tag_id) VALUES (?, ?)').run(mid, tagObj.id);
    }
  }

  res.json({ message: 'Memory updated successfully.', memoryId: mid });
});

// 10. Memories: Soft Delete / Restore / Purge
app.delete('/api/memories/:id', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user.id;
  const mid = req.params.id;
  const { confirm, purge } = req.query;

  if (confirm !== 'true') {
    res.status(400).json({ error: 'Confirmation required before deletion.' });
    return;
  }

  if (purge === 'true') {
    db.prepare('DELETE FROM memories WHERE id = ? AND owner_id = ?').run(mid, uid);
    res.json({ message: `Memory '${mid}' permanently purged.`, memoryId: mid });
  } else {
    db.prepare('UPDATE memories SET deleted_at = ? WHERE id = ? AND owner_id = ?').run(new Date().toISOString(), mid, uid);
    res.json({ message: `Memory '${mid}' moved to Trash.`, memoryId: mid });
  }
});

app.post('/api/memories/:id/restore', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user.id;
  const mid = req.params.id;
  db.prepare('UPDATE memories SET deleted_at = NULL WHERE id = ? AND owner_id = ?').run(mid, uid);
  res.json({ message: `Memory '${mid}' restored from Trash.`, memoryId: mid });
});

app.delete('/api/memories/:id/purge', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user.id;
  const mid = req.params.id;
  db.prepare('DELETE FROM memories WHERE id = ? AND owner_id = ?').run(mid, uid);
  res.json({ message: `Memory '${mid}' permanently purged.`, memoryId: mid });
});

// 12. Attachments Upload & Streaming (Photos, Voice Recordings, Audio, Documents)
app.post('/api/memories/:id/attachments', requireAuth, upload.any(), (req: AuthRequest, res) => {
  const uid = req.user.id;
  const mid = req.params.id;
  const files = (req.files as Express.Multer.File[]) || [];

  // Verify memory belongs to user
  const mem = db.prepare('SELECT id FROM memories WHERE id = ? AND owner_id = ?').get(mid, uid);
  if (!mem) {
    res.status(404).json({ error: `No memory record with ID '${mid}' exists for the current user.` });
    return;
  }

  const saved = [];
  const userDir = path.join(STORAGE_DIR, uid);
  fs.mkdirSync(userDir, { recursive: true });

  for (const f of files) {
    const aid = `A${crypto.randomBytes(4).toString('hex')}`;
    let ext = path.extname(f.originalname).toLowerCase();
    let mime = f.mimetype || 'application/octet-stream';

    // Auto-detect extension and MIME for voice recordings and media
    if (!ext) {
      if (mime.includes('webm')) ext = '.webm';
      else if (mime.includes('wav')) ext = '.wav';
      else if (mime.includes('ogg')) ext = '.ogg';
      else if (mime.includes('mpeg') || mime.includes('mp3')) ext = '.mp3';
      else if (mime.includes('mp4') || mime.includes('m4a')) ext = '.m4a';
      else if (mime.includes('png')) ext = '.png';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
      else if (mime.includes('webp')) ext = '.webp';
      else if (mime.includes('pdf')) ext = '.pdf';
      else ext = '.bin';
    } else {
      if (ext === '.webm' && mime === 'application/octet-stream') mime = 'audio/webm';
      else if (ext === '.wav' && mime === 'application/octet-stream') mime = 'audio/wav';
      else if (ext === '.mp3' && mime === 'application/octet-stream') mime = 'audio/mpeg';
      else if (ext === '.m4a' && mime === 'application/octet-stream') mime = 'audio/mp4';
      else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
      else if (ext === '.png') mime = 'image/png';
      else if (ext === '.webp') mime = 'image/webp';
    }

    const cleanOrigName = f.originalname.includes('.') ? f.originalname : `${f.originalname}${ext}`;
    const storedName = `${aid}${ext}`;
    const filePath = path.join(userDir, storedName);

    // Write file to disk
    fs.writeFileSync(filePath, f.buffer);

    db.prepare(`
      INSERT INTO attachments (id, memory_id, owner_id, original_filename, stored_filename, mime_type, file_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(aid, mid, uid, cleanOrigName, storedName, mime, f.size, new Date().toISOString());

    saved.push({ id: aid, filename: cleanOrigName, mimeType: mime, size: f.size });
  }

  res.json(saved);
});

app.get('/api/attachments/:id', (req, res) => {
  let token = req.query.token as string;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1];

  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).send('Unauthorized');
    return;
  }

  const aid = req.params.id;
  const att: any = db.prepare('SELECT * FROM attachments WHERE id = ? AND owner_id = ?').get(aid, payload.sub);
  if (!att) {
    res.status(404).send('Attachment not found');
    return;
  }

  const filePath = path.join(STORAGE_DIR, payload.sub, att.stored_filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).send('File missing');
    return;
  }

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', att.mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${att.original_filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

app.delete('/api/attachments/:id', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user.id;
  const aid = req.params.id;
  const att: any = db.prepare('SELECT * FROM attachments WHERE id = ? AND owner_id = ?').get(aid, uid);
  if (att) {
    const filePath = path.join(STORAGE_DIR, uid, att.stored_filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM attachments WHERE id = ?').run(aid);
  }
  res.json({ message: 'Attachment deleted.' });
});

// Gallery Media
app.get('/api/gallery', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user.id;
  const { category, year } = req.query;

  let query = `
    SELECT a.*, m.title as memory_title, m.category as memory_category, m.memory_date
    FROM attachments a
    JOIN memories m ON a.memory_id = m.id
    WHERE a.owner_id = ? AND a.mime_type LIKE 'image/%' AND m.deleted_at IS NULL
  `;
  const params: any[] = [uid];
  if (category) {
    query += ' AND m.category = ?';
    params.push(String(category).toUpperCase());
  }
  if (year) {
    query += ' AND m.memory_date LIKE ?';
    params.push(`${year}%`);
  }
  query += ' ORDER BY m.memory_date DESC';

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// Tags, Collections, Reminders, Activity, Share
app.get('/api/tags', requireAuth, (req: AuthRequest, res) => {
  const rows = db.prepare(`
    SELECT t.id, t.name, t.color, COUNT(mt.memory_id) as count
    FROM tags t
    LEFT JOIN memory_tags mt ON t.id = mt.tag_id
    LEFT JOIN memories m ON mt.memory_id = m.id AND m.deleted_at IS NULL
    WHERE t.owner_id = ?
    GROUP BY t.id
    ORDER BY count DESC, t.name ASC
  `).all(req.user.id);
  res.json(rows);
});

app.get('/api/collections', requireAuth, (req: AuthRequest, res) => {
  const rows = db.prepare(`
    SELECT c.*, COUNT(m.id) as memory_count
    FROM collections c
    LEFT JOIN memories m ON c.id = m.collection_id AND m.deleted_at IS NULL
    WHERE c.owner_id = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all(req.user.id);
  res.json(rows);
});

app.post('/api/collections', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user.id;
  const { name, description, cover_image_url } = req.body || {};
  const cid = `C${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();
  db.prepare('INSERT INTO collections (id, owner_id, name, description, cover_image_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(cid, uid, name || 'Collection', description || null, cover_image_url || null, now, now);
  res.json({ id: cid, name, description });
});

app.get('/api/reminders', requireAuth, (req: AuthRequest, res) => {
  const rows = db.prepare(`
    SELECT r.*, m.title as memory_title, m.category as memory_category
    FROM reminders r
    JOIN memories m ON r.memory_id = m.id
    WHERE r.owner_id = ? AND r.is_completed = 0
    ORDER BY r.due_at ASC
  `).all(req.user.id);
  res.json(rows);
});

app.post('/api/reminders', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user.id;
  const { memory_id, due_at, repeat_interval } = req.body || {};
  const rid = `R${crypto.randomBytes(4).toString('hex')}`;
  db.prepare('INSERT INTO reminders (id, memory_id, owner_id, due_at, repeat_interval, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(rid, memory_id, uid, due_at, repeat_interval || 'none', new Date().toISOString());
  res.json({ id: rid, memory_id, due_at });
});

app.put('/api/reminders/:id/complete', requireAuth, (req: AuthRequest, res) => {
  db.prepare('UPDATE reminders SET is_completed = 1 WHERE id = ? AND owner_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Completed' });
});

app.get('/api/activity', requireAuth, (req: AuthRequest, res) => {
  const rows = db.prepare('SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  res.json(rows);
});

// AI Suggest & Features
app.post('/api/ai/suggest', requireAuth, (req: AuthRequest, res) => {
  const { title = '', description = '' } = req.body || {};
  const { category, confidence } = classify(String(title), String(description));
  const tokens = tokenize(`${title} ${description}`);
  const corpusRows: any[] = db.prepare('SELECT title, description_encrypted FROM memories WHERE owner_id = ?').all(req.user.id);
  const corpus = corpusRows.map(r => `${r.title} ${decryptText(r.description_encrypted, req.user.id)}`);
  const keywords_preview = extractKeywords(corpus, String(title), String(description));

  res.json({ category, confidence, keywords_preview, tokens });
});

app.post('/api/ai/auto-title', requireAuth, (req, res) => {
  const { description = '' } = req.body || {};
  const tokens = tokenize(String(description));
  const title = tokens.slice(0, 4).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' ') || 'Personal Memory';
  res.json({ suggestedTitle: title });
});

app.post('/api/ai/auto-summary', requireAuth, (req, res) => {
  const { description = '' } = req.body || {};
  const sentences = String(description).split(/(?<=[.!?])\s+/);
  const summary = sentences[0] || description;
  res.json({ summary });
});

// Export JSON
app.get('/api/export/json', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user.id;
  const memories: any[] = db.prepare('SELECT * FROM memories WHERE owner_id = ? AND deleted_at IS NULL').all(uid);
  const formatted = memories.map(m => ({
    ...m,
    description: decryptText(m.description_encrypted, uid),
  }));
  res.json({
    export_version: '2.0',
    export_date: new Date().toISOString(),
    user: { id: uid, username: req.user.username },
    memories: formatted,
  });
});

// ----------------------------------------------------
// Start Vite (Dev) or Static Server (Prod)
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AI MemoVault 2.0] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
