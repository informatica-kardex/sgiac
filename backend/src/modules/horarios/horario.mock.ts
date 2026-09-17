import { Horario } from "./horario.types";

export let horariosMock: Horario[] = [
  { idHorario: 1, materia: "Programación I", docente: "Ing. Laura Mamani", aula: "A-101", dia: "LUNES", horaInicio: "08:00", horaFin: "09:30", grupo: "A" },
  { idHorario: 2, materia: "Base de Datos I", docente: "Ing. Carlos Quispe", aula: "B-102", dia: "LUNES", horaInicio: "10:00", horaFin: "11:30", grupo: "A" },
  { idHorario: 3, materia: "Redes de Computadoras", docente: "Ing. Ana Choque", aula: "B-101", dia: "MARTES", horaInicio: "08:00", horaFin: "09:30", grupo: "B" },
  { idHorario: 4, materia: "Estructura de Datos", docente: "Ing. Jorge Flores", aula: "A-102", dia: "MARTES", horaInicio: "10:00", horaFin: "11:30", grupo: "A" },
  { idHorario: 5, materia: "Ingenieria de Software I", docente: "Ing. Maria Condori", aula: "D-101", dia: "MIERCOLES", horaInicio: "08:00", horaFin: "09:30", grupo: "A" },
  { idHorario: 6, materia: "Sistemas Operativos", docente: "Ing. Pedro Huanca", aula: "A-201", dia: "MIERCOLES", horaInicio: "10:00", horaFin: "11:30", grupo: "B" },
  { idHorario: 7, materia: "Programación II", docente: "Ing. Laura Mamani", aula: "B-102", dia: "JUEVES", horaInicio: "08:00", horaFin: "09:30", grupo: "A" },
  { idHorario: 8, materia: "Base de Datos II", docente: "Ing. Carlos Quispe", aula: "D-102", dia: "JUEVES", horaInicio: "10:00", horaFin: "11:30", grupo: "A" },
  { idHorario: 9, materia: "Inteligencia Artificial", docente: "Ing. Maria Condori", aula: "D-101", dia: "VIERNES", horaInicio: "08:00", horaFin: "09:30", grupo: "B" },
  { idHorario: 10, materia: "Matematica Discreta", docente: "Lic. Ruth Apaza", aula: "A-101", dia: "VIERNES", horaInicio: "10:00", horaFin: "11:30", grupo: "A" },
  { idHorario: 11, materia: "Etica Profesional", docente: "Lic. Ruth Apaza", aula: "C-101", dia: "SABADO", horaInicio: "08:00", horaFin: "09:30", grupo: "A" },
  { idHorario: 12, materia: "Taller de Titulacion", docente: "Ing. Jorge Flores", aula: "C-102", dia: "SABADO", horaInicio: "10:00", horaFin: "11:30", grupo: "B" },
];

export function nextHorarioId(): number {
  return horariosMock.length > 0 ? Math.max(...horariosMock.map((h) => h.idHorario)) + 1 : 1;
}
