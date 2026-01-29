import XLSX from '../../vendor/xlsx';
import readItem from '../firebase/read-item';
import readLab from '../firebase/read-lab';


export default async function exportToXLSX(idLab) {
    try {   
        readItem(idLab).then((data) => {
            console.log(data);
            const labName = "Laboratorio nombre de prueba"; //cambiar por nombre real de lab.

            //Filtrar las columnas que se quieren exportar
            //transformar el arreglo de observaciones en un string unico para poder ponerlo en una celda
            const filteredData = data.map((item) => {
                // let observaciones = "";
                // item.observaciones.map((observacion) => {
                //     observaciones += observacion + ". \n";
                // }) 
                return {
                    Nombre: item.equipo,
                    Marca: item.marca,
                    Modelo: item.modelo,
                    Cantidad: item.cantidad,
                    Tipo: item.tipo,
                    "Ubicación": item.ubicacion,
                    "Columna de localizacion": item.columnadelocalizacion,
                    Observaciones: item.observaciones
                }
            })
            
            //Formatear la tabla
            
            

            const worksheet = XLSX.utils.json_to_sheet(filteredData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, labName);

            //logica de imagenes
            data.forEach((item) => {
                const imgUrl = item.imgurl;
                
            })



            const buf = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
            const blob = new Blob([buf], { type: "application/vnd.ms-excel" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "MyTable.xlsx";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
    catch (e) {
        if (e instanceof Error) {
            console.error(e);
            alert(`Error: ${e.message}`);
        }
    }
}

export async function exportAllToXLSX() {
  try {
    // 1. Obtener todos los laboratorios
    const labs = await readLab();

    // 2. Crear UN solo workbook
    const workbook = XLSX.utils.book_new();

    // 3. Iterar cada laboratorio
    let count = 1;
    for (const lab of labs) {
      const idLab = lab.id;
      const labName = lab.name;

      // Obtener los equipos/items del lab
      const data = await readItem(idLab);
      if (!data || data.length === 0) continue;

      // 4. Filtrar y formatear datos
      const filteredData = data.map(item => ({
        Nombre: item.equipo,
        Marca: item.marca,
        Modelo: item.modelo,
        Cantidad: item.cantidad,
        Tipo: item.tipo,
        Ubicación: item.ubicacion,
        "Columna de localización": item.columnadelocalizacion,
        Observaciones: Array.isArray(item.observaciones)
          ? item.observaciones.join(".\n")
          : item.observaciones || ""
      }));

      // 5. Crear worksheet vacía
      const worksheet = XLSX.utils.aoa_to_sheet([]);

      // 👉 A1: nombre real del laboratorio
      XLSX.utils.sheet_add_aoa(
        worksheet,
        [[labName]],
        { origin: "A1" }
      );

      // 👉 Tabla desde A2
      XLSX.utils.sheet_add_json(
        worksheet,
        filteredData,
        { origin: "A2" }
      );

      // 6. Nombre de la hoja = count
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        `Lab ${count}`
      );

      count++; // 👈 importante
    }

    // 7. Exportar el Excel UNA sola vez
    const buf = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx"
    });

    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Laboratorios.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (e) {
    console.error(e);
    alert(`Error al exportar: ${e.message}`);
  }
}

