import React, { useState } from 'react';
import { User, AlertCircle } from 'lucide-react';

interface UsernamePromptProps {
  onSubmit: (username: string) => void;
}

/**
 * Modal prompt for entering username
 * Shown when user hasn't set their username yet
 */
export default function UsernamePrompt({ onSubmit }: UsernamePromptProps) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  console.log('🎯 [UsernamePrompt] Rendered!');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    console.log('📝 [UsernamePrompt] Submit attempt:', username);

    const trimmed = username.trim();
    if (trimmed.length === 0) {
      setError('Proszę wpisać nazwę użytkownika');
      return;
    }

    if (trimmed.length < 2) {
      setError('Nazwa użytkownika musi mieć co najmniej 2 znaki');
      return;
    }

    if (trimmed.length > 50) {
      setError('Nazwa użytkownika może mieć maksymalnie 50 znaków');
      return;
    }

    console.log('✅ [UsernamePrompt] Valid username, submitting:', trimmed);
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Witaj w Lumina Suite
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Podaj swoją nazwę użytkownika
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Nazwa użytkownika
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              placeholder="np. Jan Kowalski"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder-gray-400 dark:placeholder-gray-500"
              autoFocus
              autoComplete="off"
            />
            {error && (
              <div className="flex items-center gap-2 mt-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Informacja:</strong> Twoja nazwa użytkownika będzie używana do identyfikacji Twoich sesji.
              Możesz ją później zmienić w ustawieniach.
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg
                     transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <User className="w-4 h-4" />
            Zapisz i kontynuuj
          </button>
        </form>
      </div>
    </div>
  );
}
