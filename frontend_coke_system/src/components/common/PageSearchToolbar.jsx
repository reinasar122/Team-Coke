import React from "react";
import { FaSearch, FaTimes } from "react-icons/fa";

export const pageToolbarControlClassName = "app-page-toolbar__control";

export function PageToolbarSelect({
  value,
  onChange,
  options = [],
  className = "",
  ariaLabel,
  ...rest
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      aria-label={ariaLabel}
      className={[pageToolbarControlClassName, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export default function PageSearchToolbar({
  value = "",
  onChange,
  onClear,
  placeholder = "Search...",
  searchLabel = "Search",
  controls = null,
  actions = null,
  summary = null,
  className = "",
  disabled = false,
}) {
  const hasValue = Boolean(value);

  return (
    <div className={["app-page-toolbar", className].filter(Boolean).join(" ")}>
      <div className="app-page-toolbar__row">
        <div className="app-page-toolbar__primary">
          <div className="app-page-toolbar__search">
            <FaSearch className="app-page-toolbar__search-icon" aria-hidden="true" />
            <input
              type="search"
              value={value}
              onChange={(event) => onChange?.(event.target.value, event)}
              placeholder={placeholder}
              aria-label={searchLabel}
              className="app-page-toolbar__search-input"
              disabled={disabled}
            />
            {hasValue && onClear ? (
              <button
                type="button"
                className="app-page-toolbar__clear"
                onClick={onClear}
                aria-label="Clear search"
                title="Clear search"
              >
                <FaTimes aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {controls ? <div className="app-page-toolbar__controls">{controls}</div> : null}
        </div>

        {actions ? <div className="app-page-toolbar__actions">{actions}</div> : null}
      </div>

      {summary ? <div className="app-page-toolbar__summary">{summary}</div> : null}
    </div>
  );
}
