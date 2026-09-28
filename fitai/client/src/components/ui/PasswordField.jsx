import React, { useState } from "react";
export default function PasswordField({ id, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input
        {...props}
        id={id}
        className="field"
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        aria-controls={id}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible(!visible)}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
