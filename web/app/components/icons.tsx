/* Hand-drawn SVG icons — loose strokes, rounded caps, slight wobble.
   All inherit `currentColor` so they theme with text. */

type IconProps = { className?: string; size?: number };

export function SparkleIcon({ className, size = 22 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {/* big four-point spark */}
      <path
        d="M12 3.2 C 12.8 8, 14.4 9.6, 19.2 10.4 C 14.4 11.2, 12.8 12.8, 12 17.6 C 11.2 12.8, 9.6 11.2, 4.8 10.4 C 9.6 9.6, 11.2 8, 12 3.2 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* small accent spark */}
      <path
        d="M18.3 15 C 18.6 16.7, 19.1 17.2, 20.8 17.6 C 19.1 18, 18.6 18.5, 18.3 20.2 C 18 18.5, 17.5 18, 15.8 17.6 C 17.5 17.2, 18 16.7, 18.3 15 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UploadIcon({ className, size = 30 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 16.5 V5.5 M12 5.5 C 10.6 6.8, 9.4 8.1, 8.2 9 M12 5.5 C 13.4 6.8, 14.6 8.1, 15.8 9"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 14 C 4.3 16.4, 4.6 18.3, 5 19 C 9.7 19.4, 14.3 19.4, 19 19 C 19.4 18.2, 19.7 16.3, 19.5 14"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowUpIcon({ className, size = 22 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 19 V5.5 M12 5.5 C 10.3 7.1, 8.7 8.7, 7 10.2 M12 5.5 C 13.7 7.1, 15.3 8.7, 17 10.2"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PdfIcon({ className, size = 26 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 3.4 C 9.5 3, 12.5 3, 14.5 3.3 L 18.4 7.2 C 18.7 12, 18.7 17, 18.3 20.6 C 14 21, 9.5 21, 5.7 20.6 C 5.3 15, 5.3 9, 6 3.4 Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M14.3 3.4 C 14.1 5, 14.2 6.6, 14.6 7.3 C 15.6 7.6, 17 7.6, 18.2 7.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.6 13 H15.2 M8.6 16 H13.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
