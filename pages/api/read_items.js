import { sql } from '@vercel/postgres';

export default async function readItems(request, response) {
    try {
        let result = await sql`SELECT * FROM items;`;
        return response.status(200).json({result});
    } catch (error) {
        return response.status(500).json({ error });
    }
}