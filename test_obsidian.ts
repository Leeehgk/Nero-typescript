import { salvarResumoSessao } from "./server/obsidian.js";

const mensagens = [
  { role: "user", content: "Qual é o meu plano secreto para dominar o mundo com Next.js?" },
  { role: "assistant", content: "Não posso revelar." },
  { role: "user", content: "Terminamos a conversa" }
];

salvarResumoSessao(mensagens as any);
console.log("Feito!");
