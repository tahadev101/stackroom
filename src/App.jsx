import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Search, ShoppingCart, BookOpen, Clock, X, Check, AlertCircle, LogOut, Lock } from "lucide-react";
import { supabase } from "./supabaseClient";

const SHELVES = Array.from({ length: 25 }, (_, i) => String.fromCharCode(65 + i)); // A..Y
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Spectral:wght@400;500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');`;

function AuthView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) setAuthError(error.message);
    setLoading(false);
  };

  return (
    <div style={styles.app}>
      <style>{FONT_IMPORT}</style>
      <header style={styles.header}>
        <div>
          <div style={styles.brand}>Books Galore</div>
          <div style={styles.tagline}>Staff Sign In</div>
        </div>
      </header>

      {authError && (
        <div style={styles.errorBanner}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{authError}</span>
        </div>
      )}

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={styles.fieldLabel}>Email Address</label>
          <input
            className="bs-input"
            type="email"
            required
            placeholder="staff@bookshop.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div>
          <label style={styles.fieldLabel}>Password</label>
          <input
            className="bs-input"
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <button className="bs-btn" type="submit" disabled={loading} style={{ ...styles.primaryBtn, justifyContent: "center", marginTop: 6 }}>
          <Lock size={15} /> {loading ? "Signing in…" : "Sign In to Books Galore"}
        </button>
      </form>
    </div>
  );
}

