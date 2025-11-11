// frontend/js/dashboard.js

const API_URL = "http://localhost:5000/api/clients";
const CONSULTAS_API_URL = "http://localhost:5000/api/consultas";

// Variables globales para filtros
let fechaInicioFiltro = null;
let fechaFinFiltro = null;
let datosOriginales = {
  clientes: [],
  consultas: [],
  estadisticas: {}
};

// Función para obtener el token
function getAuthToken() {
  return localStorage.getItem("authToken");
}

// Cargar todas las estadísticas
async function loadDashboard() {
  try {
    // Cargar datos originales
    await cargarDatosOriginales();
    
    // Aplicar filtros y mostrar
    await aplicarFiltrosYMostrar();
    
  } catch (err) {
    console.error("Error cargando dashboard:", err);
    alert("Error al cargar las estadísticas");
  }
}

// Cargar datos originales sin filtros
async function cargarDatosOriginales() {
  try {
    // Obtener clientes
    const clientesRes = await fetch(API_URL, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });
    datosOriginales.clientes = await clientesRes.json();

    // Obtener consultas
    const consultasRes = await fetch(CONSULTAS_API_URL, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });
    datosOriginales.consultas = await consultasRes.json();

    // Obtener estadísticas
    const statsRes = await fetch(`${CONSULTAS_API_URL}/estadisticas`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });
    datosOriginales.estadisticas = await statsRes.json();

  } catch (err) {
    console.error("Error cargando datos originales:", err);
    throw err;
  }
}

// Aplicar filtros y mostrar datos
async function aplicarFiltrosYMostrar() {
  // Filtrar consultas por fecha
  let consultasFiltradas = [...datosOriginales.consultas];
  
  if (fechaInicioFiltro) {
    const fechaInicio = new Date(fechaInicioFiltro + 'T00:00:00');
    consultasFiltradas = consultasFiltradas.filter(c => 
      new Date(c.fecha) >= fechaInicio
    );
  }
  
  if (fechaFinFiltro) {
    const fechaFin = new Date(fechaFinFiltro + 'T23:59:59');
    consultasFiltradas = consultasFiltradas.filter(c => 
      new Date(c.fecha) <= fechaFin
    );
  }

  // Recalcular estadísticas con datos filtrados
  const estadisticasFiltradas = calcularEstadisticas(consultasFiltradas);

  // Mostrar estadísticas
  await Promise.all([
    mostrarEstadisticasGenerales(estadisticasFiltradas),
    mostrarModalidadStats(consultasFiltradas), // Pasar consultas completas para modalidad
    mostrarEstadoStats(estadisticasFiltradas),
    mostrarMotivosStats(consultasFiltradas), // Nueva función para motivos
    mostrarTopClientes(consultasFiltradas),
    loadSedesStats()
  ]);
}

// Calcular estadísticas agrupadas por cliente (consulta = caso)
function calcularEstadisticas(consultas) {
  // Agrupar consultas por cliente
  const consultasPorCliente = {};
  
  consultas.forEach(c => {
    if (!consultasPorCliente[c.cliente_id]) {
      consultasPorCliente[c.cliente_id] = {
        sesiones: [],
        estados: new Set()
      };
    }
    consultasPorCliente[c.cliente_id].sesiones.push(c);
    consultasPorCliente[c.cliente_id].estados.add(c.estado);
  });

  // Contar consultas (casos) por estado
  let casosAbiertos = 0;
  let casosCerrados = 0;

  Object.values(consultasPorCliente).forEach(caso => {
    // Si tiene alguna sesión cerrada, el caso está cerrado
    if (caso.estados.has('Cerrado')) {
      casosCerrados++;
    } else {
      // Si todas las sesiones están abiertas
      casosAbiertos++;
    }
  });

  return {
    total_consultas: Object.keys(consultasPorCliente).length, // Total de clientes con consultas
    casos_abiertos: casosAbiertos,
    casos_cerrados: casosCerrados
  };
}

// Mostrar estadísticas generales
async function mostrarEstadisticasGenerales(stats) {
  document.getElementById("totalClientes").textContent = datosOriginales.clientes.length;
  document.getElementById("totalConsultas").textContent = stats.total_consultas || 0;
  document.getElementById("casosAbiertos").textContent = stats.casos_abiertos || 0;
  document.getElementById("casosCerrados").textContent = stats.casos_cerrados || 0;
}

