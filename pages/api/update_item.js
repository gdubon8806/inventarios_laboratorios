// api/updateLab.js
import { sql } from '@vercel/postgres';

export default async function updateItem(request, response) {
    try {
        // Obtener los datos a actualizar del cuerpo de la solicitud
        const { 
            id, 
            equipo, 
            marca,
            modelo,
            ubicacion,
            columnaDeLocalizacion,
            tipo,
            cantidad,
            imgURL,
            observaciones
        } = request.body;

        // Realizar la actualización en la base de datos
        await sql`UPDATE items SET 
        equipo = ${equipo}, 
        marca = ${marca}, 
        modelo = ${modelo},
        ubicacion = ${ubicacion},
        columnaDeLocalizacion = ${columnaDeLocalizacion},
        tipo = ${tipo},
        cantidad = ${cantidad},
        imgURL = ${imgURL},
        observaciones = ${observaciones}
        WHERE id = ${id}`;

        // Responder con un mensaje de éxito
        response.status(200).json({ message: 'Laboratorio actualizado exitosamente' });
    } catch (error) {
        // En caso de error, responder con un mensaje de error
        response.status(500).json({ error: error.message });
    }
}
