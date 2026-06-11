import React, { createContext, useMemo } from 'react';

export interface MarkdownRuntimeConfig {
  isStreaming?: boolean;
  page?: 'weAgentCUI' | 'skillCUI' | string;
}

export const MarkdownRuntimeConfigContext = createContext<MarkdownRuntimeConfig>({});

export const MarkdownRuntimeConfigProvider: React.FC<{
  value: MarkdownRuntimeConfig;
  children: React.ReactNode;
}> = ({ value, children }) => {
  const contextValue = useMemo(() => value, [
    value.isStreaming,
    value.page,
  ]);

  return (
    <MarkdownRuntimeConfigContext.Provider value={contextValue}>
      {children}
    </MarkdownRuntimeConfigContext.Provider>
  );
};
