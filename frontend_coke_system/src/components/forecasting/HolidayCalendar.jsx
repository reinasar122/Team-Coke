import React, { useState } from "react";
import "../../styles/holiday.scss";

export function HolidayCalendar({
  holidays = [],
  onAddHoliday,
  onRemoveHoliday,
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [touched, setTouched] = useState(false);

  const hasError = touched && (!name.trim() || !date);

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);

    if (!name.trim() || !date) return;

    // Send to parent
    if (onAddHoliday) {
      onAddHoliday({
        id: Date.now(),
        name: name.trim(),
        date,
      });
    }

    // Reset form
    setName("");
    setDate("");
    setTouched(false);
  };

  return (
    <div className="forecast-card">
      <div className="forecast-card-header">
        <h2 className="forecast-card-title">Holiday Calendar</h2>
        <p className="forecast-card-subtitle">
          Add holidays that may impact sales forecasting
        </p>
      </div>

      {/* Form with Flexbox layout */}
      <form className="forecast-card-body holiday-form" onSubmit={handleSubmit}>
        <div className="holiday-form-row">
          {/* Holiday name */}
          <div className="holiday-field">
            <label className="forecast-label">Holiday Name</label>
            <input
              type="text"
              value={name}
              placeholder="e.g., Christmas Day"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              className={
                "forecast-input" +
                (hasError && !name.trim() ? " forecast-input-error" : "")
              }
            />
          </div>

          {/* Holiday date */}
          <div className="holiday-field">
            <label className="forecast-label">Holiday Date</label>
            <div className="holiday-date-wrapper">
              <span className="holiday-date-icon" role="img" aria-label="date">
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onBlur={() => setTouched(true)}
                className={
                  "forecast-input holiday-date-input" +
                  (hasError && !date ? " forecast-input-error" : "")
                }
              />
            </div>
          </div>

          {/* Button */}
          <div className="holiday-button-wrapper">
            <button type="submit" className="btn-primary-danger">
              Add Holiday
            </button>
          </div>
        </div>

        {hasError && (
          <p className="forecast-error-text">
            Please enter both holiday name and date.
          </p>
        )}
      </form>

      {/* Existing holidays table/list */}
      {holidays.length > 0 && (
        <div className="forecast-card-footer">
          <h3 className="forecast-card-subtitle" style={{ marginBottom: 8 }}>
            Added Holidays
          </h3>
          <div className="holiday-table-wrapper">
            <table className="forecast-table">
              <thead>
                <tr>
                  <th>Holiday</th>
                  <th>Date</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id}>
                    <td>{h.name}</td>
                    <td>
                      {new Date(h.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </td>
                    <td>
                      {onRemoveHoliday && (
                        <button
                          type="button"
                          className="btn-link-danger"
                          onClick={() => onRemoveHoliday(h.id)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}