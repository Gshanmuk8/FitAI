import React from "react";

const paths = {
  today: "M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3Z",
  train: "M7 8v8m10-8v8M4 10v4m16-4v4M7 12h10M2 12h2m16 0h2",
  fuel: "M7 3v6m-3-6v5a3 3 0 0 0 6 0V3M7 11v10M20 3c-4 2-5 7-3 10h3m0-10v18",
  progress: "M4 4v16h17M7 15l5-5 4 3 5-7",
  coach:
    "M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5ZM20 2v4m-2-2h4",
  plan: "M8 3h8v4H8ZM6 5H4v16h16V5h-2M8 12h8m-8 4h5",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  back: "M19 12H5m6-6-6 6 6 6",
  check: "m5 12 4 4L19 6",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  water: "M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13ZM9 16a3 3 0 0 0 3 3",
  moon: "M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z",
  steps:
    "M9 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm10 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5 9h4v10a2 2 0 0 1-4 0Zm10 7h4v4a2 2 0 0 1-4 0Z",
  camera: "M8 5 9 3h6l1 2h5v15H3V5ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  upload: "M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6ZM8 12l3 3 5-6",
  refresh:
    "M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 3M4 16l2 3a8 8 0 0 0 13-2",
  info: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6m0-10v1",
  memory:
    "M8 3a3 3 0 0 0-3 3v1a4 4 0 0 0-1 7 4 4 0 0 0 4 6h4V4a3 3 0 0 0-4-1Zm8 0a3 3 0 0 1 3 3v1a4 4 0 0 1 1 7 4 4 0 0 1-4 6h-4M5 10h3m8 0h3M8 16h4m4 0h-4",
  logout: "M10 3H3v18h7m5-15 6 6-6 6m-7-6h13",
};
export default function Icon({ name, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.info} />
    </svg>
  );
}
export function Brand({ compact = false }) {
  return (
    <span className="brand">
      <svg
        width="30"
        height="30"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 25 15 7h11l-4 8h-8m4 0-5 10"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="square"
        />
      </svg>
      {!compact && (
        <span>
          fit<span className="brand-ai">ai</span>
          <span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}
