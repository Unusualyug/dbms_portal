import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import './fonts.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import FirstVisitIntro from './components/FirstVisitIntro.jsx';
import './styles.css';
import './design-system.css';
import './responsive.css';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <AuthProvider>
          <FirstVisitIntro>
            <App />
          </FirstVisitIntro>
        </AuthProvider>
      </ThemeProvider>
    </MotionConfig>
  </BrowserRouter>,
);
