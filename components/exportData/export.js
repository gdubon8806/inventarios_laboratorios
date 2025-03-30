import XLSX from '../../vendor/xlsx';
import readItem from '../firebaseStuff/read-item';


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