import { createBrowserRouter } from 'react-router-dom';
import App from './App';

export const router = createBrowserRouter([
  {
    path: '/*',
    element: <App />,
  }
], {
  basename: '/RespiView'  // Match your vite.config.js base
});
