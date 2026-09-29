import { Comunicado } from "./comunicado.types";

export let comunicadosMock: Comunicado[] = [
  {
    idComunicado: 1,
    titulo: "Inicio del semestre académico 2026-II",
    resumen: "Cronograma oficial de inicio de clases y matriculación.",
    contenido:
      "Se comunica a todos los estudiantes de la Carrera de Informática que el semestre 2026-II inicia el 1 de septiembre. La matriculación en línea estará habilitada desde el 20 de agosto en la plataforma institucional.",
    categoria: "Académico",
    fechaPublicacion: "2026-08-15T09:00:00.000Z",
    estado: "publicado",
    adjuntos: [{ nombre: "cronograma_2026-II.pdf", url: "#" }],
  },
  {
    idComunicado: 2,
    titulo: "Mantenimiento de laboratorios de la Carrera",
    resumen: "Los laboratorios B-101 y B-102 estarán cerrados por mantenimiento.",
    contenido:
      "Del 10 al 12 de septiembre los laboratorios de Redes y Software permanecerán cerrados por mantenimiento preventivo de equipos. Las clases se reprogramarán en aulas alternativas.",
    categoria: "Infraestructura",
    fechaPublicacion: "2026-09-05T14:30:00.000Z",
    estado: "publicado",
    adjuntos: [],
  },
  {
    idComunicado: 3,
    titulo: "Convocatoria a feria de proyectos de titulación",
    resumen: "Presenta tu proyecto de grado en la feria anual de la carrera.",
    contenido:
      "Se invita a los estudiantes del último semestre a inscribir sus proyectos de titulación para la feria anual, a realizarse en el Auditorio Kardex el próximo mes.",
    categoria: "Eventos",
    fechaPublicacion: "2026-09-01T10:00:00.000Z",
    estado: "publicado",
    adjuntos: [{ nombre: "bases_feria_2026.pdf", url: "#" }],
  },
  {
    idComunicado: 4,
    titulo: "Actualización del reglamento de kardex académico",
    resumen: "Cambios en el proceso de solicitud de kardex y certificados.",
    contenido:
      "A partir de este semestre, las solicitudes de kardex académico y certificados de notas se realizarán exclusivamente de forma virtual a través de la ficha de atención en línea.",
    categoria: "Administrativo",
    fechaPublicacion: "2026-08-20T08:00:00.000Z",
    estado: "publicado",
    adjuntos: [],
  },
  {
    idComunicado: 5,
    titulo: "Borrador: nuevo horario de atención (en revisión)",
    resumen: "Propuesta de horario extendido de atención Kardex.",
    contenido:
      "Se está evaluando extender el horario de atención de Kardex de lunes a sábado. Este comunicado se publicará oficialmente una vez aprobado por dirección de carrera.",
    categoria: "Administrativo",
    fechaPublicacion: "2026-09-08T12:00:00.000Z",
    estado: "borrador",
    adjuntos: [],
  },
];

export function nextComunicadoId(): number {
  return comunicadosMock.length > 0
    ? Math.max(...comunicadosMock.map((c) => Number(c.idComunicado))) + 1
    : 1;
}
