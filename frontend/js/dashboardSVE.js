// frontend/js/dashboardSVE.js - Dashboard Sistema de Vigilancia Epidemiológica

const CONSULTAS_SVE_API = window.API_CONFIG.ENDPOINTS.CONSULTAS_SVE;

// Variables globales para los gráficos
let chartModalidad = null;
let chartEstadoCasos = null;
let chartCriteriosInclusion = null;
let chartEvolucionTemporal = null;

// Función para obtener el token de autenticación
function getAuthToken() {
  return localStorage.getItem("authToken");
}

// ============================================
// CARGAR DATOS DEL DASHBOARD
// ============================================
async function cargarDashboardSVE() {
  try {
    mostrarCargando(true);

    // 1. Cargar estadísticas generales
    const resEstadisticas = await fetch(`${CONSULTAS_SVE_API}/dashboard/estadisticas`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (!resEstadisticas.ok) {
      throw new Error("Error al cargar estadísticas SVE");
    }

    const estadisticas = await resEstadisticas.json();
    console.log('📊 Estadísticas SVE COMPLETAS:', estadisticas);

    // 2. Cargar datos de criterios de inclusión
    const resCriterios = await fetch(`${CONSULTAS_SVE_API}/dashboard/criterios-inclusion`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (!resCriterios.ok) {
      throw new Error("Error al cargar criterios de inclusión");
    }

    const criterios = await resCriterios.json();
    console.log('🩺 Criterios de Inclusión:', criterios);

    // 3. Cargar evolución temporal
    const resEvolucion = await fetch(`${CONSULTAS_SVE_API}/dashboard/evolucion`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (!resEvolucion.ok) {
      throw new Error("Error al cargar evolución temporal");
    }

    const evolucion = await resEvolucion.json();
    console.log('📅 Evolución Temporal:', evolucion);

    // 4. Renderizar datos
    renderizarEstadisticas(estadisticas);
    renderizarGraficoModalidad(estadisticas);
    renderizarGraficoEstadoCasos(estadisticas);
    renderizarGraficoCriteriosInclusion(criterios);
    renderizarGraficoEvolucionTemporal(evolucion);

    mostrarCargando(false);
    document.getElementById('dashboardContent').style.display = 'block';

  } catch (err) {
    console.error('❌ Error cargando Dashboard SVE:', err);
    alert('❌ Error al cargar el Dashboard SVE: ' + err.message);
    mostrarCargando(false);
  }
}

// ============================================
// MOSTRAR/OCULTAR INDICADOR DE CARGA
// ============================================
function mostrarCargando(mostrar) {
  const loadingIndicator = document.getElementById('loadingIndicator');
  const dashboardContent = document.getElementById('dashboardContent');
  
  if (mostrar) {
    loadingIndicator.style.display = 'block';
    dashboardContent.style.display = 'none';
  } else {
    loadingIndicator.style.display = 'none';
  }
}

// ============================================
// RENDERIZAR ESTADÍSTICAS EN CARDS
// ============================================
function renderizarEstadisticas(stats) {
  // Estadísticas principales
  document.getElementById('statTotalCasos').textContent = formatNumber(stats.total_casos_sve || 0);
  document.getElementById('statCasosNuevosMes').textContent = formatNumber(stats.casos_nuevos_mes || 0);
  document.getElementById('statCasosAbiertos').textContent = formatNumber(stats.casos_abiertos || 0);
  document.getElementById('statCasosCerrados').textContent = formatNumber(stats.casos_cerrados || 0);
  
  // Total sesiones SVE
  document.getElementById('statTotalConsultas').textContent = formatNumber(stats.total_sesiones_sve || 0);
  document.getElementById('statConsultasMes').textContent = formatNumber(stats.consultas_mes_actual || 0);
  document.getElementById('statPromedioConsultas').textContent = stats.promedio_consultas_por_caso || '0';
  document.getElementById('statTasaCierre').textContent = (stats.tasa_cierre || 0) + '%';
  
  // Indicadores de trabajadores
  document.getElementById('statTrabajadoresSeguimiento').textContent = formatNumber(stats.trabajadores_seguimiento_activo || 0);
  document.getElementById('statTrabajadoresCerrados').textContent = formatNumber(stats.trabajadores_casos_cerrados || 0);
  document.getElementById('statConsultasVirtuales').textContent = formatNumber(stats.consultas_virtuales || 0);
}

// ============================================
// GRÁFICO: MODALIDAD DE CONSULTAS (PIE)
// ✅ CORREGIDO: Conversión explícita a números
// ============================================
function renderizarGraficoModalidad(stats) {
  const ctx = document.getElementById('chartModalidad');
  
  // Destruir gráfico anterior si existe
  if (chartModalidad) {
    chartModalidad.destroy();
  }
  
  // ✅ CONVERSIÓN EXPLÍCITA A NÚMEROS con parseInt
  const virtual = parseInt(stats.consultas_virtuales) || 0;
  const presencial = parseInt(stats.consultas_presenciales) || 0;
  const total = virtual + presencial;
  
  console.log('═══════════════════════════════════════');
  console.log('📊 GRÁFICO MODALIDAD - DEBUG');
  console.log('═══════════════════════════════════════');
  console.log('stats.consultas_virtuales (RAW):', stats.consultas_virtuales, 'tipo:', typeof stats.consultas_virtuales);
  console.log('stats.consultas_presenciales (RAW):', stats.consultas_presenciales, 'tipo:', typeof stats.consultas_presenciales);
  console.log('Virtual (parseado):', virtual, 'tipo:', typeof virtual);
  console.log('Presencial (parseado):', presencial, 'tipo:', typeof presencial);
  console.log('Total sesiones:', total);
  console.log('Porcentaje Virtual:', total > 0 ? ((virtual / total) * 100).toFixed(1) + '%' : '0%');
  console.log('Porcentaje Presencial:', total > 0 ? ((presencial / total) * 100).toFixed(1) + '%' : '0%');
  console.log('═══════════════════════════════════════');
  
  chartModalidad = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Virtual', 'Presencial'],
      datasets: [{
        data: [virtual, presencial],
        backgroundColor: [
          'rgba(33, 150, 243, 0.8)',
          'rgba(76, 175, 80, 0.8)'
        ],
        borderColor: [
          'rgba(33, 150, 243, 1)',
          'rgba(76, 175, 80, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: {
              size: 13,
              weight: 'bold'
            },
            generateLabels: function(chart) {
              const data = chart.data;
              console.log('🔍 GenerateLabels MODALIDAD - data:', data);
              
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label, i) => {
                  const value = data.datasets[0].data[i];
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                  
                  console.log(`  → ${label}: ${value} (${percentage}%)`);
                  
                  return {
                    text: `${label}: ${value} (${percentage}%)`,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label}: ${value} sesiones (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// ============================================
// GRÁFICO: ESTADO DE CASOS (DONA)
// ✅ CORREGIDO: Conversión explícita a números
// ============================================
function renderizarGraficoEstadoCasos(stats) {
  const ctx = document.getElementById('chartEstadoCasos');
  
  if (chartEstadoCasos) {
    chartEstadoCasos.destroy();
  }
  
  // ✅ CONVERSIÓN EXPLÍCITA A NÚMEROS con parseInt
  const abiertos = parseInt(stats.casos_abiertos) || 0;
  const cerrados = parseInt(stats.casos_cerrados) || 0;
  const total = abiertos + cerrados;
  
  console.log('═══════════════════════════════════════');
  console.log('📊 GRÁFICO ESTADO DE CASOS - DEBUG');
  console.log('═══════════════════════════════════════');
  console.log('stats.casos_abiertos (RAW):', stats.casos_abiertos, 'tipo:', typeof stats.casos_abiertos);
  console.log('stats.casos_cerrados (RAW):', stats.casos_cerrados, 'tipo:', typeof stats.casos_cerrados);
  console.log('Abiertos (parseado):', abiertos, 'tipo:', typeof abiertos);
  console.log('Cerrados (parseado):', cerrados, 'tipo:', typeof cerrados);
  console.log('Total casos:', total);
  console.log('Porcentaje Abiertos:', total > 0 ? ((abiertos / total) * 100).toFixed(1) + '%' : '0%');
  console.log('Porcentaje Cerrados:', total > 0 ? ((cerrados / total) * 100).toFixed(1) + '%' : '0%');
  console.log('═══════════════════════════════════════');
  
  chartEstadoCasos = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Abiertos', 'Cerrados'],
      datasets: [{
        data: [abiertos, cerrados],
        backgroundColor: [
          'rgba(255, 152, 0, 0.8)',
          'rgba(156, 39, 176, 0.8)'
        ],
        borderColor: [
          'rgba(255, 152, 0, 1)',
          'rgba(156, 39, 176, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: {
              size: 13,
              weight: 'bold'
            },
            generateLabels: function(chart) {
              const data = chart.data;
              console.log('🔍 GenerateLabels ESTADO - data:', data);
              
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label, i) => {
                  const value = data.datasets[0].data[i];
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                  
                  console.log(`  → ${label}: ${value} (${percentage}%)`);
                  
                  return {
                    text: `${label}: ${value} (${percentage}%)`,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label}: ${value} casos (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// ============================================
// GRÁFICO: CRITERIOS DE INCLUSIÓN (BAR HORIZONTAL)
// ============================================
function renderizarGraficoCriteriosInclusion(criterios) {
  const ctx = document.getElementById('chartCriteriosInclusion');
  
  if (chartCriteriosInclusion) {
    chartCriteriosInclusion.destroy();
  }
  
  // Ordenar por cantidad descendente y tomar los top 10
  const criteriosOrdenados = criterios
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);
  
  // Acortar etiquetas largas
  const labels = criteriosOrdenados.map(c => {
    const texto = c.criterio_inclusion;
    return texto.length > 50 ? texto.substring(0, 50) + '...' : texto;
  });
  
  const datos = criteriosOrdenados.map(c => c.cantidad);
  
  // Generar colores degradados
  const colores = criteriosOrdenados.map((_, index) => {
    const hue = 120 - (index * 12); // De verde a amarillo
    return `hsla(${hue}, 70%, 50%, 0.8)`;
  });
  
  chartCriteriosInclusion = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Cantidad de Casos',
        data: datos,
        backgroundColor: colores,
        borderColor: colores.map(c => c.replace('0.8', '1')),
        borderWidth: 2
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
          callbacks: {
            title: function(context) {
              const index = context[0].dataIndex;
              return criteriosOrdenados[index].criterio_inclusion;
            },
            label: function(context) {
              const index = context.dataIndex;
              const cantidad = context.parsed.x;
              const porcentaje = criteriosOrdenados[index].porcentaje;
              return `Casos: ${cantidad} (${porcentaje}%)`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            precision: 0
          },
          title: {
            display: true,
            text: 'Cantidad de Casos',
            font: {
              weight: 'bold'
            }
          }
        },
        y: {
          ticks: {
            font: {
              size: 11
            }
          }
        }
      }
    }
  });
}

// ============================================
// GRÁFICO: EVOLUCIÓN TEMPORAL (LINE)
// ============================================
function renderizarGraficoEvolucionTemporal(evolucion) {
  const ctx = document.getElementById('chartEvolucionTemporal');
  
  if (chartEvolucionTemporal) {
    chartEvolucionTemporal.destroy();
  }
  
  // Formatear etiquetas de meses
  const labels = evolucion.map(e => {
    const [year, month] = e.mes.split('-');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${meses[parseInt(month) - 1]} ${year}`;
  });
  
  const totales = evolucion.map(e => parseInt(e.total_consultas));
  const virtuales = evolucion.map(e => parseInt(e.virtuales));
  const presenciales = evolucion.map(e => parseInt(e.presenciales));
  
  chartEvolucionTemporal = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Total Consultas',
          data: totales,
          borderColor: 'rgba(86, 171, 47, 1)',
          backgroundColor: 'rgba(86, 171, 47, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: 'Virtual',
          data: virtuales,
          borderColor: 'rgba(33, 150, 243, 1)',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Presencial',
          data: presenciales,
          borderColor: 'rgba(76, 175, 80, 1)',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            padding: 15,
            font: {
              size: 13,
              weight: 'bold'
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y} consultas`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          },
          title: {
            display: true,
            text: 'Cantidad de Consultas',
            font: {
              weight: 'bold'
            }
          }
        },
        x: {
          title: {
            display: true,
            text: 'Mes',
            font: {
              weight: 'bold'
            }
          }
        }
      }
    }
  });
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ============================================
// EVENTOS
// ============================================
document.getElementById('btnRefreshDashboard')?.addEventListener('click', () => {
  cargarDashboardSVE();
});

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  cargarDashboardSVE();
});

console.log('✅ dashboardSVE.js cargado correctamente');