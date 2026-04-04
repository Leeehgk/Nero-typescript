import { cleanTextForSpeech } from "./textClean.js";
/** Carrega sob demanda — o pacote é pesado e atrasava o `listen()` no arranque. */
async function getCommunicate() {
    const mod = await import("edge-tts-universal");
    return mod.Communicate;
}
/**
 * Voz pt-BR Antonio (igual ao projeto Python edge-tts).
 * Nomes aceites pela API Edge — tentamos em ordem se um falhar.
 */
const envV = process.env.EDGE_TTS_VOICE?.trim();
const FALLBACK_VOICES = Array.from(new Set([
    envV,
    "pt-BR-AntonioNeural",
    "pt-BR-FranciscaNeural",
    "pt-PT-DuarteNeural",
    "pt-PT-RaquelNeural",
].filter((voice) => Boolean(voice?.trim()))));
export async function synthesizeEdgeMp3(text) {
    const cleaned = cleanTextForSpeech(text);
    if (!cleaned)
        return Buffer.alloc(0);
    const errors = [];
    const Communicate = await getCommunicate();
    for (const voice of FALLBACK_VOICES) {
        try {
            const comm = new Communicate(cleaned, {
                voice,
                rate: "+5%",
                pitch: "+0Hz",
                volume: "+0%",
            });
            const chunks = [];
            for await (const chunk of comm.stream()) {
                if (chunk.type === "audio" && chunk.data?.length) {
                    chunks.push(chunk.data);
                }
            }
            if (chunks.length) {
                return Buffer.concat(chunks);
            }
            errors.push(`${voice}: sem áudio`);
        }
        catch (e) {
            errors.push(`${voice}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    throw new Error(`Edge TTS falhou: ${errors.join(" | ")}`);
}
