# AI MemoVault — Secure Personal Digital Memory Management System

An AI-assisted personal digital memory vault ported from a core-Java console project to a modern full-stack web application.

- **Backend**: Python 3.10+ FastAPI, Uvicorn, Pydantic v2 (with standard library fallbacks).
- **Frontend**: React 19 + Vite, Tailwind CSS, Lucide Icons, TypeScript.
- **Intelligent Layer**: 100% hand-crafted lexical AI implemented with Python's standard library (no scikit-learn, no NLTK, no spaCy, no transformers, no external LLM APIs).
- **Persistence**: Flat pipe-delimited text files (`users.csv`, `memories.csv`) in `./data` — **no database**.

---

## 1. Product Overview & Driving Question

> **"Can a plain application, built without any external ML library, store a person's scattered personal records securely and still retrieve the right record when the user remembers only a fragment of it?"**

AI MemoVault answers this question in the affirmative. By combining:
1. **Lexical Tokenization with Stop-Word Removal** (~70 noise words eliminated),
2. **Corpus-Relative TF-IDF Keyword Extraction** for automatic tagging,
3. **In-Memory Inverted Indexing** for sub-millisecond candidate generation,
4. **Weighted Relevance Scoring** across document body (0.50), title (0.30), and category (0.20),
5. **Weighted Lexicon Classification** for automatic category suggestions, and
6. **Jaccard Similarity** for cross-record associative discovery,

the vault achieves rapid, transparent retrieval without external dependencies, neural networks, or paid API keys.

---

## 2. Architecture: Strict Four-Layer Rule

The codebase strictly enforces unidirectional layer isolation:

```
┌────────────────────────────────────────────────────────┐
│                   Presentation Layer                   │
│   React Frontend (Vite SPA)  +  FastAPI Route Handlers │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                  Business Logic Layer                  │
│    AuthService  •  MemoryManager  •  SearchService     │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
┌─────────────▼──────────────┐ ┌───────────▼─────────────┐
│     Intelligent Layer      │ │    Data Access Layer    │
│  AIService (Lexical Math)  │ │ FileStorage (Atomic IO) │
│  Tokenizer, TF-IDF,        │ │ InvertedIndex (In-Mem)  │
│  Lexicon, Jaccard          │ │ Users & Memories CSV    │
└────────────────────────────┘ └─────────────────────────┘
```

- **Presentation Layer**: React UI and FastAPI route handlers (`app/api/*`). Routes contain **no business rules**; they delegate directly to services and rely on global exception handlers.
- **Business Logic Layer**: `AuthService`, `MemoryManager`, `SearchService`, and `ValidationUtil`. Enforces per-user tenant isolation, access authorization, and validation invariants.
- **Intelligent Layer**: `AIService`. Sits beside the business layer. If removed or disabled, the application gracefully degrades to plain keyword matching without breaking storage or entity lifecycles.
- **Data Access Layer**: `FileStorage` is the **only** module that interacts with disk files. `InvertedIndex` is an in-memory data structure rebuilt at startup and kept synchronized during creates, updates, and deletes.

---

## 3. Data Model & Storage Format

### 3.1 Entities

1. **User**: `userId` (e.g., `U001`), `username`, `passwordHashBase64`, `saltBase64`.
2. **Memory** (7 fields):
   - `memoryId`: Immutable sequence (`M001`, `M002`, `M006`).
   - `ownerId`: Immutable user identifier (`U001`).
   - `title`: 1–60 characters.
   - `category`: One of `ACHIEVEMENT`, `EVENT`, `STUDY`, `TRAVEL`, `REMINDER`, `PERSONAL`.
   - `date`: ISO `yyyy-MM-dd` (cannot be in the future).
   - `description`: 5–500 characters.
   - `keywords`: Up to 6 comma-separated extracted strings.

### 3.2 File Serialisation & Safety Invariants

- **`memories.csv`** format:
  ```text
  memoryId|ownerId|title|category|date|description|keyword1,keyword2,...
  ```
  *Example*:
  ```text
  M001|U001|Started Java unit 3|STUDY|2025-08-04|Began the third unit of the Java Programming course covering collections and exception handling.|unit,java,exception,covering,third,began
  ```

- **`users.csv`** format:
  ```text
  userId|username|passwordHashBase64|saltBase64
  ```

