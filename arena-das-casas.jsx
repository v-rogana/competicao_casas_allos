import { useState, useEffect, useRef } from "react";

// ── Mock Data (will be replaced by JSON from Python script) ──────────────────
const MOCK_DATA = {
  updated_at: "2026-02-26T08:30:00",
  houses: {
    prisma: {
      name: "Prisma",
      leader: "Diogo",
      sensibility: "TCC e Comportamentais",
      motto: "Decompor a complexidade em clareza",
      therapists_count: 16,
      active_patients: 48,
    },
    macondo: {
      name: "Macondo",
      leader: "Flávia",
      sensibility: "Psicodinâmica",
      motto: "A magia habita a realidade",
      therapists_count: 14,
      active_patients: 42,
    },
    marmoris: {
      name: "Marmoris",
      leader: "Alice Guedon",
      sensibility: "Humanista",
      motto: "O brilho do sol refletido no mar",
      therapists_count: 12,
      active_patients: 36,
    },
  },
  periods: {
    current: {
      label: "Fevereiro 2026",
      kpis: {
        adimplencia: { prisma: 87.5, macondo: 78.6, marmoris: 91.7 },
        sessoes_paciente: { prisma: 3.4, macondo: 3.1, marmoris: 3.6 },
        qualidade: { prisma: 8.2, macondo: 7.8, marmoris: 8.9 },
        comparecimento: { prisma: 89.3, macondo: 82.1, marmoris: 86.5 },
        evolucao_ors: { prisma: 4.7, macondo: 6.2, marmoris: 5.3 },
      },
    },
    accumulated: {
      label: "Dez 2025 — Fev 2026",
      kpis: {
        adimplencia: { prisma: 84.2, macondo: 76.1, marmoris: 88.9 },
        sessoes_paciente: { prisma: 9.8, macondo: 8.7, marmoris: 10.2 },
        qualidade: { prisma: 8.0, macondo: 7.6, marmoris: 8.7 },
        comparecimento: { prisma: 87.1, macondo: 80.5, marmoris: 84.8 },
        evolucao_ors: { prisma: 5.1, macondo: 6.8, marmoris: 5.9 },
      },
    },
  },
};

// ── House Configuration ──────────────────────────────────────────────────────
const HOUSES = {
  prisma: {
    key: "prisma",
    color: "#2B7A9E",
    colorLight: "#3A9BC4",
    colorDark: "#1A5276",
    gradient: "linear-gradient(135deg, #1A5276, #2B7A9E, #3AAFCF)",
    glowColor: "rgba(43, 122, 158, 0.4)",
    bgAccent: "rgba(43, 122, 158, 0.08)",
    symbol: "triangle",
  },
  macondo: {
    key: "macondo",
    color: "#6C4F9E",
    colorLight: "#8B6BBF",
    colorDark: "#4A3072",
    gradient: "linear-gradient(135deg, #4A3072, #6C4F9E, #9B7FD0)",
    glowColor: "rgba(108, 79, 158, 0.4)",
    bgAccent: "rgba(108, 79, 158, 0.08)",
    symbol: "window",
  },
  marmoris: {
    key: "marmoris",
    color: "#D4A574",
    colorLight: "#E4BF9A",
    colorDark: "#C4956A",
    gradient: "linear-gradient(135deg, #C4956A, #D4A574, #E8CBA8)",
    glowColor: "rgba(212, 165, 116, 0.4)",
    bgAccent: "rgba(212, 165, 116, 0.08)",
    symbol: "sun",
  },
};

const HOUSE_ORDER = ["prisma", "macondo", "marmoris"];

