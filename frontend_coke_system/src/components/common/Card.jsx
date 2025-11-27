import React from "react";
import PropTypes from "prop-types";

export default function Card({ title, children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 transition-all hover:shadow-md ${className}`}
    >
      {title && (
        <div className="mb-3 border-b border-slate-100 pb-2">
          <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
            {title}
          </h3>
        </div>
      )}
      <div className="text-slate-700">{children}</div>
    </div>
  );
}

Card.propTypes = {
  title: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
};