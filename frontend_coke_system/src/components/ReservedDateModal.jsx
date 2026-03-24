import React, { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import ModalShell from "./common/ModalShell";

const CALENDAR_LOCALE = "en-US";

const getLocalDateValue = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const toLocalCalendarDate = (value) => {
  if (!value) return null;

  const [year, month, day] = String(value)
    .split("-")
    .map(Number);

  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatMonthYearLabel = (_, date) =>
  date.toLocaleDateString(CALENDAR_LOCALE, {
    month: "long",
    year: "numeric",
  });

const formatShortWeekdayLabel = (_, date) =>
  date
    .toLocaleDateString(CALENDAR_LOCALE, { weekday: "short" })
    .slice(0, 2);

const ReservedDateModal = ({
  open,
  onClose,
  onConfirm,
  title = "Reserve Transaction",
  description = "Choose the pickup date for the reserved products.",
  confirmLabel = "Save Reservation",
  initialDate = "",
  items = [],
  calendarOnly = false,
}) => {
  const minDate = useMemo(() => getLocalDateValue(), []);
  const minCalendarDate = useMemo(
    () => toLocalCalendarDate(minDate) || new Date(),
    [minDate]
  );
  const [reservedDate, setReservedDate] = useState(initialDate || minDate);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      return;
    }

    setReservedDate(initialDate || minDate);
    setIsSubmitting(false);
  }, [open, initialDate, minDate]);

  const previewItems = useMemo(
    () =>
      (Array.isArray(items) ? items : []).filter(
        (item) => Number(item?.soldShell || 0) > 0 || Number(item?.soldPcs || 0) > 0
      ),
    [items]
  );

  const calendarValue = useMemo(
    () => toLocalCalendarDate(reservedDate) || minCalendarDate,
    [reservedDate, minCalendarDate]
  );

  const handleConfirm = async (dateValue = reservedDate) => {
    if (!dateValue || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onConfirm?.(dateValue);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCalendarChange = (nextValue) => {
    const selectedDate = Array.isArray(nextValue) ? nextValue[0] : nextValue;
    if (!(selectedDate instanceof Date) || Number.isNaN(selectedDate.getTime())) return;

    setReservedDate(getLocalDateValue(selectedDate));
  };

  const isDateConfirmAction = /date/i.test(confirmLabel);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="sm"
      ariaLabel={title}
      initialFocusSelector={
        calendarOnly
          ? ".reserved-calendar-widget .react-calendar__navigation button, .reserved-calendar-widget .react-calendar__tile"
          : "input[type='date']"
      }
      panelClassName={calendarOnly ? "reserved-calendar-panel" : ""}
    >
      {calendarOnly ? (
        <div className="reserved-calendar-layout">
          <div className="reserved-calendar-only">
            <Calendar
              onChange={handleCalendarChange}
              value={calendarValue}
              minDate={minCalendarDate}
              locale={CALENDAR_LOCALE}
              calendarType="gregory"
              minDetail="month"
              maxDetail="month"
              prevLabel={<span aria-hidden="true">{"\u2190"}</span>}
              nextLabel={<span aria-hidden="true">{"\u2192"}</span>}
              prevAriaLabel="Go to previous month"
              nextAriaLabel="Go to next month"
              next2Label={null}
              prev2Label={null}
              showNeighboringMonth={false}
              formatMonthYear={formatMonthYearLabel}
              formatShortWeekday={formatShortWeekdayLabel}
              className="reserved-calendar-widget"
            />
          </div>

          <div className="reserved-calendar-actions">
            <button
              type="button"
              onClick={onClose}
              className="reserved-calendar-btn reserved-calendar-btn--ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleConfirm()}
              disabled={!reservedDate || isSubmitting}
              className="reserved-calendar-btn reserved-calendar-btn--primary"
            >
              {isSubmitting ? "Setting..." : confirmLabel}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          </div>

          {previewItems.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">
                Sold values based on dispatched quantities
              </p>
              <div className="mt-2 space-y-2 text-sm text-gray-700">
                {previewItems.map((item) => (
                  <div
                    key={item.id || item.productName}
                    className="flex items-center justify-between gap-3 rounded bg-white px-3 py-2"
                  >
                    <span className="font-medium text-gray-900">{item.productName}</span>
                    <span>
                      Sold Shell: {Number(item.soldShell || 0)} | Sold Item Qty: {Number(item.soldPcs || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
            Reserved Pickup Date
            <input
              type="date"
              value={reservedDate}
              min={minDate}
              onChange={(e) => setReservedDate(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleConfirm()}
              disabled={!reservedDate || isSubmitting}
              className={`rounded px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed ${
                isDateConfirmAction
                  ? "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
                  : "bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
};

export default ReservedDateModal;
