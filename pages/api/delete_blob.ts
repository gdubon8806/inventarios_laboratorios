import { del } from '@vercel/blob' 
import { NextResponse } from 'next/server'

export const runtime = 'edge'

export default async function DELETE(req: Request) {
    const  { url }   = await req.json(); // Parseamos el cuerpo de la solicitud como JSON
    console.log("La url es", url , "y es de tipo", typeof(url)); // Obtenemos la URL del cuerpo de la solicitud
  
    // Ahora puedes utilizar la URL para eliminar la imagen
    await del(url);
    
    return NextResponse.json("Se ha eliminado la imagen exitosamente");
  }
  
  