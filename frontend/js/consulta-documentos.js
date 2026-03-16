// frontend/js/consulta-documentos.js
// MÓDULO 6: Gestión de documentos adjuntos (PDF/Word)
// Solo aplica en modalidad Orientación Psicosocial
// Depende de: consulta-api.js

// ============================================
// VARIABLES GLOBALES DE DOCUMENTOS
// ============================================

let documentosCliente = {
  consentimiento_informado: null,
  historia_clinica: null,
  documentos_adicionales: null
};

// ============================================
// MOSTRAR/OCULTAR SECCIÓN SEGÚN MODALIDAD
// ============================================

function toggleDocumentosSection() {
  const modalidad = localStorage.getItem('modalidadSeleccionada') || 'Orientación Psicosocial';
  const documentosSection = document.getElementById('documentosSection');

  if (modalidad === 'Orientación Psicosocial' && documentosSection) {
    documentosSection.style.display = 'block';
  } else if (documentosSection) {
    documentosSection.style.display = 'none';
  }
}

// ============================================
// SELECCIÓN Y SUBIDA DE ARCHIVOS
// ============================================

window.handleFileSelect = async function(tipo, input) {
  const file = input.files[0];

  if (!file) return;

  // Validar tipo de archivo (solo PDF o Word)
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (!allowedTypes.includes(file.type)) {
    alert('⚠️ Solo se permiten archivos PDF o Word (.pdf, .doc, .docx)');
    input.value = '';
    return;
  }

  // Validar tamaño (10MB máximo)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    alert('⚠️ El archivo es demasiado grande. Tamaño máximo: 10MB');
    input.value = '';
    return;
  }

  const confirmar = confirm(`¿Desea adjuntar el archivo "${file.name}"?`);
  if (!confirmar) {
    input.value = '';
    return;
  }

  // Mostrar indicador de carga
  const btn = document.querySelector(`button[onclick="document.getElementById('${tipo}File').click()"]`);
  const originalText = btn.innerHTML;
  btn.innerHTML = '⏳ Subiendo...';
  btn.disabled = true;

  try {
    await subirDocumento(tipo, file);
    mostrarDocumentoAdjuntado(tipo, file.name);
    alert(`✅ Documento "${file.name}" adjuntado correctamente`);
  } catch (err) {
    console.error('Error subiendo documento:', err);
    alert('❌ Error al adjuntar el documento. Por favor intente nuevamente.');
    input.value = '';
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

// ============================================
// SUBIR DOCUMENTO AL SERVIDOR
// ============================================

async function subirDocumento(tipo, file) {
  const clienteId = getClienteIdFromURL();

  if (!clienteId) throw new Error('No se encontró el ID del cliente');

  const formData = new FormData();
  formData.append('documento', file);
  formData.append('tipo', tipo);
  formData.append('cliente_id', clienteId);

  const response = await fetch(`${API_URL}/${clienteId}/documentos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Error al subir documento');
  }

  const result = await response.json();

  // Actualizar la variable global con la ruta del documento
  const campoDocumento = getCampoDocumento(tipo);
  documentosCliente[campoDocumento] = result[campoDocumento];

  return result;
}

// ============================================
// UTILIDADES DE DOCUMENTOS
// ============================================

// Obtener nombre del campo según el tipo
function getCampoDocumento(tipo) {
  const campos = {
    'consentimiento': 'consentimiento_informado',
    'historia': 'historia_clinica',
    'adicionales': 'documentos_adicionales'
  };
  return campos[tipo];
}

// Mostrar documento adjuntado en la interfaz
function mostrarDocumentoAdjuntado(tipo, nombreArchivo) {
  const infoDiv = document.getElementById(`${tipo}Info`);
  const nombreSpan = document.getElementById(`${tipo}Nombre`);

  if (infoDiv && nombreSpan) {
    nombreSpan.textContent = nombreArchivo;
    infoDiv.style.display = 'flex';
  }

  const btnVer = document.getElementById(`btnVer${capitalizar(tipo)}`);
  const btnEliminar = document.getElementById(`btnEliminar${capitalizar(tipo)}`);

  if (btnVer) btnVer.style.display = 'flex';
  if (btnEliminar) btnEliminar.style.display = 'flex';

  const card = document.querySelector(`#${tipo}File`).closest('.documento-card');
  if (card) {
    card.classList.add(tipo);
  }
}

// Extraer nombre de archivo de la ruta
function extraerNombreArchivo(ruta) {
  if (!ruta) return '';
  const partes = ruta.split('/');
  return partes[partes.length - 1];
}

// ============================================
// VER Y ELIMINAR DOCUMENTOS
// ============================================

window.verDocumento = async function(tipo) {
  const campoDocumento = getCampoDocumento(tipo);
  const rutaDocumento = documentosCliente[campoDocumento];

  if (!rutaDocumento) {
    alert('⚠️ No se encontró el documento');
    return;
  }

  // Construir URL sin el /api
  const baseUrl = window.API_CONFIG.BASE_URL.replace('/api', '');
  const urlDocumento = `${baseUrl}/${rutaDocumento}`;

  console.log('📄 Abriendo documento:', urlDocumento);
  window.open(urlDocumento, '_blank');
};

window.eliminarDocumento = async function(tipo) {
  const confirmar = confirm('¿Está seguro de eliminar este documento?');
  if (!confirmar) return;

  const clienteId = getClienteIdFromURL();
  const campoDocumento = getCampoDocumento(tipo);

  if (!clienteId) {
    alert('⚠️ No se encontró el ID del cliente');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/${clienteId}/documentos/${tipo}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('Error al eliminar documento');

    // Limpiar la interfaz
    const infoDiv = document.getElementById(`${tipo}Info`);
    const btnVer = document.getElementById(`btnVer${capitalizar(tipo)}`);
    const btnEliminar = document.getElementById(`btnEliminar${capitalizar(tipo)}`);
    const fileInput = document.getElementById(`${tipo}File`);

    if (infoDiv) infoDiv.style.display = 'none';
    if (btnVer) btnVer.style.display = 'none';
    if (btnEliminar) btnEliminar.style.display = 'none';
    if (fileInput) fileInput.value = '';

    documentosCliente[campoDocumento] = null;

    alert('✅ Documento eliminado correctamente');

  } catch (err) {
    console.error('Error eliminando documento:', err);
    alert('❌ Error al eliminar el documento');
  }
};

// ============================================
// CARGAR DOCUMENTOS EXISTENTES
// ============================================

async function cargarDocumentosExistentes() {
  const clienteId = getClienteIdFromURL();
  if (!clienteId) return;

  try {
    const response = await fetch(`${API_URL}/${clienteId}/documentos`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('Error al cargar documentos');

    const data = await response.json();

    documentosCliente.consentimiento_informado = data.consentimiento_informado;
    documentosCliente.historia_clinica = data.historia_clinica;
    documentosCliente.documentos_adicionales = data.documentos_adicionales;

    if (data.consentimiento_informado) {
      mostrarDocumentoAdjuntado('consentimiento', extraerNombreArchivo(data.consentimiento_informado));
    }
    if (data.historia_clinica) {
      mostrarDocumentoAdjuntado('historia', extraerNombreArchivo(data.historia_clinica));
    }
    if (data.documentos_adicionales) {
      mostrarDocumentoAdjuntado('adicionales', extraerNombreArchivo(data.documentos_adicionales));
    }

  } catch (err) {
    console.error('Error cargando documentos existentes:', err);
  }
}

// ============================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  toggleDocumentosSection();
  cargarDocumentosExistentes();
});

console.log('✅ Módulo consulta-documentos.js cargado');