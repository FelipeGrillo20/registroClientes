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
    
    // DEBUG: Ver qué llega del frontend
    console.log('=== PARAMETROS RECIBIDOS ===');
    console.log('req.query completo:', req.query);
    console.log('period:', period);
    console.log('profesionalId:', profesionalId);
    console.log('startDate:', startDate);
    console.log('endDate:', endDate);
    
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
    // ✅ CORREGIDO: Contar total de trabajadores desde la tabla clients
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
    // ✅ CORREGIDO: Contar consultas únicas por motivo, no sesiones
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
    
    // 10. INDICADORES DE CALIDAD - ✅ CORREGIDO
    // Preparar filtros limpios para la subquery
    const cleanDateFilter = dateFilter.replace('WHERE 1=1 AND ', '').replace('AND ', '');
    const dateFilterForJoin = cleanDateFilter ? `AND ${cleanDateFilter}` : '';
    const dateFilterForSubquery = cleanDateFilter ? `AND ${cleanDateFilter}` : '';
    
    // Extraer el ID del profesional si existe el filtro
    let profesionalIdForCalidad = '';
    if (profesionalFilter) {
      const profesionalIdMatch = profesionalFilter.match(/profesional_id = (\d+)/);
      if (profesionalIdMatch) {
        profesionalIdForCalidad = `AND cl.profesional_id = ${profesionalIdMatch[1]}`;
      }
    }
    
    // DEBUG: Ver qué filtros se están aplicando
    console.log('=== DEBUG CALIDAD ===');
    console.log('profesionalFilter:', profesionalFilter);
    console.log('profesionalIdForCalidad:', profesionalIdForCalidad);
    console.log('profesionalId del query:', profesionalId);
    
    const calidadQuery = `
      WITH consultas_unicas AS (
        SELECT DISTINCT
          cl.id as cliente_id,
          cl.profesional_id,
          cl.contacto_emergencia_telefono,
          cl.fecha_cierre,
          c.motivo_consulta,
          (
            SELECT MIN(c_min.fecha)::date 
            FROM consultas c_min 
            WHERE c_min.cliente_id = cl.id 
            AND c_min.motivo_consulta = c.motivo_consulta
          ) as primera_sesion
        FROM clients cl
        INNER JOIN consultas c ON c.cliente_id = cl.id ${dateFilterForJoin}
        WHERE 1=1 ${profesionalIdForCalidad}
      ),
      duraciones AS (
        SELECT 
          cliente_id,
          motivo_consulta,
          CASE 
            WHEN fecha_cierre IS NOT NULL 
            THEN fecha_cierre::date - primera_sesion
            ELSE NULL 
          END as dias_duracion
        FROM consultas_unicas
      )
      SELECT 
        -- Contacto de emergencia
        COUNT(DISTINCT CASE 
          WHEN cu.contacto_emergencia_telefono IS NOT NULL 
          AND cu.contacto_emergencia_telefono != '' 
          THEN cu.cliente_id 
        END) as con_contacto,
        COUNT(DISTINCT cu.cliente_id) as total_clientes,
        
        -- Tiempo promedio (ahora sobre consultas únicas, no sesiones)
        CEIL(AVG(d.dias_duracion)) as tiempo_promedio_dias,
        
        -- Sesiones promedio por caso
        ROUND(
          (SELECT COUNT(*) FROM consultas c3 
           INNER JOIN clients cl3 ON c3.cliente_id = cl3.id
           WHERE 1=1 ${profesionalIdForCalidad.replace('cl.', 'cl3.')} ${dateFilterForJoin.replace('c.', 'c3.')})::numeric / 
          NULLIF(COUNT(DISTINCT CONCAT(cu.cliente_id, '-', cu.motivo_consulta)), 0),
          1
        ) as sesiones_promedio
        
      FROM consultas_unicas cu
      LEFT JOIN duraciones d ON d.cliente_id = cu.cliente_id 
        AND d.motivo_consulta = cu.motivo_consulta
    `;
    
    const calidadResult = await pool.query(calidadQuery, dateParams);
    
    // DEBUG: Ver resultado de la query de calidad
    console.log('=== RESULTADO CALIDAD ===');
    console.log('Resultado completo:', calidadResult.rows[0]);
    console.log('tiempo_promedio_dias:', calidadResult.rows[0].tiempo_promedio_dias);
    
    // Sin seguimiento reciente: consultas abiertas sin sesiones en últimos 30 días
    const sinSeguimientoQuery = `
      SELECT COUNT(DISTINCT CONCAT(cl.id, '-', c.motivo_consulta)) as sin_seguimiento
      FROM consultas c
      INNER JOIN clients cl ON c.cliente_id = cl.id
      WHERE c.estado = 'Abierto'
        AND NOT EXISTS (
          SELECT 1 FROM consultas c2
          WHERE c2.cliente_id = c.cliente_id 
            AND c2.motivo_consulta = c.motivo_consulta
            AND c2.fecha >= NOW() - INTERVAL '30 days'
        )
        ${profesionalIdForCalidad}
    `;
    
    const sinSeguimientoResult = await pool.query(sinSeguimientoQuery);
    
    // Calcular porcentaje de contacto de emergencia
    const contactoPercent = calidadResult.rows[0].total_clientes > 0
      ? Math.round((calidadResult.rows[0].con_contacto / calidadResult.rows[0].total_clientes) * 100)
      : 0;
    
    // Construir respuesta
    const stats = {
      summary: {
        totalTrabajadores: totalTrabajadores,
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
        tiempoPromedio: parseInt(calidadResult.rows[0].tiempo_promedio_dias) || 0,
        sesionesPromedio: parseFloat(calidadResult.rows[0].sesiones_promedio) || 0,
        contactoEmergencia: contactoPercent,
        sinSeguimiento: parseInt(sinSeguimientoResult.rows[0].sin_seguimiento) || 0
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