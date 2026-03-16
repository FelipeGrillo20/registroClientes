// frontend/js/consulta-form.js
// MÓDULO 4: Formulario principal de consultas (Orientación Psicosocial)
// Incluye: registro, edición, eliminación, consultas sugeridas y confidencialidad
// Depende de: consulta-api.js, consulta-historial.js

// ============================================
// VARIABLE: consulta_number de la consulta activa
//
// Se inicializa en null y se actualiza en dos momentos:
//   1. Al cargar el historial (loadHistorialConsultas la detecta y la expone)
//   2. Al pulsar "Nueva Consulta" (se pone a null para que el backend calcule el siguiente)
//
// Cuando vale null  → el backend calcula MAX+1 (primera sesión de consulta nueva)
// Cuando vale número → el backend usa ese valor (sesión adicional de consulta existente)
// ============================================
let consultaNumberActual = null;

// Exponer globalmente para que consulta-historial.js pueda actualizarla
window.setConsultaNumberActual = function(num) {
  consultaNumberActual = num;
};

window.getConsultaNumberActual = function() {
  return consultaNumberActual;
};

// ============================================
// CAMPO FECHA DE CIERRE - TOGGLE
// ============================================

let fechaCierreModificadaManualmente = false;

function toggleFechaCierreField() {
  const estadoSelect = document.getElementById("estado");
  const fechaCierreContainer = document.getElementById("fechaCierreContainer");
  const fechaCierreInput = document.getElementById("fecha_cierre");
  const recomendacionesInput = document.getElementById("recomendaciones_finales");

  if (estadoSelect.value === "Cerrado") {
    fechaCierreContainer.classList.add("show");
    fechaCierreInput.required = true;
    recomendacionesInput.required = true;

    fechaCierreModificadaManualmente = false;

    // Leer fecha_cierre y recomendaciones desde las sesiones de la consulta activa,
    // no desde clienteActual — así cada consulta carga sus propios datos al reabrir.
    const numActual = window.getConsultaNumberActual ? window.getConsultaNumberActual() : null;
    const sesionesActuales = (window.consultasDelCliente || []).filter(
      c => c.consulta_number === numActual
    );
    const sesionConCierre = sesionesActuales.find(s => s.fecha_cierre);

    const fechaCierreConsulta  = sesionConCierre ? sesionConCierre.fecha_cierre : null;
    const recomendacionesConsulta = sesionConCierre ? sesionConCierre.recomendaciones_finales : null;

    // Precargar fecha de cierre solo si el campo está vacío
    if (!fechaCierreInput.value) {
      if (fechaCierreConsulta) {
        fechaCierreInput.value = fechaCierreConsulta.substring(0, 10);
      } else {
        const fechaFormulario = document.getElementById("fecha")?.value;
        fechaCierreInput.value = fechaFormulario || getFechaLocalHoy();
      }
    }

    // Precargar recomendaciones solo si el campo está vacío
    if (!recomendacionesInput.value && recomendacionesConsulta) {
      recomendacionesInput.value = recomendacionesConsulta;
    }
  } else {
    fechaCierreContainer.classList.remove("show");
    fechaCierreInput.required = false;
    recomendacionesInput.required = false;
    fechaCierreInput.value = "";
    fechaCierreModificadaManualmente = false;
  }
}

document.getElementById("estado")?.addEventListener("change", toggleFechaCierreField);

document.getElementById("fecha_cierre")?.addEventListener("change", function() {
  fechaCierreModificadaManualmente = true;
});

document.getElementById("fecha")?.addEventListener("change", function() {
  const estadoSelect = document.getElementById("estado");
  const fechaCierreInput = document.getElementById("fecha_cierre");

  if (estadoSelect?.value === "Cerrado" && fechaCierreInput && !fechaCierreModificadaManualmente) {
    fechaCierreInput.value = this.value;
  }
});

// ============================================
// TOGGLE DE CONFIDENCIALIDAD
// ============================================

