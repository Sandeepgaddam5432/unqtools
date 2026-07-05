'use client';

import React, { useState, useRef, useEffect } from 'react';

interface DockApp {
  id: string;
  name: string;
  icon: string;
}

interface MacOSDockProps {
  apps: DockApp[];
  onAppClick: (appId: string) => void;
  openApps?: string[];
  className?: string;
}

const MacOSDock: React.FC<MacOSDockProps> = ({ 
  apps, 
  onAppClick, 
  openApps = [],
  className = ''
}) => {
  const [renderState, setRenderState] = useState<{ scales: number[]; positions: number[] }>({
    scales: apps.map(() => 1),
    positions: []
  });
  const dockRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastMouseMoveTime = useRef<number>(0);
  const mouseXRef = useRef<number | null>(null);

  const baseIconSize = 56;
  const maxScale = 1.6;
  const effectWidth = 240;
  const minScale = 1.0;
  const baseSpacing = 6;

  // Animation loop
  useEffect(() => {
    let running = true;

    const getTargetScales = (mousePos: number | null): number[] => {
      if (mousePos === null) return apps.map(() => minScale);
      return apps.map((_, index) => {
        const center = (index * (baseIconSize + baseSpacing)) + (baseIconSize / 2);
        const minX = mousePos - (effectWidth / 2);
        const maxX = mousePos + (effectWidth / 2);
        if (center < minX || center > maxX) return minScale;
        const theta = ((center - minX) / effectWidth) * 2 * Math.PI;
        const capped = Math.min(Math.max(theta, 0), 2 * Math.PI);
        const factor = (1 - Math.cos(capped)) / 2;
        return minScale + (factor * (maxScale - minScale));
      });
    };

    const getPositions = (scales: number[]): number[] => {
      let x = 0;
      return scales.map((s) => {
        const w = baseIconSize * s;
        const cx = x + w / 2;
        x += w + baseSpacing;
        return cx;
      });
    };

    const animate = () => {
      if (!running) return;
      
      const targetScales = getTargetScales(mouseXRef.current);
      const targetPositions = getPositions(targetScales);
      const lerp = mouseXRef.current !== null ? 0.2 : 0.12;

      setRenderState(prev => {
        const newScales = prev.scales.map((s, i) => s + (targetScales[i] - s) * lerp);
        const newPositions = prev.positions.length === targetPositions.length
          ? prev.positions.map((p, i) => p + (targetPositions[i] - p) * lerp)
          : targetPositions;

        const needsMore = newScales.some((s, i) => Math.abs(s - targetScales[i]) > 0.002) || mouseXRef.current !== null;
        if (needsMore) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
        return { scales: newScales, positions: newPositions };
      });
    };

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [apps]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const now = performance.now();
    if (now - lastMouseMoveTime.current < 16) return;
    lastMouseMoveTime.current = now;
    if (dockRef.current) {
      const rect = dockRef.current.getBoundingClientRect();
      mouseXRef.current = e.clientX - rect.left - 8;
    }
  };

  const handleMouseLeave = () => { mouseXRef.current = null; };

  const handleAppClick = (appId: string, index: number) => {
    if (iconRefs.current[index]) {
      const element = iconRefs.current[index]!;
      element.style.transition = 'transform 0.2s ease-out';
      element.style.transform = `translateY(-8px)`;
      setTimeout(() => { element.style.transform = 'translateY(0px)'; }, 200);
    }
    onAppClick(appId);
  };

  const { scales, positions } = renderState;
  const contentWidth = positions.length > 0 
    ? Math.max(...positions.map((pos, index) => pos + (baseIconSize * scales[index]) / 2))
    : (apps.length * (baseIconSize + baseSpacing)) - baseSpacing;

  return (
    <div 
      ref={dockRef}
      className={`backdrop-blur-md ${className}`}
      style={{
        width: `${contentWidth + 16}px`,
        background: 'rgba(45, 45, 45, 0.75)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.2)',
        padding: '8px'
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative" style={{ height: `${baseIconSize}px`, width: '100%' }}>
        {apps.map((app, index) => {
          const scale = scales[index];
          const position = positions[index] || 0;
          const scaledSize = baseIconSize * scale;
          
          return (
            <div
              key={app.id}
              ref={(el) => { iconRefs.current[index] = el; }}
              className="absolute cursor-pointer flex flex-col items-center justify-end"
              title={app.name}
              onClick={() => handleAppClick(app.id, index)}
              style={{
                left: `${position - scaledSize / 2}px`,
                bottom: '0px',
                width: `${scaledSize}px`,
                height: `${scaledSize}px`,
                transformOrigin: 'bottom center',
                zIndex: Math.round(scale * 10)
              }}
            >
              <img
                src={app.icon}
                alt={app.name}
                width={scaledSize}
                height={scaledSize}
                className="object-contain rounded-xl"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
              />
              {openApps.includes(app.id) && (
                <div 
                  className="absolute"
                  style={{
                    bottom: '-4px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    boxShadow: '0 0 4px rgba(0, 0, 0, 0.3)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MacOSDock;
