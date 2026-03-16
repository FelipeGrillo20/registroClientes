// frontend/js/consulta-antecedentes.js
// Módulo: Gestión de Antecedentes de Salud
// Depende de: consulta-api.js (API_URL, getAuthToken, getClienteIdFromURL)
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// ABRIR / CERRAR MODALES
// ─────────────────────────────────────────────────────────────────────────

window.abrirModalAntecedentes = async function () {
  document.getElementById('modalAntecedentes').classList.add('show');
  await cargarAntecedentes();
};

window.cerrarModalAntecedentes = function () {
  document.getElementById('modalAntecedentes').classList.remove('show');
  limpiarFormularioNuevo();
};

window.cerrarModalEditarAntecedente = function () {
  document.getElementById('modalEditarAntecedente').classList.remove('show');
};

// Cerrar al hacer clic fuera
document.getElementById('modalAntecedentes')?.addEventListener('click', (e) => {
  if (e.target.id === 'modalAntecedentes') cerrarModalAntecedentes();
});

document.getElementById('modalEditarAntecedente')?.addEventListener('click', (e) => {
  if (e.target.id === 'modalEditarAntecedente') cerrarModalEditarAntecedente();
});

// ─────────────────────────────────────────────────────────────────────────
// CONTADOR DE CARACTERES
// ─────────────────────────────────────────────────────────────────────────

document.getElementById('detalleAntecedenteNuevo')?.addEventListener('input', function () {
  document.getElementById('charCountAntecedente').textContent = this.value.length;
});

// ─────────────────────────────────────────────────────────────────────────
// CARGAR Y RENDERIZAR LISTA DE ANTECEDENTES
// ─────────────────────────────────────────────────────────────────────────

async function cargarAntecedentes() {
  const clienteId = getClienteIdFromURL();
  const contenedor = document.getElementById('listaAntecedentes');

  contenedor.innerHTML = `
    <div class="antecedentes-loading">
      <span class="spinner-antecedente"></span>
      <p>Cargando antecedentes...</p>
    </div>`;

  try {
    const res = await fetch(`${API_URL}/${clienteId}/antecedentes`, {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });

    if (!res.ok) throw new Error('Error al obtener antecedentes');

    const antecedentes = await res.json();
    renderizarAntecedentes(antecedentes, contenedor);

  } catch (err) {
    console.error('Error cargando antecedentes:', err);
    contenedor.innerHTML = `
      <div class="antecedentes-empty">
        ❌ Error al cargar los antecedentes. Intente nuevamente.
      </div>`;
  }
}

function renderizarAntecedentes(lista, contenedor) {
  if (!lista || lista.length === 0) {
    contenedor.innerHTML = `
      <div class="antecedentes-empty">
        📋 Este trabajador aún no tiene antecedentes de salud registrados.
      </div>`;
    return;
  }

  const filas = lista.map(a => {
    const badgeClass = a.tipo_antecedente === 'Físico' ? 'badge-fisico' : 'badge-psicologico';
    const fecha = new Date(a.created_at).toLocaleDateString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    return `
      <tr>
        <td><span class="badge-tipo-antecedente ${badgeClass}">${escapeHtml(a.tipo_antecedente)}</span></td>
        <td>${escapeHtml(a.detalle)}</td>
        <td style="white-space:nowrap; color:#999; font-size:12px;">${fecha}</td>
        <td style="white-space:nowrap;">
          <button class="btn-editar-antecedente"
            onclick="abrirEditarAntecedente(${a.id}, '${escapeHtml(a.tipo_antecedente)}', \`${escapeHtml(a.detalle)}\`)">
            ✏️ Editar
          </button>
          <button class="btn-eliminar-antecedente"
            onclick="eliminarAntecedente(${a.id})">
            🗑️
          </button>
        </td>
      </tr>`;
  }).join('');

  contenedor.innerHTML = `
    <table class="tabla-antecedentes">
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Detalle</th>
          <th>Fecha</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`;
}

