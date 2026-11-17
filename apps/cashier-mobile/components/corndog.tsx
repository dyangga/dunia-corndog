import { memo } from "react";
import { Platform } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  G,
  Rect,
  Path,
} from "react-native-svg";
const Corndog = memo(function Corndog({
  kind = "gold",
  width = 120,
  height = 144,
  id = "dog",
}: {
  kind?: string;
  width?: number;
  height?: number;
  id?: string;
}) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 160 190"
      fill="none"
      {...(Platform.OS === "web"
        ? { "aria-hidden": true }
        : { accessible: false })}
    >
      <Defs>
        <LinearGradient
          id={`${id}-g`}
          x1="40"
          y1="20"
          x2="125"
          y2="160"
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor={kind === "choco" ? "#6C3D29" : "#FFD16A"} />
          <Stop
            offset="1"
            stopColor={kind === "choco" ? "#3C211B" : "#DD8328"}
          />
        </LinearGradient>
      </Defs>
      <G transform="rotate(26 80 95)">
        <Rect x="75" y="123" width="9" height="59" rx="4.5" fill="#D9B07B" />
        <Rect
          x="47"
          y="15"
          width="65"
          height="130"
          rx="32"
          fill={`url(#${id}-g)`}
        />
        {Array.from({ length: 30 }, (_, i) => (
          <Rect
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
        <Path
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
          <Path
            d="M101 33L59 53M103 77L59 99M101 121L78 130"
            stroke={kind === "red" ? "#F8CD4D" : "#DF4A35"}
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}
      </G>
    </Svg>
  );
});
export default Corndog;