- **Serialisation Safety Rules**:
  - On write, any user-entered pipe `|` is replaced with `&pipe;`, and all newline variations (`\r\n`, `\r`, `\n`) are replaced with a single space.
  - On read, `&pipe;` is converted back to `|`.
  - Lines are split with a limit (`split('|', 6)`) to preserve empty trailing keyword fields.
  - A line with fewer than 7 fields is flagged as corrupt and **skipped with a warning**, never crashing the server.
  - Missing data files are automatically initialized empty on startup.
  - Record creation **appends** a single line under a `threading.Lock`. Updates and deletes write to a temporary file in the same directory and execute an **atomic replace** (`os.replace`).
  - **Multi-Process Concurrency Limitation**: AI MemoVault uses in-process thread locking. Concurrent writes from multiple distinct OS processes require OS-level advisory locks (`fcntl.flock`), which is a documented known limitation.

- **Entity Ordering**: Records implement `__lt__` such that sorting produces **newest date first** (secondary: descending `memoryId`).

---

## 4. Auth & Security

1. **Zero Plain-Text Passwords**: Every password is salted with a 16-byte cryptographically secure random salt generated via `secrets.token_bytes(16)`.
2. **Hash Formula**:
   $$\text{digest} = \text{SHA-256}(\text{salt}_{\text{utf8}} \mathbin{\Vert} \text{password}_{\text{utf8}})$$
3. **Constant-Time Verification**: Verification computes the candidate hash and evaluates `hmac.compare_digest(computed, stored)` to eliminate timing side-channel attacks.
4. **Uniform Error Messages**: Login failures return the exact same message: `"Invalid username or password."` for unknown usernames and incorrect passwords alike, completely mitigating username enumeration.
5. **Session Bearer Tokens**: 8-hour signed HS256 JWT tokens. Protected routes require `Authorization: Bearer <token>`.
6. **Per-User Tenant Isolation**: `ownerId` is enforced on every read, list, search, edit, and delete operation. Accessing another user's record returns the identical 404: `"No memory record with ID 'Mxxx' exists for the current user."`
7. **Production Hardening Switch**: `config.py` contains the `HASH_ALGORITHM` setting (`"SHA256"` default fast; switchable to `"PBKDF2"` with 100,000 iterations for high-threat production environments).

---

## 5. Hand-Crafted Lexical AI Engine (`ai_service.py`)

No third-party NLP or machine-learning libraries are used. All logic is pure standard library arithmetic:

### 5.1 Tokenization & Stop-Word Elimination
- Lowercase string, replace `[^a-z0-9\s]` with whitespace, split on spaces.
- Discard tokens with length $< 3$ or present in the 70-term stop-word set (including `the`, `with`, `for`, `show`, `tell`, `give`, `find`, `get`).

### 5.2 TF-IDF Keyword Extraction
Computed once per record against the user's isolated corpus:
$$w(t, d) = \text{tf}(t, d) \times \left( \ln\left( \frac{N}{1 + \text{df}(t)} \right) + 1 \right)$$
where $\text{tf}(t, d)$ is term frequency in the record, $N = \max(|corpus|, 1)$, and $\text{df}(t)$ is document frequency in the user's corpus. The top 6 terms by weight are retained.

### 5.3 Weighted Lexicon Category Classifier
Evaluates title and description against term weights across the 6 categories:
$$\text{score}(c) = \frac{\sum_{t \in \text{tokens}} \text{weight}(c, t)}{\sqrt{|\text{tokens}|}}$$
Categories:
- **ACHIEVEMENT** (0.90): `won`, `winner`, `prize`, `award`, `rank`, `first`, `hackathon`, `certificate`, `selected`, `medal`, `topper`, `published`, `qualified`
- **EVENT** (0.80): `event`, `seminar`, `workshop`, `symposium`, `fest`, `conference`, `meeting`, `celebration`, `function`, `competition`, `club`
- **STUDY** (0.80): `exam`, `class`, `lecture`, `semester`, `subject`, `notes`, `unit`, `assignment`, `lab`, `syllabus`, `course`, `java`, `revision`
- **TRAVEL** (0.85): `trip`, `travel`, `visit`, `journey`, `tour`, `temple`, `beach`, `station`, `flight`, `hotel`, `holiday`
- **REMINDER** (0.85): `reminder`, `deadline`, `submit`, `submission`, `due`, `pay`, `renew`, `appointment`, `tomorrow`, `schedule`
- **PERSONAL** (0.70): `family`, `friend`, `birthday`, `home`, `mother`, `father`, `brother`, `sister`, `gift`, `dinner`

