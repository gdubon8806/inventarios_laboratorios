// api/updateLab.js
import { sql } from '@vercel/postgres';

export default async function updateLab(request, response) {
    try {
        // Obtener los datos a actualizar del cuerpo de la solicitud
        const { id, name, description, imgurl } = request.body;

        // Realizar la actualización en la base de datos
        await sql`UPDATE laboratorios SET name = ${name}, description = ${description}, imgurl = ${imgurl} WHERE id = ${id}`;

        // Responder con un mensaje de éxito
        response.status(200).json({ message: 'Laboratorio actualizado exitosamente' });
    } catch (error) {
        // En caso de error, responder con un mensaje de error
        response.status(500).json({ error: error.message });
    }
}
