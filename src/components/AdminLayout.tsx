import React from 'react';

export const AdminLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', backgroundColor: '#f4f6f9' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {children}
      </div>
    </div>
  );
};