import { saveAudio } from "../idb.js";
import { uid } from "../utils.js";

export function createRecorder({ onStop, onError }) {
  let mediaRecorder = null;
  let chunks = [];
  let stream = null;
  let startedAt = 0;

  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/mp4";
    mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: mime });
      const durationSec = Math.round((Date.now() - startedAt) / 1000);
      const key = `audio_${uid()}`;
      await saveAudio(key, blob);
      stream.getTracks().forEach((t) => t.stop());
      onStop?.({ id: key, localAudioKey: key, durationSec, createdAt: new Date().toISOString() });
    };
    mediaRecorder.onerror = (e) => onError?.(e.error || e);
    startedAt = Date.now();
    mediaRecorder.start();
  }

  function stop() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }

  function isRecording() {
    return mediaRecorder && mediaRecorder.state === "recording";
  }

  return { start, stop, isRecording };
}