window.toggleConfidencialidad = function() {
  const btnCandado = document.getElementById("btnCandado");
  const candadoIcon = document.getElementById("candadoIcon");
  const candadoTexto = document.getElementById("candadoTexto");
  const observacionesInfo = document.getElementById("observacionesInfo");
  const hiddenInput = document.getElementById("observaciones_confidenciales");

  const esConfidencial = hiddenInput.value === "true";

  if (esConfidencial) {
    hiddenInput.value = "false";
    btnCandado.classList.remove("confidencial");
    candadoIcon.textContent = "🔓";
    candadoTexto.textContent = "Visible en informe";
    observacionesInfo.innerHTML = '💡 Estas observaciones <strong>se mostrarán</strong> en el informe del trabajador';
    observacionesInfo.classList.remove("confidencial");
  } else {
    hiddenInput.value = "true";
    btnCandado.classList.add("confidencial");
    candadoIcon.textContent = "🔒";
    candadoTexto.textContent = "Confidencial (No visible)";
    observacionesInfo.innerHTML = '🔒 Estas observaciones <strong>NO se mostrarán</strong> en el informe del trabajador';
    observacionesInfo.classList.add("confidencial");
  }
};

// ============================================
// CONSULTAS SUGERIDAS
// Se guardan en la tabla consultas (no en clients)
// usando el endpoint PUT /api/consultas/sugeridas
// ============================================

async function guardarConsultasSugeridas(clienteId, consultas_sugeridas) {
  const numActual = window.getConsultaNumberActual ? window.getConsultaNumberActual() : null;
  if (numActual === null) return;

  try {
    const res = await fetch(`${CONSULTAS_API_URL}/sugeridas`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        cliente_id: parseInt(clienteId),
        consulta_number: numActual,
        consultas_sugeridas: parseInt(consultas_sugeridas)
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Error al guardar consultas sugeridas");
    }
  } catch (err) {
    console.error("Error guardando consultas sugeridas:", err);
    alert("⚠️ Error al guardar consultas sugeridas: " + err.message);
  }
}

async function limpiarConsultasSugeridas(clienteId) {
  const numActual = window.getConsultaNumberActual ? window.getConsultaNumberActual() : null;
  if (numActual === null) return;

  try {
    await fetch(`${CONSULTAS_API_URL}/sugeridas`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        cliente_id: parseInt(clienteId),
        consulta_number: numActual,
        consultas_sugeridas: null
      })
    });
  } catch (err) {
    console.error("Error limpiando consultas sugeridas:", err);
  }
}

// ============================================
// SUBMIT FORMULARIO DE CONSULTA
// ============================================

