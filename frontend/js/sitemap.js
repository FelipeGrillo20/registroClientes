// js/sitemap.js

document.addEventListener('DOMContentLoaded', function() {
  
  // Agregar funcionalidad de click a cada item de la rueda
  const wheelItems = document.querySelectorAll('.wheel-item');
  
  wheelItems.forEach(item => {
    item.addEventListener('click', function() {
      const url = this.getAttribute('data-url');
      
      if (url) {
        // Animación de salida antes de navegar
        this.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
          window.location.href = url;
        }, 200);
      }
    });

    // Efecto de sonido visual al hacer hover (opcional)
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

  // Efecto parallax suave al mover el mouse (opcional)
  const wheelContainer = document.querySelector('.wheel-container');
  
  if (wheelContainer) {
    document.addEventListener('mousemove', function(e) {
      const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
      const moveY = (e.clientY - window.innerHeight / 2) * 0.01;
      
      wheelContainer.style.transform = `translate(${moveX}px, ${moveY}px)`;
    });
  }

  console.log('✅ Mapa de sitio cargado correctamente');
});