function ShelfSpines({ counts, active, onSelect, maxCount }) {
  return (
    <div style={styles.spineRow}>
      {SHELVES.map((s) => {
        const c = counts[s] || 0;
        const ratio = maxCount > 0 ? c / maxCount : 0;
        const h = 34 + Math.round(ratio * 46);
        const isActive = active === s;
        return (
          <button
            key={s}
            onClick={() => onSelect(isActive ? null : s)}
            title={`Shelf ${s}: ${c} book${c === 1 ? "" : "s"}`}
            style={{
              ...styles.spine,
              height: h,
              background: isActive ? "var(--gold)" : c > 0 ? "var(--green)" : "var(--spine-empty)",
              color: isActive ? "var(--ink)" : c > 0 ? "#EFE8D2" : "var(--ink-faint)",
              transform: isActive ? "translateY(-4px)" : "none",
            }}
          >
            <span style={styles.spineLetter}>{s}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function BookshelfApp() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [books, setBooks] = useState(null);
  const [sales, setSales] = useState(null);
  const [tab, setTab] = useState("inventory");
  const [shelfFilter, setShelfFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newShelf, setNewShelf] = useState("A");
  const [addErr, setAddErr] = useState("");
  const [sellSearch, setSellSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [booksRes, salesRes] = await Promise.all([
        supabase.from("books").select("*").order("shelf").order("title"),
        supabase.from("sales_log").select("*").order("sold_at", { ascending: false }).limit(100),
      ]);

      if (booksRes.error) throw booksRes.error;
      if (salesRes.error) throw salesRes.error;

      setBooks(booksRes.data || []);
      setSales(salesRes.data || []);
      setError("");
    } catch (err) {
      setError("Failed to sync inventory data. Refreshing...");
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) fetchData();
  }, [session, fetchData]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const counts = useMemo(() => {
    if (!books) return {};
    const c = {};
    for (const b of books) c[b.shelf] = (c[b.shelf] || 0) + 1;
    return c;
  }, [books]);

  const maxCount = useMemo(() => Math.max(1, ...Object.values(counts)), [counts]);

  const filteredInventory = useMemo(() => {
    if (!books) return [];
    return books
      .filter((b) => (shelfFilter ? b.shelf === shelfFilter : true))
      .filter((b) => b.title.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => a.shelf.localeCompare(b.shelf) || a.title.localeCompare(b.title));
  }, [books, shelfFilter, search]);

  const sellResults = useMemo(() => {
    if (!books || !sellSearch.trim()) return [];
    const q = sellSearch.trim().toLowerCase();
    return books.filter((b) => b.title.toLowerCase().includes(q)).slice(0, 20);
  }, [books, sellSearch]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) {
      setAddErr("Enter a title first.");
      return;
    }
    setAddErr("");

    const { data, error: insertErr } = await supabase
      .from("books")
      .insert([{ title, shelf: newShelf }])
      .select();

    if (insertErr) {
      setAddErr("Could not save book. Please try again.");
      return;
    }

    if (data) setBooks((prev) => [...(prev || []), ...data]);
    setNewTitle("");
    setToast({ kind: "add", text: `Added "${title}" to shelf ${newShelf}` });
  };

  const handleSell = async (book) => {
    const { error: delErr } = await supabase.from("books").delete().eq("id", book.id);
    if (delErr) {
      setError("Failed to complete sale. Try again.");
      return;
    }

    const { data: saleData } = await supabase
      .from("sales_log")
      .insert([{ title: book.title, shelf: book.shelf }])
      .select();

    setBooks((prev) => (prev || []).filter((b) => b.id !== book.id));
    if (saleData) setSales((prev) => [saleData[0], ...(prev || [])]);
    setToast({ kind: "sell", text: `Sold "${book.title}" from shelf ${book.shelf}` });
  };

  if (authLoading) return <div style={styles.loading}>Checking credentials…</div>;
  if (!session) return <AuthView />;

  const loading = books === null || sales === null;
  const totalBooks = books ? books.length : 0;

  return (
    <div style={styles.app}>
      <style>{FONT_IMPORT}</style>
      <style>{`
        .bs-input, .bs-select {
          font-family: 'Inter', sans-serif;
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--ink);
          border-radius: 6px;
          padding: 9px 12px;
          font-size: 14px;
          outline: none;
        }
        .bs-input:focus, .bs-select:focus { border-color: var(--green); }
        .bs-btn {
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          font-size: 14px;
          border-radius: 6px;
          padding: 9px 16px;
          border: 1px solid transparent;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .bs-btn:active { transform: scale(0.98); }
        .bs-tab {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 500;
          padding: 10px 4px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--ink-faint);
          border-bottom: 2px solid transparent;
        }
        .bs-tab.active { color: var(--ink); border-bottom-color: var(--green); }
      `}</style>

      <header style={styles.header}>
        <div>
          <div style={styles.brand}>Books Galore</div>
          <div style={styles.tagline}>Shelf inventory &amp; point of sale</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={styles.headerStat}>
            <div style={styles.headerStatNum}>{totalBooks}</div>
            <div style={styles.headerStatLabel}>books on shelves</div>
          </div>
          <button
            className="bs-btn"
            onClick={() => supabase.auth.signOut()}
            title="Sign out"
            style={{ ...styles.chipBtn, padding: "7px 9px", color: "var(--ink-faint)" }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <ShelfSpines counts={counts} active={shelfFilter} onSelect={setShelfFilter} maxCount={maxCount} />

      <nav style={styles.tabs}>
        <button className={`bs-tab ${tab === "inventory" ? "active" : ""}`} onClick={() => setTab("inventory")}>
          <BookOpen size={14} style={{ verticalAlign: -2, marginRight: 5 }} /> Inventory
        </button>
        <button className={`bs-tab ${tab === "sell" ? "active" : ""}`} onClick={() => setTab("sell")}>
          <ShoppingCart size={14} style={{ verticalAlign: -2, marginRight: 5 }} /> Sell
        </button>
        <button className={`bs-tab ${tab === "log" ? "active" : ""}`} onClick={() => setTab("log")}>
          <Clock size={14} style={{ verticalAlign: -2, marginRight: 5 }} /> Activity
        </button>
      </nav>

      {loading ? (
        <div style={styles.loading}>Loading shelves…</div>
      ) : tab === "inventory" ? (
        <div>
          <form onSubmit={handleAdd} style={styles.addForm}>
            <input
              className="bs-input"
              style={{ flex: 1, minWidth: 160 }}
              placeholder="Book title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <select className="bs-select" value={newShelf} onChange={(e) => setNewShelf(e.target.value)}>
              {SHELVES.map((s) => (
                <option key={s} value={s}>Shelf {s}</option>
              ))}
            </select>
            <button className="bs-btn" type="submit" style={styles.primaryBtn}>
              <Plus size={15} /> Add book
            </button>
          </form>
          {addErr && <div style={styles.fieldError}>{addErr}</div>}

          <div style={styles.searchRow}>
            <Search size={15} color="var(--ink-faint)" />
            <input
              className="bs-input"
              style={{ border: "none", background: "transparent", flex: 1, padding: "9px 4px" }}
              placeholder={shelfFilter ? `Search shelf ${shelfFilter}…` : "Search all shelves…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {shelfFilter && (
              <button className="bs-btn" style={styles.chipBtn} onClick={() => setShelfFilter(null)}>
                Shelf {shelfFilter} <X size={12} />
              </button>
            )}
          </div>

          {filteredInventory.length === 0 ? (
            <div style={styles.empty}>
              {books.length === 0 ? "No books yet. Add the first one above." : "No books match this search."}
            </div>
          ) : (
            <div style={styles.list}>
              {filteredInventory.map((b) => (
                <div key={b.id} style={styles.row}>
                  <span style={styles.shelfTag}>{b.shelf}</span>
                  <span style={styles.rowTitle}>{b.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : tab === "sell" ? (
        <div>
          <div style={styles.searchRow}>
            <Search size={15} color="var(--ink-faint)" />
            <input
              className="bs-input"
              style={{ border: "none", background: "transparent", flex: 1, padding: "9px 4px" }}
              placeholder="Type a title to find and sell it"
              value={sellSearch}
              onChange={(e) => setSellSearch(e.target.value)}
              autoFocus
            />
          </div>

          {sellSearch.trim() === "" ? (
            <div style={styles.empty}>Start typing a book title to find it on the shelf.</div>
          ) : sellResults.length === 0 ? (
            <div style={styles.empty}>No matching book in stock.</div>
          ) : (
            <div style={styles.list}>
              {sellResults.map((b) => (
                <div key={b.id} style={styles.row}>
                  <span style={styles.shelfTag}>{b.shelf}</span>
                  <span style={styles.rowTitle}>{b.title}</span>
                  <button className="bs-btn" style={styles.sellBtn} onClick={() => handleSell(b)}>
                    <Check size={14} /> Sell
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {sales.length === 0 ? (
            <div style={styles.empty}>No sales logged yet.</div>
          ) : (
            <div style={styles.list}>
              {sales.map((s) => (
                <div key={s.id} style={styles.row}>
                  <span style={styles.shelfTag}>{s.shelf}</span>
                  <span style={styles.rowTitle}>{s.title}</span>
                  <span style={styles.rowTime}>
                    {new Date(s.sold_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {toast && (
        <div style={{ ...styles.toast, borderColor: toast.kind === "sell" ? "var(--rust)" : "var(--green)" }}>
          {toast.kind === "sell" ? <ShoppingCart size={14} /> : <Plus size={14} />}
          <span>{toast.text}</span>
        </div>
      )}

      <p style={styles.sharedNote}>Logged in as {session.user.email} • Changes sync automatically</p>
    </div>
  );
}

const styles = {
  app: {
    "--ink": "#242E27",
    "--ink-faint": "#7C8378",
    "--paper": "#F1EAD6",
    "--panel": "#FFFDF7",
    "--green": "#3E5C43",
    "--rust": "#B4482F",
    "--gold": "#C79A3B",
    "--border": "#DCD3B8",
    "--spine-empty": "#E4DCC4",
    fontFamily: "'Inter', sans-serif",
    color: "var(--ink)",
    background: "var(--paper)",
    borderRadius: 14,
    padding: "20px 22px 24px",
    maxWidth: 680,
    margin: "30px auto",
    position: "relative",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 },
  brand: { fontFamily: "'Spectral', serif", fontWeight: 600, fontSize: 26, letterSpacing: "-0.01em" },
  tagline: { fontSize: 13, color: "var(--ink-faint)", marginTop: 2 },
  headerStat: { textAlign: "right" },
  headerStatNum: { fontFamily: "'Spectral', serif", fontSize: 22, fontWeight: 600, lineHeight: 1 },
  headerStatLabel: { fontSize: 11, color: "var(--ink-faint)", marginTop: 2 },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#F6E3DC",
    color: "#7A3A22",
    border: "1px solid #E4B8A2",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
    marginBottom: 14,
  },
  fieldLabel: { display: "block", fontSize: 12, fontWeight: 500, color: "var(--ink-faint)", marginBottom: 4 },
  spineRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 3,
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "12px 10px 8px",
    marginBottom: 16,
    overflowX: "auto",
  },
  spine: {
    flex: "1 0 auto",
    width: 18,
    borderRadius: "3px 3px 2px 2px",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingBottom: 4,
    transition: "transform 120ms ease",
  },
  spineLetter: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    fontWeight: 500,
    writingMode: "horizontal-tb",
  },
  tabs: { display: "flex", gap: 20, borderBottom: "1px solid var(--border)", marginBottom: 16 },
  loading: { padding: "40px 0", textAlign: "center", color: "var(--ink-faint)", fontSize: 14 },
  addForm: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 },
  primaryBtn: { background: "var(--green)", color: "#F3F0E2", border: "1px solid var(--green)" },
  sellBtn: { background: "var(--rust)", color: "#FBEFE9", border: "1px solid var(--rust)", marginLeft: "auto" },
  chipBtn: { background: "var(--panel)", color: "var(--ink)", border: "1px solid var(--border)", padding: "6px 10px", fontSize: 13 },
  fieldError: { color: "var(--rust)", fontSize: 12.5, marginBottom: 10 },
  searchRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "2px 10px",
    marginBottom: 14,
  },
  list: { display: "flex", flexDirection: "column", gap: 1, borderTop: "1px solid var(--border)" },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "var(--panel)",
    borderBottom: "1px solid var(--border)",
    padding: "10px 12px",
    fontSize: 14,
  },
  shelfTag: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 12,
    fontWeight: 500,
    background: "var(--paper)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "2px 7px",
    color: "var(--green)",
    flexShrink: 0,
  },
  rowTitle: { flex: 1 },
  rowTime: { fontSize: 12, color: "var(--ink-faint)" },
  empty: {
    textAlign: "center",
    color: "var(--ink-faint)",
    fontSize: 13.5,
    padding: "32px 12px",
    border: "1px dashed var(--border)",
    borderRadius: 8,
  },
  toast: {
    position: "absolute",
    bottom: 16,
    left: "50%",
    transform: "translateX(-50%)",
    background: "var(--ink)",
    color: "#F3F0E2",
    borderRadius: 8,
    padding: "9px 16px",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderLeft: "3px solid",
    boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
  },
  sharedNote: { fontSize: 11.5, color: "var(--ink-faint)", textAlign: "center", marginTop: 18 },
};
