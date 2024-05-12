import { storage } from '../../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const generateUniqueFileName = (file) => {
  const timestamp = new Date().getTime();
  const fileName = file.name;
  const fileExtension = fileName.split('.').pop();
  const uniqueFileName = `${fileName}_${timestamp}.${fileExtension}`;
  return uniqueFileName;
};

const uploadImage = async (file) => {
  try {
    const uniqueFileName = generateUniqueFileName(file);
    const storageRef = ref(storage, `images/${uniqueFileName}`);
    await uploadBytes(storageRef, file);
    const imageUrl = await getDownloadURL(storageRef);
    return [1, imageUrl, uniqueFileName];
  } catch (error) {
    console.error('Error al cargar la imagen:', error);
    return [0, null, null];
  }
};

export { uploadImage };
