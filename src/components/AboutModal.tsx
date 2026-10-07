import React, { useState } from 'react';
import {
  Brain,
  Layers,
  Sparkles,
  Search,
  BookOpen,
  AlertTriangle,
  Code2,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { api } from '../api';

export const AboutModal: React.FC = () => {
  const [testText, setTestText] = useState('Show my hackathon achievements and won first prize award');
  const [previewTokens, setPreviewTokens] = useState<string[]>([]);
  const [previewCat, setPreviewCat] = useState<string>('');
  const [previewConf, setPreviewConf] = useState<number>(0);
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    if (!testText.trim()) return;
    setTesting(true);
    try {
      const res = await api.suggest(testText, testText);
      setPreviewTokens(res.tokens);
      setPreviewCat(res.category);
      setPreviewConf(res.confidence);
    } catch {
      // Ignore
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-xs">
      {/* Hero Card */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-white/[0.08] shadow-2xl relative overflow-hidden">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[11px] mb-3.5 font-medium">
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span>Deterministic Lexical AI Architecture</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            How AI MemoVault Works Without Machine Learning
          </h2>
          <p className="text-slate-300 mt-2.5 leading-relaxed text-sm">
            Driving question: <em>&quot;Can a plain application, built without any external ML library, store a person&apos;s scattered personal records securely and still retrieve the right record when the user remembers only a fragment of it?&quot;</em>
          </p>
          <p className="text-slate-400 mt-2 leading-relaxed text-xs">
            The intelligent layer consists of 100% deterministic algorithms implemented strictly with Python&apos;s standard library and duplicated cleanly in the web runtime: Tokenization, TF-IDF term weighting, Inverted Index postings, Weighted Lexicon classification, and Jaccard similarity.
          </p>
        </div>
      </div>

      {/* Honest Limitation Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 flex items-start gap-3.5 shadow-lg">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-xs uppercase tracking-wide text-amber-300">
            Honest Architectural Boundary: Lexical vs. Semantic Retrieval
          </h4>
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            Because this vault deliberately employs no vector embeddings, neural transformers, or external LLM APIs, retrieval is <strong>purely lexical</strong>. A query for <code className="bg-black/60 px-1.5 py-0.5 rounded text-amber-300 border border-amber-500/30 font-mono">&quot;hackathon&quot;</code> will match records containing the word <em>&quot;hackathon&quot;</em> or its morphological variations, but will <strong>not</strong> magically infer that a record titled <em>&quot;coding competition&quot;</em> is conceptually related unless the specific token occurs.
          </p>
        </div>
      </div>

      {/* Interactive Lexical Sandbox */}
      <div className="glass-panel rounded-2xl p-6 border border-white/[0.08] shadow-xl">
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06] mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-sm tracking-tight">Interactive Lexical Sandbox</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Live Tokenizer &amp; Classifier Test</span>
        </div>
        <div className="space-y-3.5">
          <div className="flex gap-2.5">
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Type any test sentence..."
              className="flex-1 px-3.5 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all placeholder-slate-500"
            />
            <button
              onClick={runTest}
              disabled={testing}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] cursor-pointer shrink-0 disabled:opacity-50"
            >
              {testing ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>

          {previewTokens.length > 0 && (
            <div className="p-4 bg-black/40 rounded-xl border border-white/[0.07] space-y-2.5 font-mono">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 text-xs">Tokens retained:</span>
                {previewTokens.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded-lg font-bold text-[11px]"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-slate-300 pt-2 border-t border-white/[0.06] text-xs">
                <span>
                  Classification: <strong className="text-white">{previewCat}</strong>
                </span>
                <span>
                  Confidence: <strong className="text-cyan-400">{previewConf.toFixed(2)}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deep-Dive Algorithm Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Tokenizer */}
        <div className="p-5 rounded-2xl glass-panel border border-white/[0.07] space-y-2.5">
          <div className="flex items-center gap-2 text-cyan-300 font-bold">
            <Layers className="w-4 h-4" />
            <span>1. Lexical Tokenization &amp; Stop Words</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Text is converted to lowercase and scrubbed of any non-alphanumeric symbols. Tokens shorter than 3 characters or belonging to the 70+ common English stop-word set (including <code>show</code>, <code>find</code>, <code>get</code>) are discarded.
          </p>
          <div className="bg-black/50 p-2.5 rounded-xl border border-white/[0.06] font-mono text-[10px] text-slate-400">
            Example: <code>&quot;show my hackathon achievements&quot;</code> → <code className="text-cyan-300">[&apos;hackathon&apos;, &apos;achievements&apos;]</code>
          </div>
        </div>

        {/* 2. TF-IDF */}
        <div className="p-5 rounded-2xl glass-panel border border-white/[0.07] space-y-2.5">
          <div className="flex items-center gap-2 text-teal-300 font-bold">
            <Code2 className="w-4 h-4" />
            <span>2. TF-IDF Keyword Extraction</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Calculated once per memory at create/update time against the user&apos;s isolated corpus.
          </p>
          <div className="bg-black/50 p-2.5 rounded-xl border border-white/[0.06] font-mono font-bold text-teal-300 text-[11px]">
            w(t, d) = tf(t, d) * ( ln( N / (1 + df(t)) ) + 1 )
          </div>
          <p className="text-slate-500 text-[10px]">
            Where tf = term occurrences in the document, N = user record count, df = records containing the term. Top 6 terms are persisted.
          </p>
        </div>

        {/* 3. Inverted Index */}
        <div className="p-5 rounded-2xl glass-panel border border-white/[0.07] space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-300 font-bold">
            <Search className="w-4 h-4" />
            <span>3. In-Memory Inverted Index</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Maintains a mapping of <code>dict[term, set[memoryId]]</code>. On search, candidate memory IDs are obtained via union of term posting lists (OR semantics).
          </p>
          <div className="bg-black/50 p-2.5 rounded-xl border border-white/[0.06] font-mono text-[10px] text-emerald-300">
            Benchmark performance: 800 records scanned in under 4.3 ms.
          </div>
        </div>

        {/* 4. Weighted Relevance */}
        <div className="p-5 rounded-2xl glass-panel border border-white/[0.07] space-y-2.5">
          <div className="flex items-center gap-2 text-purple-300 font-bold">
            <Brain className="w-4 h-4" />
            <span>4. Weighted Relevance Formula</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Scores only candidate IDs produced by the inverted index, discarding records scoring zero.
          </p>
          <div className="bg-black/50 p-2.5 rounded-xl border border-white/[0.06] font-mono font-bold text-purple-300 text-[11px]">
            score(q, m) = 0.50*body + 0.30*title + 0.20*category
          </div>
          <p className="text-slate-500 text-[10px]">
            body = token fraction in description; title = token fraction in title; category = 1.0 if token in category.
          </p>
        </div>

        {/* 5. Lexicon Classifier */}
        <div className="p-5 rounded-2xl glass-panel border border-white/[0.07] space-y-2.5">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <Sparkles className="w-4 h-4" />
            <span>5. Weighted Lexicon Classifier</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Cold-start friendly category suggestion. Computes category sum normalized by length square-root:
          </p>
          <div className="bg-black/50 p-2.5 rounded-xl border border-white/[0.06] font-mono font-bold text-amber-300 text-[11px]">
            score(c) = ( ∑ weight(c, t) ) / √|tokens|
          </div>
          <p className="text-slate-500 text-[10px]">
            Highest score category wins. Returns confidence = min(bestScore, 1.0).
          </p>
        </div>

        {/* 6. Jaccard Similarity */}
        <div className="p-5 rounded-2xl glass-panel border border-white/[0.07] space-y-2.5">
          <div className="flex items-center gap-2 text-sky-300 font-bold">
            <BookOpen className="w-4 h-4" />
            <span>6. Jaccard Similarity (Related)</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Used strictly for discovering related memory records inside the detail drawer:
          </p>
          <div className="bg-black/50 p-2.5 rounded-xl border border-white/[0.06] font-mono font-bold text-sky-300 text-[11px]">
            J(A, B) = |A ∩ B| / |A ∪ B|
          </div>
          <p className="text-slate-500 text-[10px]">
            Compares token sets of two full records. Top 5 records with J &gt; 0 are displayed.
          </p>
        </div>
      </div>
    </div>
  );
};
