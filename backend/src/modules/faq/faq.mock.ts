import { Faq } from "./faq.types";

export let faqMock: Faq[] = [
  { idFaq: 1, categoria: "Matriculación", pregunta: "¿Cómo me matriculo en el nuevo semestre?", respuesta: "Ingresa a la plataforma institucional con tu usuario y sigue el asistente de matriculación en línea disponible desde la fecha publicada en el cronograma académico.", estado: "publicada" },
  { idFaq: 2, categoria: "Matriculación", pregunta: "¿Puedo matricularme fuera de fecha?", respuesta: "Sí, mediante una solicitud de matrícula extraordinaria presentada en la ficha de atención Kardex, sujeta a aprobación de dirección de carrera.", estado: "publicada" },
  { idFaq: 3, categoria: "Kardex", pregunta: "¿Cómo solicito mi kardex académico?", respuesta: "Debes llenar la ficha de atención en línea desde la sección 'Atención Kardex' del portal, indicando el motivo de tu solicitud.", estado: "publicada" },
  { idFaq: 4, categoria: "Kardex", pregunta: "¿Cuánto demora la entrega del kardex?", respuesta: "El tiempo estimado de entrega es de 3 a 5 días hábiles desde la recepción de la solicitud.", estado: "publicada" },
  { idFaq: 5, categoria: "Horarios", pregunta: "¿Dónde veo los horarios de mis materias?", respuesta: "En la sección 'Horarios' del portal público puedes consultar el calendario semanal con materia, docente, aula y horario.", estado: "publicada" },
  { idFaq: 6, categoria: "Horarios", pregunta: "¿Los horarios pueden cambiar durante el semestre?", respuesta: "Sí, ante eventos como mantenimiento de aulas. Cualquier cambio se publica como comunicado oficial.", estado: "publicada" },
  { idFaq: 7, categoria: "Comunicados", pregunta: "¿Cómo me entero de comunicados importantes?", respuesta: "Todos los comunicados oficiales se publican en la sección 'Comunicados' del portal público, ordenados por fecha.", estado: "publicada" },
  { idFaq: 8, categoria: "Cuenta", pregunta: "¿Olvidé mi contraseña, qué hago?", respuesta: "Usa la opción '¿Olvidaste tu contraseña?' en la pantalla de inicio de sesión para recibir un código de recuperación.", estado: "publicada" },
  { idFaq: 9, categoria: "Cuenta", pregunta: "¿Cómo verifico mi correo institucional?", respuesta: "Tras registrarte recibirás un código de 6 dígitos; ingrésalo en la pantalla de verificación de correo para activar tu cuenta.", estado: "publicada" },
  { idFaq: 10, categoria: "Atención", pregunta: "¿Cuál es el horario de atención de Kardex?", respuesta: "La atención presencial es de lunes a viernes de 8:00 a 16:00, y las solicitudes en línea se reciben las 24 horas.", estado: "publicada" },
];

export function nextFaqId(): number {
  return faqMock.length > 0 ? Math.max(...faqMock.map((f) => f.idFaq)) + 1 : 1;
}