Highest score wins. Confidence is $\min(\text{score}, 1.0)$. Defaults to `PERSONAL` with 0.0 confidence when no keywords match.

### 5.4 Candidate Generation via Inverted Index
Maps `dict[str term, set[str memoryId]]`. On query, computes union of term posting lists.

### 5.5 Weighted Relevance Search Ranking
Scores only candidate records matching the query tokens:
$$\text{score}(q, m) = 0.50 \times \text{body}(q, m) + 0.30 \times \text{title}(q, m) + 0.20 \times \text{category}(q, m)$$
- $\text{body}$: fraction of unique query tokens present in description.
- $\text{title}$: fraction of unique query tokens present in title.
- $\text{category}$: $1.0$ if any query token is contained in lowercase category name, else $0.0$.
- *Sanity check test case*: Query `"show my hackathon achievements"` against record `"First Hackathon"` with body mentioning `"hackathon"` produces a verified score of **0.40** ($0.50 \times 0.5 + 0.30 \times 0.5 + 0.20 \times 0.0 = 0.40$).

### 5.6 Jaccard Similarity (Related Memories)
Used exclusively for related record discovery:
$$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$

### 5.7 Honest Architectural Limitation
Retrieval is strictly **lexical**, not semantic. The search query `"hackathon"` matches records with the literal token `"hackathon"`; it will **not** retrieve a record titled `"coding competition"` unless the specific words overlap.

---

## 6. REST API Reference

All requests/responses are JSON. Authenticated endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user `{username, password}` | No |
| `POST` | `/api/auth/login` | Authenticate `{username, password}` → `{token, user}` | No |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Yes |
| `POST` | `/api/ai/suggest` | Live AI preview `{title, description}` → `{category, confidence, keywords_preview, tokens}` | Yes |
| `POST` | `/api/memories` | Create memory record `{title, date, description, category?}` | Yes |
| `GET` | `/api/memories` | List user memories `?category=&from=&to=` (newest first) | Yes |
| `GET` | `/api/memories/{id}` | Read single memory by ID (enforces ownership) | Yes |
| `PUT` | `/api/memories/{id}` | Update memory (re-extracts TF-IDF keywords, re-indexes) | Yes |
| `DELETE` | `/api/memories/{id}` | Delete memory (`?confirm=true` required) | Yes |
| `GET` | `/api/memories/search` | Lexical smart search `?q=...&category=&from=&to=` | Yes |
| `GET` | `/api/memories/{id}/related` | Top related records via Jaccard similarity | Yes |
| `GET` | `/api/stats` | Vault statistics `{total, by_category, recent}` | Yes |
| `GET` | `/api/health` | System health check | No |

Interactive Swagger documentation is available at `/docs` when running the FastAPI server.

---

## 7. Setup & Run Instructions

### 7.1 Running the Full-Stack Application (Express + Vite)
```bash
# 1. Install dependencies
npm install

# 2. Start full-stack development server (runs port 3000)
npm run dev
```

### 7.2 Running the Python FastAPI Backend Separately
```bash
# 1. Navigate to backend directory
cd backend

# 2. Install Python packages
pip install -r requirements.txt

# 3. Launch Uvicorn server on port 8000
uvicorn app.main:app --reload --port 8000
```

### 7.3 Running the Comprehensive Test Suite (50 Tests)
```bash
# Run with Python standard library unittest:
python3 -m unittest backend/tests/test_suite.py

# Or run with pytest:
pytest backend/tests/test_suite.py -v
```

### 7.4 Running the Search Benchmark (800+ Records < 5ms)
```bash
PYTHONPATH=backend python3 backend/benchmark.py
```

---

## 8. Demo Credentials & Seed Data

On initial startup, demo records are created under:
- **Username**: `Thivisha`
- **Password**: `demo123`

Seed records include:
1. `M001` (STUDY) - *Started Java unit 3*
2. `M002` (EVENT) - *Coding club build night*
3. `M003` (ACHIEVEMENT) - *SIH internal round*
4. `M004` (TRAVEL) - *Family trip to Thanjavur*
5. `M005` (REMINDER) - *PBL review 2 submission*
6. `M006` (ACHIEVEMENT) - *First Hackathon*
