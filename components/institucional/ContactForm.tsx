"use client";

export function ContactForm() {
  return (
    <div className="glass-light rounded-2xl p-6 sm:p-8 gradient-border">
      <h2 className="text-xl font-bold text-[#03065E] mb-2">
        Envianos un Mensaje
      </h2>
      <p className="text-sm text-[#03065E]/50 mb-6">
        Completá el formulario y nos pondremos en contacto a la brevedad.
      </p>

      <form
        className="space-y-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-[#03065E]/60 mb-1.5 block">
              Nombre
            </label>
            <input
              type="text"
              placeholder="Tu nombre"
              className="w-full border border-[#03065E]/10 rounded-xl px-4 py-3 text-sm text-[#03065E] placeholder:text-[#03065E]/25 focus:outline-none focus:border-[#C9A84C] focus:shadow-[0_0_0_3px_rgba(201,168,76,0.1)] transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#03065E]/60 mb-1.5 block">
              Apellido
            </label>
            <input
              type="text"
              placeholder="Tu apellido"
              className="w-full border border-[#03065E]/10 rounded-xl px-4 py-3 text-sm text-[#03065E] placeholder:text-[#03065E]/25 focus:outline-none focus:border-[#C9A84C] focus:shadow-[0_0_0_3px_rgba(201,168,76,0.1)] transition-all"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-[#03065E]/60 mb-1.5 block">
            Email
          </label>
          <input
            type="email"
            placeholder="tu@email.com"
            className="w-full border border-[#03065E]/10 rounded-xl px-4 py-3 text-sm text-[#03065E] placeholder:text-[#03065E]/25 focus:outline-none focus:border-[#C9A84C] focus:shadow-[0_0_0_3px_rgba(201,168,76,0.1)] transition-all"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-[#03065E]/60 mb-1.5 block">
            Teléfono
          </label>
          <input
            type="tel"
            placeholder="+598 99 123 456"
            className="w-full border border-[#03065E]/10 rounded-xl px-4 py-3 text-sm text-[#03065E] placeholder:text-[#03065E]/25 focus:outline-none focus:border-[#C9A84C] focus:shadow-[0_0_0_3px_rgba(201,168,76,0.1)] transition-all"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-[#03065E]/60 mb-1.5 block">
            ¿En qué podemos ayudarte?
          </label>
          <select className="w-full border border-[#03065E]/10 rounded-xl px-4 py-3 text-sm text-[#03065E] focus:outline-none focus:border-[#C9A84C] focus:shadow-[0_0_0_3px_rgba(201,168,76,0.1)] transition-all bg-white">
            <option value="">Seleccioná una opción</option>
            <option value="cuenta">Abrir una cuenta</option>
            <option value="asesoria">Asesoramiento financiero</option>
            <option value="productos">Información de productos</option>
            <option value="otro">Otra consulta</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-[#03065E]/60 mb-1.5 block">
            Mensaje
          </label>
          <textarea
            placeholder="Contanos sobre tu consulta..."
            rows={4}
            className="w-full border border-[#03065E]/10 rounded-xl px-4 py-3 text-sm text-[#03065E] placeholder:text-[#03065E]/25 focus:outline-none focus:border-[#C9A84C] focus:shadow-[0_0_0_3px_rgba(201,168,76,0.1)] transition-all resize-none"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-[#C9A84C] to-[#d4b65e] text-[#03065E] font-semibold py-3.5 rounded-xl text-sm hover:shadow-[0_0_30px_rgba(201,168,76,0.3)] transition-all duration-300"
        >
          Enviar Mensaje
        </button>
      </form>
    </div>
  );
}
