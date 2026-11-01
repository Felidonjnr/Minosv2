export interface TTSController {
  state: 'idle' | 'loading' | 'playing' | 'paused';
  play: (text: string, gcpKey?: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export function createTTSPlayer(onStateChange: (state: 'idle' | 'loading' | 'playing' | 'paused') => void): TTSController {
  let audio: HTMLAudioElement | null = null;
  let synthUtterance: SpeechSynthesisUtterance | null = null;
  let isWebSpeech = false;
  let currentState: 'idle' | 'loading' | 'playing' | 'paused' = 'idle';

  function setState(next: 'idle' | 'loading' | 'playing' | 'paused') {
    currentState = next;
    onStateChange(next);
  }

  function cleanText(text: string): string {
    return text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*{1,3}/g, '')
      .replace(/__/g, '')
      .replace(/_/g, '')
      .replace(/\|/g, ' ')
      .replace(/\[.*?\]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  return {
    get state() {
      return currentState;
    },

    async play(rawText: string, gcpKey?: string) {
      this.stop();
      const text = cleanText(rawText);
      if (!text) return;

      if (gcpKey && gcpKey.trim().length > 15) {
        setState('loading');
        try {
          const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${gcpKey.trim()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: { text: text.slice(0, 4800) },
              voice: { languageCode: 'en-US', name: 'en-US-Neural2-D' },
              audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95 }
            })
          });
          const data = await res.json();
          if (data.audioContent) {
            audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
            audio.onended = () => {
              setState('idle');
            };
            audio.onerror = () => {
              setState('idle');
            };
            setState('playing');
            await audio.play();
            return;
          }
        } catch {
          // fallback to Web Speech
        }
      }

      // Browser Web Speech API fallback
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        synthUtterance = new SpeechSynthesisUtterance(text);
        synthUtterance.rate = 0.95;
        synthUtterance.pitch = 1.0;
        
        synthUtterance.onend = () => {
          setState('idle');
        };
        synthUtterance.onerror = () => {
          setState('idle');
        };

        isWebSpeech = true;
        setState('playing');
        window.speechSynthesis.speak(synthUtterance);
      } else {
        setState('idle');
      }
    },

    pause() {
      if (audio && !audio.paused) {
        audio.pause();
        setState('paused');
      } else if (isWebSpeech && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.pause();
        setState('paused');
      }
    },

    resume() {
      if (audio && audio.paused) {
        audio.play();
        setState('playing');
      } else if (isWebSpeech && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.resume();
        setState('playing');
      }
    },

    stop() {
      if (audio) {
        audio.pause();
        audio = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        synthUtterance = null;
      }
      isWebSpeech = false;
      setState('idle');
    }
  };
}
