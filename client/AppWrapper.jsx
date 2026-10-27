import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

export default function AppWrapper() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
