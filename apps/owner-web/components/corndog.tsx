import { memo } from "react";
const Corndog = memo(function Corndog({
  kind = "gold",
  className = "",
  id = "dog",
}: {
  kind?: string;
  className?: string;
  id?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 190"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}-g`}
          x1="40"
          y1="20"
          x2="125"
          y2="160"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={kind === "choco" ? "#6C3D29" : "#FFD16A"} />
          <stop
            offset="1"
            stopColor={kind === "choco" ? "#3C211B" : "#DD8328"}
          />
        </linearGradient>
        <filter id={`${id}-s`}>
          <feDropShadow
            dx="3"
            dy="7"
            stdDeviation="5"
            floodColor="#8d571e"
            floodOpacity=".15"
          />
        </filter>
      </defs>
      <g transform="rotate(26 80 95)" filter={`url(#${id}-s)`}>
        <rect x="75" y="123" width="9" height="59" rx="4.5" fill="#D9B07B" />
        <rect
          x="47"
          y="15"
          width="65"
          height="130"
          rx="32"
          fill={`url(#${id}-g)`}
        />
        {Array.from({ length: 30 }, (_, i) => (
          <rect
            key={i}
            x={53 + ((i * 17) % 51)}
            y={25 + ((i * 23) % 108)}
            width={kind === "potato" ? 12 : 3}
            height={kind === "potato" ? 12 : 5}
            rx={kind === "potato" ? 3 : 1.5}
            fill={i % 3 === 0 ? "#F6D28D" : "#C68B34"}
            opacity=".65"
            transform={`rotate(${i * 17} ${53 + ((i * 17) % 51)} ${25 + ((i * 23) % 108)})`}
          />
        ))}
        <path
          d="M55 42C102 42 61 63 102 65C59 67 104 87 59 88C100 91 62 110 102 112"
          stroke={
            kind === "choco"
              ? "#DAB293"
              : kind === "red"
                ? "#E63946"
                : "#FFF0C0"
          }
          strokeWidth="6"
          strokeLinecap="round"
        />
        {kind !== "choco" && (
          <path
            d="M101 33L59 53M103 77L59 99M101 121L78 130"
            stroke={kind === "red" ? "#F8CD4D" : "#DF4A35"}
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}
      </g>
    </svg>
  );
});
export default Corndog;