const KPI_CONFIG = [
  {
    key: "adimplencia",
    label: "Adimplência",
    subtitle: "Pagamentos / Pacientes Ativos",
    unit: "%",
    maxValue: 100,
    icon: "💰",
    description: "Taxa de pacientes com pagamento registrado no período",
  },
  {
    key: "sessoes_paciente",
    label: "Sessões por Paciente",
    subtitle: "Média de sessões realizadas",
    unit: "",
    maxValue: null, // dynamic
    icon: "📋",
    description: "Número médio de sessões realizadas por paciente ativo",
  },
  {
    key: "qualidade",
    label: "Qualidade da Terapia",
    subtitle: "Média das avaliações (0-10)",
    unit: "/10",
    maxValue: 10,
    icon: "⭐",
    description: "Nota média de qualidade geral atribuída pelos pacientes",
  },
  {
    key: "comparecimento",
    label: "Taxa de Comparecimento",
    subtitle: "Sessões realizadas / Total agendado",
    unit: "%",
    maxValue: 100,
    icon: "✅",
    description: "Percentual de sessões efetivamente realizadas",
  },
  {
    key: "evolucao_ors",
    label: "Evolução Clínica",
    subtitle: "Δ ORS (Saída − Entrada)",
    unit: " pts",
    maxValue: null, // dynamic
    icon: "📈",
    description: "Melhora média na pontuação ORS entre entrada e saída",
  },
];

// ── Utility Components ───────────────────────────────────────────────────────

