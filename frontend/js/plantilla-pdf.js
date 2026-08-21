// frontend/js/plantilla-pdf.js
// Construcción de la plantilla PDF de Entrega Individual de Resultados.
// Extraído de entrega-resultados.js para poder reutilizarlo también en el
// descargue masivo de dashboard-entrega.html, sin duplicar la lógica de
// dibujo del PDF (jsPDF) ni el parser de texto enriquecido del editor.
//
// Requiere que jsPDF (window.jspdf) ya esté cargado en la página.
window.PlantillaPDF = (function () {
  'use strict';

  function formatearFecha(isoDate) {
    if (!isoDate) return '—';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  }

  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  // ============================================================
  // LOGO — se precarga una vez y se reutiliza en todos los PDF
  // ============================================================
  let logoBase64  = null;
  let logoPromise = null;

  function precargarLogo() {
    if (logoPromise) return logoPromise;
    logoPromise = (async () => {
      try {
        const res = await fetch('img/logo/stconsultores.png');
        const esImagen = res.ok && (res.headers.get('content-type') || '').startsWith('image/');
        if (esImagen) {
          const blob = await res.blob();
          logoBase64 = await blobToBase64(blob);
        } else {
          console.warn('Logo no encontrado o inválido');
        }
      } catch (err) {
        console.warn('Logo no encontrado:', err);
      }
    })();
    return logoPromise;
  }

  // ============================================================
  // FIRMA — cacheada por cédula del profesional que firma el documento
  // ============================================================
  const firmaCache = {};
  async function obtenerFirmaBase64(cedula) {
    if (!cedula) return null;
    if (Object.prototype.hasOwnProperty.call(firmaCache, cedula)) return firmaCache[cedula];
    try {
      const res = await fetch(`img/firmas/firma_${cedula}.png`);
      // Algunos servidores devuelven 200 con una página HTML de fallback
      // en vez de un 404 real cuando el archivo no existe — por eso no basta
      // con revisar res.ok, también hay que confirmar que el contenido sea
      // realmente una imagen antes de usarlo (si no, jsPDF truena al armar el PDF).
      const esImagen = res.ok && (res.headers.get('content-type') || '').startsWith('image/');
      if (esImagen) {
        const blob = await res.blob();
        firmaCache[cedula] = await blobToBase64(blob);
      } else {
        console.warn(`Firma no encontrada o inválida para cédula: ${cedula}`);
        firmaCache[cedula] = null;
      }
    } catch (err) {
      console.warn('Error al cargar firma:', err);
      firmaCache[cedula] = null;
    }
    return firmaCache[cedula];
  }

  // ============================================================
  // RENDER DE TEXTO ENRIQUECIDO (HTML del editor → jsPDF)
  // ============================================================
  const PDF_FONT_SIZE = 11;
  const PDF_LINE_H    = 6.5;
  const PDF_BLANK_H   = 5.5;
  const PDF_COLOR     = [50, 50, 50];

  function construirMapaSegmentos(segmentos) {
    const mapa = [];
    segmentos.forEach(seg => {
      for (let i = 0; i < seg.texto.length; i++) mapa.push(seg);
    });
    return mapa;
  }

  function detectarAlign(nodo) {
    // Subir hasta 4 niveles buscando text-align explícito
    let el = nodo;
    for (let i = 0; i < 4 && el; i++) {
      if (el.style && el.style.textAlign) return el.style.textAlign;
      if (el.getAttribute && el.getAttribute('align')) return el.getAttribute('align');
      el = el.parentElement;
    }
    // Buscar también en hijos directos
    if (nodo.children) {
      for (const hijo of nodo.children) {
        if (hijo.style && hijo.style.textAlign) return hijo.style.textAlign;
        if (hijo.getAttribute && hijo.getAttribute('align')) return hijo.getAttribute('align');
      }
    }
    // Sin alineación explícita en el editor: justificado por defecto
    return 'justify';
  }

  function extraerSegmentosInline(el, fmtPadre) {
    const segs = [];
    function recorrer(nodo, fmt) {
      if (nodo.nodeType === Node.TEXT_NODE) {
        const t = nodo.textContent;
        if (t) segs.push({ ...fmt, texto: t });
        return;
      }
      if (nodo.nodeType !== Node.ELEMENT_NODE) return;
      const tag = nodo.tagName.toLowerCase();
      if (tag === 'br') { segs.push({ ...fmt, texto: ' ' }); return; }
      const est = nodo.style;
      const bold      = fmt.bold      || tag === 'b' || tag === 'strong' || est.fontWeight === 'bold';
      const italic    = fmt.italic    || tag === 'i' || tag === 'em'     || est.fontStyle === 'italic';
      const underline = fmt.underline || tag === 'u' || (est.textDecoration && est.textDecoration.includes('underline'));
      nodo.childNodes.forEach(hijo => recorrer(hijo, { bold, italic, underline }));
    }
    recorrer(el, fmtPadre);
    return segs;
  }

  function extraerParrafos(editorEl) {
    const resultado = [];

    function procesarNodo(nodo, fmtPadre) {
      if (nodo.nodeType === Node.TEXT_NODE) {
        const txt = nodo.textContent;
        if (txt) resultado.push({ texto: txt, align: 'justify', segmentos: [{ ...fmtPadre, texto: txt }], esBr: false, esLista: false });
        return;
      }
      if (nodo.nodeType !== Node.ELEMENT_NODE) return;

      const tag = nodo.tagName.toLowerCase();

      if (tag === 'br') { resultado.push({ esBr: true, texto: '' }); return; }

      if (tag === 'ul' || tag === 'ol') {
        let contador = 1;
        nodo.querySelectorAll(':scope > li').forEach(li => {
          const viñeta = tag === 'ol' ? `${contador++}.` : '•';
          const segs   = extraerSegmentosInline(li, { bold: false, italic: false, underline: false });
          // Buscar alineación en li, luego en ol/ul, luego en el contenedor padre
          const align  = detectarAlign(li) || detectarAlign(nodo) || 'left';
          resultado.push({
            esLista: true,
            viñeta,
            texto:    segs.map(s => s.texto).join(''),
            segmentos: segs,
            align
          });
        });
        return;
      }

      if (['div','p','h1','h2','h3','h4','h5','h6'].includes(tag)) {
        // Si el div contiene una lista anidada, procesarla directamente
        const listaAnidada = nodo.querySelector('ul, ol');
        if (listaAnidada) {
          // Procesar los hijos para llegar a la lista
          nodo.childNodes.forEach(hijo => procesarNodo(hijo, fmtPadre));
          return;
        }

        const align = detectarAlign(nodo);
        const textoPlano = nodo.innerText || nodo.textContent || '';
        if (!textoPlano.trim()) { resultado.push({ esBr: true, texto: '' }); return; }
        const segs = extraerSegmentosInline(nodo, { bold: false, italic: false, underline: false });
        resultado.push({ texto: segs.map(s => s.texto).join(''), align, segmentos: segs, esBr: false, esLista: false });
        return;
      }

      nodo.childNodes.forEach(hijo => procesarNodo(hijo, fmtPadre));
    }

    editorEl.childNodes.forEach(n => procesarNodo(n, { bold: false, italic: false, underline: false }));
    return resultado;
  }

  function renderParrafoPDF(doc, par, marginL, y, contentW, pageH, resetFont, nuevaPagina) {
    const textoCompleto = par.segmentos.map(s => s.texto).join('');
    if (!textoCompleto.trim()) return y;

    resetFont(false, false);
    const lineas = doc.splitTextToSize(textoCompleto, contentW);
    const align  = par.align || 'left';
    const mapaSegmentos = construirMapaSegmentos(par.segmentos);
    let charGlobal = 0;

    lineas.forEach((lineaTexto, lineaIdx) => {
      nuevaPagina();
      const esUltima = lineaIdx === lineas.length - 1;

      resetFont(false, false);
      const anchoLinea = doc.getTextWidth(lineaTexto);
      let xBase = marginL;
      if (align === 'center') xBase = marginL + (contentW - anchoLinea) / 2;
      else if (align === 'right') xBase = marginL + contentW - anchoLinea;

      const palabras = lineaTexto.split(' ');
      let espacioExtra = 0;
      if (align === 'justify' && !esUltima && palabras.length > 1) {
        espacioExtra = (contentW - doc.getTextWidth(lineaTexto)) / (palabras.length - 1);
        xBase = marginL;
      }

      let xActual = xBase;
      palabras.forEach((palabra) => {
        const seg       = mapaSegmentos[Math.min(charGlobal, mapaSegmentos.length - 1)] || {};
        const bold      = !!seg.bold;
        const italic    = !!seg.italic;
        const underline = !!seg.underline;

        resetFont(bold, italic);
        doc.text(palabra, xActual, y);

        if (underline) {
          const w = doc.getTextWidth(palabra);
          doc.setDrawColor(...PDF_COLOR);
          doc.setLineWidth(0.3);
          doc.line(xActual, y + 0.9, xActual + w, y + 0.9);
        }

        xActual    += doc.getTextWidth(palabra) + doc.getTextWidth(' ') + espacioExtra;
        charGlobal += palabra.length + 1;
      });

      y += PDF_LINE_H;
    });

    resetFont(false, false);
    return y;
  }

  function renderHTMLenPDF(doc, editorEl, marginL, yStart, contentW, pageH) {
    let y = yStart;

    function resetFont(bold, italic) {
      const style = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
      doc.setFont('helvetica', style);
      doc.setFontSize(PDF_FONT_SIZE);
      doc.setTextColor(...PDF_COLOR);
    }

    function nuevaPaginaSiNecesario() {
      if (y > pageH - 55) { doc.addPage(); y = 25; }
    }

    const parrafos = extraerParrafos(editorEl);

    parrafos.forEach(par => {
      nuevaPaginaSiNecesario();

      if (par.esBr || par.texto.trim() === '') {
        y += PDF_BLANK_H;
        return;
      }

      if (par.esLista) {
        const sangria    = 8;
        const anchoTexto = contentW - sangria;
        resetFont(false, false);

        // Pintar viñeta
        doc.text(par.viñeta, marginL, y);

        // Renderizar texto con la misma lógica de justificado que los párrafos normales
        const lineas = doc.splitTextToSize(par.texto.trim(), anchoTexto);
        const align  = par.align || 'justify';

        lineas.forEach((lineaTexto, lineaIdx) => {
          nuevaPaginaSiNecesario();
          const esUltima = lineaIdx === lineas.length - 1;
          const palabras = lineaTexto.split(' ');
          let xActual    = marginL + sangria;
          let espacioExtra = 0;

          if (align === 'justify' && !esUltima && palabras.length > 1) {
            resetFont(false, false);
            const anchoLinea = doc.getTextWidth(lineaTexto);
            espacioExtra = (anchoTexto - anchoLinea) / (palabras.length - 1);
          }

          const mapaSegs = construirMapaSegmentos(par.segmentos);
          let charGlobal = 0;
          palabras.forEach((palabra) => {
            const seg       = mapaSegs[Math.min(charGlobal, mapaSegs.length - 1)] || {};
            const bold      = !!seg.bold;
            const italic    = !!seg.italic;
            const underline = !!seg.underline;
            const style = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
            doc.setFont('helvetica', style);
            doc.setFontSize(PDF_FONT_SIZE);
            doc.setTextColor(...PDF_COLOR);
            doc.text(palabra, xActual, y);
            if (underline) {
              const w = doc.getTextWidth(palabra);
              doc.setDrawColor(...PDF_COLOR);
              doc.setLineWidth(0.3);
              doc.line(xActual, y + 0.9, xActual + w, y + 0.9);
            }
            xActual    += doc.getTextWidth(palabra) + doc.getTextWidth(' ') + espacioExtra;
            charGlobal += palabra.length + 1;
          });

          y += PDF_LINE_H;
        });
        return;
      }

      y = renderParrafoPDF(doc, par, marginL, y, contentW, pageH, resetFont, nuevaPaginaSiNecesario);
    });

    return y;
  }

  // ============================================================
  // CONSTRUCCIÓN DEL DOCUMENTO — punto de entrada público
  // ============================================================
  // datos: {
  //   trabajadorNombre, fechaRetroalimentacion (YYYY-MM-DD), tituloSeccion,
  //   recomendacionesHtml (string HTML), pruebasProfundidad,
  //   profesional: { nombre, licencia, telefono }, firmaBase64
  // }
  // Devuelve la instancia jsPDF ya construida (sin guardar ni abrir) — el
  // llamador decide qué hacer con ella (doc.save(), doc.output('blob'), etc.)
  function construirDocumentoPDF(datos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const profesional = datos.profesional || {};

    const pageW   = doc.internal.pageSize.getWidth();
    const pageH   = doc.internal.pageSize.getHeight();
    const marginL = 25;
    const marginR = 25;
    const contentW = pageW - marginL - marginR;

    // Logo superior derecho
    if (logoBase64) {
      const logoAncho = 45;
      const logoAlto  = 18;
      doc.addImage(logoBase64, 'PNG', pageW - marginR - logoAncho, 8, logoAncho, logoAlto);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(26, 60, 110);
      doc.text('St Consultores', pageW - marginR, 18, { align: 'right' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('SALUD Y SEGURIDAD EN EL TRABAJO', pageW - marginR, 22, { align: 'right' });
    }
    doc.setDrawColor(220, 220, 230);
    doc.setLineWidth(0.4);
    doc.line(marginL, 27, pageW - marginR, 27);

    // Datos del trabajador
    let y = 38;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text(`Nombre: ${datos.trabajadorNombre || ''}`, marginL, y);
    y += 7;

    const fecRetro = datos.fechaRetroalimentacion ? formatearFecha(datos.fechaRetroalimentacion) : '_______________';
    doc.text(`Fecha de retroalimentación: ${fecRetro}`, marginL, y);
    y += 18;

    // Título de sección (con wrap por si el texto es largo)
    const titulo = (datos.tituloSeccion || '').trim() || 'RESULTADO INDIVIDUAL DEL DIAGNOSTICO DE RIESGO PSICOSOCIAL';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    const tituloLineas = doc.splitTextToSize(titulo, contentW);
    tituloLineas.forEach((linea, idx) => {
      doc.text(linea, marginL, y);
      if (idx === tituloLineas.length - 1) {
        const anchoLinea = doc.getTextWidth(linea);
        doc.setDrawColor(40, 40, 40);
        doc.setLineWidth(0.4);
        doc.line(marginL, y + 1.5, marginL + anchoLinea, y + 1.5);
      }
      y += 6;
    });
    y += 4;

    // Descripción de los Hallazgos
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    const recomendacionesHtml = (datos.recomendacionesHtml || '').trim();
    if (recomendacionesHtml) {
      // El parser necesita un elemento DOM real, pero no hace falta que esté
      // visible en la página — un div desconectado funciona igual.
      const tmp = document.createElement('div');
      tmp.innerHTML = recomendacionesHtml;
      y = renderHTMLenPDF(doc, tmp, marginL, y, contentW, pageH) + 10;
    } else {
      y += 10;
    }

    // Pruebas a profundidad
    if (y > pageH - 55) { doc.addPage(); y = 25; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('PRUEBAS A PROFUNDIDAD', marginL, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text(datos.pruebasProfundidad || 'No asistio', marginL, y);
    y += 10;

    // Firma — imagen o línea de fallback
    if (y > pageH - 55) { doc.addPage(); y = 30; }
    y += 10;

    if (datos.firmaBase64) {
      doc.addImage(datos.firmaBase64, 'PNG', marginL, y, 50, 20);
      y += 22;
    } else {
      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(0.5);
      doc.line(marginL, y, marginL + 65, y);
      y += 6;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 30, 30);
    doc.text(profesional.nombre || '', marginL, y);
    y += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text('Psicóloga Especialista en Seguridad y Salud en el Trabajo', marginL, y);
    y += 5.5;
    if (profesional.licencia) {
      doc.text(`Licencia N. ${profesional.licencia}`, marginL, y);
      y += 5.5;
    }
    if (profesional.telefono) {
      doc.text(`Tel: ${profesional.telefono}`, marginL, y);
    }

    return doc;
  }

  return {
    formatearFecha,
    precargarLogo,
    obtenerFirmaBase64,
    construirDocumentoPDF,
  };
})();
