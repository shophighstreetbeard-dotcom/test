import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export default function Auth() {
  const { login } = useAuth();

  useEffect(() => {
    login();
  }, [login]);

  return <div>Loading...</div>;
}
