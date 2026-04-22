import React from 'react';
import type { ErrorBlockProps } from '../types/components';

export const ErrorBlock: React.FC<ErrorBlockProps> = ({ part }) => (
  <div className="error-block" role="alert">
    <div className="error-block__header">
      <span className="error-block__icon">!</span>
      <span className="error-block__title">Error</span>
    </div>
    <div className="error-block__content">{part.content}</div>
  </div>
);
