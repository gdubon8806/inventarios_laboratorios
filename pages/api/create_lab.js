// api/insertLab.js
import { sql } from '@vercel/postgres';

export default async function createLab(request, response) {
    try {
        // Obtener los datos a insertar del cuerpo de la solicitud
        const { name, description } = request.body;

        // Realizar la inserción en la base de datos
        await sql`INSERT INTO laboratorios (name, description) VALUES (${name}, ${description})`;

        // Responder con un mensaje de éxito
        response.status(201).json({ message: 'Laboratorio insertado exitosamente' });
    } catch (error) {
        // En caso de error, responder con un mensaje de error
        response.status(500).json({ error: error.message });
    }
}
