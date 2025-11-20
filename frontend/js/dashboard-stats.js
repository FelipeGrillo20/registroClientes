// frontend/js/dashboard-stats.js
// Script para el cuadro de mando administrativo

(function() {
  const API_URL = window.API_CONFIG.BASE_URL + "/api";
  
  // Variables globales
  let chartsInstances = {};
  let currentFilters = {
    period: 'current',
    profesional: 'all',
    startDate: null,
    endDate: null
  };
  
  // Elementos del DOM
  const btnBack = document.getElementById("btnBack");
  const btnApplyFilters = document.getElementById("btnApplyFilters");
  const btnExport = document.getElementById("btnExport");
  const filterMonth = document.getElementById("filterMonth");
  const filterProfesional = document.getElementById("filterProfesional");
  const customDateGroup = document.getElementById("customDateGroup");
  const startDate = document.getElementById("startDate");
  const endDate = document.getElementById("endDate");
  const loadingStats = document.getElementById("loadingStats");
  
  // ============================================
  // INICIALIZACIÓN
  // ============================================
  
  function init() {
    verificarAccesoAdmin();
    configurarEventos();
    cargarProfesionales();
    cargarEstadisticas();
  }
  
  // ============================================
  // VERIFICAR ACCESO ADMIN
  // ============================================
  
  function verificarAccesoAdmin() {
    const userData = getUserData();
    
    if (!userData || userData.rol !== 'admin') {
      mostrarMensaje("Acceso denegado. Solo administradores pueden ver esta página.", "error");
      setTimeout(() => {
        window.location.href = "perfil.html";
      }, 2000);
    }
  }
  
  // ============================================
  // CONFIGURAR EVENTOS
  // ============================================
  
  function configurarEventos() {
    // Botón volver
    if (btnBack) {
      btnBack.addEventListener("click", () => {
        window.location.href = "perfil.html";
      });
    }
    
    // Filtro de mes
    if (filterMonth) {
      filterMonth.addEventListener("change", (e) => {
        if (e.target.value === 'custom') {
          customDateGroup.style.display = 'flex';
        } else {
          customDateGroup.style.display = 'none';
        }
        currentFilters.period = e.target.value;
      });
    }
    
    // Filtro de profesional
    if (filterProfesional) {
      filterProfesional.addEventListener("change", (e) => {
        currentFilters.profesional = e.target.value;
      });
    }
    
    // Aplicar filtros
    if (btnApplyFilters) {
      btnApplyFilters.addEventListener("click", () => {
        if (filterMonth.value === 'custom') {
          if (!startDate.value || !endDate.value) {
            mostrarMensaje("Por favor selecciona ambas fechas", "error");
            return;
          }
          currentFilters.startDate = startDate.value;
          currentFilters.endDate = endDate.value;
        }
        cargarEstadisticas();
      });
    }
    
    // Exportar PDF
    if (btnExport) {
      btnExport.addEventListener("click", exportarPDF);
    }
  }
  
  // ============================================
  // CARGAR PROFESIONALES
  // ============================================
  
  async function cargarProfesionales() {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Error al cargar profesionales');
      
      const data = await response.json();
      
      if (data.success && data.users) {
        const profesionales = data.users.filter(u => u.rol === 'profesional' && u.activo);
        
        // Llenar select de profesionales
        const select = filterProfesional;
        select.innerHTML = '<option value="all">Todos los Profesionales</option>';
        
        profesionales.forEach(prof => {
          const option = document.createElement('option');
          option.value = prof.id;
          option.textContent = prof.nombre;
          select.appendChild(option);
        });
      }
      
    } catch (error) {
      console.error('Error cargando profesionales:', error);
    }
  }
  
  // ============================================
  // CARGAR ESTADÍSTICAS
  // ============================================
  
  async function cargarEstadisticas() {
    mostrarLoading(true);
    
    try {
      const token = getAuthToken();
      
      // Construir parámetros de consulta
      const params = new URLSearchParams({
        period: currentFilters.period,
        profesionalId: currentFilters.profesional
      });
      
      if (currentFilters.period === 'custom' && currentFilters.startDate && currentFilters.endDate) {
        params.append('startDate', currentFilters.startDate);
        params.append('endDate', currentFilters.endDate);
      }
      
      const response = await fetch(`${API_URL}/stats/dashboard?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Error al cargar estadísticas');
      
      const data = await response.json();
      
      if (data.success) {
        renderizarEstadisticas(data.stats);
      }
      
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      mostrarMensaje('Error al cargar las estadísticas', 'error');
    } finally {
      mostrarLoading(false);
    }
  }
  
  // ============================================
  // RENDERIZAR ESTADÍSTICAS
  // ============================================
  
  function renderizarEstadisticas(stats) {
    // Tarjetas de resumen
    actualizarTarjetasResumen(stats.summary);
    
    // Gráficos
    renderizarGraficoProfesionales(stats.byProfesional);
    renderizarGraficoModalidad(stats.modalidad);
    renderizarGraficoMotivos(stats.topMotivos);
    renderizarGraficoEstados(stats.estados);
    renderizarGraficoEvolucion(stats.evolucion);
    renderizarGraficoSedes(stats.bySede);
    renderizarGraficoEmpresas(stats.byEmpresa);
    
    // Tabla de profesionales
    renderizarTablaProfesionales(stats.detalleProfesionales);
    
    // Indicadores de calidad
    actualizarIndicadoresCalidad(stats.calidad);
  }
  
  // ============================================
  // ACTUALIZAR TARJETAS DE RESUMEN
  // ============================================
  
  function actualizarTarjetasResumen(summary) {
    document.getElementById('totalWorkers').textContent = summary.totalTrabajadores || 0;
    document.getElementById('workersChange').textContent = `+${summary.trabajadoresMes || 0} este mes`;
    
    document.getElementById('totalConsultas').textContent = summary.totalConsultas || 0;
    document.getElementById('consultasChange').textContent = `+${summary.consultasMes || 0} este mes`;
    
    document.getElementById('totalSesiones').textContent = summary.totalSesiones || 0;
    document.getElementById('sesionesChange').textContent = `+${summary.sesionesMes || 0} este mes`;
    
    document.getElementById('totalHours').textContent = `${summary.totalHoras || 0}h`;
    document.getElementById('hoursChange').textContent = `+${summary.horasMes || 0}h este mes`;
    
    document.getElementById('casosCerradosPercent').textContent = `${summary.casosCerradosPercent || 0}%`;
    document.getElementById('casosCerradosChange').textContent = `${summary.casosCerradosChange || 0}% vs mes ant.`;
  }
  
  // ============================================
  // GRÁFICO: CONSULTAS POR PROFESIONAL
  // ============================================
  
  function renderizarGraficoProfesionales(data) {
    const ctx = document.getElementById('chartProfesionales');
    
    // Destruir gráfico anterior si existe
    if (chartsInstances.profesionales) {
      chartsInstances.profesionales.destroy();
    }
    
    chartsInstances.profesionales = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Consultas',
          data: data.values,
          backgroundColor: 'rgba(52, 152, 219, 0.7)',
          borderColor: 'rgba(52, 152, 219, 1)',
          borderWidth: 2,
          borderRadius: 8,
          barPercentage: data.labels.length === 1 ? 0.3 : 0.7, // Barra más angosta si solo hay un dato
          categoryPercentage: data.labels.length === 1 ? 0.4 : 0.8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }
  
  // ============================================
  // GRÁFICO: MODALIDAD DE ATENCIÓN
  // ============================================
  
  function renderizarGraficoModalidad(data) {
    const ctx = document.getElementById('chartModalidad');
    
    if (chartsInstances.modalidad) {
      chartsInstances.modalidad.destroy();
    }
    
    const total = data.virtual + data.presencial;
    const virtualPercent = total > 0 ? Math.round((data.virtual / total) * 100) : 0;
    const presencialPercent = total > 0 ? Math.round((data.presencial / total) * 100) : 0;
    
    chartsInstances.modalidad = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Virtual', 'Presencial'],
        datasets: [{
          data: [data.virtual, data.presencial],
          backgroundColor: [
            'rgba(52, 152, 219, 0.8)',
            'rgba(230, 126, 34, 0.8)'
          ],
          borderColor: [
            'rgba(52, 152, 219, 1)',
            'rgba(230, 126, 34, 1)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
    
    // Mostrar datos debajo del gráfico
    const dataContainer = document.getElementById('modalidadData');
    if (dataContainer) {
      dataContainer.innerHTML = `
        <div class="chart-data-item">
          <div class="chart-data-color" style="background: rgba(52, 152, 219, 0.8);"></div>
          <span class="chart-data-label">Virtual:</span>
          <span class="chart-data-value">${data.virtual} (${virtualPercent}%)</span>
        </div>
        <div class="chart-data-item">
          <div class="chart-data-color" style="background: rgba(230, 126, 34, 0.8);"></div>
          <span class="chart-data-label">Presencial:</span>
          <span class="chart-data-value">${data.presencial} (${presencialPercent}%)</span>
        </div>
      `;
    }
  }
  
  // ============================================
  // GRÁFICO: TOP MOTIVOS DE CONSULTA
  // ============================================
  
  function renderizarGraficoMotivos(data) {
    const ctx = document.getElementById('chartMotivos');
    
    if (chartsInstances.motivos) {
      chartsInstances.motivos.destroy();
    }
    
    chartsInstances.motivos = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Cantidad',
          data: data.values,
          backgroundColor: 'rgba(155, 89, 182, 0.7)',
          borderColor: 'rgba(155, 89, 182, 1)',
          borderWidth: 2,
          borderRadius: 8,
          barPercentage: data.labels.length <= 2 ? 0.4 : 0.7, // Ajustar según cantidad de datos
          categoryPercentage: data.labels.length <= 2 ? 0.5 : 0.8
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          y: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }
  
  // ============================================
  // GRÁFICO: ESTADO DE CASOS
  // ============================================
  
  function renderizarGraficoEstados(data) {
    const ctx = document.getElementById('chartEstados');
    
    if (chartsInstances.estados) {
      chartsInstances.estados.destroy();
    }
    
    const total = data.abiertos + data.cerrados;
    const abiertosPercent = total > 0 ? Math.round((data.abiertos / total) * 100) : 0;
    const cerradosPercent = total > 0 ? Math.round((data.cerrados / total) * 100) : 0;
    
    chartsInstances.estados = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Abiertos', 'Cerrados'],
        datasets: [{
          data: [data.abiertos, data.cerrados],
          backgroundColor: [
            'rgba(241, 196, 15, 0.8)',
            'rgba(39, 174, 96, 0.8)'
          ],
          borderColor: [
            'rgba(241, 196, 15, 1)',
            'rgba(39, 174, 96, 1)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
    
    // Mostrar datos debajo del gráfico
    const dataContainer = document.getElementById('estadosData');
    if (dataContainer) {
      dataContainer.innerHTML = `
        <div class="chart-data-item">
          <div class="chart-data-color" style="background: rgba(241, 196, 15, 0.8);"></div>
          <span class="chart-data-label">Abiertos:</span>
          <span class="chart-data-value">${data.abiertos} (${abiertosPercent}%)</span>
        </div>
        <div class="chart-data-item">
          <div class="chart-data-color" style="background: rgba(39, 174, 96, 0.8);"></div>
          <span class="chart-data-label">Cerrados:</span>
          <span class="chart-data-value">${data.cerrados} (${cerradosPercent}%)</span>
        </div>
      `;
    }
  }
  
  // ============================================
  // GRÁFICO: EVOLUCIÓN MENSUAL
  // ============================================
  
  function renderizarGraficoEvolucion(data) {
    const ctx = document.getElementById('chartEvolucion');
    
    if (chartsInstances.evolucion) {
      chartsInstances.evolucion.destroy();
    }
    
    chartsInstances.evolucion = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Consultas',
          data: data.values,
          borderColor: 'rgba(52, 152, 219, 1)',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgba(52, 152, 219, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 5
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }
  
  // ============================================
  // GRÁFICO: DISTRIBUCIÓN POR SEDE
  // ============================================
  
  function renderizarGraficoSedes(data) {
    const ctx = document.getElementById('chartSedes');
    
    if (chartsInstances.sedes) {
      chartsInstances.sedes.destroy();
    }
    
    const colores = [
      'rgba(52, 152, 219, 0.8)',
      'rgba(46, 204, 113, 0.8)',
      'rgba(155, 89, 182, 0.8)',
      'rgba(230, 126, 34, 0.8)',
      'rgba(231, 76, 60, 0.8)',
      'rgba(26, 188, 156, 0.8)',
      'rgba(52, 73, 94, 0.8)',
      'rgba(241, 196, 15, 0.8)'
    ];
    
    chartsInstances.sedes = new Chart(ctx, {
      type: 'doughnut', // ⭐ Cambiado de 'pie' a 'doughnut' para consistencia
      data: {
        labels: data.labels,
        datasets: [{
          data: data.values,
          backgroundColor: colores.slice(0, data.labels.length),
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
    
    // ⭐ Mostrar datos debajo del gráfico
    const total = data.values.reduce((a, b) => a + b, 0);
    const dataContainer = document.getElementById('sedesData');
    
    console.log('📊 Renderizando datos de sedes:', data);
    console.log('📦 Contenedor sedesData:', dataContainer);
    
    if (dataContainer) {
      const htmlContent = data.labels.map((label, index) => {
        const value = data.values[index];
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;
        return `
          <div class="chart-data-item">
            <div class="chart-data-color" style="background: ${colores[index]};"></div>
            <span class="chart-data-label">${label}:</span>
            <span class="chart-data-value">${value} (${percent}%)</span>
          </div>
        `;
      }).join('');
      
      dataContainer.innerHTML = htmlContent;
      console.log('✅ Datos de sedes renderizados correctamente');
    } else {
      console.error('❌ No se encontró el contenedor sedesData');
    }
  }
  
  // ============================================
  // GRÁFICO: DISTRIBUCIÓN POR EMPRESA
  // ============================================
  
  function renderizarGraficoEmpresas(data) {
    const ctx = document.getElementById('chartEmpresas');
    
    if (chartsInstances.empresas) {
      chartsInstances.empresas.destroy();
    }
    
    chartsInstances.empresas = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Trabajadores',
          data: data.values,
          backgroundColor: 'rgba(39, 174, 96, 0.7)',
          borderColor: 'rgba(39, 174, 96, 1)',
          borderWidth: 2,
          borderRadius: 8,
          barPercentage: data.labels.length <= 2 ? 0.4 : 0.7, // Ajustar según cantidad de datos
          categoryPercentage: data.labels.length <= 2 ? 0.5 : 0.8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }
  
  // ============================================
  // TABLA DE PROFESIONALES
  // ============================================
  
  function renderizarTablaProfesionales(profesionales) {
    const tbody = document.getElementById('tableProfesionalesBody');
    const tfoot = document.getElementById('tableProfesionalesFooter');
    
    if (!profesionales || profesionales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px;">No hay datos disponibles</td></tr>';
      tfoot.innerHTML = '';
      return;
    }
    
    // Calcular totales
    const totales = profesionales.reduce((acc, prof) => {
      acc.trabajadores += prof.trabajadores || 0;
      acc.consultas += prof.consultas || 0;
      acc.sesiones += prof.sesiones || 0;
      acc.virtual += prof.virtual || 0;
      acc.presencial += prof.presencial || 0;
      acc.abiertos += prof.abiertos || 0;
      acc.cerrados += prof.cerrados || 0;
      acc.horas += prof.horas || 0;
      return acc;
    }, {
      trabajadores: 0,
      consultas: 0,
      sesiones: 0,
      virtual: 0,
      presencial: 0,
      abiertos: 0,
      cerrados: 0,
      horas: 0
    });
    
    const promedioSesiones = totales.consultas > 0 
      ? (totales.sesiones / totales.consultas).toFixed(1) 
      : 0;
    
    // Renderizar filas
    tbody.innerHTML = profesionales.map(prof => `
      <tr>
        <td><strong>${prof.nombre}</strong></td>
        <td>${prof.trabajadores || 0}</td>
        <td>${prof.consultas || 0}</td>
        <td>${prof.sesiones || 0}</td>
        <td>${prof.virtual || 0} (${prof.virtualPercent || 0}%)</td>
        <td>${prof.presencial || 0} (${prof.presencialPercent || 0}%)</td>
        <td>${prof.abiertos || 0}</td>
        <td>${prof.cerrados || 0}</td>
        <td>${prof.horas || 0}h</td>
        <td>${prof.promedioSesiones || 0}</td>
      </tr>
    `).join('');
    
    // Renderizar totales
    tfoot.innerHTML = `
      <tr>
        <td><strong>TOTAL</strong></td>
        <td><strong>${totales.trabajadores}</strong></td>
        <td><strong>${totales.consultas}</strong></td>
        <td><strong>${totales.sesiones}</strong></td>
        <td><strong>${totales.virtual}</strong></td>
        <td><strong>${totales.presencial}</strong></td>
        <td><strong>${totales.abiertos}</strong></td>
        <td><strong>${totales.cerrados}</strong></td>
        <td><strong>${totales.horas}h</strong></td>
        <td><strong>${promedioSesiones}</strong></td>
      </tr>
    `;
  }
  
  // ============================================
  // INDICADORES DE CALIDAD
  // ============================================
  
  function actualizarIndicadoresCalidad(calidad) {
    document.getElementById('avgDuration').textContent = `${calidad.tiempoPromedio || 0} días`;
    document.getElementById('avgSessions').textContent = calidad.sesionesPromedio || 0;
    document.getElementById('emergencyContact').textContent = `${calidad.contactoEmergencia || 0}%`;
    document.getElementById('noFollowup').textContent = calidad.sinSeguimiento || 0;
  }
  
  // ============================================
  // EXPORTAR PDF
  // ============================================
  
  function exportarPDF() {
    mostrarMensaje("Función de exportación en desarrollo", "info");
    // Aquí puedes implementar la exportación usando librerías como jsPDF o html2pdf
  }
  
  // ============================================
  // MOSTRAR/OCULTAR LOADING
  // ============================================
  
  function mostrarLoading(show) {
    if (loadingStats) {
      loadingStats.style.display = show ? 'flex' : 'none';
    }
  }
  
  // ============================================
  // UTILIDADES
  // ============================================
  
  function getUserData() {
    const userData = localStorage.getItem("userData");
    return userData ? JSON.parse(userData) : null;
  }
  
  function getAuthToken() {
    return localStorage.getItem("authToken");
  }
  
  function mostrarMensaje(mensaje, tipo = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${tipo}`;
    notification.textContent = mensaje;
    
    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "16px 24px",
      borderRadius: "12px",
      color: "white",
      fontWeight: "600",
      fontSize: "14px",
      zIndex: "10001",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      animation: "slideInRight 0.3s ease",
      maxWidth: "400px"
    });
    
    if (tipo === "success") {
      notification.style.background = "linear-gradient(135deg, #27ae60, #229954)";
    } else if (tipo === "error") {
      notification.style.background = "linear-gradient(135deg, #e74c3c, #c0392b)";
    } else {
      notification.style.background = "linear-gradient(135deg, #3498db, #2980b9)";
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = "slideOutRight 0.3s ease";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 4000);
  }
  
  // ============================================
  // EJECUTAR AL CARGAR
  // ============================================
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();