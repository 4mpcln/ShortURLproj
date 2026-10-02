import type { CSSProperties, ReactNode } from 'react';

type AnimatedGradientProps = {
  children?: ReactNode;
  variant?: 'mist';
  speed?: number;
  opacity?: number;
  className?: string;
};

export function AnimatedGradient({
  children,
  variant = 'mist',
  speed = 0.3,
  opacity = 0.8,
  className = '',
}: AnimatedGradientProps) {
  const isAnimated = Number.isFinite(speed) && speed > 0;
  const style: CSSProperties = {
    animationDuration: `${12 / (isAnimated ? speed : 1)}s`,
    animationPlayState: isAnimated ? 'running' : 'paused',
    opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 0.8,
  };

  return (
    <div className={`animated-gradient ${className}`}>
      <div
        aria-hidden="true"
        className={`animated-gradient__mist animated-gradient__mist--${variant}`}
        style={style}
      />
      {children}
    </div>
  );
}
