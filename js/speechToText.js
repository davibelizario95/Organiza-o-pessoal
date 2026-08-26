import { toast } from "./components/toast.js";

// Reconhecimento de voz (Web Speech API) pra ditar o comando rápido em vez
// de digitar — sem servidor, roda direto no navegador. Some silenciosamente
// (botão escondido) em navegadores sem suporte, em vez de quebrar.
const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

export function isSpeechRecognitionSupported() {
  return !!SpeechRecognitionImpl;
}

// Liga um botão de microfone a um campo de texto: clique começa a ouvir,
// clique de novo (ou o reconhecimento terminar sozinho) para. O texto
// reconhecido substitui o campo — quem confirma o envio é o usuário, não a
// transcrição, já que reconhecimento de voz erra.
export function attachVoiceButton(input, micBtn) {
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
      input.value = transcript;
      input.focus();
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
