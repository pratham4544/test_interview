import React from 'react';

const LoadingSpinner = ({ message = 'Loading...' }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px'
    }}>
      <div className="loading-spinner" />
      <p style={{ marginTop: '20px', color: '#6b7280' }}>{message}</p>
    </div>
  );
};

export default LoadingSpinner;