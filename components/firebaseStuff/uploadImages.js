import {storage } from '../../firebaseConfig';
import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const uploadImage = async (file) => {
    try {
        const storageRef = ref(storage, `images/${file.name}`);
        await uploadBytes(storageRef, file);
        // console.log('Imagen cargada con éxito.');
        const imageUrl = await getDownloadURL(storageRef);
        const imageName = file.name;
        // console.log("LA URL ES:", imageUrl);
        return [1, imageUrl, imageName];
    } catch (error) {
        console.error('Error al cargar la imagen:', error);
        return 0;
    }
};

export { storage, uploadImage };
