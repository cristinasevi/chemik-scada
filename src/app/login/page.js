'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, User, Lock, AlertTriangle, Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const { login, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Detectar tema actual después del primer renderizado
  useEffect(() => {
    setIsClient(true);
    
    // Leer el tema actual del DOM
    const htmlClasses = document.documentElement.className;
    setIsDark(htmlClasses.includes('dark'));
  }, []);

  // Cambiar tema
  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    
    // Obtener clases actuales y reemplazar solo el tema
    const currentClasses = document.documentElement.className;
    const baseClasses = currentClasses.replace(/\b(light|dark)\b/g, '').trim();
    const themeClass = newTheme ? 'dark' : 'light';
    
    document.documentElement.className = `${baseClasses} ${themeClass}`.trim();
    localStorage.setItem('theme', themeClass);
  };

  // Validar formulario
  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'El email es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.username)) {
      newErrors.username = 'El formato del email no es válido';
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es obligatoria';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(formData.username, formData.password);

      if (!result.success) {
        // Manejar diferentes tipos de error
        if (result.error.includes('Invalid login credentials')) {
          setLoginError('Email o contraseña incorrectos');
        } else if (result.error.includes('Email not confirmed')) {
          setLoginError('Debes confirmar tu email antes de iniciar sesión');
        } else if (result.error.includes('Too many requests')) {
          setLoginError('Demasiados intentos. Espera un momento antes de intentar de nuevo');
        } else {
          setLoginError(result.error || 'Error de autenticación');
        }
      }
      // Si el login es exitoso, el AuthContext se encarga de la redirección
    } catch (error) {
      console.error('Error en login:', error);
      setLoginError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar cambios en los inputs
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Limpiar errores al escribir
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
    
    // Limpiar error de login
    if (loginError) {
      setLoginError('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header con logo y título */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center shadow-lg">
                <img 
                  src="/images/aresol.jpeg" 
                  alt="Chemik Scada Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-primary mb-2">Chemik Scada</h1>
            <p className="text-secondary">Accede a tu panel de control</p>
          </div>

          {/* Botón de tema */}
          {isClient && (
            <div className="flex justify-end mb-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover-bg transition-colors cursor-pointer"
                title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                {isDark ? <Sun size={20} className="text-secondary" /> : <Moon size={20} className="text-secondary" />}
              </button>
            </div>
          )}

          {/* Formulario de login */}
          <div className="bg-panel rounded-xl p-8 shadow-lg">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error de login */}
              {loginError && (
                <div className="flex items-center gap-3 p-4 badge-red rounded-lg border border-red">
                  <AlertTriangle className="text-red-500" size={20} />
                  <p className="text-red-error-primary text-sm">{loginError}</p>
                </div>
              )}

              {/* Campo de email */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-primary mb-2">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-secondary" />
                  </div>
                  <input
                    id="username"
                    type="email"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      errors.username ? 'border-red-500' : 'border-custom'
                    }`}
                    placeholder="usuario@chemik.es"
                    disabled={isLoading || authLoading}
                    autoComplete="username"
                  />
                </div>
                {errors.username && (
                  <p className="text-red-500 text-sm mt-1">{errors.username}</p>
                )}
              </div>

              {/* Campo de contraseña */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-primary mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-secondary" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`w-full pl-10 pr-12 py-3 border rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      errors.password ? 'border-red-500' : 'border-custom'
                    }`}
                    placeholder="••••••••"
                    disabled={isLoading || authLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                    disabled={isLoading || authLoading}
                  >
                    {showPassword ? 
                      <EyeOff className="h-5 w-5 text-secondary hover:text-primary transition-colors" /> :
                      <Eye className="h-5 w-5 text-secondary hover:text-primary transition-colors" />
                    }
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                )}
              </div>

              {/* Botón de login */}
              <button
                type="submit"
                disabled={isLoading || authLoading}
                className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
              >
                {isLoading || authLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Iniciando sesión...
                  </div>
                ) : (
                  'Iniciar Sesión'
                )}
              </button>
            </form>

            {/* Enlaces adicionales */}
            <div className="mt-6 text-center space-y-3">
              <button
                type="button"
                className="text-sm text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
                disabled={isLoading || authLoading}
              >
                ¿Olvidaste tu contraseña?
              </button>
              
              <div className="text-xs text-secondary">
                ¿Necesitas acceso? Contacta con el administrador del sistema
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer fijo al final */}
      <footer className="text-center py-6 px-4">
        <p className="text-sm text-secondary">
          © 2025 Chemik Scada. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
};

export default LoginPage;