document.getElementById("formConsulta")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const motivo_consulta = $('#motivo_consulta').val();
  const modalidad = document.getElementById("modalidad").value;
  const fecha = document.getElementById("fecha").value;
  const columna1 = document.getElementById("columna1").value.trim();
  const estado = document.getElementById("estado").value;
  const fecha_cierre = document.getElementById("fecha_cierre").value;
  const recomendaciones_finales = document.getElementById("recomendaciones_finales").value.trim();
  const observaciones_confidenciales = document.getElementById("observaciones_confidenciales").value === "true";
  const consultas_sugeridas = document.getElementById("consultas_sugeridas").value;

  if (!motivo_consulta || !modalidad || !fecha || !estado) {
    alert("⚠️ Por favor completa todos los campos obligatorios");
    return;
  }

  // Solo pedir consultas sugeridas en la primera sesión de una consulta nueva
  const esPrimerasSesionConsultaNueva = consultaNumberActual === null && consultasDelCliente.length === 0 && !editandoConsultaId;
  if (esPrimerasSesionConsultaNueva && !consultas_sugeridas) {
    alert("⚠️ Por favor indica el número de consultas sugeridas para este trabajador");
    return;
  }

  if (estado === "Cerrado") {
    if (!fecha_cierre) {
      alert("⚠️ Por favor especifica la fecha de cierre del caso");
      return;
    }
    if (!recomendaciones_finales) {
      alert("⚠️ Por favor escribe las recomendaciones finales antes de cerrar el caso");
      return;
    }
  }

  // VALIDACIÓN: La fecha de la sesión no puede ser anterior a las sesiones
  // de la misma consulta (mismo consulta_number)
  const sesionesConsultaActual = consultasDelCliente.filter(
    c => c.consulta_number === consultaNumberActual
  );

  if (sesionesConsultaActual.length > 0) {
    const sesionesOrdenadas = [...sesionesConsultaActual]
      .filter(c => !editandoConsultaId || c.id !== editandoConsultaId)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    if (sesionesOrdenadas.length > 0) {
      const ultimaFecha = sesionesOrdenadas[sesionesOrdenadas.length - 1].fecha.substring(0, 10);
      const ultimoNumero = sesionesOrdenadas[sesionesOrdenadas.length - 1].numeroSesion || sesionesOrdenadas.length;

      if (fecha < ultimaFecha) {
        alert(
          `⚠️ La fecha seleccionada (${formatDate(fecha)}) es anterior a la Sesión ${ultimoNumero} (${formatDate(ultimaFecha)}).\n\n` +
          `Debes elegir una fecha igual o posterior a la sesión anterior.`
        );
        return;
      }
    }
  }

  // VALIDACIÓN: La fecha de cierre debe ser >= a todas las sesiones de esta consulta
  if (estado === "Cerrado" && fecha_cierre && sesionesConsultaActual.length > 0) {
    const sesionesExistentes = editandoConsultaId
      ? sesionesConsultaActual.filter(c => c.id !== editandoConsultaId)
      : sesionesConsultaActual;

    const todasFechas = [...sesionesExistentes.map(c => c.fecha.substring(0, 10)), fecha];
    const fechaMaxSesion = todasFechas.sort().pop();

    if (fecha_cierre < fechaMaxSesion) {
      alert(
        `⚠️ La fecha de cierre (${formatDate(fecha_cierre)}) no puede ser anterior a la última sesión registrada (${formatDate(fechaMaxSesion)}).\n\n` +
        `La fecha de cierre debe ser igual o posterior a todas las sesiones.`
      );
      return;
    }
  }

  const clienteId = getClienteIdFromURL();

  const consultaData = {
    cliente_id: parseInt(clienteId),
    motivo_consulta,
    actividad: motivo_consulta,
    modalidad,
    fecha,
    columna1: columna1 || null,
    estado,
    fecha_cierre: estado === "Cerrado" ? fecha_cierre : null,
    observaciones_confidenciales
  };

  // Incluir consulta_number solo cuando es sesión adicional de consulta existente.
  // Si es null, el backend calcula el siguiente número automáticamente.
  if (consultaNumberActual !== null) {
    consultaData.consulta_number = consultaNumberActual;
  }

  try {
    const method = editandoConsultaId ? "PUT" : "POST";
    const url = editandoConsultaId
      ? `${CONSULTAS_API_URL}/${editandoConsultaId}`
      : CONSULTAS_API_URL;

    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(consultaData)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Error al guardar consulta");
    }

    // Capturar el consulta_number que devuelve el backend en el primer POST
    // para que las sesiones siguientes lo reutilicen
    if (method === "POST" && consultaNumberActual === null) {
      const nuevaConsulta = await res.clone().json();
      if (nuevaConsulta.consulta_number) {
        consultaNumberActual = nuevaConsulta.consulta_number;
        window.setConsultaNumberActual(consultaNumberActual);
      }
    }

    // Guardar consultas sugeridas solo en la primera sesión de una consulta nueva
    const esPrimeraSesionNueva = sesionesConsultaActual.length === 0 && !editandoConsultaId;
    let esPrimeraSesionEditando = false;
    if (editandoConsultaId) {
      const consultaEditada = consultasDelCliente.find(c => c.id === editandoConsultaId);
      esPrimeraSesionEditando = consultaEditada && consultaEditada.numeroSesion === 1;
    }

    if ((esPrimeraSesionNueva || esPrimeraSesionEditando) && consultas_sugeridas) {
      await guardarConsultasSugeridas(clienteId, parseInt(consultas_sugeridas));
    }

    if (estado === 'Cerrado') {
      await cerrarTodasLasConsultas(clienteId, fecha_cierre, recomendaciones_finales);
    }

    const mensaje = editandoConsultaId
      ? "✅ Consulta actualizada correctamente"
      : "✅ Consulta registrada correctamente";

    alert(mensaje);

    // Reset del formulario
    document.getElementById("formConsulta").reset();
    $('#motivo_consulta').val(null).trigger('change');
    editandoConsultaId = null;

    document.getElementById("observaciones_confidenciales").value = "false";
    document.getElementById("btnCandado").classList.remove("confidencial");
    document.getElementById("candadoIcon").textContent = "🔓";
    document.getElementById("candadoTexto").textContent = "Visible en informe";
    document.getElementById("observacionesInfo").innerHTML = '💡 Estas observaciones <strong>se mostrarán</strong> en el informe del trabajador';
    document.getElementById("observacionesInfo").classList.remove("confidencial");

    document.querySelector(".btn-submit-consulta").innerHTML = "💾 Registrar Consulta";

    await loadClientData();

  } catch (err) {
    console.error("Error guardando consulta:", err);
    alert("❌ " + err.message);
  }
});

