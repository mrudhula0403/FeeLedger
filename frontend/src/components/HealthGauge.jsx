export default function HealthGauge({ score = 0, label = "" }) {
  const radius = 70;
  const stroke = 14;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  const color =
    score >= 90 ? "#22c55e" : score >= 75 ? "#14b8a6" : score >= 50 ? "#f59e0b" : "#e5484d";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <svg height={radius * 2} width={radius * 2}>
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#8b7cf6" />
          </linearGradient>
        </defs>
        <circle
          stroke="rgba(16,26,51,0.08)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="url(#gaugeGradient)"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + " " + circumference}
          style={{ strokeDashoffset: offset, transition: "stroke-dashoffset 0.6s ease" }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          transform={`rotate(-90 ${radius} ${radius})`}
        />
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          fontSize="28"
          fontWeight="700"
          fontFamily="'JetBrains Mono', monospace"
          fill="#111827"
        >
          {score}
        </text>
        <text x="50%" y="63%" textAnchor="middle" fontSize="11" fill="#667085">
          / 100
        </text>
      </svg>
      <div>
        <div className="stat-card label">Fee Health Score</div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, marginTop: 4, color }}>
          {label}
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 4, maxWidth: 220 }}>
          Based on collection rate, fully-paid student rate, and overdue exposure.
        </div>
      </div>
    </div>
  );
}
