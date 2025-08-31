import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebaseConfig";
import { signOut } from "firebase/auth";


export const loginUser = async (email, password) => {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        return result.user; // contiene uid, email, etc.
    } catch (error) {
        console.error("Error al iniciar sesión:", error.message);
        throw error;
    }
};

// export function isAdmin() {
//     // return get(/databases/$(database) / documents / users / $(request.auth.uid)).data.role == "admin";
// }


export function signOutSession() {
    signOut(auth)
        .then(() => {
            console.log("Sesión cerrada");
            // Redirigir a la página de inicio o mostrar un mensaje
        })
        .catch(error => {
            console.error(error);
        });
}
