"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

type Assignment = {
  id: number;
  title: string;
  subject: string;
  description: string;
  deadline: string;
  status: string;
};

type Tab = "view" | "add";
type Filter =
  | "All"
  | "Pending"
  | "Completed"
  | "Overdue"
  | "Due Today";
type Toast = { type: "success" | "error"; text: string } | null;

const FILTERS: Filter[] = ["All", "Pending", "Completed"];

const inputStyle =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

// =====================================================
// DATE HELPERS
// screen = dd/mm/yyyy
// backend = yyyy-mm-dd
// =====================================================

// Accepts "22/09/2026", "2026-09-22" or "2026-09-22T00:00:00"
// and always returns "2026-09-22"
function toISO(value: string) {
  const text = value.trim();
  const dmy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  return text.slice(0, 10);
}

// Shows any date as dd/mm/yyyy
function formatDate(value: string) {
  const [year, month, day] = toISO(value).split("-");

  return `${day}/${month}/${year}`;
}

// Auto-inserts the slashes while typing:
// 22092026 -> 22/09/2026
function maskDate(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// Checks that dd/mm/yyyy is a real calendar date
// Rejects 31/02/2026
function isValidDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return false;

  const [, d, m, y] = match.map(Number);

  const date = new Date(y, m - 1, d);

  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

function daysLeft(deadline: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(`${toISO(deadline)}T00:00:00`);

  return Math.round(
    (due.getTime() - today.getTime()) / 86400000
  );
}

function urgency(days: number) {
  if (days < 0) {
    return {
      label: "Overdue",
      style: "bg-red-50 text-red-700 ring-red-200",
    };
  }

  if (days === 0) {
    return {
      label: "Due today",
      style: "bg-red-50 text-red-700 ring-red-200",
    };
  }

  if (days <= 3) {
    return {
      label: `${days} day${days === 1 ? "" : "s"} left`,
      style: "bg-amber-50 text-amber-800 ring-amber-200",
    };
  }

  return {
    label: `${days} days left`,
    style: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
}

export default function Home() {

  // ---------- UI state ----------

  const [tab, setTab] = useState<Tab>("view");
  const [filter, setFilter] = useState<Filter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);

  const [editingAssignment, setEditingAssignment] =
    useState<Assignment | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editStatus, setEditStatus] = useState("Pending");
  const [editDateError, setEditDateError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // ---------- Data state ----------

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // ---------- Delete state ----------

  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ---------- Complete state ----------

  const [completingId, setCompletingId] = useState<number | null>(null);

  // ---------- Form state ----------

  const [id, setId] = useState("");
  const [idError, setIdError] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [dateError, setDateError] = useState("");
  const pickerRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("Pending");
  const [submitting, setSubmitting] = useState(false);

  // =====================================================
  // GET ALL ASSIGNMENTS
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/assignments`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Server responded with ${response.status}`
          );
        }

        return response.json();
      })
      .then((data: Assignment[]) => {
        if (!cancelled) {
          setAssignments(data);
          setLoadError(false);
        }
      })
      .catch((error) => {
        console.error(
          "Error fetching assignments:",
          error
        );

        if (!cancelled) {
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function reload() {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  // =====================================================
  // AUTO-HIDE TOAST
  // =====================================================

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(
      () => setToast(null),
      3500
    );

    return () => clearTimeout(timer);
  }, [toast]);

  // =====================================================
  // ADD ASSIGNMENT
  // =====================================================

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    const assignmentId = Number(id);

    if (
      !Number.isInteger(assignmentId) ||
      assignmentId <= 0
    ) {
      setIdError(
        "Enter a valid ID (a positive whole number)"
      );
      return;
    }

    if (
      assignments.some(
        (a) => a.id === assignmentId
      )
    ) {
      setIdError(
        `ID ${assignmentId} already exists. Try ${nextId}.`
      );
      return;
    }

    if (!isValidDate(deadline)) {
      setDateError(
        "Enter a valid date as dd/mm/yyyy"
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `${API_URL}/add`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: assignmentId,
            title: title.trim(),
            subject: subject.trim(),
            description: description.trim(),
            deadline: toISO(deadline),
            status,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Server responded with ${response.status}`
        );
      }

      const data = await response
        .json()
        .catch(() => null);

      setToast({
        type: "success",
        text:
          data?.message ??
          "Assignment added.",
      });

      // Clear form
      setId("");
      setTitle("");
      setSubject("");
      setDescription("");
      setDeadline("");
      setStatus("Pending");

      setFilter("All");
      setTab("view");

      reload();

    } catch (error) {

      console.error(
        "Error adding assignment:",
        error
      );

      setToast({
        type: "error",
        text:
          "Failed to add assignment. Is the server running?",
      });

    } finally {
      setSubmitting(false);
    }
  }

  // =====================================================
  // DELETE ASSIGNMENT
  // =====================================================

  async function handleDelete(
    assignmentId: number
  ) {

    const confirmed = window.confirm(
      "Are you sure you want to delete this assignment?"
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(assignmentId);

    try {

      const response = await fetch(
        `${API_URL}/delete/${assignmentId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {

        throw new Error(
          data?.error ??
          `Server responded with ${response.status}`
        );
      }

      setToast({
        type: "success",
        text:
          data?.message ??
          "Assignment deleted.",
      });

      reload();

    } catch (error) {

      console.error(
        "Error deleting assignment:",
        error
      );

      setToast({
        type: "error",
        text:
          "Failed to delete assignment.",
      });

    } finally {
      setDeletingId(null);
    }
  }

  // =====================================================
  // MARK AS COMPLETED
  // =====================================================

  async function handleComplete(
    assignmentId: number
  ) {

    setCompletingId(assignmentId);

    try {

      const response = await fetch(
        `${API_URL}/complete/${assignmentId}`,
        {
          method: "PATCH",
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {

        throw new Error(
          data?.error ??
          `Server responded with ${response.status}`
        );
      }

      setToast({
        type: "success",
        text:
          data?.message ??
          "Assignment marked as completed.",
      });

      reload();

    } catch (error) {

      console.error(
        "Error completing assignment:",
        error
      );

      setToast({
        type: "error",
        text:
          "Failed to mark assignment as completed.",
      });

    } finally {
      setCompletingId(null);
    }
  }

  // =====================================================
  // EDIT ASSIGNMENT
  // =====================================================

  function startEditing(assignment: Assignment) {

    setEditingAssignment(assignment);

    setEditTitle(assignment.title);
    setEditSubject(assignment.subject);
    setEditDescription(assignment.description ?? "");
    setEditDeadline(formatDate(assignment.deadline));
    setEditStatus(assignment.status);

    setEditDateError("");
  }

  async function handleEditSubmit(
    e: FormEvent<HTMLFormElement>
  ) {

    e.preventDefault();

    if (!editingAssignment) {
      return;
    }

    if (!isValidDate(editDeadline)) {

      setEditDateError(
        "Enter a valid date as dd/mm/yyyy"
      );

      return;
    }

    setSavingEdit(true);

    try {

      const response = await fetch(
        `${API_URL}/edit/${editingAssignment.id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            title: editTitle.trim(),
            subject: editSubject.trim(),
            description: editDescription.trim(),
            deadline: toISO(editDeadline),
            status: editStatus,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {

        throw new Error(
          data?.error ??
          `Server responded with ${response.status}`
        );
      }

      setToast({
        type: "success",
        text:
          data?.message ??
          "Assignment updated successfully.",
      });

      setEditingAssignment(null);
      setSelectedAssignment(null);

      reload();

    }
    catch (error) {

      console.error(
        "Error editing assignment:",
        error
      );

      setToast({
        type: "error",
        text: "Failed to update assignment.",
      });

    }
    finally {

      setSavingEdit(false);
    }
  }

  // =====================================================
  // DERIVED DATA
  // =====================================================

  const pending =
    assignments.filter(
      (a) => a.status !== "Completed"
    ).length;

  const completed =
    assignments.length - pending;

  const overdue =
    assignments.filter(
      (a) =>
        a.status !== "Completed" &&
        daysLeft(a.deadline) < 0
    ).length;

  const dueToday =
    assignments.filter(
      (a) =>
        a.status !== "Completed" &&
        daysLeft(a.deadline) === 0
    ).length;

  // Next free ID
  const nextId =
    assignments.reduce(
      (max, a) => Math.max(max, a.id),
      0
    ) + 1;

  const visible = assignments
    .filter((a) => {

      const days = daysLeft(a.deadline);

      let matchesFilter = true;

      if (filter === "Pending") {
        matchesFilter =
          a.status !== "Completed";
      }

      if (filter === "Completed") {
        matchesFilter =
          a.status === "Completed";
      }

      if (filter === "Overdue") {
        matchesFilter =
          a.status !== "Completed" &&
          days < 0;
      }

      if (filter === "Due Today") {
        matchesFilter =
          a.status !== "Completed" &&
          days === 0;
      }

      const matchesSubject =
        a.subject
          .toLowerCase()
          .includes(
            searchQuery.trim().toLowerCase()
          );

      return (
        matchesFilter &&
        matchesSubject
      );
    })
    .sort(
      (a, b) =>
        Number(a.status === "Completed") -
          Number(b.status === "Completed") ||
        toISO(a.deadline).localeCompare(
          toISO(b.deadline)
        )
    );

  const stats = [
    {
      label: "Total Assignments",
      value: assignments.length,
      filter: "All" as Filter,
    },
    {
      label: "Pending",
      value: pending,
      filter: "Pending" as Filter,
    },
    {
      label: "Completed",
      value: completed,
      filter: "Completed" as Filter,
    },
    {
      label: "Overdue",
      value: overdue,
      filter: "Overdue" as Filter,
    },
    {
      label: "Due Today",
      value: dueToday,
      filter: "Due Today" as Filter,
    },
  ];

  // =====================================================
  // UI
  // =====================================================

  return (

    // Explicit light colors so the page looks right
    // even if the OS is in dark mode

    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* ---------- CREDIT ---------- */}

      <div className="mx-auto max-w-2xl px-4 pt-4 text-right text-xs text-slate-400">
        Developed by{" "}
        <span className="font-medium text-slate-500">
          Sudipta Biswas
        </span>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-10">

        {/* ---------- HEADER ---------- */}

        <header>

          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            Study planner
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Assignment Tracker
          </h1>

          <p className="mt-1 text-slate-500">
            Manage your assignments and deadlines
          </p>

        </header>

        {/* ---------- TABS ---------- */}

        <div
          role="tablist"
          className="mb-6 mt-8 grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/70 p-1"
        >

          <button
            role="tab"
            aria-selected={tab === "view"}
            onClick={() => setTab("view")}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === "view"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            View assignments
          </button>

          <button
            role="tab"
            aria-selected={tab === "add"}
            onClick={() => setTab("add")}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === "add"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Add assignment
          </button>

        </div>

        {/* =================================================
            VIEW TAB
        ================================================= */}

        {tab === "view" && (

          <section>

            {/* Stats */}

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">

              {stats.map((stat) => {

                const isActive =
                  filter === stat.filter;

                return (

                  <button
                    key={stat.label}
                    type="button"
                    onClick={() =>
                      setFilter(stat.filter)
                    }
                    className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                      isActive
                        ? "border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100"
                        : "border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md"
                    }`}
                  >

                    <p className="text-2xl font-semibold text-slate-900">
                      {stat.value}
                    </p>

                    <p className="text-sm text-slate-500">
                      {stat.label}
                    </p>

                  </button>

                );

              })}

            </div>

            {/* Search by Subject */}

            <div className="mb-4">
              <label
                htmlFor="subject-search"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Search by subject
              </label>

              <input
                id="subject-search"
                type="text"
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
                placeholder="e.g. Java, DBMS"
                className={inputStyle}
              />
            </div>

            {/* Filters */}

            <div className="mb-4 flex gap-2">

              {FILTERS.map((f) => (

                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    filter === f
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {f}
                </button>

              ))}

            </div>

            {/* Loading skeleton */}

            {loading && (

              <div className="space-y-3">

                {[0, 1, 2].map((i) => (

                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-2xl bg-slate-200/70"
                  />

                ))}

              </div>

            )}

            {/* Error */}

            {!loading && loadError && (

              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">

                <p className="font-medium text-red-800">
                  Couldn&apos;t load assignments
                </p>

                <p className="mt-1 text-sm text-red-700">
                  Check that your backend is running on localhost:8080.
                </p>

                <button
                  onClick={reload}
                  className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Try again
                </button>

              </div>

            )}

            {/* Empty */}

            {!loading &&
              !loadError &&
              visible.length === 0 && (

                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">

                  <p className="font-medium text-slate-900">
                    {assignments.length === 0
                      ? "No assignments yet"
                      : `No ${filter.toLowerCase()} assignments`}
                  </p>

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

            {!loading &&
              !loadError &&
              visible.length > 0 && (

                <ul className="space-y-3">

                  {visible.map((assignment) => {

                    const isDone =
                      assignment.status === "Completed";

                    const badge =
                      urgency(
                        daysLeft(
                          assignment.deadline
                        )
                      );

                    const isDeleting =
                      deletingId === assignment.id;

                    const isCompleting =
                      completingId === assignment.id;

                    return (

                      <li
                        key={assignment.id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setSelectedAssignment(assignment)
                        }
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;

                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedAssignment(assignment);
                          }
                        }}
                        className={`cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md ${
                          isDone
                            ? "opacity-70"
                            : ""
                        }`}
                      >

                        <div className="flex items-start justify-between gap-4">

                          <div className="min-w-0">

                            <h3
                              className={`truncate font-semibold text-slate-900 ${
                                isDone
                                  ? "line-through"
                                  : ""
                              }`}
                            >
                              {assignment.title}
                            </h3>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">

                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                ID {assignment.id}
                              </span>

                              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                {assignment.subject}
                              </span>

                              <span>
                                Due{" "}
                                {formatDate(
                                  assignment.deadline
                                )}
                              </span>

                            </div>

                          </div>

                          <span
                            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                              isDone
                                ? "bg-slate-100 text-slate-600 ring-slate-200"
                                : badge.style
                            }`}
                          >
                            {isDone
                              ? "Completed"
                              : badge.label}
                          </span>

                        </div>

                        {/* ---------- ACTION BUTTONS ---------- */}

                        <div className="mt-4 flex justify-end gap-2">

                          {/* Mark as completed (only for pending) */}

                          {!isDone && (

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleComplete(assignment.id);
                              }}
                              disabled={isCompleting}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >

                              {isCompleting
                                ? "Completing..."
                                : "Mark as completed"}

                            </button>

                          )}

                          {/* Delete */}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(assignment.id);
                            }}
                            disabled={isDeleting}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >

                            {isDeleting
                              ? "Deleting..."
                              : "Delete"}

                          </button>

                        </div>

                      </li>

                    );

                  })}

                </ul>

              )}

          </section>

        )}

        {/* =================================================
            ADD TAB
        ================================================= */}

        {tab === "add" && (

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold text-slate-900">
              New assignment
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Fill in the details and it will appear in your list.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-5"
            >

              {/* Assignment ID */}

              <div>

                <label
                  htmlFor="assignment-id"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Assignment ID
                </label>

                <input
                  id="assignment-id"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  required
                  value={id}
                  onChange={(e) => {
                    setId(e.target.value);
                    setIdError("");
                  }}
                  placeholder="e.g. 201"
                  className={inputStyle}
                />

                {idError ? (

                  <p className="mt-1.5 text-sm text-red-600">
                    {idError}
                  </p>

                ) : (

                  <p className="mt-1.5 text-sm text-slate-500">

                    Next free ID: {nextId}{" "}

                    <button
                      type="button"
                      onClick={() =>
                        setId(String(nextId))
                      }
                      className="font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Use it
                    </button>

                  </p>

                )}

              </div>

              {/* Title */}

              <div>

                <label
                  htmlFor="title"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Title
                </label>

                <input
                  id="title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) =>
                    setTitle(e.target.value)
                  }
                  placeholder="e.g. Java Assignment"
                  className={inputStyle}
                />

              </div>

              {/* Subject */}

              <div>

                <label
                  htmlFor="subject"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Subject
                </label>

                <input
                  id="subject"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) =>
                    setSubject(e.target.value)
                  }
                  placeholder="e.g. Java"
                  className={inputStyle}
                />

              </div>

              {/* Description */}

              <div>

                <label
                  htmlFor="description"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="description"
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  placeholder="e.g. Complete the inheritance program and submit the code."
                  rows={4}
                  className={inputStyle}
                />

              </div>

              {/* Deadline */}

              <div>

                <label
                  htmlFor="deadline"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Deadline
                </label>

                <div className="relative">

                  <input
                    id="deadline"
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={10}
                    pattern="\d{2}/\d{2}/\d{4}"
                    title="Use dd/mm/yyyy"
                    value={deadline}
                    onChange={(e) => {
                      setDeadline(
                        maskDate(
                          e.target.value
                        )
                      );

                      setDateError("");
                    }}
                    placeholder="dd/mm/yyyy"
                    className={`${inputStyle} pr-12`}
                  />

                  {/* Calendar button */}

                  <button
                    type="button"
                    aria-label="Open calendar"
                    onClick={() =>
                      pickerRef.current?.showPicker?.()
                    }
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

                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="18"
                        rx="3"
                      />

                      <path d="M16 2v4M8 2v4M3 10h18" />

                    </svg>

                  </button>

                  <input
                    ref={pickerRef}
                    type="date"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(e) => {

                      if (e.target.value) {

                        setDeadline(
                          formatDate(
                            e.target.value
                          )
                        );

                        setDateError("");
                      }

                    }}
                    className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
                  />

                </div>

                {dateError && (

                  <p className="mt-1.5 text-sm text-red-600">
                    {dateError}
                  </p>

                )}

              </div>

              {/* Status */}

              <fieldset>

                <legend className="mb-1.5 text-sm font-medium text-slate-700">
                  Status
                </legend>

                <div className="grid grid-cols-2 gap-2">

                  {["Pending", "Completed"].map(
                    (option) => (

                      <label
                        key={option}
                        className={`cursor-pointer rounded-xl border px-4 py-2.5 text-center text-sm font-medium transition ${
                          status === option
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >

                        <input
                          type="radio"
                          name="status"
                          value={option}
                          checked={
                            status === option
                          }
                          onChange={() =>
                            setStatus(option)
                          }
                          className="sr-only"
                        />

                        {option}

                      </label>

                    )
                  )}

                </div>

              </fieldset>

              {/* Submit */}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Adding..."
                  : "Add assignment"}
              </button>

            </form>

          </section>

        )}

      </main>

      {/* ---------- ASSIGNMENT DETAILS ---------- */}

      {selectedAssignment && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={() => setSelectedAssignment(null)}
        >

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Assignment details"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >

            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Assignment Details
            </p>

            <h2 className="mt-1 break-words text-xl font-bold text-slate-900">
              {selectedAssignment.title}
            </h2>

            <dl className="mt-5 grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3 text-sm">

              <dt className="text-slate-500">ID</dt>
              <dd className="font-medium text-slate-900">
                {selectedAssignment.id}
              </dd>

              <dt className="text-slate-500">Subject</dt>
              <dd className="font-medium text-slate-900">
                {selectedAssignment.subject}
              </dd>

              <dt className="text-slate-500">Deadline</dt>
              <dd className="font-medium text-slate-900">
                {formatDate(selectedAssignment.deadline)}
              </dd>

              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-900">
                {selectedAssignment.status}
              </dd>

            </dl>

            <div className="mt-5">

              <p className="text-sm text-slate-500">
                Description
              </p>

              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">
                {selectedAssignment.description?.trim()
                  ? selectedAssignment.description
                  : "No description added."}
              </p>

            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">

              <button
                type="button"
                onClick={() => {
                  startEditing(selectedAssignment);
                  setSelectedAssignment(null);
                }}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
              >
                Edit
              </button>

              <button
                type="button"
                onClick={() => setSelectedAssignment(null)}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ---------- EDIT ASSIGNMENT ---------- */}

      {editingAssignment && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={() => setEditingAssignment(null)}
        >

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit assignment"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >

            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Edit Assignment
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Update assignment
            </h2>

            <form
              onSubmit={handleEditSubmit}
              className="mt-6 space-y-5"
            >

              {/* Title */}

              <div>

                <label
                  htmlFor="edit-title"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Title
                </label>

                <input
                  id="edit-title"
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) =>
                    setEditTitle(e.target.value)
                  }
                  className={inputStyle}
                />

              </div>

              {/* Subject */}

              <div>

                <label
                  htmlFor="edit-subject"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Subject
                </label>

                <input
                  id="edit-subject"
                  type="text"
                  required
                  value={editSubject}
                  onChange={(e) =>
                    setEditSubject(e.target.value)
                  }
                  className={inputStyle}
                />

              </div>

              {/* Description */}

              <div>

                <label
                  htmlFor="edit-description"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) =>
                    setEditDescription(e.target.value)
                  }
                  rows={4}
                  className={inputStyle}
                />

              </div>

              {/* Deadline */}

              <div>

                <label
                  htmlFor="edit-deadline"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Deadline
                </label>

                <input
                  id="edit-deadline"
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={10}
                  pattern="\d{2}/\d{2}/\d{4}"
                  title="Use dd/mm/yyyy"
                  value={editDeadline}
                  onChange={(e) => {
                    setEditDeadline(
                      maskDate(e.target.value)
                    );

                    setEditDateError("");
                  }}
                  placeholder="dd/mm/yyyy"
                  className={inputStyle}
                />

                {editDateError && (

                  <p className="mt-1.5 text-sm text-red-600">
                    {editDateError}
                  </p>

                )}

              </div>

              {/* Status */}

              <fieldset>

                <legend className="mb-1.5 text-sm font-medium text-slate-700">
                  Status
                </legend>

                <div className="grid grid-cols-2 gap-2">

                  {["Pending", "Completed"].map(
                    (option) => (

                      <label
                        key={option}
                        className={`cursor-pointer rounded-xl border px-4 py-2.5 text-center text-sm font-medium transition ${
                          editStatus === option
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >

                        <input
                          type="radio"
                          name="edit-status"
                          value={option}
                          checked={
                            editStatus === option
                          }
                          onChange={() =>
                            setEditStatus(option)
                          }
                          className="sr-only"
                        />

                        {option}

                      </label>

                    )
                  )}

                </div>

              </fieldset>

              {/* Buttons */}

              <div className="grid grid-cols-2 gap-2">

                <button
                  type="button"
                  onClick={() =>
                    setEditingAssignment(null)
                  }
                  disabled={savingEdit}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingEdit
                    ? "Saving..."
                    : "Save changes"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ---------- TOAST ---------- */}

      {toast && (

        <div
          role="status"
          className={`fixed inset-x-4 bottom-6 mx-auto w-fit max-w-sm rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "success"
              ? "bg-emerald-600"
              : "bg-red-600"
          }`}
        >
          {toast.text}
        </div>

      )}

    </div>
  );
}
