import React from 'react';

type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: boolean;
};

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  rounded = false,
}) => {
  const baseClasses = 'animate-pulse bg-gray-200';
  const roundedClass = rounded ? 'rounded' : '';
  
  return (
    <div
      className={`${baseClasses} ${roundedClass} ${className}`}
      style={{ width, height }}
    />
  );
};