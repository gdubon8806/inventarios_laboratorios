// api/deleteLab.js
import { sql } from '@vercel/postgres';

export default async function deleteLab(request, response) {
    try {
        // Obtener el ID del laboratorio a eliminar del cuerpo de la solicitud
        const { idLab } = request.body;
        // Realizar la eliminación en la base de datos
        await sql`DELETE FROM laboratorios WHERE id = ${idLab}`;

        // Responder con un mensaje de éxito
        response.status(200).json({ message: 'Laboratorio eliminado exitosamente' });
    } catch (error) {
        // En caso de error, responder con un mensaje de error
        response.status(500).json({ error: error.message });
    }
}
