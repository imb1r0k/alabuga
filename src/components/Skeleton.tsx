import React, { useMemo } from 'react';

type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: boolean | string;
  variant?: 'default' | 'circle' | 'text' | 'avatar';
  animated?: boolean;
  count?: number;
  gap?: string | number;
  children?: React.ReactNode;
};

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  rounded = false,
  variant = 'default',
  animated = true,
  count = 1,
  gap = '0.5rem',
  children,
}) => {
  const variantStyles = useMemo(() => {
    switch (variant) {
      case 'circle':
        return {
          width: typeof width === 'number' ? `${width}px` : width || '3rem',
          height: typeof height === 'number' ? `${height}px` : height || '3rem',
          borderRadius: '50%',
        };
      case 'avatar':
        return {
          width: typeof width === 'number' ? `${width}px` : width || '2.5rem',
          height: typeof height === 'number' ? `${height}px` : height || '2.5rem',
          borderRadius: '50%',
          flexShrink: 0,
        };
      case 'text':
        return {
          width: typeof width === 'number' ? `${width}px` : width || '100%',
          height: typeof height === 'number' ? `${height}px` : height || '0.75rem',
          borderRadius: '4px',
        };
      default:
        return {
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          borderRadius: rounded ? (typeof rounded === 'string' ? rounded : '8px') : '0',
        };
    }
  }, [variant, width, height, rounded]);

  const baseStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    ...variantStyles,
  };

  const shimmerStyle: React.CSSProperties = animated
    ? {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
      }
    : {};

  if (count === 1) {
    return (
      <div className={className} style={baseStyle}>
        {animated && <div className="animate-shimmer" style={shimmerStyle} />}
        {children}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: typeof gap === 'number' ? `${gap}px` : gap }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={className} style={baseStyle}>
          {animated && <div className="animate-shimmer" style={shimmerStyle} />}
          {children}
        </div>
      ))}
    </div>
  );
};

export const SkeletonCard: React.FC<{ count?: number; className?: string }> = ({
  count = 1,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #f1f5f9', display: 'flex', gap: '16px' }}>
          <Skeleton variant="avatar" width="3rem" height="3rem" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Skeleton width="60%" height="1.25rem" />
            <Skeleton width="40%" height="0.75rem" />
            <Skeleton width="80%" height="0.75rem" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonText: React.FC<{
  lines?: number;
  lastLineWidth?: string;
}> = ({ lines = 3, lastLineWidth = '60%' }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? lastLineWidth : '100%'}
          height="0.75rem"
          variant="text"
        />
      ))}
    </div>
  );
};

export default Skeleton;