/**
 * Username Manager - Local username storage for Lumina Suite
 * Replaces Cloudflare authentication with simple username stored in localStorage
 */

const USERNAME_KEY = 'lumina_username';

/**
 * Get the current username from localStorage
 */
export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

/**
 * Set the username in localStorage
 */
export function setUsername(username: string): void {
  if (!username || username.trim().length === 0) {
    throw new Error('Username cannot be empty');
  }
  localStorage.setItem(USERNAME_KEY, username.trim());
}

/**
 * Clear the username from localStorage
 */
export function clearUsername(): void {
  localStorage.removeItem(USERNAME_KEY);
}

/**
 * Check if username is set
 */
export function hasUsername(): boolean {
  const username = getUsername();
  return username !== null && username.trim().length > 0;
}
