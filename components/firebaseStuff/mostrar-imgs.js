import { useEffect, useState } from 'react';
import { getStorage, ref, listAll, getDownloadURL, list } from "firebase/storage";
import { storage } from './uploadImages';

export default async function getImageUrl(name) {
  let urls = '';
  try {
    const storageRef = ref(storage, 'images/');
    const imageList = await listAll(storageRef);
    urls = await Promise.all(imageList.items.map(async (item) => {      
      const url = await getDownloadURL(item);
      return url;
    }));
  } catch (error) {
    console.error('Error al obtener la url de imagen:', error);
  }
  return urls;
};

