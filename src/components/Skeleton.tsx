import React, { useMemo } from 'react';
import { cn } from '../lib/utils';

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
  // Определяем стили в зависимости от варианта
  const variantStyles = useMemo(() => {
    switch (variant) {
      case 'circle':
        return {
          width: typeof width === 'number' ? width : '3rem',
          height: typeof height === 'number' ? height : '3rem',
          borderRadius: '50%',
        };
      case 'avatar':
        return {
          width: typeof width === 'number' ? width : '2.5rem',
          height: typeof height === 'number' ? height : '2.5rem',
          borderRadius: '50%',
          flexShrink: 0,
        };
      case 'text':
        return {
          width: typeof width === 'number' ? width : '100%',
          height: typeof height === 'number' ? height : '0.75rem',
          borderRadius: '4px',
        };
      default:
        return {
          width,
          height,
          borderRadius: rounded ? (typeof rounded === 'string' ? rounded : '8px') : '0',
        };
    }
  }, [variant, width, height, rounded]);

  // Базовые классы с улучшенной анимацией
  const baseClasses = cn(
    'relative overflow-hidden',
    animated && 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200',
    !animated && 'bg-gray-200',
    variant === 'text' && 'w-full',
    className
  );

  // Анимация shimmer (бегущая волна)
  const shimmerClasses = animated
    ? 'absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent'
    : '';

  // Создаем массив для множественных скелетонов
  const skeletons = Array.from({ length: count }, (_, index) => (
    <div
      key={index}
      className={baseClasses}
      style={{
        ...variantStyles,
        marginBottom: index < count - 1 ? gap : 0,
      }}
    >
      {animated && <div className={shimmerClasses} />}
      {children}
    </div>
  ));

  // Если count === 1, возвращаем один элемент
  if (count === 1) {
    return (
      <div className={baseClasses} style={variantStyles}>
        {animated && <div className={shimmerClasses} />}
        {children}
      </div>
    );
  }

  // Иначе возвращаем контейнер с колонкой
  return (
    <div className="flex flex-col" style={{ gap: typeof gap === 'number' ? gap : gap }}>
      {skeletons}
    </div>
  );
};

// Утилита для создания группы скелетонов (карточка, список и т.д.)
export const SkeletonCard: React.FC<{ count?: number; className?: string }> = ({
  count = 1,
  className = '',
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-start space-x-4">
            <Skeleton variant="avatar" width="3rem" height="3rem" />
            <div className="flex-1 space-y-3">
              <Skeleton width="60%" height="1.25rem" />
              <Skeleton width="40%" height="0.75rem" />
              <Skeleton width="80%" height="0.75rem" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Утилита для текстового блока
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}> = ({ lines = 3, className = '', lastLineWidth = '60%' }) => {
  return (
    <div className={cn('space-y-2', className)}>
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