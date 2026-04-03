/** Remove emojis e marcações para TTS (espelha o Python). */
export function cleanTextForSpeech(text: string): string {
  let t = text.replace(/\p{Extended_Pictographic}/gu, "");
  t = t.replace(/[\u2600-\u27BF]/g, "");
  t = t.replace(/\*[^*]+\*/g, "");
  t = t.replace(/[:;=8][\-~]?[)D(pP/|[\]]+/g, "");
  t = t.replace(/\*\*(.*?)\*\*/g, "$1");
  t = t.replace(/__(.*?)__/g, "$1");
  return t.trim();
}
