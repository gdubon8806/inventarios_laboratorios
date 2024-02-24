import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
    try {
        await sql`INSERT INTO Pets VALUES('GATO', 'Pedro');`;
        return response.status(200).json({ pets} );
    } catch (error) {
        return response.status(500).json({ error });
    }

}