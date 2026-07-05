"use client";

import React from "react";

function CubeLoader() {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="cube-loader">
        <div className="cube">
          <div className="cube-face front"></div>
          <div className="cube-face back"></div>
          <div className="cube-face right"></div>
          <div className="cube-face left"></div>
          <div className="cube-face top"></div>
          <div className="cube-face bottom"></div>
        </div>
      </div>
      <p className="mt-6 text-muted-foreground text-sm">Loading...</p>

      <style jsx>{`
        .cube-loader {
          perspective: 800px;
          width: 80px;
          height: 80px;
        }
        .cube {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          animation: cube-spin 2.5s infinite ease-in-out;
        }
        .cube-face {
          position: absolute;
          width: 80px;
          height: 80px;
          border: 2px solid var(--primary, #c96442);
          background: transparent;
          opacity: 0.7;
          border-radius: 4px;
        }
        .front  { transform: translateZ(40px); }
        .back   { transform: rotateY(180deg) translateZ(40px); }
        .right  { transform: rotateY(90deg) translateZ(40px); }
        .left   { transform: rotateY(-90deg) translateZ(40px); }
        .top    { transform: rotateX(90deg) translateZ(40px); }
        .bottom { transform: rotateX(-90deg) translateZ(40px); }

        @keyframes cube-spin {
          0%   { transform: rotateX(0deg) rotateY(0deg); }
          25%  { transform: rotateX(90deg) rotateY(90deg); }
          50%  { transform: rotateX(180deg) rotateY(180deg); }
          75%  { transform: rotateX(270deg) rotateY(270deg); }
          100% { transform: rotateX(360deg) rotateY(360deg); }
        }
      `}</style>
    </div>
  );
}

export { CubeLoader };
