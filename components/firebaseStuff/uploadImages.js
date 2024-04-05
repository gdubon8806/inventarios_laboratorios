import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBT6cusdCse2rF7YQbKh5sEGQjF3UAPKjM",
    authDomain: "inventarioslabsceutec.firebaseapp.com",
    projectId: "inventarioslabsceutec",
    storageBucket: "inventarioslabsceutec.appspot.com",
    messagingSenderId: "1015499109529",
    appId: "1:1015499109529:web:113f40238169121bf43408",
    measurementId: "G-YTM0GKD1ZV"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

const uploadImage = async (file) => {
    try {
        const storageRef = ref(storage, `images/${file.name}`);
        await uploadBytes(storageRef, file);
        console.log('Imagen cargada con éxito.');
        const imageUrl = await getDownloadURL(storageRef);
        const imageName = file.name;
        console.log("LA URL ES:", imageUrl);
        return [1, imageUrl, imageName];
    } catch (error) {
        console.error('Error al cargar la imagen:', error);
        return 0;
    }
};

export { storage, uploadImage };
