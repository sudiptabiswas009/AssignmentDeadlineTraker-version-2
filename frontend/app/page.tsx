"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

// =====================================================
// TYPES + CONSTANTS
// =====================================================

type Assignment = {
  id: number;
  title: string;
  subject: string;
  description: string;
  deadline: string;
  status: string;
};

type Tab = "view" | "add";
type Filter = "All" | "Pending" | "Completed" | "Overdue" | "Due Today";
type SortKey = "soonest" | "latest" | "subject" | "newest";
type View = "list" | "calendar";
type Toast = { type: "success" | "error"; text: string; undo?: boolean } | null;
type EditForm = Omit<Assignment, "id"> & { id: number };
type Origin = { x: number; y: number };

const FILTERS: Filter[] = ["All", "Pending", "Completed"];
const STATUSES = ["Pending", "Completed"];
const SORTS: { key: SortKey; label: string }[] = [
  { key: "soonest", label: "Soonest deadline" },
  { key: "latest", label: "Latest deadline" },
  { key: "subject", label: "Subject A–Z" },
  { key: "newest", label: "Newest added" },
];

const inputStyle =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";
const selectStyle = inputStyle.replace("w-full ", "");

const emptyForm = { id: "", title: "", subject: "", description: "", deadline: "", status: "Pending" };

const GRADIENT = {
  indigo: "linear-gradient(135deg, #4f46e5, #7c3aed 55%, #d946ef)",
  green: "linear-gradient(135deg, #10b981, #14b8a6 55%, #0ea5e9)",
};

