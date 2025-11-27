import React from "react";
import PropTypes from "prop-types";

export default function Metric({ label, value }) {
  return (
    <div className="flex flex-col bg-slate-50 rounded-lg p-3 border border-slate-200 text-center">
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">
        {label}
      </span>
      <span className="text-base font-semibold text-slate-800 whitespace-nowrap">
        {value}
      </span>
    </div>
  );
}

Metric.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};