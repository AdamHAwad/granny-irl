'use client';

import { useEffect, useRef } from 'react';

export function useSoundNotifications() {
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Initialize audio context on user interaction
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    };

    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });

    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
  }, []);

  const playBeep = (frequency: number, duration: number, volume: number = 0.3) => {
    if (!audioContextRef.current) return;

    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContextRef.current.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioContextRef.current.currentTime + duration);

    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + duration);
  };

  const playGameStart = () => {
    // Play ascending beeps for game start
    playBeep(440, 0.2); // A4
    setTimeout(() => playBeep(554, 0.2), 200); // C#5
    setTimeout(() => playBeep(659, 0.4), 400); // E5
  };

  const playGameEnd = () => {
    // Play descending beeps for game end
    playBeep(659, 0.3); // E5
    setTimeout(() => playBeep(554, 0.3), 300); // C#5
    setTimeout(() => playBeep(440, 0.6), 600); // A4
  };

  const playElimination = () => {
    // Play dramatic elimination sound
    playBeep(220, 0.5, 0.4); // A3
    setTimeout(() => playBeep(196, 0.8, 0.4), 200); // G3
  };

  const playCountdown = () => {
    // Play countdown beep
    playBeep(800, 0.1);
  };

  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  return {
    playGameStart,
    playGameEnd,
    playElimination,
    playCountdown,
    vibrate,
  };
}