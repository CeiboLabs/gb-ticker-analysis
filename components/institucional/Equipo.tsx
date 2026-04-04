// TODO: Replace placeholder team data with real team members
const TEAM = [
  {
    name: "Gastón Bengochea",
    role: "Director General",
    initials: "GB",
    color: "from-[#C9A84C] to-[#d4b65e]",
  },
  {
    name: "Martín Rodríguez",
    role: "Director de Inversiones",
    initials: "MR",
    color: "from-blue-500 to-blue-600",
  },
  {
    name: "Carolina Pérez",
    role: "Gerente de Operaciones",
    initials: "CP",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    name: "Lucía Fernández",
    role: "Asesora Financiera",
    initials: "LF",
    color: "from-violet-500 to-violet-600",
  },
];

export function Equipo() {
  return (
    <section className="bg-[#03065E] py-20 sm:py-28 px-6 relative overflow-hidden">
      {/* Gradient orbs */}
      <div
        className="absolute top-[-10%] left-[20%] w-[400px] h-[400px] rounded-full animate-float-slow pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute bottom-[-10%] right-[10%] w-[300px] h-[300px] rounded-full animate-pulse-glow pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="max-w-5xl mx-auto relative">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/35 text-center mb-3">
          Nuestro Equipo
        </h2>
        <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-center mb-4">
          Profesionales que impulsan tu <span className="gradient-text">inversión</span>
        </p>
        <p className="text-sm text-white/45 text-center max-w-xl mx-auto mb-14 leading-relaxed">
          Un equipo comprometido con la excelencia y el crecimiento de tu
          patrimonio.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TEAM.map((member, i) => (
            <div
              key={member.name}
              className="group glass rounded-2xl p-7 text-center hover:bg-white/[0.08] transition-all duration-500 gradient-border cursor-default"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              {/* Avatar with gradient */}
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${member.color} text-white font-bold text-xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                {member.initials}
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">
                {member.name}
              </h3>
              <p className="text-xs text-white/40">{member.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
