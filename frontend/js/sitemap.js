// js/sitemap.js

document.addEventListener('DOMContentLoaded', function() {
  
  // Agregar funcionalidad de click a cada item de la rueda
  const wheelItems = document.querySelectorAll('.wheel-item');
  
  wheelItems.forEach(item => {
    item.addEventListener('click', function() {
      const url = this.getAttribute('data-url');
      const modalidad = this.getAttribute('data-modalidad');
      
      // ✅ Si tiene atributo data-modalidad, guardar y redirigir a index.html
      if (modalidad) {
        console.log('🔄 Seleccionando modalidad:', modalidad);
        
        // Guardar modalidad en localStorage
        localStorage.setItem('modalidadSeleccionada', modalidad);
        
        // Animación de salida
        this.style.transform = 'scale(0.9)';
        
        // Mostrar feedback visual
        const itemContent = this.querySelector('.wheel-item-content');
        if (itemContent) {
          itemContent.style.transform = 'scale(1.1)';
          itemContent.style.borderWidth = '6px';
        }
        
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 300);
        
        return;
      }
      
      // ✅ Si tiene URL normal, navegar directamente
      if (url) {
        // Animación de salida antes de navegar
        this.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
          window.location.href = url;
        }, 200);
      }
    });

    // Efecto de sonido visual al hacer hover
    item.addEventListener('mouseenter', function() {
      this.style.transition = 'all 0.3s ease';
    });

    item.addEventListener('mouseleave', function() {
      this.style.transition = 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    });
  });

  // Animación del centro al hacer click
  const wheelCenter = document.querySelector('.wheel-center');
  
  if (wheelCenter) {
    wheelCenter.addEventListener('click', function() {
      this.style.transform = 'translate(-50%, -50%) scale(0.95)';
      
      setTimeout(() => {
        this.style.transform = 'translate(-50%, -50%) scale(1)';
      }, 200);
    });
  }

  // Efecto parallax suave al mover el mouse
  const wheelContainer = document.querySelector('.wheel-container');
  
  if (wheelContainer) {
    document.addEventListener('mousemove', function(e) {
      const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
      const moveY = (e.clientY - window.innerHeight / 2) * 0.01;
      
      wheelContainer.style.transform = `translate(${moveX}px, ${moveY}px)`;
    });
  }

  // ✅ Mostrar en consola la modalidad actual seleccionada
  const modalidadActual = localStorage.getItem('modalidadSeleccionada');
  if (modalidadActual) {
    console.log('✅ Modalidad actual:', modalidadActual);
  } else {
    console.log('ℹ️ No hay modalidad seleccionada');
  }

  console.log('✅ Mapa de sitio cargado correctamente');
});

// 📐 Distribución automática en círculo
const wheelContainer = document.querySelector('.wheel-container');
const items = document.querySelectorAll('.wheel-item');

const totalItems = items.length;
const radius = 275; // distancia desde el centro (ajustable)
const centerX = wheelContainer.offsetWidth / 2;
const centerY = wheelContainer.offsetHeight / 2;

items.forEach((item, index) => {
  const angle = (2 * Math.PI / totalItems) * index - Math.PI / 2;

  const x = centerX + radius * Math.cos(angle);
  const y = centerY + radius * Math.sin(angle);

  item.style.left = `${x}px`;
  item.style.top = `${y}px`;
  item.style.transform = 'translate(-50%, -50%)';
});