// Mostrar estadísticas por modalidad (suma de todas las sesiones)
async function mostrarModalidadStats(consultas) {
  const virtual = consultas.filter(c => c.modalidad === 'Virtual').length;
  const presencial = consultas.filter(c => c.modalidad === 'Presencial').length;
  const total = virtual + presencial;

  if (total > 0) {
    const virtualPct = (virtual / total) * 100;
    const presencialPct = (presencial / total) * 100;

    document.getElementById("virtualCount").textContent = virtual;
    document.getElementById("presencialCount").textContent = presencial;

    setTimeout(() => {
      document.getElementById("virtualBar").style.width = virtualPct + "%";
      document.getElementById("presencialBar").style.width = presencialPct + "%";
    }, 300);
  } else {
    document.getElementById("virtualCount").textContent = 0;
    document.getElementById("presencialCount").textContent = 0;
    document.getElementById("virtualBar").style.width = "0%";
    document.getElementById("presencialBar").style.width = "0%";
  }
}

// Mostrar estadísticas de estado (gráfico donut)
async function mostrarEstadoStats(stats) {
  const abiertos = parseInt(stats.casos_abiertos) || 0;
  const cerrados = parseInt(stats.casos_cerrados) || 0;
  const total = abiertos + cerrados;

  document.getElementById("totalCasos").textContent = total;

  if (total > 0) {
    const abiertosPct = ((abiertos / total) * 100).toFixed(1);
    const cerradosPct = ((cerrados / total) * 100).toFixed(1);

    document.getElementById("porcentajeAbiertos").textContent = abiertosPct + "%";
    document.getElementById("porcentajeCerrados").textContent = cerradosPct + "%";

    const circumference = 2 * Math.PI * 40;
    
    setTimeout(() => {
      const segmentAbiertos = document.getElementById("segmentAbiertos");
      const segmentCerrados = document.getElementById("segmentCerrados");

      // Segmento de Abiertos (comienza en la parte superior)
      const abiertosLength = (abiertosPct / 100) * circumference;
      segmentAbiertos.style.strokeDasharray = `${abiertosLength} ${circumference}`;
      segmentAbiertos.style.strokeDashoffset = '0';

      // Segmento de Cerrados (comienza donde termina Abiertos)
      const cerradosLength = (cerradosPct / 100) * circumference;
      segmentCerrados.style.strokeDasharray = `${cerradosLength} ${circumference}`;
      segmentCerrados.style.strokeDashoffset = `-${abiertosLength}`;
    }, 300);
  } else {
    document.getElementById("porcentajeAbiertos").textContent = "0%";
    document.getElementById("porcentajeCerrados").textContent = "0%";
    
    const segmentAbiertos = document.getElementById("segmentAbiertos");
    const segmentCerrados = document.getElementById("segmentCerrados");
    segmentAbiertos.style.strokeDasharray = '0';
    segmentCerrados.style.strokeDasharray = '0';
  }
}

