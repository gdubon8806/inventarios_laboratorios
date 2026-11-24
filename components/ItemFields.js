// Campos compartidos entre los formularios de alta y edición de registros (solo admin los ve).
// Se renderizan como pares <label>/<input> dentro del grid de FormStyles.form.

const checkStyle = { width: 22, height: 22, justifySelf: 'start', minWidth: 0 };

/** Fecha de vencimiento: si se activa, la fecha es obligatoria; si no, queda vacía. */
export function VencimientoFields({ tiene, setTiene, fecha, setFecha }) {
  return (
    <>
      <label>¿Tiene fecha de vencimiento?</label>
      <input type="checkbox" style={checkStyle} checked={tiene} onChange={(e) => { setTiene(e.target.checked); if (!e.target.checked) setFecha(''); }} />
      {tiene && (
        <>
          <label>Fecha de vencimiento (obligatoria):</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </>
      )}
    </>
  );
}

/** Campos propios del registro de INSUMOS (1 código por registro). En los demás tipos viven en cada unidad. */
export function InsumoFields({ serie, setSerie, fundaempresa, setFundaempresa }) {
  return (
    <>
      <label>Número de serie:</label>
      <input type="text" name="numeroSerie" value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="Vacío por defecto" />
      <label>Código Fundaempresa:</label>
      <input type="text" name="codigoFundaempresa" value={fundaempresa} onChange={(e) => setFundaempresa(e.target.value)} placeholder="Vacío por defecto" />
    </>
  );
}

/** Texto informativo sobre los datos por unidad (Mobiliario / Equipo / Herramienta). */
export function UnidadesNota() {
  return (
    <p style={{ gridColumn: '1 / -1', fontSize: '0.85rem', color: '#555', margin: 0 }}>
      Marca y modelo de aquí son los valores por defecto. Marca, modelo, serie, código Fundaempresa, estado y observaciones
      se registran por unidad en «Unidades y reportes (modo editar)».
    </p>
  );
}
