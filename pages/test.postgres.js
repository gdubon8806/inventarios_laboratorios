import { sql } from "@vercel/postgres";

export default async function Inventarios() {
  const { rows } = await sql`SELECT * from laboratorios`;
  console.log(rows);
  return (
    <div>
        hi
      {/* {rows.map((row) => (
        <div key={row.id}>
          {row.name} - {row.description}
        </div>
      ))} */}
    </div>
  );
}