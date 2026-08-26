import { toast } from "./components/toast.js";
import { FRENTES } from "./frentes.js";

// Reconhecimento de voz (Web Speech API) pra ditar o comando rápido em vez
// de digitar — sem servidor, roda direto no navegador. Some silenciosamente
// (botão escondido) em navegadores sem suporte, em vez de quebrar.
const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

export function isSpeechRecognitionSupported() {
  return !!SpeechRecognitionImpl;
}

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Falando não tem vírgula ("Trabalho gravar guitarra 15h"), então o comando
// rápido não acha onde termina a frente sem os dois-pontos. Se a fala
// começa com o nome de uma frente, insere ": " logo depois — "Trabalho:
// gravar guitarra 15h" — que é o formato que o parser já reconhece mesmo
// sem vírgula nenhuma.
function withFrenteColon(text) {
  const words = text.trim().split(/\s+/);
  if (!words.length) return text;
  const first = normalize(words[0]);
  const frente = FRENTES.find((f) => normalize(f.label) === first || normalize(f.key) === first);
  if (!frente) return text;
  const rest = words.slice(1).join(" ");
  return rest ? `${frente.label}: ${rest}` : `${frente.label}: `;
}

// Liga um botão de microfone a um campo de texto: clique começa a ouvir,
// clique de novo (ou o reconhecimento terminar sozinho) para. Assim que
// reconhece a fala, já preenche o campo e envia sozinho — `onDone` é quem
// dispara o envio (ex.: form.requestSubmit()), reaproveitando a mesma
// validação/erro que o envio manual já tem.
export function attachVoiceButton(input, micBtn, onDone) {
  if (!isSpeechRecognitionSupported()) {
    micBtn.style.display = "none";
    return;
  }

  const recognition = new SpeechRecognitionImpl();
  recognition.lang = "pt-BR";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let listening = false;

  function setListening(v) {
    listening = v;
    micBtn.classList.toggle("listening", v);
  }

  recognition.onresult = (e) => {
    const transcript = Array.from(e.results)
      .map((r) => r[0].transcript)
      .join(" ")
      .trim();
    if (transcript) {
      input.value = withFrenteColon(transcript);
      onDone?.();
    }
  };
  recognition.onerror = (e) => {
    if (e.error !== "aborted" && e.error !== "no-speech") {
      toast("Não foi possível reconhecer a voz.", "danger");
    }
  };
  recognition.onend = () => setListening(false);

  micBtn.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
      setListening(true);
    } catch {
      // já tinha uma sessão em andamento — ignora, o onend anterior resolve
    }
  });
}
