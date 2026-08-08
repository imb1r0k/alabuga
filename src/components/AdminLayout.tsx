import React from 'react';

export const AdminLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', backgroundColor: '#f4f6f9' }}>
      <div style={{ width: '100%', padding: '12px 24px' }}>
        {children}
      </div>
    </div>
  );
};