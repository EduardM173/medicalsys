const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function getHealth() {
  const response = await fetch(`${apiUrl}/health`);

  if (!response.ok) {
    throw new Error('La API no está disponible.');
  }

  return response.json();
}
