// src/components/common/Empty.jsx
import React from "react";
import PropTypes from "prop-types";

export default function Empty({ text = "No data available" }) {
  return (
    <div className="flex items-center justify-center w-full py-8">
      <p className="text-slate-400 text-sm font-medium italic">{text}</p>
    </div>
  );
}

Empty.propTypes = {
  text: PropTypes.string,
};