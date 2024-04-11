import NavBar from '../components/profileStuff/NavBar';
import '../styles/global.css'; //iconos globales
// import '../styles/output.css'
import { UserProvider } from '@auth0/nextjs-auth0/client';
export default function App({ Component, pageProps }) {
  return (
    <UserProvider>
      <Component {...pageProps} />
    </UserProvider>
  )
}