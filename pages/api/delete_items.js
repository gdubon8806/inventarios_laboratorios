import { sql } from '@vercel/postgres';

export default async function deleteItems(request, response) {
    try {
        let result = await sql`SELECT * FROM laboratorios;`;
        return response.status(200).json({result});
    } catch (error) {
        return response.status(500).json({ error });
    }
}