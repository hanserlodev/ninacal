"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type RegionOption = {
  id: string;
  name: string;
  cells: number;
};

export default function RegionPicker({
  value,
  options,
  wholeValue,
  wholeLabel,
  onChange,
  disabled,
}: {
  value: string;
  options: RegionOption[];
  wholeValue: string;
  wholeLabel: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = value === wholeValue ? null : options.find((entry) => entry.id === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((entry) =>
      `${entry.name} ${entry.id}`.toLowerCase().includes(needle),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") return setOpen(false);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(filtered.length - 1, current + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const choice = filtered[active];
      if (choice) commit(choice.id);
    }
  };

  return (
    <div className="country-picker" ref={boxRef}>
      <button
        type="button"
        className={open ? "country-trigger is-open" : "country-trigger"}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="country-trigger-name">
          {selected ? `${selected.name} · ${selected.cells.toLocaleString("en-US")} cells` : wholeLabel}
        </span>
        <span className="country-code">{selected ? selected.id : "ALL"}</span>
        <span className="country-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="country-pop">
          <input
            ref={inputRef}
            className="country-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search region or state…"
            aria-label="Search regions"
            autoComplete="off"
          />
          <ul className="country-list" role="listbox" aria-label="Regions">
            {query.trim() === "" ? (
              <li
                role="option"
                aria-selected={value === wholeValue}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commit(wholeValue);
                }}
              >
                <span className="country-trigger-name">{wholeLabel}</span>
                <span className="country-code">ALL</span>
              </li>
            ) : null}
            {filtered.map((entry, index) => (
              <li
                key={entry.id}
                role="option"
                aria-selected={entry.id === value}
                className={
                  (index === active ? "is-active " : "") + (entry.id === value ? "is-selected" : "")
                }
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commit(entry.id);
                }}
              >
                <span className="country-trigger-name">{entry.name}</span>
                <span className="country-code">{entry.cells.toLocaleString("en-US")}</span>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="country-empty">No region matches “{query}”.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
