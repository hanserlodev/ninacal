"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import { flagFor } from "@/lib/flags";

export default function CountryPicker({
  value,
  onChange,
  version = 0,
}: {
  value: string;
  onChange: (code: string) => void;
  /** Bumps when the API replaces the catalogue. */
  version?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = COUNTRIES.find((country) => country.code === value);
  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return COUNTRIES;
    return COUNTRIES.filter((country) =>
      `${country.name} ${country.code} ${country.iso3}`.toLowerCase().includes(needle),
    );
    // COUNTRIES is replaced in place by the API catalogue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, version]);

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

  const commit = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(options.length - 1, current + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const choice = options[active];
      if (choice) commit(choice.code);
    }
  };

  return (
    <div className="country-picker" ref={boxRef}>
      <button
        type="button"
        className={open ? "country-trigger is-open" : "country-trigger"}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="country-flag" aria-hidden="true">
          {selected ? flagFor(selected.code, selected.iso3) : "🌍"}
        </span>
        <span className="country-trigger-name">{selected ? selected.name : "World overview"}</span>
        <span className="country-code">{selected ? selected.code : `${COUNTRIES.length}`}</span>
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
            placeholder="Search country or code…"
            aria-label="Search countries"
            autoComplete="off"
          />
          <ul className="country-list" role="listbox" aria-label="Countries">
            {query.trim() === "" ? (
              <li
                role="option"
                aria-selected={!value}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commit("");
                }}
              >
                <span className="country-flag" aria-hidden="true">
                  🌍
                </span>
                <span className="country-trigger-name">World overview</span>
                <span className="country-code">{COUNTRIES.length}</span>
              </li>
            ) : null}
            {options.map((country, index) => (
              <li
                key={country.code}
                role="option"
                aria-selected={country.code === value}
                className={
                  (index === active ? "is-active " : "") + (country.code === value ? "is-selected" : "")
                }
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commit(country.code);
                }}
              >
                <span className="country-flag" aria-hidden="true">
                  {flagFor(country.code, country.iso3)}
                </span>
                <span className="country-trigger-name">{country.name}</span>
                <span className="country-code">{country.code}</span>
              </li>
            ))}
            {options.length === 0 ? (
              <li className="country-empty">No country matches “{query}”.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
