import React, { useLayoutEffect, useState } from 'react';
import { Router } from 'react-router';
import { createHashHistory } from '@remix-run/router';

interface HashRouterProps {
  basename?: string;
  children: React.ReactNode;
}

const hashHistory = createHashHistory();

export const HashRouter: React.FC<HashRouterProps> = ({ basename, children }) => {
  const [state, setState] = useState({
    action: hashHistory.action,
    location: hashHistory.location,
  });

  useLayoutEffect(() => hashHistory.listen((nextState) => setState(nextState)), []);

  return (
    <Router
      basename={basename}
      location={state.location}
      navigationType={state.action}
      navigator={hashHistory}
    >
      {children}
    </Router>
  );
};

