export interface Faq {
  idFaq: number;
  pregunta: string;
  respuesta: string;
  categoria: string;
  estado: "publicada" | "borrador";
}
