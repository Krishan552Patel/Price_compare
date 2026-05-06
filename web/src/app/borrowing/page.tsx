"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import CardImage from "@/components/CardImage";
import type { BorrowContact, BorrowRecord } from "@/lib/auth-queries";

// ── helpers ────────────────────────────────────────────────────

function fmt(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-CA", {
    year: "numeric", month: "short", day: "numeric",
  });
}

type Direction = "borrowed" | "lent";

// ── Card search modal ──────────────────────────────────────────

interface SearchResult {
  unique_id: string;
  name: string;
  type_text: string | null;
  image_url: string | null;
}

function CardSearchModal({
  onSelect,
  onClose,
}: {
  onSelect: (card: SearchResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        setResults(data ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="font-semibold text-white">Search Card</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-4">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type card name…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-800">
          {loading && <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="px-4 py-3 text-sm text-gray-400">No results</div>
          )}
          {results.map((card) => (
            <button
              key={card.unique_id}
              onClick={() => onSelect(card)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded overflow-hidden shrink-0 bg-gray-800">
                {card.image_url && (
                  <img src={card.image_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium text-white">{card.name}</div>
                {card.type_text && <div className="text-xs text-gray-500">{card.type_text}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Add record modal ───────────────────────────────────────────

function AddRecordModal({
  contacts,
  onSave,
  onClose,
}: {
  contacts: BorrowContact[];
  onSave: (data: {
    contactId: string;
    cardUniqueId: string;
    cardName: string;
    imageUrl: string | null;
    direction: Direction;
    qty: number;
    borrowedDate: string;
    notes: string | null;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"form" | "card">("form");
  const [selectedCard, setSelectedCard] = useState<SearchResult | null>(null);
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [direction, setDirection] = useState<Direction>("lent");
  const [qty, setQty] = useState(1);
  const [borrowedDate, setBorrowedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!selectedCard || !contactId) return;
    setSaving(true);
    await onSave({
      contactId,
      cardUniqueId: selectedCard.unique_id,
      cardName: selectedCard.name,
      imageUrl: selectedCard.image_url,
      direction,
      qty,
      borrowedDate,
      notes: notes.trim() || null,
    });
    setSaving(false);
  }

  return (
    <>
      {step === "card" && (
        <CardSearchModal
          onSelect={(c) => { setSelectedCard(c); setStep("form"); }}
          onClose={() => setStep("form")}
        />
      )}
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="font-semibold text-white">Add Borrow Record</span>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
          </div>
          <div className="p-4 space-y-4">
            {/* Card picker */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Card</label>
              <button
                onClick={() => setStep("card")}
                className="w-full flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-left hover:border-gray-500 transition-colors"
              >
                {selectedCard ? (
                  <>
                    {selectedCard.image_url && (
                      <img src={selectedCard.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                    )}
                    <span className="text-sm text-white">{selectedCard.name}</span>
                  </>
                ) : (
                  <span className="text-sm text-gray-500">Click to search…</span>
                )}
              </button>
            </div>

            {/* Contact */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Person</label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Direction */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Direction</label>
              <div className="flex gap-2">
                {(["lent", "borrowed"] as Direction[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      direction === d
                        ? d === "lent"
                          ? "bg-blue-600 text-white"
                          : "bg-amber-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {d === "lent" ? "I lent it" : "I borrowed it"}
                  </button>
                ))}
              </div>
            </div>

            {/* Qty + Date */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-400 mb-1">Qty</label>
                <input
                  type="number" min={1} value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-400 mb-1">Date</label>
                <input
                  type="date" value={borrowedDate}
                  onChange={(e) => setBorrowedDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Notes (optional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. tournament loan"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedCard || !contactId || saving}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Add Record"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Record card ────────────────────────────────────────────────

function RecordCard({
  record,
  onReturn,
  onDelete,
}: {
  record: BorrowRecord;
  onReturn: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isReturned = !!record.returned_date;
  const isLent = record.direction === "lent";

  return (
    <div className={`bg-gray-900 border rounded-xl p-4 flex gap-3 ${isReturned ? "border-gray-800 opacity-60" : isLent ? "border-blue-800" : "border-amber-800"}`}>
      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-800">
        {record.image_url ? (
          <CardImage src={record.image_url} alt={record.card_name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">?</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-medium text-white text-sm">{record.card_name}</span>
            {record.qty > 1 && <span className="ml-1.5 text-xs text-gray-400">×{record.qty}</span>}
          </div>
          <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
            isReturned ? "bg-gray-800 text-gray-400" :
            isLent ? "bg-blue-900 text-blue-300" : "bg-amber-900 text-amber-300"
          }`}>
            {isReturned ? "Returned" : isLent ? "Lent" : "Borrowed"}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {isLent ? "To" : "From"}: <span className="text-gray-300">{record.contact_name}</span>
          <span className="mx-1.5">·</span>
          {fmt(record.borrowed_date)}
          {isReturned && record.returned_date && (
            <> → returned {fmt(record.returned_date)}</>
          )}
        </div>
        {record.notes && <div className="text-xs text-gray-500 mt-0.5 italic">{record.notes}</div>}
      </div>
      {!isReturned && (
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={() => onReturn(record.id)}
            className="text-xs px-2 py-1 rounded bg-green-900 text-green-300 hover:bg-green-800 transition-colors"
            title="Mark returned"
          >
            ✓ Done
          </button>
          <button
            onClick={() => onDelete(record.id)}
            className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:bg-red-900 hover:text-red-300 transition-colors"
            title="Delete"
          >
            Delete
          </button>
        </div>
      )}
      {isReturned && (
        <button
          onClick={() => onDelete(record.id)}
          className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-500 hover:bg-red-900 hover:text-red-300 transition-colors shrink-0 self-start"
          title="Delete"
        >
          Delete
        </button>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────

export default function BorrowingPage() {
  const { status } = useSession();
  const [contacts, setContacts] = useState<BorrowContact[]>([]);
  const [records, setRecords] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactNotes, setNewContactNotes] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  const [showAddRecord, setShowAddRecord] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "returned">("active");
  const [dirFilter, setDirFilter] = useState<"all" | Direction>("all");

  const load = useCallback(async () => {
    const [c, r] = await Promise.all([
      fetch("/api/borrowing/contacts").then((x) => x.json()),
      fetch("/api/borrowing/records").then((x) => x.json()),
    ]);
    setContacts(c ?? []);
    setRecords(r ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  async function addContact() {
    if (!newContactName.trim()) return;
    setSavingContact(true);
    const r = await fetch("/api/borrowing/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newContactName.trim(), notes: newContactNotes.trim() || null }),
    });
    if (r.ok) {
      const contact = await r.json();
      setContacts((prev) => [...prev, contact].sort((a, b) => a.name.localeCompare(b.name)));
      setNewContactName("");
      setNewContactNotes("");
      setShowAddContact(false);
    }
    setSavingContact(false);
  }

  async function deleteContact(id: string) {
    if (!confirm("Delete this contact? All their borrow records will also be deleted.")) return;
    await fetch(`/api/borrowing/contacts/${id}`, { method: "DELETE" });
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setRecords((prev) => prev.filter((r) => r.contact_id !== id));
  }

  async function addRecord(data: {
    contactId: string; cardUniqueId: string; cardName: string;
    imageUrl: string | null; direction: Direction; qty: number;
    borrowedDate: string; notes: string | null;
  }) {
    const r = await fetch("/api/borrowing/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) {
      const record = await r.json();
      setRecords((prev) => [record, ...prev]);
      setShowAddRecord(false);
    }
  }

  async function markReturned(id: string) {
    await fetch(`/api/borrowing/records/${id}`, { method: "PATCH" });
    setRecords((prev) =>
      prev.map((rec) =>
        rec.id === id ? { ...rec, returned_date: new Date().toISOString().slice(0, 10) } : rec
      )
    );
  }

  async function deleteRecord(id: string) {
    await fetch(`/api/borrowing/records/${id}`, { method: "DELETE" });
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  if (status === "unauthenticated") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
          <svg className="w-8 h-8 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Borrowing Tracker</h1>
        <p className="text-gray-400 mb-6">Sign in to track cards you&apos;ve lent or borrowed.</p>
        <Link
          href="/login?callbackUrl=/borrowing"
          className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-medium transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  const filteredRecords = records.filter((r) => {
    if (filter === "active" && r.returned_date) return false;
    if (filter === "returned" && !r.returned_date) return false;
    if (dirFilter !== "all" && r.direction !== dirFilter) return false;
    return true;
  });

  const lentActive = records.filter((r) => !r.returned_date && r.direction === "lent");
  const borrowedActive = records.filter((r) => !r.returned_date && r.direction === "borrowed");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Borrowing Tracker</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {lentActive.length > 0 && `${lentActive.length} lent out`}
            {lentActive.length > 0 && borrowedActive.length > 0 && " · "}
            {borrowedActive.length > 0 && `${borrowedActive.length} borrowed`}
            {lentActive.length === 0 && borrowedActive.length === 0 && "No active loans"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/players"
            className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Browse Players
          </Link>
          {contacts.length > 0 && (
            <button
              onClick={() => setShowAddRecord(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              + Add Record
            </button>
          )}
        </div>
      </div>

      {/* Contacts panel */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="font-semibold text-white text-sm">People</h2>
          <button
            onClick={() => setShowAddContact(!showAddContact)}
            className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            + Add Person
          </button>
        </div>

        {showAddContact && (
          <div className="p-4 border-b border-gray-800 bg-gray-950 space-y-2">
            <input
              autoFocus
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addContact()}
              placeholder="Name"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              value={newContactNotes}
              onChange={(e) => setNewContactNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowAddContact(false); setNewContactName(""); setNewContactNotes(""); }}
                className="flex-1 py-1.5 rounded bg-gray-800 text-gray-400 text-sm hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={addContact} disabled={savingContact || !newContactName.trim()}
                className="flex-1 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-40">
                {savingContact ? "Saving…" : "Add"}
              </button>
            </div>
          </div>
        )}

        {contacts.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            Add people to start tracking loans.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 p-4">
            {contacts.map((c) => {
              const active = records.filter((r) => r.contact_id === c.id && !r.returned_date).length;
              return (
                <div key={c.id} className="flex items-center gap-1.5 bg-gray-800 rounded-full px-3 py-1.5 group">
                  <span className="text-sm text-white">{c.name}</span>
                  {active > 0 && (
                    <span className="text-xs bg-blue-600 text-white rounded-full px-1.5 py-0.5 font-medium">{active}</span>
                  )}
                  <button
                    onClick={() => deleteContact(c.id)}
                    className="ml-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm leading-none"
                    title="Remove contact"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Records section */}
      <div>
        <div className="flex items-center flex-wrap gap-2 mb-4">
          <h2 className="font-semibold text-white mr-2">Records</h2>
          {/* Status filter */}
          <div className="flex bg-gray-900 border border-gray-800 rounded-lg overflow-hidden text-xs">
            {(["active", "all", "returned"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 capitalize transition-colors ${filter === f ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}>
                {f}
              </button>
            ))}
          </div>
          {/* Direction filter */}
          <div className="flex bg-gray-900 border border-gray-800 rounded-lg overflow-hidden text-xs">
            {([["all", "All"], ["lent", "Lent"], ["borrowed", "Borrowed"]] as [string, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setDirFilter(v as "all" | Direction)}
                className={`px-3 py-1.5 transition-colors ${dirFilter === v ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {contacts.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            Add a person above, then track cards.
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            {filter === "active" ? "No active loans." : "No records."}
            {filter !== "returned" && contacts.length > 0 && (
              <> <button onClick={() => setShowAddRecord(true)} className="text-blue-400 hover:underline">Add one?</button></>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRecords.map((r) => (
              <RecordCard key={r.id} record={r} onReturn={markReturned} onDelete={deleteRecord} />
            ))}
          </div>
        )}
      </div>

      {showAddRecord && contacts.length > 0 && (
        <AddRecordModal contacts={contacts} onSave={addRecord} onClose={() => setShowAddRecord(false)} />
      )}
    </div>
  );
}
