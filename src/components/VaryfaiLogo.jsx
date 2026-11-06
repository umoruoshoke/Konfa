
import React from 'react';

const VaryfaiLogo = ({
  className = '',
  height = 32,
  withWordmark = true,
  ariaLabel = 'Varyfai',
}) => {
  return (
    <img
      src="https://i.postimg.cc/j51RJsjT/Varyfai-Logo-Transparent.png"
      alt={ariaLabel}
      className={className}
      height={height}
      style={{
        width: 'auto',
        maxWidth: '100%',
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
      role="img"
    />
  );
};

export default VaryfaiLogo;
