import { sql } from '@vercel/postgres';

export default async function readItems(request, response) {
    try {
        const { 
            id, 
        } = request.body;

        let result = await sql`SELECT * FROM items WHERE id_lab = ${id}`;
        return response.status(200).json({result});
    } catch (error) {
        return response.status(500).json({ error });
    }
}