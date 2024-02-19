const labs = new Map();

labs.set(1, {
    id: 1,
    nombre: "Laboratorio de electrónica",
    items: [
        { equipo: "Programmable DC POWER Supply", marca: "EXTECH-Instruments", modelo: "382280", ubicacion: "Mesa de trabajo", columnaDeLocalizacion: "3/F2-1/E2-3/D2", tipo: "Equipo", cantidad: "7", real: "7", img: "", observaciones: "Ninguna" },
        { equipo: "NI ELVIS ", marca: "EXTECH-Instruments", modelo: "382280", ubicacion: "Mesa de trabajo", columnaDeLocalizacion: "3/F2-1/E2-3/D2", tipo: "Equipo", cantidad: "7", real: "7", img: "", observaciones: "Ninguna" },
        { equipo: "Estacion de Soldadura", marca: "EXTECH-Instruments", modelo: "382280", ubicacion: "Mesa de trabajo", columnaDeLocalizacion: "3/F2-1/E2-3/D2", tipo: "Equipo", cantidad: "7", real: "7", img: "", observaciones: "Ninguna" },
        { equipo: "Emona Telecommunications Trainer", marca: "EXTECH-Instruments", modelo: "382280", ubicacion: "Mesa de trabajo", columnaDeLocalizacion: "3/F2-1/E2-3/D2", tipo: "Equipo", cantidad: "7", real: "7", img: "", observaciones: "Ninguna" },
        { equipo: "Estacion de Soldadura", marca: "EXTECH-Instruments", modelo: "382280", ubicacion: "Mesa de trabajo", columnaDeLocalizacion: "3/F2-1/E2-3/D2", tipo: "Equipo", cantidad: "7", real: "7", img: "", observaciones: "Ninguna" },
        { equipo: "Estacion de Soldadura", marca: "EXTECH-Instruments", modelo: "382280", ubicacion: "Mesa de trabajo", columnaDeLocalizacion: "3/F2-1/E2-3/D2", tipo: "Equipo", cantidad: "7", real: "7", img: "", observaciones: "Ninguna" },
        { equipo: "Estacion de Soldadura", marca: "EXTECH-Instruments", modelo: "382280", ubicacion: "Mesa de trabajo", columnaDeLocalizacion: "3/F2-1/E2-3/D2", tipo: "Equipo", cantidad: "7", real: "7", img: "", observaciones: "Ninguna" },
        { equipo: "Digital Electronics FPGA BOARD", marca: "NATIONAL-Instruments", modelo: "193426B-01L", ubicacion: "Mesa de trabajo", columnaDeLocalizacion: "3/F2-1/E2-3/D2", tipo: "Equipo", cantidad: "7", real: "7", img: "", observaciones: "Ninguna" }
    ]
})

labs.set(2, {
    id: 2,
    nombre: "Laboratorio de quimica",
    items: [
        {
            equipo: 'Microscopio',
            marca: 'OPTIKA'
        },
        {
            equipo: 'Medidor de pluma impermeable',
            marca: 'OHAUS'
        },
        {
            equipo: 'Mechero',
            marca: 'USBECK'
        },
    ]
});

labs.set(3, {
    id: 3,
    nombre: "Laboratorio de gesell",
    items: [
        {
            equipo: 'Fuente de alimentación y corriente constante de 15V / 5 A',
            marca: 'PHYWE'
        },
        {
            equipo: 'Cronómetro 4-4',
            marca: 'PHYWE'
        },
        {
            equipo: 'Transformador adaptable 115/230V',
            marca: 'PHYWE'
        },
    ]
})

labs.set(4, {
    id: 3,
    nombre: "Laboratorio de MAC",
    items: [
        {
            equipo: 'Fuente de alimentación y corriente constante de 15V / 5 A',
            marca: 'PHYWE'
        },
        {
            equipo: 'Cronómetro 4-4',
            marca: 'PHYWE'
        },
        {
            equipo: 'Transformador adaptable 115/230V',
            marca: 'PHYWE'
        },
    ]
})

export default labs;