// Mostrar estadísticas por motivo de consulta
async function mostrarMotivosStats(consultas) {
  const motivosPorCliente = {};
  
  // Agrupar por cliente y obtener el motivo de consulta (primera sesión)
  consultas.forEach(c => {
    if (!motivosPorCliente[c.cliente_id]) {
      // Solo tomamos el motivo de la primera sesión del cliente
      motivosPorCliente[c.cliente_id] = {
        motivo: c.motivo_consulta || 'Sin especificar',
        fecha: new Date(c.fecha)
      };
    } else {
      // Si ya existe, verificar si esta sesión es más antigua
      const fechaActual = new Date(c.fecha);
      if (fechaActual < motivosPorCliente[c.cliente_id].fecha) {
        motivosPorCliente[c.cliente_id].motivo = c.motivo_consulta || 'Sin especificar';
        motivosPorCliente[c.cliente_id].fecha = fechaActual;
      }
    }
  });

  // Contar casos por motivo
  const motivosCount = {};
  Object.values(motivosPorCliente).forEach(({ motivo }) => {
    motivosCount[motivo] = (motivosCount[motivo] || 0) + 1;
  });

  // Convertir a array y ordenar por cantidad
  const motivosArray = Object.entries(motivosCount)
    .map(([motivo, count]) => ({ motivo, count }))
    .sort((a, b) => b.count - a.count);

  const container = document.getElementById("motivosGrid");
  
  if (motivosArray.length === 0) {
    container.innerHTML = `
      <div class="loading-card">
        <p>No hay datos de motivos de consulta disponibles</p>
      </div>
    `;
    return;
  }

  // Calcular total para porcentajes
  const totalCasos = Object.keys(motivosPorCliente).length;

  container.innerHTML = motivosArray.map(m => {
    const porcentaje = ((m.count / totalCasos) * 100).toFixed(1);
    return `
      <div class="motivo-card">
        <div class="motivo-header">
          <span class="motivo-icon">🔍</span>
          <span class="motivo-badge">${porcentaje}%</span>
        </div>
        <h4 class="motivo-name">${escapeHtml(m.motivo)}</h4>
        <div class="motivo-stats">
          <span class="motivo-count">${m.count}</span>
          <span class="motivo-label">${m.count === 1 ? 'Caso' : 'Casos'}</span>
        </div>
        <div class="motivo-bar">
          <div class="motivo-bar-fill" style="width: ${porcentaje}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Mostrar top clientes con más consultas
async function mostrarTopClientes(consultas) {
  const consultasPorCliente = {};
  
  // Contar consultas únicas y sesiones por cliente
  consultas.forEach(c => {
    if (!consultasPorCliente[c.cliente_id]) {
      consultasPorCliente[c.cliente_id] = {
        totalConsultas: 0,
        totalSesiones: 0,
        cedula: c.cedula,
        nombre: c.nombre,
        sede: c.sede,
        consultasSet: new Set(),
        tieneAbierta: false,
        tieneCerrada: false
      };
    }
    // Por ahora cada cliente tiene 1 consulta, pero en el futuro
    // se podrá identificar por un campo adicional (ej: consulta_id)
    consultasPorCliente[c.cliente_id].consultasSet.add(c.cliente_id);
    consultasPorCliente[c.cliente_id].totalSesiones++;
    
    // Verificar estado
    if (c.estado === 'Abierto') {
      consultasPorCliente[c.cliente_id].tieneAbierta = true;
    }
    if (c.estado === 'Cerrado') {
      consultasPorCliente[c.cliente_id].tieneCerrada = true;
    }
  });

  // Contar consultas únicas
  Object.keys(consultasPorCliente).forEach(clienteId => {
    consultasPorCliente[clienteId].totalConsultas = consultasPorCliente[clienteId].consultasSet.size;
    delete consultasPorCliente[clienteId].consultasSet; // Limpiar
  });

  // Convertir a array y ordenar por número de consultas
  const clientesArray = Object.entries(consultasPorCliente)
    .map(([id, data]) => ({ id: parseInt(id), ...data }))
    .sort((a, b) => b.totalConsultas - a.totalConsultas)
    .slice(0, 5);

  const tbody = document.getElementById("topClientesTable");
  
  if (clientesArray.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: #7f8c8d;">
          No hay datos de consultas disponibles
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = clientesArray.map((cliente, index) => {
    const position = index + 1;
    const positionClass = position <= 3 ? `position-${position}` : 'position-default';
    
    // Determinar el estado visual
    let estadoIndicador = '';
    if (cliente.tieneCerrada && !cliente.tieneAbierta) {
      // Todas cerradas
      estadoIndicador = '<span class="estado-indicator cerrado" title="Consulta cerrada">🔴</span>';
    } else if (cliente.tieneAbierta) {
      // Tiene al menos una abierta
      estadoIndicador = '<span class="estado-indicator abierto" title="Consulta abierta">🟢</span>';
    }
    
    return `
      <tr>
        <td>
          <span class="position-badge ${positionClass}">${position}</span>
        </td>
        <td>${cliente.cedula}</td>
        <td>${escapeHtml(cliente.nombre)}</td>
        <td>${escapeHtml(cliente.sede)}</td>
        <td>
          <div class="consultas-info">
            <strong>${cliente.totalConsultas}</strong>
            <span class="sesiones-count">(${cliente.totalSesiones} sesiones)</span>
            ${estadoIndicador}
          </div>
        </td>
        <td>
          <button class="btn-ver-cliente" onclick="verCliente(${cliente.id})">
            Ver →
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Cargar estadísticas por sede
async function loadSedesStats() {
  try {
    const clientes = datosOriginales.clientes;
    const clientesPorSede = {};
    
    clientes.forEach(c => {
      const sede = c.sede || "Sin sede";
      clientesPorSede[sede] = (clientesPorSede[sede] || 0) + 1;
    });

    const sedesArray = Object.entries(clientesPorSede)
      .map(([sede, count]) => ({ sede, count }))
      .sort((a, b) => b.count - a.count);

    const container = document.getElementById("sedesGrid");
    
    if (sedesArray.length === 0) {
      container.innerHTML = `
        <div class="loading-card">
          <p>No hay datos de sedes disponibles</p>
        </div>
      `;
      return;
    }

    container.innerHTML = sedesArray.map(s => `
      <div class="sede-card">
        <div class="sede-name">🏢 ${escapeHtml(s.sede)}</div>
        <h3 class="sede-count">${s.count}</h3>
        <p class="sede-label">Clientes</p>
      </div>
    `).join('');

  } catch (err) {
    console.error("Error cargando estadísticas de sedes:", err);
  }
}

// ============================================
// FUNCIONALIDAD DE FILTROS
// ============================================

document.getElementById("btnApplyFilters")?.addEventListener("click", async () => {
  const fechaInicio = document.getElementById("fechaInicio").value;
  const fechaFin = document.getElementById("fechaFin").value;

  if (!fechaInicio && !fechaFin) {
    alert("⚠️ Por favor selecciona al menos una fecha");
    return;
  }

  if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
    alert("⚠️ La fecha de inicio debe ser menor que la fecha fin");
    return;
  }

  fechaInicioFiltro = fechaInicio;
  fechaFinFiltro = fechaFin;

  const activeFilters = document.getElementById("activeFilters");
  const activeFilterText = document.getElementById("activeFilterText");
  
  let textoFiltro = "";
  if (fechaInicio && fechaFin) {
    textoFiltro = `Del ${formatDateDisplay(fechaInicio)} al ${formatDateDisplay(fechaFin)}`;
  } else if (fechaInicio) {
    textoFiltro = `Desde ${formatDateDisplay(fechaInicio)}`;
  } else if (fechaFin) {
    textoFiltro = `Hasta ${formatDateDisplay(fechaFin)}`;
  }
  
  activeFilterText.textContent = textoFiltro;
  activeFilters.style.display = "block";

  await aplicarFiltrosYMostrar();
});

document.getElementById("btnClearFilters")?.addEventListener("click", async () => {
  document.getElementById("fechaInicio").value = "";
  document.getElementById("fechaFin").value = "";
  fechaInicioFiltro = null;
  fechaFinFiltro = null;
  document.getElementById("activeFilters").style.display = "none";
  await aplicarFiltrosYMostrar();
});

function formatDateDisplay(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// ============================================
// FUNCIONALIDAD DE EXPORTAR
// ============================================

document.getElementById("btnExport")?.addEventListener("click", () => {
  document.getElementById("modalExport").classList.add("show");
});

document.getElementById("btnCloseModal")?.addEventListener("click", () => {
  document.getElementById("modalExport").classList.remove("show");
});

document.getElementById("btnCancelExport")?.addEventListener("click", () => {
  document.getElementById("modalExport").classList.remove("show");
});

document.getElementById("modalExport")?.addEventListener("click", (e) => {
  if (e.target.id === "modalExport") {
    document.getElementById("modalExport").classList.remove("show");
  }
});

window.exportarPDF = function() {
  try {
    const stats = {
      totalClientes: document.getElementById("totalClientes").textContent,
      totalConsultas: document.getElementById("totalConsultas").textContent,
      casosAbiertos: document.getElementById("casosAbiertos").textContent,
      casosCerrados: document.getElementById("casosCerrados").textContent,
      virtual: document.getElementById("virtualCount").textContent,
      presencial: document.getElementById("presencialCount").textContent,
      porcentajeAbiertos: document.getElementById("porcentajeAbiertos").textContent,
      porcentajeCerrados: document.getElementById("porcentajeCerrados").textContent
    };

    const contenido = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Estadísticas</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #2c3e50; text-align: center; }
          .fecha { text-align: center; color: #7f8c8d; margin-bottom: 30px; }
          .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
          .stat-card { border: 2px solid #e0e0e0; border-radius: 10px; padding: 20px; text-align: center; }
          .stat-label { font-size: 12px; color: #7f8c8d; text-transform: uppercase; }
          .stat-value { font-size: 32px; font-weight: bold; color: #2c3e50; margin: 10px 0; }
          .section { margin: 30px 0; }
          .section h2 { color: #2c3e50; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
          th { background: #f8f9fa; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>📊 Reporte de Estadísticas</h1>
        <p class="fecha">Generado el ${new Date().toLocaleString('es-ES')}</p>
        
        ${fechaInicioFiltro || fechaFinFiltro ? `
          <p class="fecha" style="background: #e8f5e9; padding: 10px; border-radius: 5px;">
            <strong>Filtro aplicado:</strong> 
            ${fechaInicioFiltro ? `Desde ${formatDateDisplay(fechaInicioFiltro)}` : ''} 
            ${fechaFinFiltro ? `Hasta ${formatDateDisplay(fechaFinFiltro)}` : ''}
          </p>
        ` : ''}
        
        <div class="stats-grid">
          <div class="stat-card">
            <p class="stat-label">Total Clientes</p>
            <p class="stat-value">${stats.totalClientes}</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Total Consultas</p>
            <p class="stat-value">${stats.totalConsultas}</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Casos Abiertos</p>
            <p class="stat-value">${stats.casosAbiertos}</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Casos Cerrados</p>
            <p class="stat-value">${stats.casosCerrados}</p>
          </div>
        </div>
        
        <div class="section">
          <h2>Consultas por Modalidad</h2>
          <table>
            <tr><th>Modalidad</th><th>Cantidad de Sesiones</th></tr>
            <tr><td>Virtual</td><td>${stats.virtual}</td></tr>
            <tr><td>Presencial</td><td>${stats.presencial}</td></tr>
          </table>
        </div>
        
        <div class="section">
          <h2>Estado de Casos</h2>
          <table>
            <tr><th>Estado</th><th>Porcentaje</th></tr>
            <tr><td>Abiertos</td><td>${stats.porcentajeAbiertos}</td></tr>
            <tr><td>Cerrados</td><td>${stats.porcentajeCerrados}</td></tr>
          </table>
        </div>
      </body>
      </html>
    `;

    const ventana = window.open('', '_blank');
    ventana.document.write(contenido);
    ventana.document.close();
    setTimeout(() => { ventana.print(); }, 500);
    document.getElementById("modalExport").classList.remove("show");
    
  } catch (err) {
    console.error("Error exportando PDF:", err);
    alert("❌ Error al exportar a PDF");
  }
};

window.exportarExcel = function() {
  try {
    let consultasFiltradas = [...datosOriginales.consultas];
    
    if (fechaInicioFiltro) {
      const fechaInicio = new Date(fechaInicioFiltro + 'T00:00:00');
      consultasFiltradas = consultasFiltradas.filter(c => 
        new Date(c.fecha) >= fechaInicio
      );
    }
    
    if (fechaFinFiltro) {
      const fechaFin = new Date(fechaFinFiltro + 'T23:59:59');
      consultasFiltradas = consultasFiltradas.filter(c => 
        new Date(c.fecha) <= fechaFin
      );
    }

    let csv = "ID,Cliente ID,Cédula,Nombre,Sede,Actividad,Modalidad,Fecha,Observaciones,Estado\n";
    
    consultasFiltradas.forEach(c => {
      const row = [
        c.id,
        c.cliente_id,
        c.cedula,
        `"${c.nombre}"`,
        `"${c.sede}"`,
        `"${c.actividad}"`,
        c.modalidad,
        c.fecha.split('T')[0],
        `"${c.columna1 || ''}"`,
        c.estado
      ].join(',');
      csv += row + '\n';
    });

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `consultas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    document.getElementById("modalExport").classList.remove("show");
    alert("✅ Archivo CSV descargado correctamente");
    
  } catch (err) {
    console.error("Error exportando Excel:", err);
    alert("❌ Error al exportar a Excel");
  }
};

window.exportarJSON = function() {
  try {
    // Calcular estadísticas correctamente para exportación
    const estadisticasExport = calcularEstadisticas(datosOriginales.consultas);
    
    const dataToExport = {
      fecha_generacion: new Date().toISOString(),
      filtros: {
        fecha_inicio: fechaInicioFiltro,
        fecha_fin: fechaFinFiltro
      },
      estadisticas: {
        total_clientes: datosOriginales.clientes.length,
        total_consultas: estadisticasExport.total_consultas,
        casos_abiertos: estadisticasExport.casos_abiertos,
        casos_cerrados: estadisticasExport.casos_cerrados,
        total_sesiones_virtuales: datosOriginales.consultas.filter(c => c.modalidad === 'Virtual').length,
        total_sesiones_presenciales: datosOriginales.consultas.filter(c => c.modalidad === 'Presencial').length
      },
      clientes: datosOriginales.clientes,
      consultas: datosOriginales.consultas
    };

    const json = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `datos_completos_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    document.getElementById("modalExport").classList.remove("show");
    alert("✅ Archivo JSON descargado correctamente");
    
  } catch (err) {
    console.error("Error exportando JSON:", err);
    alert("❌ Error al exportar a JSON");
  }
};

// ============================================
// UTILIDADES
// ============================================

window.verCliente = function(id) {
  window.location.href = `consulta.html?cliente=${id}`;
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.getElementById("btnBack")?.addEventListener("click", () => {
  window.location.href = "clientes.html";
});

document.getElementById("btnRefresh")?.addEventListener("click", () => {
  location.reload();
});

document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();
});