function HouseEmblem({ house, size = 64 }) {
  const config = HOUSES[house];
  const s = size;
  const mid = s / 2;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <defs>
        <radialGradient id={`glow-${house}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={config.colorLight} stopOpacity="0.6" />
          <stop offset="100%" stopColor={config.colorDark} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`fill-${house}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={config.colorLight} />
          <stop offset="100%" stopColor={config.colorDark} />
        </linearGradient>
      </defs>
      <circle cx={mid} cy={mid} r={mid * 0.8} fill={`url(#glow-${house})`} />
      {house === "prisma" && (
        <polygon
          points={`${mid},${s * 0.2} ${s * 0.75},${s * 0.7} ${s * 0.25},${s * 0.7}`}
          fill="none"
          stroke={config.colorLight}
          strokeWidth="2"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${mid} ${mid}`}
            to={`360 ${mid} ${mid}`}
            dur="20s"
            repeatCount="indefinite"
          />
        </polygon>
      )}
      {house === "prisma" && (
        <polygon
          points={`${mid},${s * 0.28} ${s * 0.68},${s * 0.64} ${s * 0.32},${s * 0.64}`}
          fill={`url(#fill-${house})`}
          opacity="0.7"
        />
      )}
      {house === "macondo" && (
        <>
          <rect
            x={s * 0.25}
            y={s * 0.25}
            width={s * 0.5}
            height={s * 0.5}
            rx="4"
            fill={`url(#fill-${house})`}
            opacity="0.7"
          />
          <line x1={mid} y1={s * 0.25} x2={mid} y2={s * 0.75} stroke={config.colorDark} strokeWidth="1.5" />
          <line x1={s * 0.25} y1={mid} x2={s * 0.75} y2={mid} stroke={config.colorDark} strokeWidth="1.5" />
        </>
      )}
      {house === "marmoris" && (
        <>
          <circle cx={mid} cy={s * 0.35} r={s * 0.18} fill={`url(#fill-${house})`} opacity="0.8" />
          <path
            d={`M ${s * 0.2} ${s * 0.6} Q ${s * 0.35} ${s * 0.52} ${mid} ${s * 0.6} Q ${s * 0.65} ${s * 0.68} ${s * 0.8} ${s * 0.6}`}
            fill="none"
            stroke={config.colorLight}
            strokeWidth="1.5"
            opacity="0.6"
          />
          <path
            d={`M ${s * 0.15} ${s * 0.68} Q ${s * 0.35} ${s * 0.6} ${mid} ${s * 0.68} Q ${s * 0.65} ${s * 0.76} ${s * 0.85} ${s * 0.68}`}
            fill="none"
            stroke={config.colorLight}
            strokeWidth="1"
            opacity="0.4"
          />
        </>
      )}
    </svg>
  );
}

function AnimatedBar({ value, maxValue, color, gradient, delay = 0 }) {
  const [width, setWidth] = useState(0);
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;

  useEffect(() => {
    const timer = setTimeout(() => setWidth(pct), 100 + delay);
    return () => clearTimeout(timer);
  }, [pct, delay]);

  return (
    <div
      style={{
        width: "100%",
        height: "28px",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.04)",
        overflow: "hidden",
        position: "relative",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${width}%`,
          background: gradient,
          borderRadius: "14px",
          transition: "width 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
          boxShadow: `0 0 20px ${color}40, inset 0 1px 0 rgba(255,255,255,0.2)`,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "50%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.15), transparent)",
            borderRadius: "14px 14px 0 0",
          }}
        />
      </div>
    </div>
  );
}

function ParticleField() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    duration: Math.random() * 20 + 15,
    delay: Math.random() * -20,
    opacity: Math.random() * 0.3 + 0.1,
  }));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "#2E9E8F",
            opacity: p.opacity,
            animation: `floatParticle ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ArenaDasCasas() {
  const [period, setPeriod] = useState("current");
  const [data] = useState(MOCK_DATA);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const periodData = data.periods[period];
  const houses = data.houses;

  const formatValue = (kpi, value) => {
    if (kpi.unit === "%") return `${value.toFixed(1)}%`;
    if (kpi.unit === "/10") return value.toFixed(1);
    if (kpi.unit === " pts") return `+${value.toFixed(1)}`;
    return value.toFixed(1);
  };

  const getMaxForKpi = (kpiKey) => {
    const config = KPI_CONFIG.find((k) => k.key === kpiKey);
    if (config.maxValue) return config.maxValue;
    const vals = HOUSE_ORDER.map((h) => periodData.kpis[kpiKey][h]);
    return Math.max(...vals) * 1.15;
  };

  const getBestHouse = (kpiKey) => {
    let best = null;
    let bestVal = -Infinity;
    HOUSE_ORDER.forEach((h) => {
      if (periodData.kpis[kpiKey][h] > bestVal) {
        bestVal = periodData.kpis[kpiKey][h];
        best = h;
      }
    });
    return best;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07070C",
        color: "#E8E6E3",
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        @keyframes floatParticle {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(10px, -20px) scale(1.3); }
          50% { transform: translate(-5px, -40px) scale(0.8); }
          75% { transform: translate(15px, -20px) scale(1.1); }
        }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        
        @keyframes crownBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.1); }
        }
        
        .body-font {
          font-family: 'Outfit', -apple-system, sans-serif;
        }
        
        .serif-font {
          font-family: 'Cormorant Garamond', Georgia, serif;
        }
        
        .period-btn {
          padding: 10px 28px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.03);
          color: rgba(255,255,255,0.5);
          border-radius: 100px;
          cursor: pointer;
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.5px;
          transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
          backdrop-filter: blur(10px);
        }
        
        .period-btn:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.2);
        }
        
        .period-btn.active {
          background: rgba(46, 158, 143, 0.15);
          border-color: rgba(46, 158, 143, 0.5);
          color: #5EEAD4;
          box-shadow: 0 0 20px rgba(46, 158, 143, 0.15);
        }
        
        .house-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 28px 24px;
          text-align: center;
          transition: all 0.5s cubic-bezier(0.22, 1, 0.36, 1);
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(20px);
        }
        
        .house-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 20px;
          padding: 1px;
          background: var(--house-gradient);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.5s;
        }
        
        .house-card:hover::before {
          opacity: 0.5;
        }
        
        .house-card:hover {
          transform: translateY(-4px);
          background: rgba(255,255,255,0.04);
          box-shadow: 0 20px 60px var(--house-glow);
        }
        
        .kpi-section {
          background: rgba(255,255,255,0.015);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 20px;
          padding: 32px;
          position: relative;
          overflow: hidden;
        }
        
        .kpi-section::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(46,158,143,0.3), transparent);
        }
        
        .best-indicator {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 10px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          animation: crownBounce 2s ease-in-out infinite;
        }

        .tooltip-container {
          position: relative;
          display: inline-block;
          cursor: help;
        }

        .tooltip-container .tooltip-text {
          visibility: hidden;
          opacity: 0;
          position: absolute;
          bottom: 130%;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(20,20,30,0.95);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.8);
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 12px;
          white-space: nowrap;
          z-index: 10;
          transition: all 0.2s;
          backdrop-filter: blur(10px);
          font-family: 'Outfit', sans-serif;
          font-weight: 400;
        }

        .tooltip-container:hover .tooltip-text {
          visibility: visible;
          opacity: 1;
        }
        
        @media (max-width: 768px) {
          .houses-grid { flex-direction: column !important; }
          .kpi-bars-grid { gap: 16px !important; }
          .kpi-section { padding: 20px !important; }
        }
      `}</style>

      <ParticleField />

      {/* ── Background Gradient Orbs ── */}
      <div
        style={{
          position: "fixed",
          top: "-20%",
          left: "-10%",
          width: "50%",
          height: "50%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(46,158,143,0.06), transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "-20%",
          right: "-10%",
          width: "60%",
          height: "60%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(108,79,158,0.04), transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ── Content ── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1100,
          margin: "0 auto",
          padding: "40px 24px 80px",
        }}
      >
        {/* ── Header ── */}
        <header
          style={{
            textAlign: "center",
            marginBottom: 48,
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div
            className="body-font"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 18px",
              borderRadius: 100,
              border: "1px solid rgba(46,158,143,0.25)",
              background: "rgba(46,158,143,0.06)",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#5EEAD4",
              marginBottom: 24,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5EEAD4", animation: "pulseGlow 2s infinite" }} />
            Associação Allos
          </div>

          <h1
            style={{
              fontSize: "clamp(36px, 6vw, 60px)",
              fontWeight: 300,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              marginBottom: 12,
            }}
          >
            Arena das{" "}
            <span
              style={{
                fontWeight: 600,
                fontStyle: "italic",
                background: "linear-gradient(135deg, #2B7A9E, #2E9E8F, #D4A574, #6C4F9E)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "shimmer 6s linear infinite",
              }}
            >
              Casas
            </span>
          </h1>

          <p
            className="body-font"
            style={{
              fontSize: 15,
              color: "rgba(255,255,255,0.4)",
              fontWeight: 300,
              letterSpacing: 0.3,
            }}
          >
            Competição clínica entre as Casas da Allos
          </p>
        </header>

        {/* ── Period Toggle ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            marginBottom: 48,
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.1s",
          }}
        >
          <button
            className={`period-btn ${period === "current" ? "active" : ""}`}
            onClick={() => setPeriod("current")}
          >
            {data.periods.current.label}
          </button>
          <button
            className={`period-btn ${period === "accumulated" ? "active" : ""}`}
            onClick={() => setPeriod("accumulated")}
          >
            {data.periods.accumulated.label}
          </button>
        </div>

        {/* ── House Cards ── */}
        <div
          className="houses-grid"
          style={{
            display: "flex",
            gap: 20,
            marginBottom: 48,
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.2s",
          }}
        >
          {HOUSE_ORDER.map((houseKey) => {
            const house = houses[houseKey];
            const config = HOUSES[houseKey];
            return (
              <div
                key={houseKey}
                className="house-card"
                style={{
                  flex: 1,
                  "--house-gradient": config.gradient,
                  "--house-glow": config.glowColor,
                }}
              >
                {/* Subtle background glow */}
                <div
                  style={{
                    position: "absolute",
                    top: "-50%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "80%",
                    height: "80%",
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${config.glowColor}, transparent 70%)`,
                    pointerEvents: "none",
                    opacity: 0.5,
                  }}
                />

                <div style={{ position: "relative" }}>
                  <div style={{ marginBottom: 16 }}>
                    <HouseEmblem house={houseKey} size={56} />
                  </div>

                  <h2
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      fontStyle: "italic",
                      color: config.colorLight,
                      marginBottom: 4,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {house.name}
                  </h2>

                  <p
                    className="body-font"
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.35)",
                      fontWeight: 400,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      marginBottom: 12,
                    }}
                  >
                    {house.sensibility}
                  </p>

                  <p
                    style={{
                      fontSize: 14,
                      fontStyle: "italic",
                      color: "rgba(255,255,255,0.25)",
                      marginBottom: 20,
                      fontWeight: 300,
                    }}
                  >
                    "{house.motto}"
                  </p>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: 24,
                    }}
                  >
                    <div>
                      <div
                        className="body-font"
                        style={{ fontSize: 22, fontWeight: 600, color: config.colorLight }}
                      >
                        {house.therapists_count}
                      </div>
                      <div
                        className="body-font"
                        style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}
                      >
                        terapeutas
                      </div>
                    </div>
                    <div
                      style={{
                        width: 1,
                        background: "rgba(255,255,255,0.08)",
                      }}
                    />
                    <div>
                      <div
                        className="body-font"
                        style={{ fontSize: 22, fontWeight: 600, color: config.colorLight }}
                      >
                        {house.active_patients}
                      </div>
                      <div
                        className="body-font"
                        style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}
                      >
                        pacientes
                      </div>
                    </div>
                  </div>

                  <div
                    className="body-font"
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                      fontSize: 13,
                      color: "rgba(255,255,255,0.4)",
                      fontWeight: 400,
                    }}
                  >
                    Líder:{" "}
                    <span style={{ color: config.colorLight, fontWeight: 500 }}>
                      {house.leader}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── KPI Sections ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {KPI_CONFIG.map((kpi, kpiIdx) => {
            const maxVal = getMaxForKpi(kpi.key);
            const best = getBestHouse(kpi.key);

            return (
              <div
                key={kpi.key}
                className="kpi-section"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(20px)",
                  transition: `all 0.8s cubic-bezier(0.22, 1, 0.36, 1) ${0.3 + kpiIdx * 0.1}s`,
                }}
              >
                {/* KPI Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: 28,
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 20 }}>{kpi.icon}</span>
                      <h3
                        style={{
                          fontSize: 24,
                          fontWeight: 600,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {kpi.label}
                      </h3>
                    </div>
                    <div className="tooltip-container">
                      <p
                        className="body-font"
                        style={{
                          fontSize: 13,
                          color: "rgba(255,255,255,0.35)",
                          fontWeight: 300,
                        }}
                      >
                        {kpi.subtitle}
                      </p>
                      <span className="tooltip-text">{kpi.description}</span>
                    </div>
                  </div>
                </div>

                {/* KPI Bars */}
                <div className="kpi-bars-grid" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {HOUSE_ORDER.map((houseKey, hIdx) => {
                    const value = periodData.kpis[kpi.key][houseKey];
                    const config = HOUSES[houseKey];
                    const isBest = houseKey === best;

                    return (
                      <div key={houseKey}>
                        <div
                          className="body-font"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: config.color,
                                boxShadow: `0 0 8px ${config.glowColor}`,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: isBest ? config.colorLight : "rgba(255,255,255,0.6)",
                              }}
                            >
                              {houses[houseKey].name}
                            </span>
                            {isBest && (
                              <span
                                className="best-indicator"
                                style={{
                                  background: `${config.color}20`,
                                  color: config.colorLight,
                                  border: `1px solid ${config.color}40`,
                                }}
                              >
                                ★ melhor
                              </span>
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: 18,
                              fontWeight: 600,
                              color: isBest ? config.colorLight : "rgba(255,255,255,0.7)",
                              fontFamily: "'Outfit', sans-serif",
                            }}
                          >
                            {formatValue(kpi, value)}
                          </span>
                        </div>
                        <AnimatedBar
                          value={value}
                          maxValue={maxVal}
                          color={config.color}
                          gradient={config.gradient}
                          delay={hIdx * 150 + kpiIdx * 100}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <footer
          style={{
            marginTop: 64,
            paddingTop: 32,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            textAlign: "center",
            opacity: isVisible ? 1 : 0,
            transition: "opacity 1s 1.2s",
          }}
        >
          <p
            className="body-font"
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.2)",
              fontWeight: 300,
              lineHeight: 1.8,
            }}
          >
            Última atualização:{" "}
            {new Date(data.updated_at).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            <br />
            Dados extraídos do Hamilton · Associação Allos
            <br />
            <span style={{ color: "rgba(46,158,143,0.5)" }}>
              Transformando talentos em legado
            </span>
          </p>
        </footer>
      </div>
    </div>
  );
}
