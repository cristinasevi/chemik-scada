'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Home, AlertTriangle } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Si el countdown llega a 0, redirigir
    if (countdown === 0) {
      router.push('/');
      return;
    }

    // Timer que actualiza el countdown cada segundo
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    // Limpiar el timer
    return () => clearTimeout(timer);
  }, [countdown, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <AlertTriangle size={64} className="text-red-500" />
        </div>
        
        <div>
          <h1 className="text-4xl font-bold text-red-500 mb-2">404</h1>
          <h2 className="text-xl font-semibold text-primary mb-4">
            Página no encontrada
          </h2>
          <p className="text-secondary mb-4">
            Serás redirigido al inicio en{' '}
            <span className="">
              {countdown}
            </span>{' '}
            segundo{countdown !== 1 ? 's' : ''}...
          </p>
        </div>

        <button
          onClick={() => router.push('/')}
          className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
        >
          <Home size={16} />
          Ir ahora al Dashboard
        </button>
      </div>
    </div>
  );
}
