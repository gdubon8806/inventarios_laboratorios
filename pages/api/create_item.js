// api/insertItem.js
import { sql } from '@vercel/postgres';

export default async function createLab(request, response) {
    try {
        // Obtener los datos a insertar del cuerpo de la solicitud
        const { 
            equipo, 
            marca,
            modelo,
            ubicacion,
            columnaDeLocalizacion,
            tipo,
            cantidad,
            imgURL,
            observaciones,
            idLab
         } = request.body;
         console.log( equipo, 
            marca,
            modelo,
            ubicacion,
            columnaDeLocalizacion,
            tipo,
            cantidad,
            imgURL,
            observaciones,
            idLab)

         const idLabToInteger = parseInt(idLab); 
         const cantidadToInteger = parseInt(cantidad);
        // Realizar la inserción en la base de datos
        await sql`INSERT INTO items (equipo, marca, modelo, ubicacion, columnaDeLocalizacion, tipo, cantidad, imgurl, observaciones, id_lab) VALUES (${equipo}, ${marca}, ${modelo}, ${ubicacion}, ${columnaDeLocalizacion}, ${tipo}, ${cantidadToInteger}, ${imgURL}, ${observaciones}, ${idLabToInteger})`;

        // Responder con un mensaje de éxito
        response.status(201).json({ message: 'Laboratorio insertado exitosamente' });
    } catch (error) {
        // En caso de error, responder con un mensaje de error
        response.status(500).json({ error: error.message });
    }
}