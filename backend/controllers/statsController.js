// backend/controllers/statsController.js

const pool = require("../config/db");

// Obtener estadísticas del dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    // Verificar que el usuario sea admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado - Se requieren permisos de administrador"
      });
    }
    
    console.log('📊 Iniciando carga de estadísticas...');
    console.log('Usuario:', req.user.nombre, '(', req.user.rol, ')');
    
    const { period = 'current', profesionalId = 'all', modalidad = 'all', startDate, endDate } = req.query;

    // Mapear código corto → texto completo que usa la BD en clients.modalidad
    const MODALIDAD_MAP = {
      'psicosocial': 'Orientación Psicosocial',
      'vigilancia':  'Sistema de Vigilancia Epidemiológica',
    };
    const modalidadBD = MODALIDAD_MAP[modalidad] || null; // null = todas

    console.log('Parámetros recibidos:', { period, profesionalId, modalidad, modalidadBD, startDate, endDate });
    
    // ==========================================
    // OBTENER TODOS LOS DATOS
    // ==========================================
    
    // 1. Obtener todos los clientes (filtrando por profesional y/o modalidad)
    let clientesWhere = [];
    let clientesParams = [];
    if (profesionalId && profesionalId !== 'all') {
      clientesParams.push(profesionalId);
      clientesWhere.push(`profesional_id = $${clientesParams.length}`);
    }
    if (modalidadBD) {
      clientesParams.push(modalidadBD);
      clientesWhere.push(`modalidad = $${clientesParams.length}`);
    }
    const clientesQuery = clientesWhere.length > 0
      ? `SELECT * FROM clients WHERE ${clientesWhere.join(' AND ')}`
      : `SELECT * FROM clients`;

    const clientesResult = await pool.query(clientesQuery, clientesParams);
    const todosLosClientes = clientesResult.rows;
    
    console.log('✅ Clientes obtenidos:', todosLosClientes.length);
    
    // 2. Obtener sesiones según modalidad seleccionada
    // - 'Orientación Psicosocial'              → solo tabla consultas
    // - 'Sistema de Vigilancia Epidemiológica' → solo tabla consultas_sve
    // - null (todas)                           → ambas tablas combinadas
    const clienteIds = todosLosClientes.map(c => c.id);

    async function fetchSesiones(tabla) {
      if (clienteIds.length === 0) return [];
      const placeholders = clienteIds.map((_, i) => `$${i + 1}`).join(',');
      const q = `SELECT c.*, cl.cedula, cl.nombre, cl.sede, cl.profesional_id,
                        cl.empresa_id, cl.contacto_emergencia_telefono
                 FROM ${tabla} c
                 INNER JOIN clients cl ON c.cliente_id = cl.id
                 WHERE c.cliente_id IN (${placeholders})`;
      const r = await pool.query(q, clienteIds);
      return r.rows;
    }

    let todasLasConsultas = [];
    if (!modalidadBD || modalidadBD === 'Orientación Psicosocial') {
      const ps = await fetchSesiones('consultas');
      todasLasConsultas = todasLasConsultas.concat(ps.map(s => ({ ...s, _src: 'ps' })));
    }
    if (!modalidadBD || modalidadBD === 'Sistema de Vigilancia Epidemiológica') {
      const sve = await fetchSesiones('consultas_sve');
      // Normalizar campos SVE que pueden no existir
      todasLasConsultas = todasLasConsultas.concat(sve.map(s => ({
        ...s,
        _src: 'sve',
        consulta_number:              s.consulta_number              ?? 1,
        motivo_consulta:              s.motivo_consulta              ?? null,
        observaciones_confidenciales: s.observaciones_confidenciales ?? false,
      })));
    }

    console.log('✅ Sesiones obtenidas:', todasLasConsultas.length, '| Fuente:', modalidadBD || 'ambas');
    
    // 3. Obtener profesionales y administradores
    let profesionalesResult;
    if (profesionalId && profesionalId !== 'all') {
      profesionalesResult = await pool.query(
        `SELECT id, nombre, rol FROM users WHERE (rol = 'profesional' OR rol = 'admin') AND activo = true AND id = $1`,
        [profesionalId]
      );
    } else {
      profesionalesResult = await pool.query(
        `SELECT id, nombre, rol FROM users WHERE (rol = 'profesional' OR rol = 'admin') AND activo = true ORDER BY rol DESC, nombre ASC`
      );
    }
    const profesionales = profesionalesResult.rows;
    
    console.log('✅ Profesionales y admins obtenidos:', profesionales.length);
    
    // 4. Obtener empresas
    const empresasResult = await pool.query('SELECT id, nombre_cliente FROM empresas');
    const empresas = empresasResult.rows;
    
    // ==========================================
    // FILTRAR POR FECHAS
    // ==========================================
    
    const now = new Date();
    let fechaInicio;
    let fechaFin;
    
    switch(period) {
      case 'current':
        fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last':
        fechaInicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        fechaFin = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last3':
        fechaInicio = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'last6':
        fechaInicio = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        break;
      case 'year':
        fechaInicio = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        if (startDate && endDate) {
          fechaInicio = new Date(startDate);
          fechaFin = new Date(endDate);
        } else {
          fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        break;
      default:
        fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    console.log('Fecha inicio:', fechaInicio);
    console.log('Fecha fin:', fechaFin || 'Sin límite');
    
    // Filtrar consultas por fecha
    const consultasFiltradas = todasLasConsultas.filter(c => {
      const fechaConsulta = new Date(c.fecha);
      if (fechaFin) {
        return fechaConsulta >= fechaInicio && fechaConsulta <= fechaFin;
      }
      return fechaConsulta >= fechaInicio;
    });
    
    console.log('✅ Consultas filtradas:', consultasFiltradas.length);
    
    // ==========================================
    // CALCULAR ESTADÍSTICAS
    // ==========================================
    
    // 1. RESUMEN GENERAL
    const consultasPorCliente = {};
    consultasFiltradas.forEach(c => {
      const key = `${c.cliente_id}-${c.motivo_consulta}`;
      if (!consultasPorCliente[key]) {
        consultasPorCliente[key] = {
          cliente_id: c.cliente_id,
          motivo: c.motivo_consulta,
          sesiones: [],
          estados: new Set()
        };
      }
      consultasPorCliente[key].sesiones.push(c);
      consultasPorCliente[key].estados.add(c.estado);
    });
    
    const totalConsultas = Object.keys(consultasPorCliente).length;
    const casosCerrados = Object.values(consultasPorCliente).filter(caso => 
      caso.estados.has('Cerrado')
    ).length;
    const casosAbiertos = totalConsultas - casosCerrados;
    const totalSesiones = consultasFiltradas.length;
    const casosCerradosPercent = totalConsultas > 0 
      ? Math.round((casosCerrados / totalConsultas) * 100) 
      : 0;
    
    // 2. MODALIDAD
    const virtual = consultasFiltradas.filter(c => c.modalidad === 'Virtual').length;
    const presencial = consultasFiltradas.filter(c => c.modalidad === 'Presencial').length;
    
    // 3. TOP MOTIVOS
    const motivosCount = {};
    Object.values(consultasPorCliente).forEach(caso => {
      const motivo = caso.motivo || 'Sin especificar';
      motivosCount[motivo] = (motivosCount[motivo] || 0) + 1;
    });
    
    const topMotivos = Object.entries(motivosCount)
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // 4. EVOLUCIÓN MENSUAL (últimos 6 meses)
    const evolucionPorMes = {};
    const fechaLimite = new Date();
    fechaLimite.setMonth(fechaLimite.getMonth() - 6);
    
    todasLasConsultas.forEach(c => {
      const fecha = new Date(c.fecha);
      if (fecha >= fechaLimite) {
        const mes = fecha.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
        evolucionPorMes[mes] = (evolucionPorMes[mes] || 0) + 1;
      }
    });
    
    const evolucionArray = Object.entries(evolucionPorMes)
      .map(([mes, count]) => ({ mes, count }));
    
    // 5. DISTRIBUCIÓN POR SEDE
    const sedesCount = {};
    const clientesConConsultas = new Set(consultasFiltradas.map(c => c.cliente_id));
    
    todosLosClientes.forEach(cl => {
      if (clientesConConsultas.has(cl.id)) {
        const sede = cl.sede || 'Sin sede';
        sedesCount[sede] = (sedesCount[sede] || 0) + 1;
      }
    });
    
    const sedesArray = Object.entries(sedesCount)
      .map(([sede, count]) => ({ sede, count }))
      .sort((a, b) => b.count - a.count);
    
    // 6. DISTRIBUCIÓN POR EMPRESA
    const empresasCount = {};
    const empresasMap = {};
    empresas.forEach(e => {
      empresasMap[e.id] = e.nombre_cliente;
    });
    
    todosLosClientes.forEach(cl => {
      if (clientesConConsultas.has(cl.id)) {
        const empresaNombre = empresasMap[cl.empresa_id] || 'Sin empresa';
        empresasCount[empresaNombre] = (empresasCount[empresaNombre] || 0) + 1;
      }
    });
    
    const empresasArray = Object.entries(empresasCount)
      .map(([empresa, count]) => ({ empresa, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // 7. DETALLE POR PROFESIONAL
    const detallePorProfesional = {};
    
    profesionales.forEach(prof => {
      detallePorProfesional[prof.id] = {
        nombre: prof.nombre,
        rol: prof.rol, // Guardar el rol para identificar admins
        trabajadores: todosLosClientes.filter(cl => cl.profesional_id === prof.id).length,
        consultas: new Set(),
        sesiones: 0,
        virtual: 0,
        presencial: 0,
        abiertos: new Set(),
        cerrados: new Set()
      };
    });
    
    consultasFiltradas.forEach(c => {
      const profId = c.profesional_id;
      if (detallePorProfesional[profId]) {
        const key = `${c.cliente_id}-${c.motivo_consulta}`;
        detallePorProfesional[profId].consultas.add(key);
        detallePorProfesional[profId].sesiones++;
        
        if (c.modalidad === 'Virtual') detallePorProfesional[profId].virtual++;
        if (c.modalidad === 'Presencial') detallePorProfesional[profId].presencial++;
        
        if (c.estado === 'Abierto') detallePorProfesional[profId].abiertos.add(key);
        if (c.estado === 'Cerrado') detallePorProfesional[profId].cerrados.add(key);
      }
    });
    
    const detalleProfesionales = Object.values(detallePorProfesional)
      .filter(prof => prof.sesiones > 0 || prof.trabajadores > 0)
      .map(prof => {
        const totalConsultas = prof.consultas.size;
        const totalSesiones = prof.sesiones;
        const virtualPercent = totalSesiones > 0 ? Math.round((prof.virtual / totalSesiones) * 100) : 0;
        const presencialPercent = totalSesiones > 0 ? Math.round((prof.presencial / totalSesiones) * 100) : 0;
        const promedioSesiones = totalConsultas > 0 ? (totalSesiones / totalConsultas).toFixed(1) : 0;
        
        return {
          nombre: prof.nombre,
          rol: prof.rol, // Incluir rol en la respuesta
          trabajadores: prof.trabajadores,
          consultas: totalConsultas,
          sesiones: totalSesiones,
          virtual: prof.virtual,
          virtualPercent,
          presencial: prof.presencial,
          presencialPercent,
          abiertos: prof.abiertos.size,
          cerrados: prof.cerrados.size,
          horas: totalSesiones,
          promedioSesiones: parseFloat(promedioSesiones)
        };
      })
      .sort((a, b) => b.consultas - a.consultas);
    
    // 8. INDICADORES DE CALIDAD
    const clientesUnicos = new Set(consultasFiltradas.map(c => c.cliente_id));
    const clientesConContacto = todosLosClientes.filter(cl => 
      clientesUnicos.has(cl.id) && 
      cl.contacto_emergencia_telefono && 
      cl.contacto_emergencia_telefono !== ''
    ).length;
    
    const contactoPercent = clientesUnicos.size > 0 
      ? Math.round((clientesConContacto / clientesUnicos.size) * 100) 
      : 0;
    
    // Tiempo promedio de casos cerrados
    let duraciones = [];
    Object.values(consultasPorCliente).forEach(caso => {
      if (caso.estados.has('Cerrado')) {
        const fechas = caso.sesiones.map(s => new Date(s.fecha)).sort((a, b) => a - b);
        if (fechas.length > 0) {
          const primera = fechas[0];
          const ultima = fechas[fechas.length - 1];
          const dias = Math.ceil((ultima - primera) / (1000 * 60 * 60 * 24));
          duraciones.push(dias);
        }
      }
    });
    
    const tiempoPromedio = duraciones.length > 0
      ? Math.ceil(duraciones.reduce((a, b) => a + b, 0) / duraciones.length)
      : 0;
    
    const sesionesPromedio = totalConsultas > 0 
      ? (totalSesiones / totalConsultas).toFixed(1) 
      : 0;
    
    // Sin seguimiento (casos abiertos sin sesiones en últimos 30 días)
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    
    const casosAbiertosArray = Object.values(consultasPorCliente).filter(caso => 
      !caso.estados.has('Cerrado')
    );
    
    const sinSeguimiento = casosAbiertosArray.filter(caso => {
      const ultimaSesion = caso.sesiones
        .map(s => new Date(s.fecha))
        .sort((a, b) => b - a)[0];
      return ultimaSesion < hace30Dias;
    }).length;
    
    // ==========================================
    // CONSTRUIR RESPUESTA
    // ==========================================
    
    const stats = {
      summary: {
        totalTrabajadores: todosLosClientes.length,
        trabajadoresMes: todosLosClientes.length,
        totalConsultas,
        consultasMes: totalConsultas,
        totalSesiones,
        sesionesMes: totalSesiones,
        totalHoras: totalSesiones,
        horasMes: totalSesiones,
        casosCerradosPercent,
        casosCerradosChange: 0
      },
      byProfesional: {
        labels: detalleProfesionales.map(p => p.rol === 'admin' ? `👑 ${p.nombre}` : p.nombre),
        values: detalleProfesionales.map(p => p.consultas)
      },
      modalidad: {
        virtual,
        presencial
      },
      topMotivos: {
        labels: topMotivos.map(m => m.motivo),
        values: topMotivos.map(m => m.count)
      },
      estados: {
        abiertos: casosAbiertos,
        cerrados: casosCerrados
      },
      evolucion: {
        labels: evolucionArray.map(e => e.mes),
        values: evolucionArray.map(e => e.count)
      },
      bySede: {
        labels: sedesArray.map(s => s.sede),
        values: sedesArray.map(s => s.count)
      },
      byEmpresa: {
        labels: empresasArray.map(e => e.empresa),
        values: empresasArray.map(e => e.count)
      },
      detalleProfesionales,
      calidad: {
        tiempoPromedio,
        sesionesPromedio: parseFloat(sesionesPromedio),
        contactoEmergencia: contactoPercent,
        sinSeguimiento
      }
    };
    
    console.log('✅ Estadísticas generadas exitosamente');
    
    res.json({
      success: true,
      stats
    });
    
  } catch (err) {
    console.error("❌ Error obteniendo estadísticas:");
    console.error("Mensaje:", err.message);
    console.error("Stack:", err.stack);
    
    res.status(500).json({ 
      success: false,
      message: "Error al obtener estadísticas",
      error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor'
    });
  }
};