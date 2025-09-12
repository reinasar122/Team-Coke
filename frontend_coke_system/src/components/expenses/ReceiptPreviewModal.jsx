import React from "react";

export default function ReceiptPreviewModal({ url, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Receipt</h3>
        </div>
        <div className="modal-body center">
          {url ? (
            <img className="receipt-full" src={url} alt="receipt" />
          ) : (
            <div>No image.</div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