// Every subject gets a colour (same subject = same colour, always)
const PALETTE = [
  { chip: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500" },
  { chip: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
  { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  { chip: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  { chip: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  { chip: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  { chip: "bg-teal-50 text-teal-700 ring-teal-200", dot: "bg-teal-500" },
  { chip: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500" },
];

function subjectColor(subject: string) {
  let hash = 0;
  for (const ch of subject.trim().toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

// =====================================================
// DATE HELPERS  (screen = dd/mm/yyyy, backend = yyyy-mm-dd)
// =====================================================

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Accepts "22/09/2026", "2026-09-22" or "2026-09-22T00:00:00" -> "2026-09-22"
function toISO(value: string) {
  const text = value.trim();
  const dmy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : text.slice(0, 10);
}

// Shows any date as dd/mm/yyyy
function formatDate(value: string) {
  const [year, month, day] = toISO(value).split("-");
  return `${day}/${month}/${year}`;
}

// Auto-inserts the slashes while typing: 22092026 -> 22/09/2026
function maskDate(input: string) {
  const d = input.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/");
}

// Checks that dd/mm/yyyy is a real calendar date (rejects 31/02/2026)
function isValidDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;

  const [, d, m, y] = match.map(Number);
  const date = new Date(y, m - 1, d);

  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function daysLeft(deadline: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(`${toISO(deadline)}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function urgency(days: number) {
  if (days < 0) return { label: "Overdue", style: "bg-red-50 text-red-700 ring-red-200", stripe: "border-l-red-500" };
  if (days === 0) return { label: "Due today", style: "bg-red-50 text-red-700 ring-red-200", stripe: "border-l-red-500" };
  if (days <= 3) {
    return {
      label: `${days} day${days === 1 ? "" : "s"} left`,
      style: "bg-amber-50 text-amber-800 ring-amber-200",
      stripe: "border-l-amber-400",
    };
  }
  return { label: `${days} days left`, style: "bg-emerald-50 text-emerald-700 ring-emerald-200", stripe: "border-l-emerald-500" };
}

// =====================================================
// SMALL HELPERS
// =====================================================

const isDone = (a: Assignment) => a.status === "Completed";
const cmpDeadline = (a: Assignment, b: Assignment) => toISO(a.deadline).localeCompare(toISO(b.deadline));

const SORTERS: Record<SortKey, (a: Assignment, b: Assignment) => number> = {
  soonest: cmpDeadline,
  latest: (a, b) => cmpDeadline(b, a),
  subject: (a, b) => a.subject.localeCompare(b.subject) || cmpDeadline(a, b),
  newest: (a, b) => b.id - a.id,
};

function matchesFilter(a: Assignment, filter: Filter) {
  const days = daysLeft(a.deadline);
  if (filter === "Pending") return !isDone(a);
  if (filter === "Completed") return isDone(a);
  if (filter === "Overdue") return !isDone(a) && days < 0;
  if (filter === "Due Today") return !isDone(a) && days === 0;
  return true;
}

// One helper for every backend call (throws on any error response)
async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  const data = await res.json().catch(() => null);

  if (!res.ok) throw new Error(data?.error ?? `Server responded with ${res.status}`);
  return data as T;
}

const jsonPost = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// Small confetti burst (no CSS needed, uses the Web Animations API).
// It is only decoration, so it must never break the real action.
function confetti({ x, y }: Origin) {
  if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#0ea5e9"];

  try {
    for (let i = 0; i < 36; i++) {
      const piece = document.createElement("i");
      Object.assign(piece.style, {
        position: "fixed",
        left: `${x}px`,
        top: `${y}px`,
        width: "8px",
        height: "12px",
        borderRadius: "2px",
        background: colors[i % colors.length],
        pointerEvents: "none",
        zIndex: "90",
      });
      document.body.appendChild(piece);

      const dx = (Math.random() - 0.5) * 260;
      const dy = -40 + Math.random() * 200;
      const rot = Math.random() * 720 - 360;

      const animation = piece.animate(
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0 },
        ],
        { duration: 1100, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" }
      );
      animation.onfinish = () => piece.remove();
    }
  } catch {
    /* ignore: confetti is optional */
  }
}

const centerOf = (e: ReactMouseEvent<HTMLElement>): Origin => {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

// =====================================================
// BROWSER NOTIFICATIONS
// =====================================================

const NOTIFY_KEY = "at-notifications"; // "on" once the user turned them on
const SENT_KEY = "at-notified"; // keys of reminders already shown today

type NotifPermission = NotificationPermission | "unsupported" | null;

function readSent(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Shows a pop-up for every pending assignment that is overdue, due today or due tomorrow.
// Each assignment is announced once per day (and again when its stage changes).
function sendDueNotifications(list: Assignment[], onClick: (id: number) => void) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const today = isoOf(new Date());
  const sent = readSent().filter((k) => k.endsWith(`|${today}`)); // yesterday's keys are dropped
  const fresh: { a: Assignment; days: number; text: string }[] = [];

  for (const a of list) {
    const days = daysLeft(a.deadline);
    if (isDone(a) || days > 1) continue;

    const stage = days < 0 ? "overdue" : days === 0 ? "today" : "tomorrow";
    const key = `${a.id}|${stage}|${today}`;
    if (sent.includes(key)) continue;

    sent.push(key);
    fresh.push({
      a,
      days,
      text: days < 0 ? `overdue by ${-days} day${-days === 1 ? "" : "s"}` : days === 0 ? "due today" : "due tomorrow",
    });
  }

  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(sent));
  } catch {
    /* storage unavailable: worst case the reminder repeats */
  }

  if (fresh.length === 0) return;
  fresh.sort((x, y) => x.days - y.days);

  try {
    if (fresh.length <= 3) {
      fresh.forEach(({ a, text }) => {
        const n = new Notification(a.title, { body: `${a.subject} · ${text}`, tag: `assignment-${a.id}` });
        n.onclick = () => {
          window.focus();
          onClick(a.id);
          n.close();
        };
      });
    } else {
      const n = new Notification(`${fresh.length} assignments need attention`, {
        body:
          fresh
            .slice(0, 3)
            .map(({ a, text }) => `${a.title} (${text})`)
            .join("\n") + `\n+ ${fresh.length - 3} more`,
        tag: "assignment-summary",
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  } catch {
    /* some browsers (for example Chrome on Android) don't allow new Notification() */
  }
}

// =====================================================
// SMALL COMPONENTS
// =====================================================

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusPicker({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-slate-700">Status</legend>
      <div className="grid grid-cols-2 gap-2">
        {STATUSES.map((option) => (
          <label
            key={option}
            className={`cursor-pointer rounded-xl border px-4 py-2.5 text-center text-sm font-medium transition ${
              value === option
                ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const C = 2 * Math.PI * 26;
  const [shown, setShown] = useState(0);

  // start empty, then fill so the ring animates
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div className="shrink-0 text-center">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r="26" fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke="#6366f1"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - shown)}
            style={{ transition: "stroke-dashoffset .8s cubic-bezier(.3,.7,.3,1)" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-800">
          {Math.round(pct * 100)}%
        </span>
      </div>
      <p className="mt-0.5 text-[11px] font-medium text-slate-500">completed</p>
    </div>
  );
}

// "Next up": the most urgent pending assignment
function HeroCard({
  next,
  empty,
  onDone,
  onOpen,
  onAdd,
}: {
  next?: Assignment;
  empty: boolean;
  onDone: (id: number) => void;
  onOpen: (id: number) => void;
  onAdd: () => void;
}) {
  const box = "mb-5 overflow-hidden rounded-3xl p-5 text-white shadow-lg";
  const eyebrow = "text-xs font-semibold uppercase tracking-widest text-white/80";

  if (empty) {
    return (
      <div className={box} style={{ backgroundImage: GRADIENT.indigo }}>
        <p className={eyebrow}>Get started</p>
        <h2 className="mt-1 text-2xl font-bold">Add your first assignment</h2>
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
        >
          Add assignment
        </button>
      </div>
    );
  }

  if (!next) {
    return (
      <div className={box} style={{ backgroundImage: GRADIENT.green }}>
        <p className={eyebrow}>All clear</p>
        <h2 className="mt-1 text-2xl font-bold">You&apos;re all caught up 🎉</h2>
        <p className="mt-1 text-sm text-white/90">Nothing pending. Enjoy the free time.</p>
      </div>
    );
  }

  const days = daysLeft(next.deadline);
  const big = days < 0 ? "Overdue" : days === 0 ? "Today" : String(days);
  const small =
    days < 0 ? `${-days} day${-days === 1 ? "" : "s"} ago` : days === 0 ? "due today" : days === 1 ? "day left" : "days left";
  const desc = next.description?.trim();

  return (
    <div className={box} style={{ backgroundImage: GRADIENT.indigo }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={eyebrow}>Next up</p>
          <h2 className="mt-1 truncate text-2xl font-bold">{next.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/90">
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">{next.subject}</span>
            <span>Due {formatDate(next.deadline)}</span>
          </div>
          {desc && <p className="mt-2 truncate text-sm text-white/80">{desc}</p>}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-3xl font-extrabold leading-none">{big}</p>
          <p className="mt-1 text-xs text-white/80">{small}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => onDone(next.id)}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
        >
          Mark as done
        </button>
        <button
          type="button"
          onClick={() => onOpen(next.id)}
          className="rounded-xl bg-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/30"
        >
          Details
        </button>
      </div>
    </div>
  );
}

function AssignmentCard({
  a,
  onOpen,
  onTick,
}: {
  a: Assignment;
  onOpen: (id: number) => void;
  onTick: (id: number) => void;
}) {
  const done = isDone(a);
  const u = urgency(daysLeft(a.deadline));
  const col = subjectColor(a.subject);
  const desc = a.description?.trim();

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={() => onOpen(a.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(a.id);
        }
      }}
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border border-l-4 border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        done ? "border-l-slate-300 opacity-70" : u.stripe
      }`}
    >
      {/* Round tick: asks for confirmation before completing */}
      <button
        type="button"
        disabled={done}
        aria-label={done ? "Completed" : "Mark as completed"}
        title={done ? "Completed" : "Mark as completed"}
        onClick={(e) => {
          e.stopPropagation();
          onTick(a.id);
        }}
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
          done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-slate-300 text-transparent hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-500"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className={`truncate font-semibold text-slate-900 ${done ? "line-through" : ""}`}>{a.title}</h3>
          <span
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
              done ? "bg-slate-100 text-slate-600 ring-slate-200" : u.style
            }`}
          >
            {done ? "Completed" : u.label}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">ID {a.id}</span>
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${col.chip}`}>{a.subject}</span>
          <span>Due {formatDate(a.deadline)}</span>
        </div>

        {desc && <p className="mt-2 truncate text-sm text-slate-500">{desc}</p>}
      </div>
    </li>
  );
}

function CalendarView({
  items,
  cal,
  day,
  onMonth,
  onToday,
  onPick,
  onOpen,
  onTick,
}: {
  items: Assignment[];
  cal: { y: number; m: number };
  day: string | null;
  onMonth: (delta: number) => void;
  onToday: () => void;
  onPick: (iso: string) => void;
  onOpen: (id: number) => void;
  onTick: (id: number) => void;
}) {
  const { y, m } = cal;

  const byDay: Record<string, Assignment[]> = {};
  items.forEach((a) => {
    const key = toISO(a.deadline);
    byDay[key] = [...(byDay[key] ?? []), a];
  });

  const offset = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const total = new Date(y, m + 1, 0).getDate();
  const cells = Math.ceil((offset + total) / 7) * 7;
  const today = isoOf(new Date());
  const label = new Date(y, m, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const dayItems = day ? byDay[day] ?? [] : [];

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonth(-1)}
            className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100"
          >
            ‹
          </button>

          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900">{label}</p>
            <button
              type="button"
              onClick={onToday}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              Today
            </button>
          </div>

          <button
            type="button"
            aria-label="Next month"
            onClick={() => onMonth(1)}
            className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100"
          >
            ›
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-slate-400">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: cells }, (_, i) => {
            const n = i - offset + 1;
            if (n < 1 || n > total) return <div key={i} className="h-14 sm:h-16" />;

            const iso = `${y}-${pad(m + 1)}-${pad(n)}`;
            const list = byDay[iso] ?? [];

            return (
              <button
                key={i}
                type="button"
                aria-label={`Day ${n}, ${list.length} due`}
                data-iso={iso}
                onClick={() => onPick(iso)}
                className={`flex h-14 flex-col items-center justify-between rounded-xl border p-1.5 text-sm transition sm:h-16 ${
                  iso === day ? "border-indigo-300 bg-indigo-50" : "border-transparent hover:bg-slate-100"
                } ${iso === today ? "font-bold text-indigo-700 ring-2 ring-indigo-500" : "text-slate-700"}`}
              >
                <span>{n}</span>
                <span className="flex items-center gap-0.5">
                  {list.slice(0, 3).map((a) => (
                    <span
                      key={a.id}
                      className={`h-1.5 w-1.5 rounded-full ${subjectColor(a.subject).dot} ${isDone(a) ? "opacity-30" : ""}`}
                    />
                  ))}
                  {list.length > 3 && <span className="text-[10px] font-medium text-slate-400">+{list.length - 3}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {day === null ? (
        <p className="mt-4 text-center text-sm text-slate-500">Pick a day to see what&apos;s due.</p>
      ) : (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">{formatDate(day)}</p>
          {dayItems.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              Nothing due on this day.
            </p>
          ) : (
            <ul className="space-y-3">
              {dayItems.map((a) => (
                <AssignmentCard key={a.id} a={a} onOpen={onOpen} onTick={onTick} />
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

// ---------- popups ----------

function Overlay({
  onClose,
  z = "z-50",
  dim = "bg-slate-900/40",
  children,
}: {
  onClose: () => void;
  z?: string;
  dim?: string;
  children: ReactNode;
}) {
  return (
    <div className={`at-fade fixed inset-0 ${z} flex items-center justify-center px-4 ${dim}`} onClick={onClose}>
      {children}
    </div>
  );
}

function Dialog({
  label,
  role = "dialog",
  className,
  children,
}: {
  label: string;
  role?: "dialog" | "alertdialog";
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      role={role}
      aria-modal="true"
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      className={`at-pop ${className}`}
    >
      {children}
    </div>
  );
}

function DetailsModal({
  a,
  onClose,
  onEdit,
  onDelete,
}: {
  a: Assignment;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const col = subjectColor(a.subject);
  const desc = a.description?.trim();

  return (
    <Overlay onClose={onClose}>
      <Dialog label="Assignment details" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Assignment Details</p>
        <h2 className="mt-1 break-words text-xl font-bold text-slate-900">{a.title}</h2>

        <dl className="mt-5 grid grid-cols-[6rem_1fr] items-center gap-x-4 gap-y-3 text-sm">
          <dt className="text-slate-500">ID</dt>
          <dd className="font-medium text-slate-900">{a.id}</dd>

          <dt className="text-slate-500">Subject</dt>
          <dd>
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${col.chip}`}>{a.subject}</span>
          </dd>

          <dt className="text-slate-500">Deadline</dt>
          <dd className="font-medium text-slate-900">{formatDate(a.deadline)}</dd>

          <dt className="text-slate-500">Status</dt>
          <dd className="font-medium text-slate-900">{a.status}</dd>
        </dl>

        <div className="mt-5">
          <p className="text-sm text-slate-500">Description</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">{desc ? a.description : "No description added."}</p>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-100"
          >
            Delete
          </button>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Close
          </button>
        </div>
      </Dialog>
    </Overlay>
  );
}

function EditModal({
  form,
  setForm,
  dateError,
  setDateError,
  saving,
  onSubmit,
  onClose,
}: {
  form: EditForm;
  setForm: (f: EditForm) => void;
  dateError: string;
  setDateError: (s: string) => void;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const set = (key: keyof EditForm, value: string) => setForm({ ...form, [key]: value });

  return (
    <Overlay onClose={onClose}>
      <Dialog label="Edit assignment" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Edit Assignment</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">Update assignment</h2>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <Field label="Title" id="edit-title">
            <input
              id="edit-title"
              type="text"
              required
              autoFocus
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className={inputStyle}
            />
          </Field>

          <Field label="Subject" id="edit-subject">
            <input
              id="edit-subject"
              type="text"
              required
              value={form.subject}
              onChange={(e) => set("subject", e.target.value)}
              className={inputStyle}
            />
          </Field>

          <Field label="Description" id="edit-description">
            <textarea
              id="edit-description"
              rows={4}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className={inputStyle}
            />
          </Field>

          <Field label="Deadline" id="edit-deadline">
            <input
              id="edit-deadline"
              type="text"
              inputMode="numeric"
              required
              maxLength={10}
              pattern="\d{2}/\d{2}/\d{4}"
              title="Use dd/mm/yyyy"
              value={form.deadline}
              onChange={(e) => {
                set("deadline", maskDate(e.target.value));
                setDateError("");
              }}
              placeholder="dd/mm/yyyy"
              className={inputStyle}
            />
            {dateError && <p className="mt-1.5 text-sm text-red-600">{dateError}</p>}
          </Field>

          <StatusPicker name="edit-status" value={form.status} onChange={(v) => set("status", v)} />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </Dialog>
    </Overlay>
  );
}

// One confirmation dialog for both "Delete" (red) and "Mark as completed" (green)
function ConfirmModal({
  tone,
  title,
  message,
  confirmLabel,
  busyLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  tone: "red" | "green";
  title: string;
  message: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (e: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const red = tone === "red";

  return (
    <Overlay onClose={onCancel} z="z-[60]" dim="bg-slate-900/50">
      <Dialog label={title} role="alertdialog" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            red ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            {red ? <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" /> : <path d="M5 13l4 4L19 7" />}
          </svg>
        </div>

        <h2 className="mt-4 text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 break-words text-sm text-slate-500">{message}</p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              red ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </Dialog>
    </Overlay>
  );
}

// 🔔 In-app deadline reminders: overdue, due today, and due within 3 days
function DeadlineReminders({
  assignments,
  onOpen,
}: {
  assignments: Assignment[];
  onOpen: (id: number) => void;
}) {
  const urgent = assignments
    .filter((a) => !isDone(a) && daysLeft(a.deadline) <= 3)
    .sort(
      (a, b) =>
        daysLeft(a.deadline) - daysLeft(b.deadline) ||
        cmpDeadline(a, b)
    );

  if (urgent.length === 0) {
    return (
      <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">
            ✓
          </div>

          <div>
            <p className="font-semibold text-emerald-800">
              No urgent deadlines
            </p>
            <p className="mt-0.5 text-sm text-emerald-700">
              You&apos;re all caught up.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-lg">
          🔔
        </div>

        <div>
          <h2 className="font-semibold text-slate-900">
            Deadline Reminders
          </h2>
          <p className="text-sm text-slate-500">
            Assignments that need your attention
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {urgent.map((assignment) => {
          const days = daysLeft(assignment.deadline);

          let label = "";

          if (days < 0) {
            label = `${Math.abs(days)} day${
              Math.abs(days) === 1 ? "" : "s"
            } overdue`;
          } else if (days === 0) {
            label = "Due today";
          } else if (days === 1) {
            label = "Due tomorrow";
          } else {
            label = `Due in ${days} days`;
          }

          const urgentStyle =
            days <= 0
              ? "border-red-200 bg-red-50 hover:bg-red-100"
              : "border-amber-200 bg-amber-50 hover:bg-amber-100";

          const labelStyle =
            days <= 0 ? "text-red-700" : "text-amber-700";

          return (
            <button
              key={assignment.id}
              type="button"
              onClick={() => onOpen(assignment.id)}
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${urgentStyle}`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">
                  {assignment.title}
                </p>

                <p className="mt-0.5 text-sm text-slate-500">
                  {assignment.subject}
                </p>
              </div>

              <span
                className={`ml-4 shrink-0 text-sm font-semibold ${labelStyle}`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Turn browser notifications on or off (the browser only lets a click ask for permission)
function NotificationBar({
  perm,
  on,
  onEnable,
  onDisable,
}: {
  perm: NotifPermission;
  on: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  if (perm === null) return null;

  const box = "-mt-2 mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm";
  const button = "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition";

  if (perm === "unsupported") {
    return (
      <div className={`${box} border-slate-200 bg-white text-slate-500`}>
        This browser doesn&apos;t support notifications.
      </div>
    );
  }

  if (perm === "denied") {
    return (
      <div className={`${box} border-amber-200 bg-amber-50 text-amber-800`}>
        Notifications are blocked. Allow them in your browser&apos;s site settings to get reminders.
      </div>
    );
  }

  if (perm === "granted" && on) {
    return (
      <div className={`${box} border-emerald-200 bg-emerald-50 text-emerald-800`}>
        <span>
          🔔 Notifications are on. You&apos;ll get a pop-up for overdue, due-today and due-tomorrow assignments while this
          page is open.
        </span>
        <button type="button" onClick={onDisable} className={`${button} bg-white text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100`}>
          Turn off
        </button>
      </div>
    );
  }

  return (
    <div className={`${box} border-slate-200 bg-white text-slate-600`}>
      <span>🔔 Get a browser pop-up when a deadline is near.</span>
      <button type="button" onClick={onEnable} className={`${button} bg-indigo-600 text-white hover:bg-indigo-700`}>
        Turn on notifications
      </button>
    </div>
  );
}

// =====================================================
// PAGE
// =====================================================

export default function Home() {
  // ---------- UI state ----------
  const [tab, setTab] = useState<Tab>("view");
  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("soonest");
  const [cal, setCal] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [calDay, setCalDay] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [notifPerm, setNotifPerm] = useState<NotifPermission>(null); // null until we know (avoids SSR mismatch)
  const [notifOn, setNotifOn] = useState(false);

  // ---------- Data state ----------
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastDeleted, setLastDeleted] = useState<Assignment | null>(null);

  // ---------- Popups ----------
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [editDateError, setEditDateError] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [completeId, setCompleteId] = useState<number | null>(null);

  // ---------- Busy flags ----------
  const [submitting, setSubmitting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);

  // ---------- Add form ----------
  const [form, setForm] = useState(emptyForm); // deadline is typed as dd/mm/yyyy
  const [idError, setIdError] = useState("");
  const [dateError, setDateError] = useState("");
  const pickerRef = useRef<HTMLInputElement>(null);

  const updateForm = (key: keyof typeof emptyForm, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const reload = () => setReloadKey((k) => k + 1); // refreshes quietly, no skeleton flash
  const byId = (id: number | null) => assignments.find((a) => a.id === id) ?? null;

  // ---------- Get all assignments ----------
  useEffect(() => {
    let cancelled = false;

    api<Assignment[]>("/assignments")
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("Unexpected response");
        if (cancelled) return;
        setAssignments(data);
        setLoadError(false);
      })
      .catch((error) => {
        console.error("Error fetching assignments:", error);
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Auto-hide the toast (longer when it offers Undo)
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.undo ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Learn the browser's notification permission once the page is open
  useEffect(() => {
    if (typeof Notification === "undefined") {
      setNotifPerm("unsupported");
      return;
    }
    setNotifPerm(Notification.permission);
    try {
      setNotifOn(localStorage.getItem(NOTIFY_KEY) === "on" && Notification.permission === "granted");
    } catch {
      setNotifOn(false);
    }
  }, []);

  // Automatic reminders: check now, every minute, and whenever the tab becomes visible again
  useEffect(() => {
    if (!notifOn || notifPerm !== "granted" || loading || loadError) return;

    const run = () => sendDueNotifications(assignments, setSelectedId);
    run();

    const timer = setInterval(run, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [notifOn, notifPerm, loading, loadError, assignments]);

  // Escape closes the top-most popup
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (completeId !== null) setCompleteId(null);
      else if (deleteId !== null) setDeleteId(null);
      else if (edit) setEdit(null);
      else if (selectedId !== null) setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [completeId, deleteId, edit, selectedId]);

  // ---------- Browser notifications on/off ----------
  async function enableNotifications() {
    if (typeof Notification === "undefined") return;

    const permission = await Notification.requestPermission();
    setNotifPerm(permission);
    if (permission !== "granted") return;

    try {
      localStorage.setItem(NOTIFY_KEY, "on");
    } catch {
      /* ignore */
    }
    setNotifOn(true);

    try {
      const hello = new Notification("Notifications are on", {
        body: "You'll get a pop-up when a deadline is near.",
      });
      hello.onclick = () => window.focus();
    } catch {
      /* ignore */
    }
  }

  function disableNotifications() {
    try {
      localStorage.setItem(NOTIFY_KEY, "off");
    } catch {
      /* ignore */
    }
    setNotifOn(false);
  }

  // ---------- Add assignment ----------
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const assignmentId = Number(form.id);
    const nextFree = Math.max(0, ...assignments.map((a) => a.id)) + 1;

    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      return setIdError("Enter a valid ID (a positive whole number)");
    }
    if (assignments.some((a) => a.id === assignmentId)) {
      return setIdError(`ID ${assignmentId} already exists. Try ${nextFree}.`);
    }
    if (!isValidDate(form.deadline)) {
      return setDateError("Enter a valid date as dd/mm/yyyy");
    }

    setSubmitting(true);

    try {
      const data = await api<{ message?: string }>(
        "/add",
        jsonPost("POST", {
          id: assignmentId,
          title: form.title.trim(),
          subject: form.subject.trim(),
          description: form.description.trim(),
          deadline: toISO(form.deadline), // backend/MySQL expects yyyy-mm-dd
          status: form.status,
        })
      );

      setToast({ type: "success", text: data?.message ?? "Assignment added." });

      // Clear form, go back to the list, refresh it
      setForm(emptyForm);
      setFilter("All");
      setTab("view");
      reload();
    } catch (error) {
      console.error("Error adding assignment:", error);
      setToast({ type: "error", text: "Failed to add assignment. Is the server running?" });
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Mark as completed (after the confirmation dialog) ----------
  async function handleComplete(id: number, origin: Origin) {
    setCompleting(true);

    try {
      const data = await api<{ message?: string }>(`/complete/${id}`, { method: "PATCH" });

      setCompleteId(null);
      setToast({ type: "success", text: data?.message ?? "Assignment marked as completed." });
      confetti(origin);
      reload();
    } catch (error) {
      console.error("Error completing assignment:", error);
      setCompleteId(null);
      setToast({ type: "error", text: "Failed to mark assignment as completed." });
    } finally {
      setCompleting(false);
    }
  }

  // ---------- Delete (after the confirmation dialog) + Undo ----------
  async function handleDelete(id: number) {
    const target = byId(id);
    setDeleting(true);

    try {
      const data = await api<{ message?: string }>(`/delete/${id}`, { method: "DELETE" });

      setLastDeleted(target);
      setDeleteId(null);
      setSelectedId(null);
      setToast({ type: "success", text: data?.message ?? "Assignment deleted.", undo: !!target });
      reload();
    } catch (error) {
      console.error("Error deleting assignment:", error);
      setDeleteId(null);
      setToast({ type: "error", text: "Failed to delete assignment." });
    } finally {
      setDeleting(false);
    }
  }

  // Undo = add the deleted assignment again through /add
  async function handleUndo() {
    if (!lastDeleted) return;
    const a = lastDeleted;

    try {
      await api(
        "/add",
        jsonPost("POST", {
          id: a.id,
          title: a.title,
          subject: a.subject,
          description: a.description ?? "",
          deadline: toISO(a.deadline),
          status: a.status,
        })
      );

      setLastDeleted(null);
      setToast({ type: "success", text: "Assignment restored." });
      reload();
    } catch (error) {
      console.error("Error restoring assignment:", error);
      setToast({ type: "error", text: "Couldn't restore the assignment." });
    }
  }

  // ---------- Edit ----------
  function startEditing(a: Assignment) {
    setEdit({
      id: a.id,
      title: a.title,
      subject: a.subject,
      description: a.description ?? "",
      deadline: formatDate(a.deadline),
      status: a.status,
    });
    setEditDateError("");
    setSelectedId(null);
  }

  async function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!edit) return;

    if (!isValidDate(edit.deadline)) {
      return setEditDateError("Enter a valid date as dd/mm/yyyy");
    }

    setSavingEdit(true);

    try {
      const data = await api<{ message?: string }>(
        `/edit/${edit.id}`,
        jsonPost("PATCH", {
          title: edit.title.trim(),
          subject: edit.subject.trim(),
          description: edit.description.trim(),
          deadline: toISO(edit.deadline),
          status: edit.status,
        })
      );

      setToast({ type: "success", text: data?.message ?? "Assignment updated successfully." });
      setEdit(null);
      setSelectedId(null);
      reload();
    } catch (error) {
      console.error("Error editing assignment:", error);
      setToast({ type: "error", text: "Failed to update assignment." });
    } finally {
      setSavingEdit(false);
    }
  }

  // ---------- Derived data ----------
  const pending = assignments.filter((a) => !isDone(a)).length;
  const completed = assignments.length - pending;
  const overdue = assignments.filter((a) => matchesFilter(a, "Overdue")).length;
  const dueToday = assignments.filter((a) => matchesFilter(a, "Due Today")).length;

  const nextId = Math.max(0, ...assignments.map((a) => a.id)) + 1; // hint shown in the form
  const nextUp = assignments.filter((a) => !isDone(a)).sort(cmpDeadline)[0];
  const ready = !loading && !loadError;

  const subjects = [...new Set(assignments.map((a) => a.subject))].sort((a, b) => a.localeCompare(b));
  const activeSubject = subjects.includes(subjectFilter) ? subjectFilter : "";

  const query = search.trim().toLowerCase();
  const visible = assignments
    .filter(
      (a) =>
        matchesFilter(a, filter) &&
        (!activeSubject || a.subject === activeSubject) &&
        a.subject.toLowerCase().includes(query)
    )
    .sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || SORTERS[sort](a, b));

  const stats: { label: string; value: number; filter: Filter; warn?: boolean }[] = [
    { label: "Total", value: assignments.length, filter: "All" },
    { label: "Pending", value: pending, filter: "Pending" },
    { label: "Completed", value: completed, filter: "Completed" },
    { label: "Overdue", value: overdue, filter: "Overdue", warn: true },
    { label: "Due today", value: dueToday, filter: "Due Today", warn: true },
  ];

  const emptyMessage = query
    ? `No assignments match “${search.trim()}”`
    : activeSubject
    ? `Nothing here for ${activeSubject}`
    : {
        All: "No assignments yet",
        Pending: "No pending assignments",
        Completed: "No completed assignments",
        Overdue: "Nothing is overdue",
        "Due Today": "Nothing is due today",
      }[filter];

  const selected = byId(selectedId);
  const toDelete = byId(deleteId);
  const toComplete = byId(completeId);

  const moveMonth = (delta: number) =>
    setCal(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  // ---------- UI ----------
  return (
    // Explicit light colors so the page looks right even if the OS is in dark mode
    <div className="min-h-screen bg-slate-50 text-slate-900" style={{ backgroundImage: "linear-gradient(to bottom, #eef2ff, #f8fafc 40%)" }}>
      <style>{`
        @keyframes at-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes at-pop-in { from { opacity: 0; transform: translateY(8px) scale(.97) } to { opacity: 1; transform: none } }
        .at-fade { animation: at-fade-in .15s ease-out }
        .at-pop { animation: at-pop-in .18s ease-out }
        @media (prefers-reduced-motion: reduce) { .at-fade, .at-pop { animation: none } }
      `}</style>

      {/* Credit */}
      <div className="mx-auto max-w-2xl px-4 pt-4 text-right text-xs text-slate-400">
        Developed by <span className="font-medium text-slate-500">Sudipta Biswas</span>
      </div>

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Study planner</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Assignment Tracker</h1>
            <p className="mt-1 text-slate-500">Manage your assignments and deadlines</p>
          </div>

          <ProgressRing pct={assignments.length ? completed / assignments.length : 0} />
        </header>

        {/* Tabs */}
        <div role="tablist" className="mb-6 mt-7 grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/70 p-1">
          {(
            [
              ["view", "View assignments"],
              ["add", "Add assignment"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ================= VIEW TAB ================= */}
        {tab === "view" && (
          <section>
            {ready && (
              <HeroCard
                next={nextUp}
                empty={assignments.length === 0}
                onDone={setCompleteId}
                onOpen={setSelectedId}
                onAdd={() => setTab("add")}
              />
            )}

            {/* Dashboard cards (also filters) */}
            <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {stats.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setFilter(s.filter)}
                  className={`rounded-2xl border p-3 text-left shadow-sm transition ${
                    filter === s.filter
                      ? "border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100"
                      : "border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md"
                  }`}
                >
                  <p className={`text-xl font-semibold ${s.warn && s.value > 0 ? "text-red-600" : "text-slate-900"}`}>{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </button>
              ))}
            </div>

            {/* Deadline reminders */}
            {ready && (
              <>
                <DeadlineReminders
                  assignments={assignments}
                  onOpen={setSelectedId}
                />

                <NotificationBar
                  perm={notifPerm}
                  on={notifOn}
                  onEnable={enableNotifications}
                  onDisable={disableNotifications}
                />
              </>
            )}

            {/* Search + sort */}
            <div className="mb-3 flex gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor="subject-search" className="sr-only">
                  Search by subject
                </label>
                <input
                  id="subject-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by subject, e.g. Java, DBMS"
                  className={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="sort-select" className="sr-only">
                  Sort
                </label>
                <select
                  id="sort-select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className={`${selectStyle} pr-8`}
                >
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subject chips */}
            <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setSubjectFilter("")}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  !activeSubject ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                All subjects
              </button>

              {subjects.map((s) => {
                const col = subjectColor(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSubjectFilter(s)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition ${
                      activeSubject === s ? `${col.dot} text-white ring-transparent` : `${col.chip} hover:brightness-95`
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            {/* Filters + list/calendar switch */}
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                      filter === f ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-0.5 rounded-xl bg-slate-200/70 p-0.5">
                {(["list", "calendar"] as View[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
                      view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
                ))}
              </div>
            )}

            {/* Error */}
            {!loading && loadError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <p className="font-medium text-red-800">Couldn&apos;t load assignments</p>
                <p className="mt-1 text-sm text-red-700">Check that your backend is running on localhost:8080.</p>
                <button
                  onClick={() => {
                    setLoading(true);
                    reload();
                  }}
                  className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Calendar */}
            {ready && view === "calendar" && (
              <CalendarView
                items={visible}
                cal={cal}
                day={calDay}
                onMonth={moveMonth}
                onToday={() => {
                  const now = new Date();
                  setCal({ y: now.getFullYear(), m: now.getMonth() });
                  setCalDay(isoOf(now));
                }}
                onPick={(iso) => setCalDay(calDay === iso ? null : iso)}
                onOpen={setSelectedId}
                onTick={setCompleteId}
              />
            )}

            {/* Empty */}
            {ready && view === "list" && visible.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="font-medium text-slate-900">{emptyMessage}</p>

                {assignments.length === 0 && (
                  <button
                    onClick={() => setTab("add")}
                    className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Add your first assignment
                  </button>
                )}
              </div>
            )}

            {/* List */}
            {ready && view === "list" && visible.length > 0 && (
              <ul className="space-y-3">
                {visible.map((a) => (
                  <AssignmentCard key={a.id} a={a} onOpen={setSelectedId} onTick={setCompleteId} />
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ================= ADD TAB ================= */}
        {tab === "add" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">New assignment</h2>
            <p className="mt-1 text-sm text-slate-500">Fill in the details and it will appear in your list.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <Field label="Assignment ID" id="assignment-id">
                <input
                  id="assignment-id"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  required
                  autoFocus
                  value={form.id}
                  onChange={(e) => {
                    updateForm("id", e.target.value);
                    setIdError("");
                  }}
                  placeholder="e.g. 201"
                  className={inputStyle}
                />

                {idError ? (
                  <p className="mt-1.5 text-sm text-red-600">{idError}</p>
                ) : (
                  <p className="mt-1.5 text-sm text-slate-500">
                    Next free ID: {nextId}{" "}
                    <button
                      type="button"
                      onClick={() => updateForm("id", String(nextId))}
                      className="font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Use it
                    </button>
                  </p>
                )}
              </Field>

              <Field label="Title" id="title">
                <input
                  id="title"
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  placeholder="e.g. Java Assignment"
                  className={inputStyle}
                />
              </Field>

              <Field label="Subject" id="subject">
                <input
                  id="subject"
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => updateForm("subject", e.target.value)}
                  placeholder="e.g. Java"
                  className={inputStyle}
                />
              </Field>

              <Field label="Description" id="description">
                <textarea
                  id="description"
                  rows={4}
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  placeholder="e.g. Complete the inheritance program and submit the code."
                  className={inputStyle}
                />
              </Field>

              <Field label="Deadline" id="deadline">
                <div className="relative">
                  <input
                    id="deadline"
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={10}
                    pattern="\d{2}/\d{2}/\d{4}"
                    title="Use dd/mm/yyyy"
                    value={form.deadline}
                    onChange={(e) => {
                      updateForm("deadline", maskDate(e.target.value));
                      setDateError("");
                    }}
                    placeholder="dd/mm/yyyy"
                    className={`${inputStyle} pr-12`}
                  />

                  {/* Calendar button opens the native picker, result shows as dd/mm/yyyy */}
                  <button
                    type="button"
                    aria-label="Open calendar"
                    onClick={() => pickerRef.current?.showPicker?.()}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-slate-700"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="3" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  </button>

                  <input
                    ref={pickerRef}
                    type="date"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(e) => {
                      if (!e.target.value) return;
                      updateForm("deadline", formatDate(e.target.value));
                      setDateError("");
                    }}
                    className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
                  />
                </div>

                {dateError && <p className="mt-1.5 text-sm text-red-600">{dateError}</p>}
              </Field>

              <StatusPicker name="status" value={form.status} onChange={(v) => updateForm("status", v)} />

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Adding..." : "Add assignment"}
              </button>
            </form>
          </section>
        )}
      </main>

      {/* ---------- POPUPS ---------- */}

      {selected && (
        <DetailsModal
          a={selected}
          onClose={() => setSelectedId(null)}
          onEdit={() => startEditing(selected)}
          onDelete={() => setDeleteId(selected.id)}
        />
      )}

      {edit && (
        <EditModal
          form={edit}
          setForm={setEdit}
          dateError={editDateError}
          setDateError={setEditDateError}
          saving={savingEdit}
          onSubmit={handleEditSubmit}
          onClose={() => setEdit(null)}
        />
      )}

      {toDelete && (
        <ConfirmModal
          tone="red"
          title="Delete this assignment?"
          message={`“${toDelete.title}” will be deleted. You can undo it right after.`}
          confirmLabel="Delete"
          busyLabel="Deleting..."
          busy={deleting}
          onCancel={() => setDeleteId(null)}
          onConfirm={() => handleDelete(toDelete.id)}
        />
      )}

      {toComplete && (
        <ConfirmModal
          tone="green"
          title="Mark as completed?"
          message={`“${toComplete.title}” will be marked as completed.`}
          confirmLabel="Mark as completed"
          busyLabel="Saving..."
          busy={completing}
          onCancel={() => setCompleteId(null)}
          onConfirm={(e) => handleComplete(toComplete.id, centerOf(e))}
        />
      )}

      {/* ---------- TOAST ---------- */}
      {toast && (
        <div
          role="status"
          className={`at-pop fixed inset-x-4 bottom-6 z-[70] mx-auto flex w-fit max-w-sm items-center gap-4 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          <span>{toast.text}</span>

          {toast.undo && lastDeleted && (
            <button
              type="button"
              onClick={handleUndo}
              className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold transition hover:bg-white/30"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
