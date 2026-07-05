'use client';

import React, { useEffect, useRef } from 'react';

export type SecondsMode = 'smooth' | 'tick1' | 'tick2' | 'highFreq';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function GlassClock(): React.ReactElement {
  const hourMarksRef = useRef<HTMLDivElement>(null);
  const glossyOverlayRef = useRef<HTMLDivElement>(null);
  const reflectionOverlayRef = useRef<HTMLDivElement>(null);
  const hourHandRef = useRef<HTMLDivElement>(null);
  const minuteHandRef = useRef<HTMLDivElement>(null);
  const secondHandContainerRef = useRef<HTMLDivElement>(null);
  const secondHandShadowRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const requestAnimationRef = useRef<number | null>(null);
  const hourMinuteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const rootStyle = document.documentElement.style;

    const setInitialVariables = () => {
      rootStyle.setProperty('--primary-light-angle', '-45deg');
      rootStyle.setProperty('--dark-edge-angle', '135deg');
      rootStyle.setProperty('--minute-marker-opacity', '1');
      rootStyle.setProperty('--inner-shadow-opacity', '0.15');
      rootStyle.setProperty('--outer-shadow-opacity', '1');
      rootStyle.setProperty('--reflection-opacity', '0.5');
      rootStyle.setProperty('--glossy-opacity', '0.3');
      rootStyle.setProperty('--hour-number-opacity', '1');
      rootStyle.setProperty('--hour-number-color', 'rgba(50, 50, 50, 0.9)');
      rootStyle.setProperty('--minute-marker-color', 'rgba(80, 80, 80, 0.5)');
      rootStyle.setProperty('--hand-color', 'rgba(50, 50, 50, 0.9)');
      rootStyle.setProperty('--second-hand-color', 'rgba(255, 107, 0, 1)');
    };

    const createHourMarks = () => {
      const container = hourMarksRef.current;
      if (!container) return;
      container.replaceChildren();

      for (let i = 0; i < 60; i += 1) {
        if (i % 5 === 0) {
          const hourIndex = i / 5;
          const hourNumber = document.createElement('div');
          hourNumber.className = 'clock-number';
          const angle = (i * 6 * Math.PI) / 180;
          const radius = 145;
          const left = 175 + Math.sin(angle) * radius - 15;
          const top = 175 - Math.cos(angle) * radius - 10;
          hourNumber.style.left = `${left}px`;
          hourNumber.style.top = `${top}px`;
          hourNumber.textContent = hourIndex === 0 ? '12' : hourIndex.toString();
          container.appendChild(hourNumber);
        } else {
          const minuteMarker = document.createElement('div');
          minuteMarker.className = 'minute-marker';
          minuteMarker.style.transform = `rotate(${i * 6}deg)`;
          container.appendChild(minuteMarker);
        }
      }
    };

    const updateHourAndMinuteHands = () => {
      const now = new Date();
      const hours = now.getHours() % 12;
      const minutes = now.getMinutes();
      const minutesDegrees = minutes * 6;
      const hoursDegrees = hours * 30 + (minutes / 60) * 30;

      if (hourHandRef.current) hourHandRef.current.style.transform = `rotate(${hoursDegrees}deg)`;
      if (minuteHandRef.current) minuteHandRef.current.style.transform = `rotate(${minutesDegrees}deg)`;
      if (dateRef.current) {
        dateRef.current.textContent = `${MONTH_NAMES[now.getMonth()]} ${now.getDate()}`;
      }

      if (hourMinuteTimeoutRef.current) clearTimeout(hourMinuteTimeoutRef.current);
      const millisecondsUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      hourMinuteTimeoutRef.current = window.setTimeout(updateHourAndMinuteHands, Math.max(millisecondsUntilNextMinute, 0));
    };

    const applySecondHandRotation = (angle: number) => {
      if (secondHandContainerRef.current) {
        secondHandContainerRef.current.style.transition = 'none';
        secondHandContainerRef.current.style.transform = `rotate(${angle}deg)`;
      }
      if (secondHandShadowRef.current) {
        secondHandShadowRef.current.style.transition = 'none';
        secondHandShadowRef.current.style.transform = `rotate(${angle + 0.5}deg)`;
      }
    };

    const startSmoothSecondHand = () => {
      if (requestAnimationRef.current !== null) cancelAnimationFrame(requestAnimationRef.current);
      const animate = () => {
        const now = new Date();
        const seconds = now.getSeconds();
        const milliseconds = now.getMilliseconds();
        const angle = seconds * 6 + (milliseconds / 1000) * 6;
        applySecondHandRotation(angle);
        requestAnimationRef.current = requestAnimationFrame(animate);
      };
      animate();
    };

    const initializeOverlays = () => {
      if (glossyOverlayRef.current) {
        glossyOverlayRef.current.style.background = `linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 15%, rgba(255,255,255,0.5) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.2) 75%, rgba(255,255,255,0.1) 100%)`;
        glossyOverlayRef.current.style.filter = 'blur(10px)';
      }
      if (reflectionOverlayRef.current) {
        reflectionOverlayRef.current.style.transform = 'rotate(-15deg)';
        reflectionOverlayRef.current.style.filter = 'blur(10px)';
      }
    };

    setInitialVariables();
    createHourMarks();
    initializeOverlays();
    updateHourAndMinuteHands();
    startSmoothSecondHand();

    return () => {
      if (requestAnimationRef.current !== null) cancelAnimationFrame(requestAnimationRef.current);
      if (hourMinuteTimeoutRef.current) clearTimeout(hourMinuteTimeoutRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="glass-clock-container" style={{ position: 'relative', width: '350px', height: '350px' }}>
        <div className="glass-effect-wrapper" style={{ position: 'relative', width: '350px', height: '350px' }}>
          <div
            className="glass-effect-shadow"
            style={{ opacity: 'var(--outer-shadow-opacity, 1)' }}
          />
          <div className="glass-clock-face">
            <div className="glass-glossy-overlay" ref={glossyOverlayRef} />
            <div className="glass-edge-highlight" />
            <div className="glass-edge-highlight-outer" />
            <div className="glass-edge-shadow" />
            <div className="glass-dark-edge" />
            <div className="glass-reflection" />
            <div className="glass-reflection-overlay" ref={reflectionOverlayRef} />
            <div className="clock-hour-marks" ref={hourMarksRef} />
            <div className="hour-hand clock-hand" ref={hourHandRef} />
            <div className="minute-hand clock-hand" ref={minuteHandRef} />
            <div className="second-hand-container" ref={secondHandContainerRef}>
              <div className="second-hand" />
              <div className="second-hand-counterweight" />
            </div>
            <div className="second-hand-shadow" ref={secondHandShadowRef} />
            <div className="clock-center-dot" />
            <div className="clock-center-blur" />
            <div className="clock-date" ref={dateRef} />
          </div>
        </div>
      </div>

      <style jsx>{`
        .glass-clock-container {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .glass-effect-shadow {
          position: absolute;
          inset: -20px;
          border-radius: 50%;
          box-shadow: 0 30px 60px rgba(0,0,0,0.3), 0 10px 20px rgba(0,0,0,0.2);
        }
        .glass-clock-face {
          position: absolute;
          width: 350px;
          height: 350px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.2);
          overflow: hidden;
        }
        .glass-glossy-overlay {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          z-index: 5;
          pointer-events: none;
        }
        .glass-edge-highlight {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.3);
          z-index: 6;
          pointer-events: none;
        }
        .glass-edge-highlight-outer {
          position: absolute;
          inset: -1px;
          border-radius: 50%;
          border: 1px solid rgba(0,0,0,0.1);
          z-index: 6;
          pointer-events: none;
        }
        .glass-edge-shadow {
          position: absolute;
          inset: 2px;
          border-radius: 50%;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.15);
          z-index: 5;
          pointer-events: none;
        }
        .glass-dark-edge {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          box-shadow: inset 0 -2px 4px rgba(0,0,0,0.1);
          z-index: 5;
          pointer-events: none;
        }
        .glass-reflection {
          position: absolute;
          top: -30%;
          left: -20%;
          width: 80%;
          height: 60%;
          background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 60%);
          border-radius: 50%;
          z-index: 7;
          pointer-events: none;
          opacity: var(--reflection-opacity, 0.5);
        }
        .glass-reflection-overlay {
          position: absolute;
          top: -20%;
          left: -10%;
          width: 60%;
          height: 40%;
          background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%);
          border-radius: 50%;
          z-index: 8;
          pointer-events: none;
        }
        .clock-hour-marks {
          position: absolute;
          inset: 0;
          z-index: 10;
        }
        .clock-number {
          position: absolute;
          width: 30px;
          height: 20px;
          text-align: center;
          font-size: 14px;
          font-weight: 600;
          color: var(--hour-number-color, rgba(50,50,50,0.9));
          opacity: var(--hour-number-opacity, 1);
        }
        .minute-marker {
          position: absolute;
          top: 12px;
          left: 50%;
          width: 1px;
          height: 6px;
          margin-left: -0.5px;
          background: var(--minute-marker-color, rgba(80,80,80,0.5));
          transform-origin: 0.5px 163px;
          opacity: var(--minute-marker-opacity, 1);
        }
        .clock-hand {
          position: absolute;
          bottom: 50%;
          left: 50%;
          transform-origin: bottom center;
          z-index: 15;
          border-radius: 4px;
        }
        .hour-hand {
          width: 4px;
          height: 80px;
          margin-left: -2px;
          background: var(--hand-color, rgba(50,50,50,0.9));
          border-radius: 2px;
        }
        .minute-hand {
          width: 3px;
          height: 110px;
          margin-left: -1.5px;
          background: var(--hand-color, rgba(50,50,50,0.9));
          border-radius: 1.5px;
        }
        .second-hand-container {
          position: absolute;
          bottom: 50%;
          left: 50%;
          width: 2px;
          height: 130px;
          margin-left: -1px;
          transform-origin: bottom center;
          z-index: 16;
        }
        .second-hand {
          width: 2px;
          height: 130px;
          background: var(--second-hand-color, rgba(255,107,0,1));
          border-radius: 1px;
        }
        .second-hand-counterweight {
          position: absolute;
          bottom: -30px;
          left: 50%;
          width: 6px;
          height: 30px;
          margin-left: -3px;
          background: var(--second-hand-color, rgba(255,107,0,1));
          border-radius: 3px;
        }
        .second-hand-shadow {
          position: absolute;
          bottom: 50%;
          left: 50%;
          width: 2px;
          height: 130px;
          margin-left: -0.5px;
          transform-origin: bottom center;
          z-index: 14;
          background: rgba(0,0,0,0.1);
          border-radius: 1px;
        }
        .clock-center-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 10px;
          height: 10px;
          margin: -5px 0 0 -5px;
          border-radius: 50%;
          background: var(--second-hand-color, rgba(255,107,0,1));
          z-index: 20;
        }
        .clock-center-blur {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 20px;
          height: 20px;
          margin: -10px 0 0 -10px;
          border-radius: 50%;
          background: rgba(255,107,0,0.2);
          filter: blur(4px);
          z-index: 19;
        }
        .clock-date {
          position: absolute;
          top: 62%;
          left: 50%;
          transform: translateX(-50%);
          font-size: 12px;
          font-weight: 500;
          color: rgba(50,50,50,0.7);
          z-index: 10;
        }
      `}</style>
    </div>
  );
}

export default GlassClock;
