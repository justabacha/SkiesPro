import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AccountModeProvider } from '@/shared/context/AccountModeContext';

function App() {
  return (
    <AccountModeProvider>
      <RouterProvider router={router} />
    </AccountModeProvider>
  );
}

export default App;
