import Image from 'next/image';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { loginUser } from './authService';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // Con await, el catch ahora sí atrapa los errores de inicio de sesión
      await loginUser(email, password);
      // El usuario será redirigido automáticamente por el listener en index.js
    } catch (err) {
      setError('Correo o contraseña incorrectos');
    }
  };

  // Credenciales del usuario invitado: ya NO están en el código; se leen de variables de entorno
  // (ver .env.example). Siguen siendo visibles en el navegador (NEXT_PUBLIC_*): tratarlo como usuario público.
  const guestEmail = process.env.NEXT_PUBLIC_GUEST_EMAIL;
  const guestPassword = process.env.NEXT_PUBLIC_GUEST_PASSWORD;

  const handleGuestLogin = async () => {
    setError('');
    try {
      await loginUser(guestEmail, guestPassword);
    } catch (err) {
      setError('No se pudo ingresar como invitado');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f5'
    }}>
      <Paper elevation={6} style={{
        padding: 32,
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: 320
      }}>
        <Image
          src='/img/ceutec_logo.png'
          width={240}
          height={240}
          alt='Logo de CEUTEC'
          style={{ marginBottom: 16 }}
        />
        <Typography variant="h5" gutterBottom>
          Bienvenido a inventario de laboratorios
        </Typography>
        <form onSubmit={handleLogin} style={{ width: '100%', marginTop: 16 }}>
          <TextField
            label="Correo electrónico"
            type="email"
            fullWidth
            required
            margin="normal"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <TextField
            label="Contraseña"
            type="password"
            fullWidth
            required
            margin="normal"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {error && (
            <Typography color="error" variant="body2" style={{ marginTop: 8 }}>
              {error}
            </Typography>
          )}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            style={{ marginTop: 24 }}
          >
            Iniciar Sesión
          </Button>
          {guestEmail && guestPassword && (
            <Button
              onClick={handleGuestLogin}
              variant="contained"
              color="primary"
              fullWidth
              style={{ marginTop: 24 }}
            >
              Ingresar como invitado
            </Button>
          )}
        </form>
      </Paper>
    </div>
  );
}