// ─────────────────────────────────────────────────────────────────────────
// GUARDAR NUEVO ANTECEDENTE
// ─────────────────────────────────────────────────────────────────────────

document.getElementById('btnGuardarAntecedente')?.addEventListener('click', async () => {
  const tipo   = document.getElementById('tipoAntecedenteNuevo').value.trim();
  const detalle = document.getElementById('detalleAntecedenteNuevo').value.trim();

  if (!tipo) {
    alert('⚠️ Seleccione el tipo de antecedente');
    return;
  }
  if (!detalle) {
    alert('⚠️ Escriba el detalle del antecedente');
    return;
  }

  const clienteId = getClienteIdFromURL();
  const btn = document.getElementById('btnGuardarAntecedente');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const res = await fetch(`${API_URL}/${clienteId}/antecedentes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ tipo_antecedente: tipo, detalle })
    });

    if (!res.ok) throw new Error('Error al guardar');

    limpiarFormularioNuevo();
    await cargarAntecedentes();

  } catch (err) {
    console.error('Error guardando antecedente:', err);
    alert('❌ Error al guardar el antecedente');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Guardar Antecedente';
  }
});

function limpiarFormularioNuevo() {
  document.getElementById('tipoAntecedenteNuevo').value = '';
  document.getElementById('detalleAntecedenteNuevo').value = '';
  document.getElementById('charCountAntecedente').textContent = '0';
}

// ─────────────────────────────────────────────────────────────────────────
// EDITAR ANTECEDENTE
// ─────────────────────────────────────────────────────────────────────────

window.abrirEditarAntecedente = function (id, tipo, detalle) {
  document.getElementById('editAntecedenteId').value = id;
  document.getElementById('editTipoAntecedente').value = tipo;
  document.getElementById('editDetalleAntecedente').value = detalle;
  document.getElementById('modalEditarAntecedente').classList.add('show');
};

document.getElementById('btnActualizarAntecedente')?.addEventListener('click', async () => {
  const id      = document.getElementById('editAntecedenteId').value;
  const tipo    = document.getElementById('editTipoAntecedente').value.trim();
  const detalle = document.getElementById('editDetalleAntecedente').value.trim();

  if (!tipo || !detalle) {
    alert('⚠️ Complete todos los campos');
    return;
  }

  const clienteId = getClienteIdFromURL();
  const btn = document.getElementById('btnActualizarAntecedente');
  btn.disabled = true;
  btn.textContent = 'Actualizando...';

  try {
    const res = await fetch(`${API_URL}/${clienteId}/antecedentes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ tipo_antecedente: tipo, detalle })
    });

    if (!res.ok) throw new Error('Error al actualizar');

    cerrarModalEditarAntecedente();
    await cargarAntecedentes();

  } catch (err) {
    console.error('Error actualizando antecedente:', err);
    alert('❌ Error al actualizar el antecedente');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Actualizar';
  }
});

// ─────────────────────────────────────────────────────────────────────────
// ELIMINAR ANTECEDENTE
// ─────────────────────────────────────────────────────────────────────────

window.eliminarAntecedente = async function (id) {
  if (!confirm('¿Está seguro de eliminar este antecedente?')) return;

  const clienteId = getClienteIdFromURL();

  try {
    const res = await fetch(`${API_URL}/${clienteId}/antecedentes/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });

    if (!res.ok) throw new Error('Error al eliminar');

    await cargarAntecedentes();

  } catch (err) {
    console.error('Error eliminando antecedente:', err);
    alert('❌ Error al eliminar el antecedente');
  }
};

// ─────────────────────────────────────────────────────────────────────────
// BOTÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────

document.getElementById('btnAntecedentes')?.addEventListener('click', () => {
  abrirModalAntecedentes();
});

console.log('✅ Módulo consulta-antecedentes.js cargado');