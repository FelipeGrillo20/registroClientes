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
    
    const { period, profesionalId, startDate, endDate } = req.query;
    
    // Construir filtro de fechas según el periodo
    let dateFilter = '';
    let dateParams = [];
    
    if (period === 'custom' && startDate && endDate) {
      dateFilter = 'AND fecha BETWEEN $1 AND $2';
      dateParams = [startDate, endDate];
    } else {
      const now = new Date();
      let start = new Date();
      
      switch(period) {
        case 'current':
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'last':
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
          dateFilter = 'AND fecha BETWEEN $1 AND $2';
          dateParams = [start.toISOString().split('T')[0], lastMonthEnd.toISOString().split('T')[0]];
          break;
        case 'last3':
          start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        case 'last6':
          start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          break;
        case 'year':
          start = new Date(now.getFullYear(), 0, 1);
          break;
      }
      
      if (dateFilter === '') {
        dateFilter = 'AND fecha >= $1';
        dateParams = [start.toISOString().split('T')[0]];
      }
    }
    
    // Filtro de profesional
    let profesionalFilter = '';
    if (profesionalId && profesionalId !== 'all') {
      profesionalFilter = `AND cl.profesional_id = ${profesionalId}`;
    }
    
    // 1. RESUMEN GENERAL
    // ⭐ CORREGIDO: Contar total de trabajadores desde la tabla clients
    let totalTrabajadoresQuery;
    let totalTrabajadoresParams = [];
    
    if (profesionalFilter) {
      // Si hay filtro de profesional, contar solo sus trabajadores
      const profesionalIdMatch = profesionalFilter.match(/profesional_id = (\d+)/);
      if (profesionalIdMatch) {
        totalTrabajadoresQuery = `
          SELECT COUNT(DISTINCT id) as total_trabajadores
          FROM clients
          WHERE profesional_id = $1
        `;
        totalTrabajadoresParams = [profesionalIdMatch[1]];
      }
    } else {
      // Admin: contar todos los trabajadores
      totalTrabajadoresQuery = `
        SELECT COUNT(DISTINCT id) as total_trabajadores
        FROM clients
      `;
    }
    
    const totalTrabajadoresResult = await pool.query(totalTrabajadoresQuery, totalTrabajadoresParams);
    const totalTrabajadores = parseInt(totalTrabajadoresResult.rows[0].total_trabajadores) || 0;
    
    // Consultas y sesiones
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT CONCAT(cl.id, '-', motivo_consulta)) as total_consultas,
        COUNT(c.id) as total_sesiones,
        COUNT(c.id) as total_horas,
        COUNT(DISTINCT CASE WHEN estado = 'Cerrado' THEN CONCAT(cl.id, '-', motivo_consulta) END) as casos_cerrados,
        COUNT(DISTINCT CASE WHEN estado = 'Abierto' THEN CONCAT(cl.id, '-', motivo_consulta) END) as casos_abiertos
      FROM consultas c
      INNER JOIN clients cl ON c.cliente_id = cl.id
      WHERE 1=1 ${dateFilter} ${profesionalFilter}
    `;
    
    const summaryResult = await pool.query(summaryQuery, dateParams);
    const summary = summaryResult.rows[0];
    
    const totalConsultasReales = parseInt(summary.casos_cerrados) + parseInt(summary.casos_abiertos);
    const casosCerradosPercent = totalConsultasReales > 0 
      ? Math.round((summary.casos_cerrados / totalConsultasReales) * 100)
      : 0;
    
    // 2. CONSULTAS POR PROFESIONAL
    const profesionalQuery = `
      SELECT 
        u.id as profesional_id,
        u.nombre,
        (
          SELECT COUNT(DISTINCT id) 
          FROM clients 
          WHERE profesional_id = u.id
        ) as trabajadores,
        COALESCE(COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN CONCAT(cl.id, '-', c.motivo_consulta) END), 0) as consultas,
        COALESCE(COUNT(c.id), 0) as sesiones,
        COALESCE(COUNT(CASE WHEN c.modalidad = 'Virtual' THEN 1 END), 0) as virtual,
        COALESCE(COUNT(CASE WHEN c.modalidad = 'Presencial' THEN 1 END), 0) as presencial,
        COALESCE(COUNT(DISTINCT CASE WHEN c.estado = 'Abierto' AND c.id IS NOT NULL THEN CONCAT(cl.id, '-', c.motivo_consulta) END), 0) as abiertos,
        COALESCE(COUNT(DISTINCT CASE WHEN c.estado = 'Cerrado' AND c.id IS NOT NULL THEN CONCAT(cl.id, '-', c.motivo_consulta) END), 0) as cerrados
      FROM users u
      LEFT JOIN clients cl ON cl.profesional_id = u.id
      LEFT JOIN consultas c ON c.cliente_id = cl.id 
        ${dateFilter ? 'AND ' + dateFilter.replace('WHERE 1=1 AND ', '').replace('AND ', '') : ''}
      WHERE u.rol = 'profesional' AND u.activo = true 
        ${profesionalFilter ? 'AND ' + profesionalFilter.replace('AND cl.profesional_id', 'u.id') : ''}
      GROUP BY u.id, u.nombre
      HAVING COALESCE(COUNT(c.id), 0) > 0 OR (SELECT COUNT(*) FROM clients WHERE profesional_id = u.id) > 0
      ORDER BY consultas DESC
    `;
    
    const profesionalResult = await pool.query(profesionalQuery, dateParams);
    
    // 3. MODALIDAD DE ATENCIÓN
    const modalidadQuery = `
      SELECT 
        COUNT(CASE WHEN modalidad = 'Virtual' THEN 1 END) as virtual,
        COUNT(CASE WHEN modalidad = 'Presencial' THEN 1 END) as presencial
      FROM consultas c
      INNER JOIN clients cl ON c.cliente_id = cl.id
      WHERE 1=1 ${dateFilter} ${profesionalFilter}
    `;
    
    const modalidadResult = await pool.query(modalidadQuery, dateParams);
    
    // 4. TOP MOTIVOS DE CONSULTA
    // ⭐ CORREGIDO: Contar consultas únicas por motivo, no sesiones
    const motivosQuery = `
      SELECT 
        motivo_consulta,
        COUNT(DISTINCT CONCAT(cl.id, '-', motivo_consulta)) as cantidad
      FROM consultas c
      INNER JOIN clients cl ON c.cliente_id = cl.id
      WHERE 1=1 ${dateFilter} ${profesionalFilter}
      GROUP BY motivo_consulta
      ORDER BY cantidad DESC
      LIMIT 5
    `;
    
    const motivosResult = await pool.query(motivosQuery, dateParams);
    
    // 5. ESTADO DE CASOS
    const estadosQuery = `
      SELECT 
        COUNT(DISTINCT CASE WHEN estado = 'Abierto' THEN CONCAT(cl.id, '-', motivo_consulta) END) as abiertos,
        COUNT(DISTINCT CASE WHEN estado = 'Cerrado' THEN CONCAT(cl.id, '-', motivo_consulta) END) as cerrados
      FROM consultas c
      INNER JOIN clients cl ON c.cliente_id = cl.id
      WHERE 1=1 ${dateFilter} ${profesionalFilter}
    `;
    
    const estadosResult = await pool.query(estadosQuery, dateParams);
    
    // 6. EVOLUCIÓN MENSUAL (últimos 6 meses)
    const evolucionQuery = `
      SELECT 
        TO_CHAR(fecha, 'Mon YYYY') as mes,
        COUNT(*) as consultas
      FROM consultas c
      INNER JOIN clients cl ON c.cliente_id = cl.id
      WHERE fecha >= NOW() - INTERVAL '6 months' ${profesionalFilter}
      GROUP BY TO_CHAR(fecha, 'Mon YYYY'), DATE_TRUNC('month', fecha)
      ORDER BY DATE_TRUNC('month', fecha)
    `;
    
    const evolucionResult = await pool.query(evolucionQuery);
    
    // 7. DISTRIBUCIÓN POR SEDE
    const sedesQuery = `
      SELECT 
        cl.sede,
        COUNT(DISTINCT cl.id) as cantidad
      FROM clients cl
      INNER JOIN consultas c ON c.cliente_id = cl.id
      WHERE 1=1 ${dateFilter} ${profesionalFilter}
      GROUP BY cl.sede
      ORDER BY cantidad DESC
    `;
    
    const sedesResult = await pool.query(sedesQuery, dateParams);
    
    // 8. DISTRIBUCIÓN POR EMPRESA
    const empresasQuery = `
      SELECT 
        e.nombre_cliente,
        COUNT(DISTINCT cl.id) as cantidad
      FROM clients cl
      INNER JOIN empresas e ON cl.empresa_id = e.id
      INNER JOIN consultas c ON c.cliente_id = cl.id
      WHERE 1=1 ${dateFilter} ${profesionalFilter}
      GROUP BY e.nombre_cliente
      ORDER BY cantidad DESC
      LIMIT 10
    `;
    
    const empresasResult = await pool.query(empresasQuery, dateParams);
    
    // 9. DETALLE POR PROFESIONAL
    const detalleProfesionales = profesionalResult.rows.map(prof => {
      const totalConsultas = parseInt(prof.consultas) || 0;
      const totalSesiones = parseInt(prof.sesiones) || 0;
      const virtualPercent = totalSesiones > 0 ? Math.round((prof.virtual / totalSesiones) * 100) : 0;
      const presencialPercent = totalSesiones > 0 ? Math.round((prof.presencial / totalSesiones) * 100) : 0;
      const promedioSesiones = totalConsultas > 0 
        ? (totalSesiones / totalConsultas).toFixed(1) 
        : 0;
      
      return {
        nombre: prof.nombre,
        trabajadores: parseInt(prof.trabajadores) || 0,
        consultas: totalConsultas,
        sesiones: totalSesiones,
        virtual: parseInt(prof.virtual) || 0,
        virtualPercent,
        presencial: parseInt(prof.presencial) || 0,
        presencialPercent,
        abiertos: parseInt(prof.abiertos) || 0,
        cerrados: parseInt(prof.cerrados) || 0,
        horas: totalSesiones, // 1 hora por sesión
        promedioSesiones
      };
    });
    
    // 10. INDICADORES DE CALIDAD
    const calidadQuery = `
      SELECT 
        COUNT(DISTINCT CASE WHEN cl.contacto_emergencia_telefono IS NOT NULL AND cl.contacto_emergencia_telefono != '' THEN cl.id END) as con_contacto,
        COUNT(DISTINCT cl.id) as total_clientes
      FROM clients cl
      WHERE EXISTS (
        SELECT 1 FROM consultas c 
        WHERE c.cliente_id = cl.id ${dateFilter.replace(/\$\d+/g, (match) => {
          const index = parseInt(match.substring(1));
          return `'${dateParams[index-1]}'`;
        })}
      ) ${profesionalFilter}
    `;
    
    const calidadResult = await pool.query(calidadQuery);
    const contactoPercent = calidadResult.rows[0].total_clientes > 0
      ? Math.round((calidadResult.rows[0].con_contacto / calidadResult.rows[0].total_clientes) * 100)
      : 0;
    
    // Construir respuesta
    const stats = {
      summary: {
        totalTrabajadores: totalTrabajadores, // ⭐ Usar el conteo correcto
        trabajadoresMes: totalTrabajadores,
        totalConsultas: parseInt(summary.total_consultas) || 0,
        consultasMes: parseInt(summary.total_consultas) || 0,
        totalSesiones: parseInt(summary.total_sesiones) || 0,
        sesionesMes: parseInt(summary.total_sesiones) || 0,
        totalHoras: parseInt(summary.total_horas) || 0,
        horasMes: parseInt(summary.total_horas) || 0,
        casosCerradosPercent,
        casosCerradosChange: 0
      },
      byProfesional: {
        labels: profesionalResult.rows.map(p => p.nombre),
        values: profesionalResult.rows.map(p => parseInt(p.consultas))
      },
      modalidad: {
        virtual: parseInt(modalidadResult.rows[0].virtual) || 0,
        presencial: parseInt(modalidadResult.rows[0].presencial) || 0
      },
      topMotivos: {
        labels: motivosResult.rows.map(m => m.motivo_consulta),
        values: motivosResult.rows.map(m => parseInt(m.cantidad))
      },
      estados: {
        abiertos: parseInt(estadosResult.rows[0].abiertos) || 0,
        cerrados: parseInt(estadosResult.rows[0].cerrados) || 0
      },
      evolucion: {
        labels: evolucionResult.rows.map(e => e.mes),
        values: evolucionResult.rows.map(e => parseInt(e.consultas))
      },
      bySede: {
        labels: sedesResult.rows.map(s => s.sede || 'Sin sede'),
        values: sedesResult.rows.map(s => parseInt(s.cantidad))
      },
      byEmpresa: {
        labels: empresasResult.rows.map(e => e.nombre_cliente || 'Sin empresa'),
        values: empresasResult.rows.map(e => parseInt(e.cantidad))
      },
      detalleProfesionales,
      calidad: {
        tiempoPromedio: 15,
        sesionesPromedio: 3,
        contactoEmergencia: contactoPercent,
        sinSeguimiento: 0
      }
    };
    
    res.json({
      success: true,
      stats
    });
    
  } catch (err) {
    console.error("Error obteniendo estadísticas:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al obtener estadísticas",
      error: err.message
    });
  }
};