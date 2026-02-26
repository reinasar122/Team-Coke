import React from "react";
import { createRoot } from "react-dom/client";
import ModalShell from "./ModalShell";

const mountTemporaryDialog = (renderDialog) =>
  new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(false);
      return;
    }

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    let settled = false;
    const cleanup = (result) => {
      if (settled) return;
      settled = true;
      root.unmount();
      host.remove();
      resolve(result);
    };

    root.render(renderDialog(cleanup));
  });

const DialogBody = ({
  title,
  message,
  details,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false,
  singleAction = false,
}) => (
  <div className="p-6 sm:p-7 text-gray-900 dark:text-slate-100">
    {title && (
      <h3
        className={`text-xl font-bold mb-3 ${
          danger ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"
        }`}
      >
        {title}
      </h3>
    )}

    {message && (
      <p className="text-sm sm:text-base text-gray-700 dark:text-slate-300 whitespace-pre-wrap">
        {message}
      </p>
    )}

    {details && (
      <div className="mt-4 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/70 p-3 max-h-56 overflow-auto">
        <pre className="text-xs sm:text-sm whitespace-pre-wrap break-words text-gray-700 dark:text-slate-300 m-0">
          {details}
        </pre>
      </div>
    )}

    <div className="flex justify-end gap-3 mt-6">
      {!singleAction && (
        <button type="button" className="btn btn-cancel" onClick={onCancel}>
          {cancelLabel}
        </button>
      )}
      <button
        type="button"
        className={danger ? "btn btn-danger" : "btn btn-primary"}
        onClick={onConfirm}
      >
        {confirmLabel}
      </button>
    </div>
  </div>
);

export const showAppAlertDialog = ({
  title = "",
  message = "",
  details = "",
  okLabel = "OK",
  danger = false,
  size = "sm",
}) =>
  mountTemporaryDialog((cleanup) => (
    <ModalShell
      open
      size={size}
      onClose={() => cleanup(true)}
      closeOnOverlay
      closeOnEscape
      panelClassName="bg-white dark:bg-slate-950 w-full"
      initialFocusSelector="button"
    >
      <DialogBody
        title={title}
        message={message}
        details={details}
        confirmLabel={okLabel}
        onConfirm={() => cleanup(true)}
        onCancel={() => cleanup(true)}
        singleAction
        danger={danger}
      />
    </ModalShell>
  ));

export const showAppConfirmDialog = ({
  title = "Confirm",
  message = "",
  details = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  size = "sm",
}) =>
  mountTemporaryDialog((cleanup) => (
    <ModalShell
      open
      size={size}
      onClose={() => cleanup(false)}
      closeOnOverlay
      closeOnEscape
      panelClassName="bg-white dark:bg-slate-950 w-full"
      initialFocusSelector="button"
    >
      <DialogBody
        title={title}
        message={message}
        details={details}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        onConfirm={() => cleanup(true)}
        onCancel={() => cleanup(false)}
        danger={danger}
      />
    </ModalShell>
  ));

export default {
  showAppAlertDialog,
  showAppConfirmDialog,
};
