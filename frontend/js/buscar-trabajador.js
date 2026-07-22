// frontend/js/buscar-trabajador.js
// Pantalla posterior al login: buscar un trabajador ya registrado (en
// cualquier modalidad) por cédula, o ir a registrar uno nuevo.

document.addEventListener('DOMContentLoaded', () => {

  const API_URL = window.API_CONFIG?.ENDPOINTS?.CLIENTS || 'http://localhost:5000/api/clients';

  function getToken() {
    return (typeof window.getAuthToken === 'function')
      ? window.getAuthToken()
      : localStorage.getItem('authToken');
  }

  const form            = document.getElementById('formBuscarCedula');
  const cedulaInput      = document.getElementById('cedulaBuscar');
  const btnBuscar        = document.getElementById('btnBuscar');
  const mensajeEl        = document.getElementById('buscarMensaje');
  const modalidadesInfoEl = document.getElementById('buscarModalidadesInfo');
  const btnRegistrar     = document.getElementById('btnRegistrarTrabajador');
  const cardRegistrar    = document.getElementById('btnRegistrarTrabajador')?.closest('.buscar-card');
  const btnSeleccionarModalidad = document.getElementById('btnSeleccionarModalidad');

  let mensajeTimeoutId = null;

  function mostrarMensaje(texto, tipo) {
    if (mensajeTimeoutId) {
      clearTimeout(mensajeTimeoutId);
      mensajeTimeoutId = null;
    }
    mensajeEl.textContent = texto;
    mensajeEl.className = `buscar-mensaje ${tipo ? 'mensaje-' + tipo : ''}`;
  }

  // Arma "la modalidad X" / "las modalidades X y Y" / "las modalidades X, Y y Z"
  function mostrarModalidadesRegistradas(modalidades) {
    if (!modalidadesInfoEl) return;
    if (!modalidades || modalidades.length === 0) {
      modalidadesInfoEl.textContent = '';
      return;
    }
    const esPlural = modalidades.length > 1;
    const listado = esPlural
      ? `${modalidades.slice(0, -1).join(', ')} y ${modalidades[modalidades.length - 1]}`
      : modalidades[0];
    modalidadesInfoEl.textContent = `📌 Registrado en ${esPlural ? 'las modalidades' : 'la modalidad'} ${listado}`;
  }

  function resaltarRegistrar() {
    if (!cardRegistrar) return;
    cardRegistrar.classList.remove('resaltar');
    // Forzar reflow para poder re-disparar la animación si ya se aplicó antes
    void cardRegistrar.offsetWidth;
    cardRegistrar.classList.add('resaltar');
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const cedula = cedulaInput.value.trim();

    if (!cedula) {
      mostrarMensaje('⚠️ Ingresa una cédula para buscar', 'error');
      return;
    }
    if (!/^\d+$/.test(cedula)) {
      mostrarMensaje('⚠️ La cédula debe contener solo números', 'error');
      return;
    }

    btnBuscar.disabled = true;
    btnBuscar.textContent = 'Buscando...';
    mostrarMensaje('', '');
    mostrarModalidadesRegistradas([]);

    try {
      const res = await fetch(`${API_URL}/buscar-cedula/${encodeURIComponent(cedula)}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (!res.ok) {
        throw new Error('Error al buscar en el servidor');
      }

      const data = await res.json();

      if (data.existe) {
        mostrarMensaje(`✅ Trabajador encontrado: ${data.cliente.nombre}. Redirigiendo...`, 'ok');
        mostrarModalidadesRegistradas(data.modalidades || []);
        // Marca que este paso a modalidad.html viene de una cédula encontrada,
        // para que allí decida por tarjeta: si el trabajador ya está
        // registrado en esa modalidad va a clientes.html, si no a index.html.
        sessionStorage.setItem('origenBusqueda', 'cedula');
        // Modalidades en las que este trabajador YA tiene registro — usado
        // en modalidad.html para saber a dónde redirigir según la tarjeta
        // que se elija.
        sessionStorage.setItem('modalidadesRegistradas', JSON.stringify(data.modalidades || []));
        // Dar 3 segundos para que alcance a leer el mensaje antes de continuar.
        setTimeout(() => {
          window.location.href = 'modalidad.html';
        }, 3000);
      } else {
        mostrarMensaje('❌ No se encontró ningún trabajador con esa cédula. Puedes registrarlo abajo.', 'error');
        resaltarRegistrar();
        // Ocultar el mensaje de error a los 3 segundos.
        mensajeTimeoutId = setTimeout(() => {
          mostrarMensaje('', '');
        }, 3000);
      }
    } catch (err) {
      console.error('Error buscando trabajador:', err);
      mostrarMensaje('❌ Error de conexión al buscar el trabajador', 'error');
    } finally {
      btnBuscar.disabled = false;
      btnBuscar.textContent = 'Buscar';
    }
  });

  btnRegistrar?.addEventListener('click', () => {
    // Va directo al formulario de registro; la modalidad se elige después
    // desde el propio formulario ("🔄 Seleccionar Modalidad").
    sessionStorage.removeItem('origenBusqueda');
    sessionStorage.removeItem('modalidadesRegistradas');
    window.location.href = 'index.html';
  });

  btnSeleccionarModalidad?.addEventListener('click', () => {
    // El profesional solo quiere revisar sus trabajadores ya registrados
    // (sin una cédula puntual) — modalidad.html manda directo a
    // clientes.html sin importar la tarjeta elegida.
    sessionStorage.setItem('origenBusqueda', 'revisar');
    sessionStorage.removeItem('modalidadesRegistradas');
    window.location.href = 'modalidad.html';
  });

});