// ============================================
// EDITAR CONSULTA
// ============================================

window.editarConsulta = async function(id) {
  if (hayCasoCerrado()) {
    alert("⚠️ No se puede editar una sesión cuando el caso está cerrado");
    return;
  }

  try {
    const res = await fetch(`${CONSULTAS_API_URL}/${id}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (!res.ok) throw new Error("Consulta no encontrada");

    const consulta = await res.json();

    $('#motivo_consulta').val(consulta.motivo_consulta).trigger('change');
    $('#motivo_consulta').prop('disabled', false);
    document.getElementById("modalidad").value = consulta.modalidad;
    document.getElementById("fecha").value = consulta.fecha.split('T')[0];
    document.getElementById("columna1").value = consulta.columna1 || "";
    document.getElementById("estado").value = consulta.estado;

    const esConfidencial = consulta.observaciones_confidenciales || false;
    document.getElementById("observaciones_confidenciales").value = esConfidencial.toString();

    const btnCandado = document.getElementById("btnCandado");
    const candadoIcon = document.getElementById("candadoIcon");
    const candadoTexto = document.getElementById("candadoTexto");
    const observacionesInfo = document.getElementById("observacionesInfo");

    if (esConfidencial) {
      btnCandado.classList.add("confidencial");
      candadoIcon.textContent = "🔒";
      candadoTexto.textContent = "Confidencial (No visible)";
      observacionesInfo.innerHTML = '🔒 Estas observaciones <strong>NO se mostrarán</strong> en el informe del trabajador';
      observacionesInfo.classList.add("confidencial");
    } else {
      btnCandado.classList.remove("confidencial");
      candadoIcon.textContent = "🔓";
      candadoTexto.textContent = "Visible en informe";
      observacionesInfo.innerHTML = '💡 Estas observaciones <strong>se mostrarán</strong> en el informe del trabajador';
      observacionesInfo.classList.remove("confidencial");
    }

    // Asegurar que el consultaNumberActual quede sincronizado con la sesión que se edita
    if (consulta.consulta_number) {
      consultaNumberActual = consulta.consulta_number;
      window.setConsultaNumberActual(consultaNumberActual);
    }

    const consultaEnHistorial = consultasDelCliente.find(c => c.id === id);
    const esPrimeraSesion = consultaEnHistorial && consultaEnHistorial.numeroSesion === 1;

    const consultasSugeridasGroup = document.getElementById("consultasSugeridasGroup");
    const consultasSugeridasInput = document.getElementById("consultas_sugeridas");

    if (esPrimeraSesion) {
      consultasSugeridasGroup.style.display = "block";
      consultasSugeridasInput.required = true;

      // Leer consultas_sugeridas desde las sesiones de esta consulta,
      // no desde clienteActual — así cada consulta carga su propio valor.
      const sesionesDeEstaConsulta = consultasDelCliente.filter(
        c => c.consulta_number === consulta.consulta_number
      );
      const sesionConSugeridas = sesionesDeEstaConsulta.find(
        s => s.consultas_sugeridas != null
      );
      consultasSugeridasInput.value = sesionConSugeridas
        ? sesionConSugeridas.consultas_sugeridas
        : "";
    } else {
      consultasSugeridasGroup.style.display = "none";
      consultasSugeridasInput.required = false;
      consultasSugeridasInput.value = "";
    }

    toggleFechaCierreField();
    editandoConsultaId = id;
    document.querySelector(".btn-submit-consulta").innerHTML = "💾 Actualizar Consulta";
    document.querySelector(".consulta-section").scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    console.error("Error cargando consulta:", err);
    alert("❌ Error al cargar consulta para editar");
  }
};

// ============================================
// ELIMINAR CONSULTA
// ============================================

window.eliminarConsulta = async function(id) {
  if (hayCasoCerrado()) {
    alert("⚠️ No se puede eliminar una sesión cuando el caso está cerrado");
    return;
  }

  // Solo se puede eliminar la última sesión de la consulta activa
  const sesionesConsultaActiva = [...consultasDelCliente]
    .filter(c => c.consulta_number === consultaNumberActual)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || a.id - b.id);

  const ultimaSesion = sesionesConsultaActiva[sesionesConsultaActiva.length - 1];

  if (ultimaSesion && ultimaSesion.id !== id) {
    const consultaAEliminar = consultasDelCliente.find(c => c.id === id);
    const numSesion = consultaAEliminar ? consultaAEliminar.numeroSesion : '?';
    alert(
      `⚠️ No puedes eliminar la Sesión ${numSesion} porque tiene sesiones posteriores.\n\n` +
      `Para eliminar esta sesión primero debes eliminar desde la última sesión hacia atrás.`
    );
    return;
  }

  if (!confirm("¿Estás seguro de eliminar esta consulta?")) return;

  try {
    const consultaAEliminar = consultasDelCliente.find(c => c.id === id);
    const esPrimeraSesion = consultaAEliminar && consultaAEliminar.numeroSesion === 1;

    const res = await fetch(`${CONSULTAS_API_URL}/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });

    if (!res.ok) throw new Error("Error al eliminar consulta");

    // Si se elimina la primera sesión de la consulta activa,
    // limpiar consultas sugeridas y resetear el consultaNumberActual
    if (esPrimeraSesion) {
      const clienteId = getClienteIdFromURL();
      await limpiarConsultasSugeridas(clienteId);
      consultaNumberActual = null;
      window.setConsultaNumberActual(null);
    }

    alert("✅ Consulta eliminada correctamente");

    const clienteId = getClienteIdFromURL();
    loadHistorialConsultas(clienteId);

  } catch (err) {
    console.error("Error eliminando consulta:", err);
    alert("❌ Error al eliminar consulta");
  }
};

// ============================================
// RESET Y EVENTOS ADICIONALES DEL FORMULARIO
// ============================================

document.getElementById("formConsulta")?.addEventListener("reset", () => {
  editandoConsultaId = null;
  document.querySelector(".btn-submit-consulta").innerHTML = "💾 Registrar Consulta";
  document.getElementById("fechaCierreContainer").classList.remove("show");

  const recomendacionesActuales = document.getElementById("recomendaciones_finales").value;

  setTimeout(() => {
    configurarCampoMotivo();
    if (recomendacionesActuales) {
      document.getElementById("recomendaciones_finales").value = recomendacionesActuales;
    }
  }, 100);
});

document.getElementById("btnBack")?.addEventListener("click", () => {
  window.location.href = "clientes.html";
});

document.getElementById("btnRefreshHistorial")?.addEventListener("click", () => {
  const clienteId = getClienteIdFromURL();
  loadHistorialConsultas(clienteId);
});

// Inicializar Select2
$(document).ready(function() {
  $('#motivo_consulta').select2({
    theme: 'default',
    language: 'es',
    placeholder: 'Seleccione un motivo de consulta',
    allowClear: true,
    width: '100%'
  });
});

console.log('✅ Módulo consulta-form.js cargado');