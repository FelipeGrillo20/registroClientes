// backend/utils/creditosHelper.js
// Funciones auxiliares para manejo de créditos

const CreditoModel = require('../models/creditoModel');

/**
 * Calcular la duración en horas de una cita
 */
function calcularDuracionCita(horaInicio, horaFin) {
  const [horaI, minI] = horaInicio.split(':').map(Number);
  const [horaF, minF] = horaFin.split(':').map(Number);
  
  const minutosInicio = horaI * 60 + minI;
  const minutosFin = horaF * 60 + minF;
  
  const duracionMinutos = minutosFin - minutosInicio;
  const duracionHoras = duracionMinutos / 60;
  
  return duracionHoras;
}

/**
 * Consumir horas del crédito activo al crear una cita
 */
async function consumirHorasCita(fecha, horaInicio, horaFin, modalidad_programa) {
  try {
    // Calcular duración
    const horasConsumidas = calcularDuracionCita(horaInicio, horaFin);
    
    // Buscar crédito activo (sin importar el periodo)
    const creditoActivo = await CreditoModel.obtenerCreditoActivo(modalidad_programa);
    
    if (!creditoActivo) {
      throw new Error('No hay créditos activos disponibles. Por favor, asigne un nuevo crédito.');
    }
    
    // Verificar que hay horas disponibles
    const horasDisponibles = creditoActivo.cantidad_horas - creditoActivo.horas_consumidas;
    
    if (horasDisponibles < horasConsumidas) {
      throw new Error(
        `Horas insuficientes en el crédito ${creditoActivo.consecutivo}. Disponibles: ${horasDisponibles.toFixed(2)}h, Requeridas: ${horasConsumidas.toFixed(2)}h`
      );
    }
    
    // Consumir las horas
    await CreditoModel.consumirHoras(creditoActivo.id, horasConsumidas);
    
    console.log(`✅ Consumidas ${horasConsumidas.toFixed(2)}h del crédito ${creditoActivo.consecutivo} (${creditoActivo.anio}/${creditoActivo.mes})`);
    
    return {
      credito_id: creditoActivo.id,
      horas_consumidas: horasConsumidas
    };
    
  } catch (error) {
    console.error('❌ Error al consumir horas:', error);
    throw error;
  }
}

/**
 * Devolver horas cuando se elimina o cancela una cita
 */
async function devolverHorasCita(creditoId, horaInicio, horaFin) {
  try {
    if (!creditoId) {
      console.warn('⚠️ No hay credito_id asociado, no se devuelven horas');
      return;
    }
    
    const horasDevueltas = calcularDuracionCita(horaInicio, horaFin);
    
    await CreditoModel.devolverHoras(creditoId, horasDevueltas);
    
    console.log(`♻️ Devueltas ${horasDevueltas.toFixed(2)}h al crédito ID ${creditoId}`);
    
    return horasDevueltas;
    
  } catch (error) {
    console.error('❌ Error al devolver horas:', error);
    throw error;
  }
}

/**
 * Ajustar horas cuando se edita una cita
 */
async function ajustarHorasCitaEditada(
  creditoId,
  horaInicioAnterior,
  horaFinAnterior,
  horaInicioNueva,
  horaFinNueva,
  fechaNueva,
  modalidad_programa
) {
  try {
    // Calcular diferencia
    const horasAnteriores = calcularDuracionCita(horaInicioAnterior, horaFinAnterior);
    const horasNuevas = calcularDuracionCita(horaInicioNueva, horaFinNueva);
    const diferencia = horasNuevas - horasAnteriores;
    
    if (diferencia === 0) {
      console.log('ℹ️ Sin cambio en duración de la cita');
      return { credito_id: creditoId };
    }
    
    if (diferencia > 0) {
      // Se necesitan más horas - consumir adicionales del crédito activo
      const creditoActivo = await CreditoModel.obtenerCreditoActivo(modalidad_programa);
      
      if (!creditoActivo) {
        throw new Error('No hay créditos activos disponibles');
      }
      
      const horasDisponibles = creditoActivo.cantidad_horas - creditoActivo.horas_consumidas;
      
      if (horasDisponibles < diferencia) {
        throw new Error(
          `Horas insuficientes en el crédito ${creditoActivo.consecutivo}. Disponibles: ${horasDisponibles.toFixed(2)}h, Requeridas: ${diferencia.toFixed(2)}h`
        );
      }
      
      await CreditoModel.consumirHoras(creditoActivo.id, diferencia);
      console.log(`✅ Consumidas ${diferencia.toFixed(2)}h adicionales del crédito ${creditoActivo.consecutivo}`);
      
      return { credito_id: creditoActivo.id };
      
    } else {
      // Se devuelven horas
      await CreditoModel.devolverHoras(creditoId, Math.abs(diferencia));
      console.log(`♻️ Devueltas ${Math.abs(diferencia).toFixed(2)}h al crédito ID ${creditoId}`);
      
      return { credito_id: creditoId };
    }
    
  } catch (error) {
    console.error('❌ Error al ajustar horas:', error);
    throw error;
  }
}

module.exports = {
  calcularDuracionCita,
  consumirHorasCita,
  devolverHorasCita,
  ajustarHorasCitaEditada
};